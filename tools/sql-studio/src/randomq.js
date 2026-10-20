// SQL Studio: writes a random, valid query for the current schema, using only real keys for joins.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const X = isNode ? Object.assign({}, require('./sql-text.js'), require('./format.js')) : root.SS;

  const FEATURES = ['where', 'andOr', 'join', 'aggregate', 'groupBy', 'having', 'calc', 'orderBy', 'limit', 'distinct', 'like'];
  const FEATURE_LABELS = {
    where: 'WHERE', andOr: 'AND/OR', join: 'JOIN', aggregate: 'Aggregate (COUNT/SUM/AVG/MIN/MAX)', groupBy: 'GROUP BY',
    having: 'HAVING', calc: 'Calculated field', orderBy: 'ORDER BY', limit: 'LIMIT', distinct: 'DISTINCT', like: 'LIKE',
  };
  const DEFAULT_OPTIONS = { where: true, andOr: false, join: true, aggregate: false, groupBy: false, having: false, calc: false, orderBy: true, limit: true, distinct: false, like: false };
  // Turning on the key turns on everything in its list.
  const NEEDS = { having: ['groupBy'], groupBy: ['aggregate'], andOr: ['where'], like: ['where'] };
  const USE_CHANCE = 0.6;

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function normalizeOptions(opts) {
    const options = Object.assign({}, ...FEATURES.map(f => ({ [f]: false })), opts);
    const added = [];
    let changed = true;
    while (changed) {
      changed = false;
      for (const [f, deps] of Object.entries(NEEDS)) {
        if (!options[f]) continue;
        for (const d of deps) if (!options[d]) { options[d] = true; added.push(d); changed = true; }
      }
    }
    return { options, added };
  }

  const SAFE = /^[A-Za-z_][A-Za-z0-9_]*$/;
  const ident = name => (SAFE.test(name) && !X.isKeyword(name) ? name : `"${name.replace(/"/g, '""')}"`);
  const lit = v => (typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);

  function makeRng(seed) {
    const r = mulberry32(seed);
    const rng = {
      next: r,
      chance: p => r() < p,
      int: (lo, hi) => lo + Math.floor(r() * (hi - lo + 1)),
      pick: arr => arr[Math.floor(r() * arr.length)],
      shuffle: arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
    };
    return rng;
  }

  function aliasFor(name, used) {
    const lower = name.toLowerCase();
    for (const a of [lower[0], lower.slice(0, 2), lower.slice(0, 3)]) if (/^[a-z]/.test(a) && !used.has(a) && !X.isKeyword(a)) { used.add(a); return a; }
    let k = 2;
    while (used.has(lower[0] + k)) k++;
    used.add(lower[0] + k);
    return lower[0] + k;
  }

  // Picks the FROM table and (maybe) a join path of 1–2 real relationships.
  function buildFrom(schema, rng, useJoin) {
    const linked = schema.tables.filter(t => schema.relationships.some(r => r.from.table === t.name || r.to.table === t.name));
    const joinable = useJoin && linked.length >= 2;
    const start = rng.pick(joinable ? linked : schema.tables);
    const parts = [{ table: start }];
    const joins = [];
    if (joinable) {
      const hops = rng.int(1, 2);
      for (let h = 0; h < hops; h++) {
        const inSet = new Set(parts.map(p => p.table.name));
        const options = schema.relationships.filter(r => inSet.has(r.from.table) !== inSet.has(r.to.table));
        if (!options.length) break;
        const rel = rng.pick(options);
        const newName = inSet.has(rel.from.table) ? rel.to.table : rel.from.table;
        const table = schema.tables.find(t => t.name === newName);
        parts.push({ table });
        joins.push(rel);
      }
    }
    const aliased = parts.length > 1;
    const used = new Set();
    parts.forEach(p => { p.alias = aliased ? aliasFor(p.table.name, used) : null; });
    const aliasOf = name => parts.find(p => p.table.name === name).alias;
    const ref = (tableName, col) => (aliased ? `${aliasOf(tableName)}.${ident(col)}` : ident(col));
    let sql = `FROM ${ident(start.name)}${aliased ? ' ' + parts[0].alias : ''}`;
    joins.forEach((rel, k) => {
      const p = parts[k + 1];
      // The book writes the newly joined table's column first: JOIN Songs so ON so.song_id = st.song_id
      const [mine, theirs] = rel.from.table === p.table.name ? [rel.from, rel.to] : [rel.to, rel.from];
      sql += `\nJOIN ${ident(p.table.name)} ${p.alias} ON ${ref(mine.table, mine.column)} = ${ref(theirs.table, theirs.column)}`;
    });
    const columns = parts.flatMap(p => p.table.columns.map(c => ({ expr: ref(p.table.name, c.name), name: c.name, type: c.type, key: c.pk || !!c.fk })));
    return { sql, columns, joined: joins.length > 0 };
  }

  function condition(col, value, sampleValues, rng, asLike) {
    if (asLike) {
      const s = String(value);
      if (col.type !== 'text' || s.length < 2 || /[%_']/.test(s)) return null;
      const len = Math.min(s.length, rng.int(2, 4));
      const mode = rng.pick(['contains', 'starts', 'ends']);
      const piece = mode === 'starts' ? s.slice(0, len) : mode === 'ends' ? s.slice(-len) : s.slice(rng.int(0, s.length - len)).slice(0, len);
      if (!piece.trim()) return null;
      const pat = mode === 'starts' ? `${piece}%` : mode === 'ends' ? `%${piece}` : `%${piece}%`;
      return `${col.expr} LIKE ${lit(pat)}`;
    }
    if (col.type === 'boolean') return `${col.expr} = ${value ? 'TRUE' : 'FALSE'}`;
    const others = [...new Set(sampleValues.filter(v => v !== null && v !== value))];
    const other = others.length ? rng.pick(others) : null;
    if (col.type === 'text') {
      const kind = rng.pick(['eq', 'eq', 'in', 'ne']);
      if (kind === 'in' && other !== null) return `${col.expr} IN (${lit(value)}, ${lit(other)})`;
      if (kind === 'ne' && other !== null) return `${col.expr} <> ${lit(other)}`;
      return `${col.expr} = ${lit(value)}`;
    }
    const kind = rng.pick(['ge', 'le', 'between']);
    if (kind === 'between' && other !== null) {
      const [lo, hi] = value < other ? [value, other] : [other, value];
      return `${col.expr} BETWEEN ${lit(lo)} AND ${lit(hi)}`;
    }
    return `${col.expr} ${kind === 'le' ? '<=' : '>='} ${lit(value)}`;
  }

  const AGG_NAMES = { SUM: 'total', AVG: 'average', MIN: 'lowest', MAX: 'highest' };

  function attempt(schema, run, o, rng, forceNoWhere) {
    const use = f => o[f] && rng.chance(USE_CHANCE);
    const having = use('having');
    const groupBy = having || use('groupBy');
    const aggregate = groupBy || use('aggregate');
    const like = !forceNoWhere && use('like');
    const andOr = !forceNoWhere && use('andOr');
    const where = !forceNoWhere && (like || andOr || use('where'));
    const join = use('join');
    const calc = use('calc');
    const distinct = use('distinct');
    const orderBy = use('orderBy');
    const limit = use('limit');
    const features = new Set();

    const from = buildFrom(schema, rng, join);
    if (from.joined) features.add('join');
    const sample = run(`SELECT ${from.columns.map(c => c.expr).join(', ')}\n${from.sql}\nLIMIT 500`);
    if (!sample.ok || !sample.rows.length) return null;
    const row = rng.pick(sample.rows);
    const colIndex = new Map(from.columns.map((c, i) => [c, i]));
    const valuesOf = c => sample.rows.map(r => r[colIndex.get(c)]);
    const plain = from.columns.filter(c => !c.key);
    const pool = plain.length ? plain : from.columns;
    const nums = pool.filter(c => c.type === 'number');
    const groupable = pool.filter(c => c.type !== 'number');

    // WHERE
    const conds = [];
    if (where) {
      const cands = rng.shuffle(pool.filter(c => row[colIndex.get(c)] !== null));
      if (like) {
        for (const c of cands) {
          const cond = condition(c, row[colIndex.get(c)], valuesOf(c), rng, true);
          if (cond) { conds.push({ col: c, cond }); features.add('like'); break; }
        }
      }
      const want = andOr ? 2 : 1;
      for (const c of cands) {
        if (conds.length >= want) break;
        if (conds.some(x => x.col === c)) continue;
        const cond = condition(c, row[colIndex.get(c)], valuesOf(c), rng, false);
        if (cond) conds.push({ col: c, cond });
      }
      if (conds.length) features.add('where');
      if (conds.length === 2) features.add('andOr');
    }
    const joiner = rng.chance(0.5) ? 'AND' : 'OR';
    const whereSql = conds.length ? `\nWHERE ${conds.map(x => x.cond).join(` ${joiner} `)}` : '';

    // SELECT
    const usedNames = new Set();
    const asName = base => { let n = base; let k = 2; while (usedNames.has(n)) n = `${base}_${k++}`; usedNames.add(n); return n; };
    const items = []; // { sql, name, aggExpr? }
    let groupSql = '';
    let havingSql = '';
    if (aggregate) {
      features.add('aggregate');
      let g = null;
      if (groupBy) {
        g = rng.pick(groupable.length ? groupable : pool);
        items.push({ sql: g.expr, name: asName(g.name) });
        groupSql = `\nGROUP BY ${g.expr}`;
        features.add('groupBy');
      }
      const aggs = [];
      const distinctable = groupable.filter(c => c !== g);
      if (distinct && distinctable.length) {
        const d = rng.pick(distinctable);
        aggs.push({ expr: `COUNT(DISTINCT ${d.expr})`, base: `distinct_${d.name}` });
        features.add('distinct');
      }
      if (calc && nums.length) {
        if (nums.length >= 2) {
          const [a, b] = rng.shuffle(nums);
          aggs.push({ expr: `SUM(${a.expr} * ${b.expr})`, base: `total_${a.name}_times_${b.name}` });
        } else {
          const a = nums[0];
          aggs.push({ expr: `MAX(${a.expr}) - MIN(${a.expr})`, base: `${a.name}_range` });
        }
        features.add('calc');
      }
      const howMany = aggs.length ? rng.int(0, 1) : rng.int(1, 2);
      for (let k = 0; k < howMany; k++) {
        if (nums.length && rng.chance(0.7)) {
          const fn = rng.pick(['SUM', 'AVG', 'MIN', 'MAX']);
          const c = rng.pick(nums);
          aggs.push({ expr: `${fn}(${c.expr})`, base: `${AGG_NAMES[fn]}_${c.name}` });
        } else aggs.push({ expr: 'COUNT(*)', base: 'number_of_rows' });
      }
      for (const a of aggs) items.push({ sql: `${a.expr} AS ${asName(a.base)}`, name: [...usedNames].pop(), aggExpr: a.expr });
      if (having && groupSql) {
        const target = rng.pick(items.filter(i => i.aggExpr));
        const probe = run(`SELECT ${target.aggExpr}\n${from.sql}${whereSql}${groupSql}`);
        const vals = probe.ok ? probe.rows.map(r => r[0]).filter(v => typeof v === 'number') : [];
        if (vals.length) {
          // Prefer a limit that drops at least one group.
          const above = vals.filter(x => x > Math.min(...vals));
          const v = rng.pick(above.length ? above : vals);
          const t = Number.isInteger(v) ? v : Math.floor(v * 100) / 100;
          havingSql = `\nHAVING ${target.aggExpr} >= ${t}`;
          features.add('having');
        }
      }
    } else {
      let chosen;
      if (distinct && groupable.length) {
        chosen = rng.shuffle(groupable).slice(0, rng.int(1, Math.min(2, groupable.length)));
        features.add('distinct');
      } else {
        const keyCols = from.columns.filter(c => c.key);
        chosen = rng.shuffle(pool).slice(0, rng.int(2, Math.min(4, Math.max(2, pool.length))));
        if (keyCols.length && rng.chance(0.2)) chosen.unshift(rng.pick(keyCols));
      }
      for (const c of chosen) items.push({ sql: c.expr, name: asName(c.name) });
      if (calc && nums.length && !features.has('distinct')) {
        if (nums.length >= 2) {
          const [a, b] = rng.shuffle(nums);
          items.push({ sql: `${a.expr} * ${b.expr} AS ${asName(`${a.name}_times_${b.name}`)}`, name: [...usedNames].pop() });
        } else {
          const a = nums[0];
          items.push({ sql: `ROUND(${a.expr} / 1000.0, 2) AS ${asName(`${a.name}_in_thousands`)}`, name: [...usedNames].pop() });
        }
        features.add('calc');
      }
    }

    let orderSql = '';
    if (orderBy) {
      const target = rng.pick(items);
      const by = target.sql.includes(' AS ') ? target.name : target.sql;
      orderSql = `\nORDER BY ${by}${rng.chance(0.5) ? ' DESC' : ''}`;
      features.add('orderBy');
    }
    let limitSql = '';
    if (limit) { limitSql = `\nLIMIT ${rng.int(3, 10)}`; features.add('limit'); }

    const head = `SELECT${features.has('distinct') && !aggregate ? ' DISTINCT' : ''} ${items.map(i => i.sql).join(', ')}`;
    return { sql: `${head}\n${from.sql}${whereSql}${groupSql}${havingSql}${orderSql}${limitSql}`, features: [...features] };
  }

  // run(sqlText) -> { ok, columns, rows } (db.runQuery bound to a studio).
  function generateQuery({ schema, run, options = DEFAULT_OPTIONS, seed = Date.now() }) {
    const { options: o } = normalizeOptions(options);
    const rng = makeRng(seed);
    let errors = 0;
    for (let tries = 1; tries <= 20; tries++) {
      const got = attempt(schema, run, o, rng, tries === 20);
      if (!got) continue;
      const sql = X.formatSql(got.sql) + ';';
      const res = run(got.sql);
      if (!res.ok) { errors++; continue; }
      if (res.rows.length || tries === 20) return { sql, features: got.features, tries, errors, rows: res.rows.length };
    }
    const t = schema.tables[0];
    return { sql: `SELECT *\nFROM ${ident(t.name)}\nLIMIT 10;`, features: [], tries: 21, errors, rows: Math.min(10, t.rows.length) };
  }

  const api = { FEATURES, FEATURE_LABELS, DEFAULT_OPTIONS, NEEDS, mulberry32, normalizeOptions, generateQuery };
  if (isNode) module.exports = api;
  else root.SS = Object.assign(root.SS || {}, api);
})(this);
