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
    return { sql, columns, joined: joins.length > 0, start: start.name, tables: parts.map(p => p.table.name) };
  }

  // Returns { sql, op, values } (op and values feed the plain-English question), or null.
  function condition(col, value, sampleValues, rng, asLike) {
    const c = (sql, op, values) => ({ sql, op, values });
    if (asLike) {
      const s = String(value);
      if (col.type !== 'text' || s.length < 2 || /[%_']/.test(s)) return null;
      const len = Math.min(s.length, rng.int(2, 4));
      const mode = rng.pick(['contains', 'starts', 'ends']);
      const piece = mode === 'starts' ? s.slice(0, len) : mode === 'ends' ? s.slice(-len) : s.slice(rng.int(0, s.length - len)).slice(0, len);
      if (!piece.trim()) return null;
      const pat = mode === 'starts' ? `${piece}%` : mode === 'ends' ? `%${piece}` : `%${piece}%`;
      return c(`${col.expr} LIKE ${lit(pat)}`, mode, [piece]);
    }
    if (col.type === 'boolean') return c(`${col.expr} = ${value ? 'TRUE' : 'FALSE'}`, 'bool', [value ? 1 : 0]);
    const others = [...new Set(sampleValues.filter(v => v !== null && v !== value))];
    const other = others.length ? rng.pick(others) : null;
    if (col.type === 'text') {
      const kind = rng.pick(['eq', 'eq', 'in', 'ne']);
      if (kind === 'in' && other !== null) return c(`${col.expr} IN (${lit(value)}, ${lit(other)})`, 'in', [value, other]);
      if (kind === 'ne' && other !== null) return c(`${col.expr} <> ${lit(other)}`, 'ne', [other]);
      return c(`${col.expr} = ${lit(value)}`, 'eq', [value]);
    }
    const kind = rng.pick(['ge', 'le', 'between']);
    if (kind === 'between' && other !== null) {
      const [lo, hi] = value < other ? [value, other] : [other, value];
      return c(`${col.expr} BETWEEN ${lit(lo)} AND ${lit(hi)}`, 'between', [lo, hi]);
    }
    return c(`${col.expr} ${kind === 'le' ? '<=' : '>='} ${lit(value)}`, kind, [value]);
  }

  // ---- the plain-English question ----
  const listOf = xs => (xs.length < 2 ? xs.join('') : xs.length === 2 ? `${xs[0]} and ${xs[1]}` : `${xs.slice(0, -1).join(', ')}, and ${xs[xs.length - 1]}`);
  const AGG_SAY = { SUM: 'the total of', AVG: 'the average', MIN: 'the lowest', MAX: 'the highest' };
  function sayItem(it) {
    if (it.kind === 'col') return it.col.name;
    if (it.kind === 'agg') {
      if (it.fn === 'COUNT') return 'the number of rows';
      if (it.fn === 'COUNTD') return `the number of different ${it.col.name} values`;
      return `${AGG_SAY[it.fn]} ${it.col.name}`;
    }
    if (it.op === 'times') return `${it.a.name} times ${it.b.name}`;
    if (it.op === 'sumtimes') return `the total of ${it.a.name} times ${it.b.name}`;
    if (it.op === 'range') return `the highest ${it.a.name} minus the lowest ${it.a.name}`;
    return `${it.a.name} divided by 1,000 (rounded to 2 decimal places)`;
  }
  function sayCond({ col, op, values }) {
    const n = col.name;
    const date = col.type === 'date';
    switch (op) {
      case 'eq': return `${n} is ${values[0]}`;
      case 'ne': return `${n} is not ${values[0]}`;
      case 'in': return `${n} is ${values[0]} or ${values[1]}`;
      case 'ge': return `${n} is ${date ? 'on or after' : 'at least'} ${values[0]}`;
      case 'le': return `${n} is ${date ? 'on or before' : 'at most'} ${values[0]}`;
      case 'between': return `${n} is between ${values[0]} and ${values[1]}`;
      case 'starts': return `${n} starts with '${values[0]}'`;
      case 'ends': return `${n} ends with '${values[0]}'`;
      case 'contains': return `${n} contains '${values[0]}'`;
      case 'bool': return `${n} is ${values[0] ? 'true' : 'false'}`;
      case 'isnull': return `${n} is missing (NULL)`;
      case 'notnull': return `${n} is not missing`;
      default: return n;
    }
  }
  function sortWords(it, desc) {
    const type = it.kind === 'col' ? it.col.type : it.kind === 'agg' && it.col && (it.fn === 'MIN' || it.fn === 'MAX') ? it.col.type : 'number';
    if (type === 'text' || type === 'boolean') return desc ? 'Z to A' : 'A to Z';
    if (type === 'date') return desc ? 'newest first' : 'oldest first';
    return desc ? 'highest first' : 'lowest first';
  }

  // spec: { start, joined[], distinct, aggregate, group (column|null), items[], where {joiner, conds[]}|null,
  //         having {item, value}|null, order {item, desc}|null, limit (number|null) }
  function describeQuery(spec) {
    const source = spec.joined.length ? `${spec.start} (with its matching ${listOf(spec.joined)} rows)` : spec.start;
    const parts = [];
    if (spec.aggregate) {
      const shown = spec.items.filter(it => !(spec.group && it.kind === 'col' && it.col.name === spec.group.name)).map(sayItem);
      const each = spec.group && spec.group.type === 'boolean' ? `${spec.group.name} value (true or false)` : spec.group && spec.group.name;
      parts.push(spec.group ? `Using ${source}, for each ${each} show ${listOf(shown)}.` : `Using all of ${source}, show ${listOf(shown)}.`);
    } else if (spec.distinct) {
      const names = spec.items.map(sayItem);
      parts.push(names.length === 1 ? `List each different ${names[0]} once, from ${source}.` : `List each different combination of ${listOf(names)} once, from ${source}.`);
    } else {
      parts.push(`For each row of ${source}, show ${listOf(spec.items.map(sayItem))}.`);
    }
    if (spec.where && spec.where.conds.length) {
      const joiner = spec.where.joiner === 'OR' ? ' or ' : ' and ';
      parts.push(`Only ${spec.aggregate ? 'count' : 'include'} rows where ${spec.where.conds.map(sayCond).join(joiner)}.`);
    }
    if (spec.having) parts.push(`Keep only groups where ${sayItem(spec.items[spec.having.item])} is at least ${spec.having.value}.`);
    if (spec.order) {
      const it = spec.items[spec.order.item];
      parts.push(`Sort by ${sayItem(it)}, ${sortWords(it, spec.order.desc)}.`);
    }
    if (spec.limit) parts.push(`Show only the first ${spec.limit} rows.`);
    return parts.join(' ');
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
    const spec = { start: from.start, joined: from.joined ? from.tables.slice(1) : [], distinct: false, aggregate: false, group: null, items: [], where: null, having: null, order: null, limit: null };
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
      const nullRate = typeof o.nullChecks === 'number' ? o.nullChecks : 0.15;
      const hasNulls = c => valuesOf(c).some(v => v === null);
      // Missing values: IS NULL when this row's value is missing; sometimes IS NOT NULL on a column with gaps.
      for (const c of rng.shuffle(pool)) {
        if (conds.length || like || !rng.chance(nullRate)) break;
        const v = row[colIndex.get(c)];
        if (v === null) conds.push({ col: c, cond: { sql: `${c.expr} IS NULL`, op: 'isnull', values: [] } });
        else if (hasNulls(c) || o.nullChecks) conds.push({ col: c, cond: { sql: `${c.expr} IS NOT NULL`, op: 'notnull', values: [] } });
      }
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
    const whereSql = conds.length ? `\nWHERE ${conds.map(x => x.cond.sql).join(` ${joiner} `)}` : '';
    if (conds.length) spec.where = { joiner, conds: conds.map(x => ({ col: x.col, op: x.cond.op, values: x.cond.values })) };

    // SELECT
    const usedNames = new Set();
    const asName = base => { let n = base; let k = 2; while (usedNames.has(n)) n = `${base}_${k++}`; usedNames.add(n); return n; };
    const items = []; // { sql, name, aggExpr?, say } — `say` is the item as the question describes it
    let groupSql = '';
    let havingSql = '';
    if (aggregate) {
      features.add('aggregate');
      spec.aggregate = true;
      let g = null;
      if (groupBy) {
        g = rng.pick(groupable.length ? groupable : pool);
        spec.group = g;
        items.push({ sql: g.expr, name: asName(g.name), say: { kind: 'col', col: g } });
        groupSql = `\nGROUP BY ${g.expr}`;
        features.add('groupBy');
      }
      const aggs = [];
      const distinctable = groupable.filter(c => c !== g);
      if (distinct && distinctable.length) {
        const d = rng.pick(distinctable);
        aggs.push({ expr: `COUNT(DISTINCT ${d.expr})`, base: `distinct_${d.name}`, say: { kind: 'agg', fn: 'COUNTD', col: d } });
        features.add('distinct');
      }
      if (calc && nums.length) {
        if (nums.length >= 2) {
          const [a, b] = rng.shuffle(nums);
          aggs.push({ expr: `SUM(${a.expr} * ${b.expr})`, base: `total_${a.name}_times_${b.name}`, say: { kind: 'calc', op: 'sumtimes', a, b } });
        } else {
          const a = nums[0];
          aggs.push({ expr: `MAX(${a.expr}) - MIN(${a.expr})`, base: `${a.name}_range`, say: { kind: 'calc', op: 'range', a } });
        }
        features.add('calc');
      }
      const howMany = aggs.length ? rng.int(0, 1) : rng.int(1, 2);
      for (let k = 0; k < howMany; k++) {
        if (nums.length && rng.chance(0.7)) {
          const fn = rng.pick(['SUM', 'AVG', 'MIN', 'MAX']);
          const c = rng.pick(nums);
          aggs.push({ expr: `${fn}(${c.expr})`, base: `${AGG_NAMES[fn]}_${c.name}`, say: { kind: 'agg', fn, col: c } });
        } else aggs.push({ expr: 'COUNT(*)', base: 'number_of_rows', say: { kind: 'agg', fn: 'COUNT' } });
      }
      for (const a of aggs) items.push({ sql: `${a.expr} AS ${asName(a.base)}`, name: [...usedNames].pop(), aggExpr: a.expr, say: a.say });
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
          spec.having = { item: items.indexOf(target), value: t };
          features.add('having');
        }
      }
    } else {
      let chosen;
      if (distinct && groupable.length) {
        chosen = rng.shuffle(groupable).slice(0, rng.int(1, Math.min(2, groupable.length)));
        features.add('distinct');
        spec.distinct = true;
      } else {
        const keyCols = from.columns.filter(c => c.key);
        chosen = rng.shuffle(pool).slice(0, rng.int(2, Math.min(4, Math.max(2, pool.length))));
        if (keyCols.length && rng.chance(0.2)) chosen.unshift(rng.pick(keyCols));
      }
      for (const c of chosen) items.push({ sql: c.expr, name: asName(c.name), say: { kind: 'col', col: c } });
      if (calc && nums.length && !features.has('distinct')) {
        if (nums.length >= 2) {
          const [a, b] = rng.shuffle(nums);
          items.push({ sql: `${a.expr} * ${b.expr} AS ${asName(`${a.name}_times_${b.name}`)}`, name: [...usedNames].pop(), say: { kind: 'calc', op: 'times', a, b } });
        } else {
          const a = nums[0];
          items.push({ sql: `ROUND(${a.expr} / 1000.0, 2) AS ${asName(`${a.name}_in_thousands`)}`, name: [...usedNames].pop(), say: { kind: 'calc', op: 'thousands', a } });
        }
        features.add('calc');
      }
    }

    let orderSql = '';
    if (orderBy) {
      const target = rng.pick(items);
      const by = target.sql.includes(' AS ') ? target.name : target.sql;
      const desc = rng.chance(0.5);
      orderSql = `\nORDER BY ${by}${desc ? ' DESC' : ''}`;
      spec.order = { item: items.indexOf(target), desc };
      features.add('orderBy');
    }
    let limitSql = '';
    if (limit) { spec.limit = rng.int(3, 10); limitSql = `\nLIMIT ${spec.limit}`; features.add('limit'); }
    spec.items = items.map(i => i.say);

    const head = `SELECT${features.has('distinct') && !aggregate ? ' DISTINCT' : ''} ${items.map(i => i.sql).join(', ')}`;
    return { sql: `${head}\n${from.sql}${whereSql}${groupSql}${havingSql}${orderSql}${limitSql}`, features: [...features], question: describeQuery(spec) };
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
      if (res.rows.length || tries === 20) return { sql, features: got.features, question: got.question, tries, errors, rows: res.rows.length };
    }
    const t = schema.tables[0];
    return { sql: `SELECT *\nFROM ${ident(t.name)}\nLIMIT 10;`, features: [], question: `Show every column of the first 10 rows of ${t.name}.`, tries: 21, errors, rows: Math.min(10, t.rows.length) };
  }

  const api = { FEATURES, FEATURE_LABELS, DEFAULT_OPTIONS, NEEDS, mulberry32, normalizeOptions, generateQuery, describeQuery };
  if (isNode) module.exports = api;
  else root.SS = Object.assign(root.SS || {}, api);
})(this);
