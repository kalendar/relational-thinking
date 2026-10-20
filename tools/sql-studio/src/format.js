// SQL Studio: a small SQL pretty-printer in the book's style.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const T = isNode ? require('./sql-text.js') : root.SS;

  const CLAUSE_HEADS = ['SELECT', 'FROM', 'WHERE', 'GROUP', 'HAVING', 'ORDER', 'LIMIT', 'UNION', 'INTERSECT', 'EXCEPT', 'WITH',
    'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'CROSS', 'NATURAL'];
  const NO_SPACE_BEFORE = new Set([',', ')', ';', '.']);
  const NO_SPACE_AFTER = new Set(['(', '.']);

  // Groups tokens into "words" so multi-word clause heads (GROUP BY, LEFT OUTER JOIN, UNION ALL) are one unit.
  function clauseHeadAt(toks, i) {
    const up = k => (toks[k] && toks[k].type === 'word' ? toks[k].text.toUpperCase() : '');
    const w = up(i);
    if (!CLAUSE_HEADS.includes(w)) return 0;
    if (w === 'GROUP' || w === 'ORDER') return up(i + 1) === 'BY' ? 2 : 0;
    if (w === 'UNION') return up(i + 1) === 'ALL' ? 2 : 1;
    if (['INNER', 'CROSS', 'NATURAL'].includes(w)) return up(i + 1) === 'JOIN' ? 2 : 0;
    if (['LEFT', 'RIGHT', 'FULL'].includes(w)) {
      if (up(i + 1) === 'JOIN') return 2;
      if (up(i + 1) === 'OUTER' && up(i + 2) === 'JOIN') return 3;
      return 0;
    }
    return 1;
  }

  function formatStatement(text) {
    const toks = T.tokenize(text).filter(t => t.type !== 'ws');
    // Pass 1: split into top-level clauses per nesting level; we render recursively.
    return render(toks, 0).replace(/[ \t]+\n/g, '\n').trim();
  }

  function upper(tok, next) {
    if (tok.type !== 'word') return tok.text;
    if (T.isKeyword(tok.text)) return tok.text.toUpperCase();
    if (next && next.text === '(') return tok.text.toUpperCase(); // function name
    return tok.text;
  }

  function needsSpace(prev, tok, prevPrev) {
    if (!prev) return false;
    if (NO_SPACE_BEFORE.has(tok.text) && tok.type === 'punct') return false;
    if (tok.text === '.' ) return false;
    if (NO_SPACE_AFTER.has(prev.text) && (prev.type === 'punct')) return false;
    if (tok.text === '(' && prev.type === 'word' && !T.isKeyword(prev.text)) return false; // f(
    if (tok.text === '(' && prev.type === 'word' && ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'CAST', 'COALESCE', 'IFNULL', 'ROUND', 'REPLACE'].includes(prev.text.toUpperCase())) return false;
    if (prev.type === 'op' && (prev.text === '-' || prev.text === '+') && isUnary(prevPrev)) return false;
    return true;
  }

  function isUnary(before) {
    return !before || before.type === 'op' || (before.type === 'punct' && (before.text === '(' || before.text === ',')) || (before.type === 'word' && T.isKeyword(before.text));
  }

  // Renders tokens of one query level. `base` is the indent (spaces) for clause heads at this level.
  function render(toks, base) {
    const pad = ' '.repeat(base);
    // Split this level into clauses at depth 0.
    const clauses = [];
    let depth = 0;
    let cur = null;
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (t.text === '(' && t.type === 'punct') depth++;
      if (t.text === ')' && t.type === 'punct') depth--;
      const headLen = depth === 0 ? clauseHeadAt(toks, i) : 0;
      if (headLen) {
        cur = { head: toks.slice(i, i + headLen), body: [] };
        clauses.push(cur);
        i += headLen - 1;
      } else {
        if (!cur) { cur = { head: [], body: [] }; clauses.push(cur); }
        cur.body.push(t);
      }
    }
    return clauses.map(c => renderClause(c, pad, base)).join('\n');
  }

  function renderClause({ head, body }, pad, base) {
    const headText = head.map(t => t.text.toUpperCase()).join(' ');
    const kind = head.length ? head[0].text.toUpperCase() : '';
    if (kind === 'SELECT') {
      const items = splitTopLevel(body, ',');
      const inline = joinTokens(body, base);
      let distinct = '';
      if (items.length && items[0].length && items[0][0].type === 'word' && ['DISTINCT', 'ALL'].includes(items[0][0].text.toUpperCase())) {
        distinct = ' ' + items[0][0].text.toUpperCase();
        items[0] = items[0].slice(1);
      }
      const oneLine = `${pad}${headText} ${inline}`;
      if (items.length < 2 || (oneLine.length <= 72 && !oneLine.includes('\n'))) return oneLine;
      const lines = items.map((it, k) => `${pad}  ${joinTokens(it, base + 2)}${k < items.length - 1 ? ',' : ''}`);
      return `${pad}${headText}${distinct}\n${lines.join('\n')}`;
    }
    if (kind === 'WHERE' || kind === 'HAVING') {
      const parts = splitConditions(body);
      return parts.map((p, k) => (k === 0 ? `${pad}${headText} ${joinTokens(p.toks, base)}` : `${pad}  ${p.joiner} ${joinTokens(p.toks, base)}`)).join('\n');
    }
    const text = joinTokens(body, base);
    return head.length ? `${pad}${headText}${text ? ' ' + text : ''}` : `${pad}${text}`;
  }

  // Splits a token list at top-level separators (depth 0).
  function splitTopLevel(toks, sep) {
    const out = [[]];
    let depth = 0;
    for (const t of toks) {
      if (t.type === 'punct' && t.text === '(') depth++;
      if (t.type === 'punct' && t.text === ')') depth--;
      if (depth === 0 && t.type === 'punct' && t.text === sep) { out.push([]); continue; }
      out[out.length - 1].push(t);
    }
    return out.filter(x => x.length);
  }

  // Splits WHERE/HAVING bodies at top-level AND/OR, skipping the AND of BETWEEN.
  function splitConditions(toks) {
    const out = [{ joiner: '', toks: [] }];
    let depth = 0;
    let betweenOpen = false;
    for (const t of toks) {
      const w = t.type === 'word' ? t.text.toUpperCase() : '';
      if (t.type === 'punct' && t.text === '(') depth++;
      if (t.type === 'punct' && t.text === ')') depth--;
      if (depth === 0 && w === 'BETWEEN') betweenOpen = true;
      if (depth === 0 && (w === 'AND' || w === 'OR')) {
        if (w === 'AND' && betweenOpen) { betweenOpen = false; out[out.length - 1].toks.push(t); continue; }
        out.push({ joiner: w, toks: [] });
        continue;
      }
      out[out.length - 1].toks.push(t);
    }
    return out;
  }

  // Joins tokens with the spacing rules; subqueries "(SELECT ...)" are rendered on new lines 4 deeper.
  function joinTokens(toks, base) {
    let s = '';
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      const next = toks[i + 1];
      if (t.type === 'punct' && t.text === '(' && next && next.type === 'word' && ['SELECT', 'WITH'].includes(next.text.toUpperCase())) {
        // find matching ')'
        let depth = 0;
        let j = i;
        for (; j < toks.length; j++) {
          if (toks[j].type === 'punct' && toks[j].text === '(') depth++;
          if (toks[j].type === 'punct' && toks[j].text === ')' && --depth === 0) break;
        }
        const inner = render(toks.slice(i + 1, j), base + 4);
        s += (s && !s.endsWith('(') && !s.endsWith(' ') ? ' ' : '') + '(\n' + inner + (j < toks.length ? ')' : '');
        i = j;
        continue;
      }
      if (t.type === 'comment') {
        s += (s ? ' ' : '') + t.text + (t.text.startsWith('--') ? '\n' + ' '.repeat(base + 2) : '');
        continue;
      }
      if (s && !s.endsWith('\n' + ' '.repeat(base + 2)) && needsSpace(toks[i - 1], t, toks[i - 2])) s += ' ';
      s += upper(t, next);
    }
    return s.replace(/\n\s*$/, '\n');
  }

  function formatSql(text) {
    const parts = T.splitStatements(text);
    const hadFinalSemi = /;\s*$/.test(T.tokenize(text).filter(t => t.type !== 'comment').map(t => t.text).join(''));
    const formatted = [];
    for (const p of parts) {
      if (p.empty) {
        const c = p.text.trim();
        if (c) formatted.push({ text: c, comment: true });
        continue;
      }
      formatted.push({ text: formatStatement(p.text) });
    }
    let out = '';
    formatted.forEach((f, k) => {
      if (k > 0) out += f.comment ? '\n' : ';\n\n';
      out += f.text;
    });
    if (hadFinalSemi && formatted.length && !formatted[formatted.length - 1].comment) out += ';';
    return out;
  }

  const api = { formatSql, formatStatement };
  if (isNode) module.exports = api;
  else root.SS = Object.assign(root.SS || {}, api);
})(this);
