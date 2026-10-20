// SQL Studio: puts one or two small, realistic mistakes into a correct random query, for "fix the SQL" practice.
// Every mistake is checked: on its own, and together, the broken query either errors or gives different rows.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const X = isNode ? Object.assign({}, require('./sql-text.js'), require('./check.js'), require('./randomq.js')) : root.SS;

  // ---- helpers over the formatted SQL the generator writes ----
  const HEADS = ['SELECT', 'FROM', 'WHERE', 'GROUP', 'HAVING', 'ORDER', 'LIMIT'];
  const up = t => (t && t.type === 'word' ? t.text.toUpperCase() : '');

  function context(sql, schema, rng) {
    const tk = X.tokenize(sql).filter(t => t.type !== 'ws' && t.type !== 'comment');
    // Clause heads at depth 0, in order: { head, index }
    const heads = [];
    let depth = 0;
    tk.forEach((t, i) => {
      if (t.text === '(') depth++;
      if (t.text === ')') depth--;
      if (depth === 0 && HEADS.includes(up(t))) heads.push({ head: up(t), index: i });
    });
    const region = head => {
      const k = heads.findIndex(h => h.head === head);
      if (k === -1) return null;
      return { from: heads[k].index, to: k + 1 < heads.length ? heads[k + 1].index : tk.length };
    };
    const tableNames = schema.tables.map(t => t.name);
    const aliases = X.aliasMap(sql, tableNames);
    const fromRegion = region('FROM');
    const firstTable = fromRegion ? aliases.get(String(tk[fromRegion.from + 1] && tk[fromRegion.from + 1].text).toLowerCase()) : null;
    const allColumns = new Set(schema.tables.flatMap(t => t.columns.map(c => c.name)));
    // The table a column token belongs to (via its alias, or the only/first table that has it).
    const tableOf = i => {
      if (tk[i - 1] && tk[i - 1].text === '.' && tk[i - 2]) return aliases.get(tk[i - 2].text.toLowerCase()) || null;
      const t = schema.tables.find(x => x.name === firstTable && x.columns.some(c => c.name === tk[i].text));
      return t ? t.name : (schema.tables.find(x => x.columns.some(c => c.name === tk[i].text)) || {}).name || null;
    };
    const tableObj = name => schema.tables.find(t => t.name === name);
    const pick = arr => (arr.length ? arr[Math.floor(rng() * arr.length)] : null);
    return { sql, tk, schema, region, aliases, allColumns, tableOf, tableObj, pick };
  }

  const edit = (start, end, text) => ({ start, end, text });
  const replaceTok = (t, text) => edit(t.start, t.end, text);
  const lineStart = (sql, pos) => sql.lastIndexOf('\n', pos - 1) + 1;
  const lineEnd = (sql, pos) => { const n = sql.indexOf('\n', pos); return n === -1 ? sql.length : n; };
  // Removes the whole line holding [from, to): the line and its newline (or the newline before it, if it's the last line).
  function removeLines(sql, from, to) {
    const s = lineStart(sql, from);
    const e = lineEnd(sql, to);
    return e < sql.length ? edit(s, e + 1, '') : edit(Math.max(0, s - 1), e, '');
  }

  // Column-name tokens inside a token range (not function names, not AS aliases, not table aliases).
  function columnTokens(ctx, range) {
    const out = [];
    for (let i = range.from + 1; i < range.to; i++) {
      const t = ctx.tk[i];
      if (t.type !== 'word' || !ctx.allColumns.has(t.text)) continue;
      if (ctx.tk[i + 1] && (ctx.tk[i + 1].text === '(' || ctx.tk[i + 1].text === '.')) continue;
      if (up(ctx.tk[i - 1]) === 'AS') continue;
      out.push(i);
    }
    return out;
  }
  const inRanges = (ctx, heads) => heads.map(h => ctx.region(h)).filter(Boolean);
  const stringsIn = (ctx, heads) => inRanges(ctx, heads).flatMap(r => ctx.tk.slice(r.from, r.to).filter(t => t.type === 'string'));
  const isDateLit = t => /^'\d{4}-\d{2}-\d{2}'$/.test(t.text);
  const afterLike = (ctx, t) => up(ctx.tk[ctx.tk.indexOf(t) - 1]) === 'LIKE';
  const hasAggregate = ctx => { const r = ctx.region('SELECT'); return !!r && ctx.tk.slice(r.from, r.to).some((t, k, a) => /^(COUNT|SUM|AVG|MIN|MAX)$/i.test(t.text) && a[k + 1] && a[k + 1].text === '('); };

  const TYPOS = { SELECT: 'SELCT', FROM: 'FORM', WHERE: 'WHRE', GROUP: 'GRUOP', ORDER: 'ODER', JOIN: 'JION', HAVING: 'HAVIGN', BETWEEN: 'BETWEN' };

  // Each mistake: find(ctx) returns a list of edits, or null when it doesn't fit this query.
  const MISTAKES = [
    { id: 'quotes', kind: 'error', label: 'Text without quotes', find(ctx) {
      const t = ctx.pick(stringsIn(ctx, ['WHERE', 'HAVING']).filter(s => !isDateLit(s) && !afterLike(ctx, s)));
      return t && [replaceTok(t, t.text.slice(1, -1).replace(/''/g, "'"))];
    } },
    { id: 'date-quotes', kind: 'wrong-rows', label: 'A date without quotes', find(ctx) {
      const t = ctx.pick(stringsIn(ctx, ['WHERE', 'HAVING']).filter(isDateLit));
      return t && [replaceTok(t, t.text.slice(1, -1))];
    } },
    { id: 'keyword', kind: 'error', label: 'A misspelled keyword', find(ctx) {
      const t = ctx.pick(ctx.tk.filter(x => TYPOS[up(x)]));
      return t && [replaceTok(t, TYPOS[up(t)])];
    } },
    { id: 'column-typo', kind: 'error', label: 'A misspelled column name', find(ctx) {
      const r = ctx.region('SELECT');
      const i = r && ctx.pick(columnTokens(ctx, r).filter(k => ctx.tk[k].text.length >= 4));
      if (i === null || i === undefined) return null;
      const name = ctx.tk[i].text;
      const spots = [];
      for (let p = 1; p < name.length - 2; p++) {
        const typo = name.slice(0, p) + name[p + 1] + name[p] + name.slice(p + 2);
        if (typo !== name && !ctx.allColumns.has(typo)) spots.push(typo);
      }
      const typo = ctx.pick(spots);
      return typo && [replaceTok(ctx.tk[i], typo)];
    } },
    { id: 'missing-comma', kind: 'error', label: 'A missing comma between columns', find(ctx) {
      const r = ctx.region('SELECT');
      if (!r) return null;
      let depth = 0;
      const commas = [];
      for (let i = r.from + 1; i < r.to; i++) {
        const t = ctx.tk[i];
        if (t.text === '(') depth++;
        if (t.text === ')') depth--;
        if (depth === 0 && t.type === 'punct' && t.text === ',') commas.push(t);
      }
      const c = ctx.pick(commas);
      return c && [replaceTok(c, '')];
    } },
    { id: 'extra-comma', kind: 'error', label: 'An extra comma before FROM', find(ctx) {
      const r = ctx.region('SELECT');
      if (!r || r.to >= ctx.tk.length) return null;
      const last = ctx.tk[r.to - 1];
      return [edit(last.end, last.end, ',')];
    } },
    { id: 'missing-paren', kind: 'error', label: 'A missing closing parenthesis', find(ctx) {
      const r = ctx.region('SELECT');
      if (!r) return null;
      const closers = [];
      let depth = 0;
      for (let i = r.from + 1; i < r.to; i++) {
        const t = ctx.tk[i];
        if (t.text === '(') depth++;
        if (t.text === ')' && --depth === 0) closers.push(t);
      }
      const c = closers[0];
      return c ? [replaceTok(c, '')] : null;
    } },
    { id: 'where-aggregate', kind: 'error', label: 'A total or count in WHERE instead of HAVING', find(ctx) {
      const h = ctx.region('HAVING');
      if (!h) return null;
      const condStart = ctx.tk[h.from + 1].start;
      const condEnd = ctx.tk[h.to - 1].end;
      const cond = ctx.sql.slice(condStart, condEnd);
      const w = ctx.region('WHERE');
      const g = ctx.region('GROUP');
      const insertAt = w ? ctx.tk[w.to - 1].end : ctx.tk[g ? g.from : h.from].start - 1;
      const text = w ? `\n  AND ${cond}` : `\nWHERE ${cond}`;
      return [edit(insertAt, insertAt, text), removeLines(ctx.sql, ctx.tk[h.from].start, condEnd)];
    } },
    { id: 'null-equals', kind: 'wrong-rows', label: '= NULL instead of IS NULL', find(ctx) {
      const spots = ctx.tk.map((t, i) => i).filter(i => up(ctx.tk[i]) === 'IS');
      const i = ctx.pick(spots);
      if (i === null || i === undefined) return null;
      const not = up(ctx.tk[i + 1]) === 'NOT';
      return [edit(ctx.tk[i].start, ctx.tk[not ? i + 1 : i].end, not ? '<>' : '=')];
    } },
    { id: 'missing-group-by', kind: 'wrong-rows', label: 'A missing GROUP BY', find(ctx) {
      const g = ctx.region('GROUP');
      if (!g || !hasAggregate(ctx)) return null;
      return [removeLines(ctx.sql, ctx.tk[g.from].start, ctx.tk[g.to - 1].end)];
    } },
    { id: 'like-no-wildcard', kind: 'wrong-rows', label: 'LIKE without %', find(ctx) {
      const t = ctx.pick(ctx.tk.filter((x, i) => x.type === 'string' && up(ctx.tk[i - 1]) === 'LIKE' && x.text.includes('%') && x.text.replace(/%/g, '') !== "''"));
      return t && [replaceTok(t, t.text.replace(/%/g, ''))];
    } },
    { id: 'and-or', kind: 'wrong-rows', label: 'AND and OR mixed up', find(ctx) {
      const w = ctx.region('WHERE');
      if (!w) return null;
      const joiners = [];
      let depth = 0;
      let between = false;
      for (let i = w.from + 1; i < w.to; i++) {
        const t = ctx.tk[i];
        if (t.text === '(') depth++;
        if (t.text === ')') depth--;
        if (depth) continue;
        if (up(t) === 'BETWEEN') between = true;
        else if (up(t) === 'AND' && between) between = false;
        else if (up(t) === 'AND' || up(t) === 'OR') joiners.push(t);
      }
      const j = ctx.pick(joiners);
      return j && [replaceTok(j, up(j) === 'AND' ? 'OR' : 'AND')];
    } },
    { id: 'wrong-join', kind: 'wrong-rows', label: 'A join on the wrong column', find(ctx) {
      const spots = [];
      // The generator writes joins as: ON a.x = b.y — change b.y to another column of b's table.
      ctx.tk.forEach((t, i) => {
        if (up(t) !== 'ON' || !ctx.tk[i + 7] || ctx.tk[i + 4].text !== '=' || ctx.tk[i + 6].text !== '.') return;
        const rightCol = ctx.tk[i + 7];
        const table = ctx.tableObj(ctx.aliases.get(ctx.tk[i + 5].text.toLowerCase()));
        const current = table && table.columns.find(c => c.name === rightCol.text);
        if (!current) return;
        const pk = table.columns.find(c => c.pk);
        const other = pk && pk.name !== current.name && pk.type === current.type ? pk
          : table.columns.find(c => c.name !== current.name && c.type === current.type);
        if (other) spots.push(replaceTok(rightCol, other.name));
      });
      const e = ctx.pick(spots);
      return e && [e];
    } },
    { id: 'sort-direction', kind: 'wrong-rows', label: 'Sorted the wrong way', find(ctx) {
      const o = ctx.region('ORDER');
      if (!o) return null;
      const last = ctx.tk[o.to - 1];
      if (up(last) === 'DESC') return [edit(ctx.tk[o.to - 2].end, last.end, '')];
      return [edit(last.end, last.end, ' DESC')];
    } },
    { id: 'wrong-column', kind: 'wrong-rows', label: 'The wrong column', find(ctx) {
      const r = ctx.region('SELECT');
      if (!r) return null;
      const g = ctx.region('GROUP');
      const grouped = new Set(g ? ctx.tk.slice(g.from, g.to).map(t => t.text) : []);
      const selected = new Set(ctx.tk.slice(r.from, r.to).map(t => t.text));
      const spots = [];
      for (const i of columnTokens(ctx, r)) {
        const name = ctx.tk[i].text;
        if (grouped.has(name)) continue;
        const table = ctx.tableObj(ctx.tableOf(i));
        if (!table) continue;
        const me = table.columns.find(c => c.name === name);
        if (!me) continue;
        for (const c of table.columns) {
          if (c.name !== name && c.type === me.type && !c.pk && !c.fk && !selected.has(c.name)) spots.push(replaceTok(ctx.tk[i], c.name));
        }
      }
      const e = ctx.pick(spots);
      return e && [e];
    } },
  ];

  function applyEdits(sql, edits) {
    return [...edits].sort((a, b) => b.start - a.start).reduce((s, e) => s.slice(0, e.start) + e.text + s.slice(e.end), sql);
  }
  const overlaps = (a, b) => a.some(x => b.some(y => x.start <= y.end && y.start <= x.end));

  // For tests and one-off use: one mistake, chosen spot decided by `seed`. Returns the new SQL or null.
  function applyMistake(id, sql, schema, seed = 1) {
    const m = MISTAKES.find(x => x.id === id);
    const edits = m.find(context(sql, schema, X.mulberry32(seed)));
    return edits ? applyEdits(sql, edits) : null;
  }

  function mistakeHeader(question, count, width = 78) {
    const words = `Question: ${question}`.split(/\s+/);
    const lines = [];
    let line = '--';
    for (const w of words) {
      if (line.length + 1 + w.length > width && line !== '--') { lines.push(line); line = '--'; }
      line += ` ${w}`;
    }
    lines.push(line);
    lines.push(count === 1 ? '-- This query has 1 mistake. Fix it and check the result.' : `-- This query has ${count} mistakes. Fix them and check the result.`);
    return lines.join('\n');
  }

  const stripSemi = s => s.replace(/;\s*$/, '');

  // Returns { question, original, broken, mistakes: [{ id, label, kind }], text } — `text` goes in the editor.
  function makeBrokenQuery({ schema, run, options, seed = Date.now() }) {
    const rng = X.mulberry32(seed);
    const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    // A wrong join on big uploaded tables could take a long time to check, so skip it there.
    const big = schema.tables.some(t => t.rows.length > 3000);
    for (let t = 0; t < 40; t++) {
      const g = X.generateQuery({ schema, run, options: Object.assign({}, options, { nullChecks: 0.35 }), seed: (seed * 7 + t * 101) >>> 0 });
      const original = stripSemi(g.sql);
      const orig = run(original);
      if (!orig.ok) continue;
      const orderMatters = /\bORDER BY\b/i.test(original);
      const isReal = sql => { const r = run(sql); return !r.ok || !X.compareResults(r, orig, { orderMatters }).ok; };
      const want = rng() < 0.5 ? 1 : 2;
      const chosen = [];
      for (const m of shuffle(MISTAKES)) {
        if (chosen.length >= want) break;
        if (m.id === 'wrong-join' && big) continue;
        const edits = m.find(context(original, schema, rng));
        if (!edits || chosen.some(c => overlaps(c.edits, edits))) continue;
        if (!isReal(applyEdits(original, edits))) continue;
        chosen.push({ m, edits });
      }
      if (!chosen.length) continue;
      const broken = applyEdits(original, chosen.flatMap(c => c.edits));
      if (!isReal(broken)) continue;
      return {
        question: g.question,
        original,
        broken,
        mistakes: chosen.map(c => ({ id: c.m.id, label: c.m.label, kind: c.m.kind })),
        text: `${mistakeHeader(g.question, chosen.length)}\n${broken};\n`,
      };
    }
    return null;
  }

  const api = { MISTAKES, applyMistake, mistakeHeader, makeBrokenQuery };
  if (isNode) module.exports = api;
  else root.SS = Object.assign(root.SS || {}, api);
})(this);
