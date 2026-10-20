const test = require('node:test');
const assert = require('node:assert/strict');
const Q = require('../src/randomq.js');
const S = require('../src/schema.js');
const D = require('../src/db.js');
const T = require('../src/sql-text.js');
const F = require('../src/format.js');
const { getSQL, loadDatasets } = require('./helpers.js');

const ALL_ON = Object.fromEntries(Q.FEATURES.map(f => [f, true]));
const ALL_OFF = Object.fromEntries(Q.FEATURES.map(f => [f, false]));
const stripSemi = s => s.replace(/;\s*$/, '');

// Signs of each feature in the generated SQL text (formatted, so top-level AND/OR start a line).
const SIGNS = {
  where: /\nWHERE\b/, join: /\nJOIN\b/, groupBy: /\nGROUP BY\b/, having: /\nHAVING\b/, orderBy: /\nORDER BY\b/,
  limit: /\nLIMIT\b/, distinct: /\bDISTINCT\b/, like: /\bLIKE\b/, andOr: /\n\s+(AND|OR)\b/,
  aggregate: /\b(COUNT|SUM|AVG|MIN|MAX)\(/,
};

test('normalizeOptions adds what a feature needs', () => {
  const { options, added } = Q.normalizeOptions({ having: true, like: true });
  assert.equal(options.groupBy, true);
  assert.equal(options.aggregate, true);
  assert.equal(options.where, true);
  assert.deepEqual(added.sort(), ['aggregate', 'groupBy', 'where']);
});

test('the same seed gives the same query', async () => {
  const SQL = await getSQL();
  const st = D.openStudio(SQL, S.buildSchema(loadDatasets()[0]));
  const run = sql => D.runQuery(st, sql);
  const a = Q.generateQuery({ schema: st.schema, run, options: ALL_ON, seed: 42 });
  const b = Q.generateQuery({ schema: st.schema, run, options: ALL_ON, seed: 42 });
  assert.equal(a.sql, b.sql);
  D.closeStudio(st);
});

test('hundreds of random queries per data set all run, use real joins, and honor the toggles', async () => {
  const SQL = await getSQL();
  const seen = Object.fromEntries(Q.FEATURES.map(f => [f, 0]));
  for (const d of loadDatasets()) {
    const st = D.openStudio(SQL, S.buildSchema(d));
    const run = sql => D.runQuery(st, sql);
    const rels = new Set(st.schema.relationships.flatMap(r => [
      `${r.from.table}.${r.from.column}=${r.to.table}.${r.to.column}`, `${r.to.table}.${r.to.column}=${r.from.table}.${r.from.column}`]));
    let withRows = 0;
    const cases = [];
    for (let i = 0; i < 300; i++) {
      const rnd = Q.mulberry32(i * 7919 + d.number);
      cases.push(Object.fromEntries(Q.FEATURES.map(f => [f, rnd() < 0.5])));
    }
    for (let i = 0; i < 100; i++) cases.push(ALL_ON, ALL_OFF);
    cases.forEach((opts, i) => {
      const g = Q.generateQuery({ schema: st.schema, run, options: opts, seed: 1000 * d.number + i });
      const label = `${d.id} #${i}\n${g.sql}`;
      assert.equal(g.errors, 0, label);
      const r = run(stripSemi(g.sql));
      assert.equal(r.ok, true, `${label}\n${r.error && r.error.message}`);
      if (r.rows.length) withRows++;
      const allowed = Q.normalizeOptions(opts).options;
      for (const [f, re] of Object.entries(SIGNS)) {
        if (re.test(g.sql)) { assert.ok(allowed[f], `${f} used but off: ${label}`); seen[f]++; }
      }
      if (g.features.includes('calc')) { assert.ok(allowed.calc, label); seen.calc++; }
      // Every JOIN ... ON a.x = b.y matches a real relationship.
      const aliases = T.aliasMap(stripSemi(g.sql), st.schema.tables.map(t => t.name));
      for (const m of g.sql.matchAll(/JOIN \w+ \w+ ON (\w+)\.(\w+) = (\w+)\.(\w+)/g)) {
        const key = `${aliases.get(m[1])}.${m[2]}=${aliases.get(m[3])}.${m[4]}`;
        assert.ok(rels.has(key), `not a real key: ${key}\n${label}`);
      }
    });
    assert.ok(withRows / cases.length >= 0.95, `${d.id}: only ${withRows}/${cases.length} returned rows`);
    D.closeStudio(st);
  }
  for (const f of Q.FEATURES) assert.ok(seen[f] > 0, `feature never used: ${f}`);
});

test('formatting never changes the result of random queries', async () => {
  const SQL = await getSQL();
  const ds = loadDatasets();
  for (let i = 0; i < 300; i++) {
    const d = ds[i % ds.length];
    const st = D.openStudio(SQL, S.buildSchema(d));
    const run = sql => D.runQuery(st, sql);
    const g = Q.generateQuery({ schema: st.schema, run, options: ALL_ON, seed: 5000 + i });
    const oneLine = stripSemi(g.sql).replace(/\s+/g, ' ');
    assert.deepEqual(run(stripSemi(F.formatSql(oneLine))), run(oneLine), g.sql);
    D.closeStudio(st);
  }
});
