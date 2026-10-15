const test = require('node:test');
const assert = require('node:assert/strict');
const X = require('../src/export.js');
const { MINI } = require('./fixtures.js');
const SPOTIFY = require('../src/datasets/01-spotify.js');

const BASE = 'https://example.org/qe.html';
const mini = { ...MINI, number: 3, questions: [{ text: 'Which song got the most plays?', recipe: { start: 'Streams', steps: [] } }] };
const build = (recipe, extra = {}) => X.buildAnswer({ dataset: mini, recipe, questionIndex: 0, baseUrl: BASE, ...extra });

test('title, question, data set, and filename', () => {
  const a = build({ start: 'Streams', steps: [] });
  const lines = a.markdown.split('\n').map(l => l.trimEnd());
  assert.equal(lines[0], '## Query Explorer — Question 3.1');
  assert.equal(lines[1], 'Which song got the most plays?');
  assert.equal(lines[2], 'Data set: 3. Mini');
  assert.equal(a.filename, 'query-explorer-3.1.md');
  assert.ok(a.html.includes('<h2>Query Explorer — Question 3.1</h2>'));
});

test('recipe lines use step sentences, numbered from 0', () => {
  const a = build({ start: 'Streams', steps: [
    { op: 'filter', column: 'stream_date', condition: 'between', value: '2026-03-01', value2: '2026-03-31', on: true },
    { op: 'join', table: 'Songs', leftColumn: 'song_id', rightColumn: 'song_id', on: true },
  ] });
  assert.ok(a.markdown.includes('### Recipe'));
  assert.ok(a.markdown.includes('- Step 0: Start with **Streams**'));
  assert.ok(a.markdown.includes('- Step 1: Keep only rows where `stream_date` is between **Mar 1, 2026** and **Mar 31, 2026**'));
  assert.ok(a.markdown.includes('- Step 2: Combine with **Songs**, matching `song_id`'));
  assert.ok(a.html.includes('<li>Step 0: Start with <strong>Streams</strong></li>'));
  assert.ok(a.html.includes('<code>stream_date</code>'));
});

test('turned-off and invalid steps are marked', () => {
  const a = build({ start: 'Streams', steps: [
    { op: 'filter', column: 'stream_count', condition: 'more_than', value: '1', on: false },
    { op: 'project', columns: ['nope'], on: true },
  ] });
  assert.ok(/- Step 1: .* \*\(turned off\)\*/.test(a.markdown));
  assert.ok(/- Step 2: .* \*\(skipped: .+\)\*/.test(a.markdown));
  assert.ok(a.html.includes('<em>(turned off)</em>'));
  assert.ok(/<em>\(skipped: .+<\/em>/.test(a.html));
});

test('result table is the final result, with right-aligned numbers', () => {
  const a = build({ start: 'Artists', steps: [{ op: 'project', columns: ['artist_id', 'artist_name'], on: true }] });
  assert.ok(a.markdown.includes('### Result (3 rows × 2 columns)'));
  assert.ok(a.markdown.includes('| artist_id | artist_name |\n|---:|---|\n| 1 | Bad Bunny |'));
  assert.ok(a.html.includes('<th style="text-align:right">artist_id</th>'));
  assert.ok(a.html.includes('<td style="text-align:right">1</td>'));
});

test('values use on-screen formatting', () => {
  const a = build({ start: 'Streams', steps: [{ op: 'project', columns: ['stream_date', 'stream_count'], on: true }] });
  assert.ok(a.markdown.includes('| Mar 2, 2026 | 500 |'));
  const big = X.buildAnswer({ dataset: SPOTIFY, recipe: SPOTIFY.questions[0].recipe, questionIndex: 0, baseUrl: BASE });
  assert.ok(/\| [\d,]{9,} \|/.test(big.markdown), 'large totals have thousands separators');
  assert.ok(big.markdown.includes('Question 1.1'));
});

test('pipes, backslashes, and newlines are escaped in markdown cells', () => {
  const ds = { ...mini, tables: [{ name: 'T', columns: [{ name: 'a|b', type: 'text' }, { name: 'n', type: 'text' }], rows: [['x|y\\z', 'line1\nline2']] }], start: 'T' };
  const a = X.buildAnswer({ dataset: ds, recipe: { start: 'T', steps: [] }, questionIndex: 0, baseUrl: BASE });
  assert.ok(a.markdown.includes('| a\\|b | n |'));
  assert.ok(a.markdown.includes('| x\\|y\\\\z | line1 line2 |'));
});

test('HTML escapes data, names, and question text', () => {
  const ds = { ...mini, questions: [{ text: 'Is 1 < 2 & "ok"?', recipe: { start: 'T', steps: [] } }],
    tables: [{ name: 'T', columns: [{ name: '<i>', type: 'text' }], rows: [['<b>&"']] }], start: 'T' };
  const a = X.buildAnswer({ dataset: ds, recipe: { start: 'T', steps: [] }, questionIndex: 0, baseUrl: BASE });
  assert.ok(a.html.includes('<td>&lt;b&gt;&amp;&quot;</td>'));
  assert.ok(a.html.includes('<th>&lt;i&gt;</th>'));
  assert.ok(a.html.includes('Is 1 &lt; 2 &amp; &quot;ok&quot;?'));
  assert.ok(!a.html.includes('<b>&"'));
});

test('more than 50 rows are capped with a note', () => {
  const rows = Array.from({ length: 60 }, (_, i) => [i + 1]);
  const ds = { ...mini, tables: [{ name: 'T', columns: [{ name: 'n', type: 'number', key: 'pk' }], rows }], start: 'T' };
  const a = X.buildAnswer({ dataset: ds, recipe: { start: 'T', steps: [] }, questionIndex: 0, baseUrl: BASE });
  assert.ok(a.markdown.includes('### Result (60 rows × 1 column)'));
  assert.ok(a.markdown.includes('(showing 50 of 60 rows)'));
  assert.ok(a.markdown.includes('| 50 |') && !a.markdown.includes('| 51 |'));
  assert.ok(a.html.includes('(showing 50 of 60 rows)'));
  const exact = X.buildAnswer({ dataset: ds, recipe: { start: 'T', steps: [] }, questionIndex: 0, baseUrl: BASE, maxRows: 60 });
  assert.ok(!exact.markdown.includes('showing'));
});

test('zero rows says (no rows)', () => {
  const a = build({ start: 'Streams', steps: [{ op: 'filter', column: 'stream_count', condition: 'more_than', value: '99999', on: true }] });
  assert.ok(a.markdown.includes('### Result (0 rows × 4 columns)'));
  assert.ok(a.markdown.includes('(no rows)'));
  assert.ok(!a.markdown.includes('|---'));
  assert.ok(a.html.includes('(no rows)'));
});

test('the reopen link carries the recipe', () => {
  const recipe = { start: 'Streams', steps: [{ op: 'project', columns: ['stream_id'], on: true }] };
  const a = build(recipe);
  const m = a.markdown.match(/\[Open this recipe in Query Explorer\]\((.+)\)/);
  assert.ok(m && m[1].startsWith(BASE + '#r='));
  assert.ok(a.html.includes('<a href="' + m[1] + '">Open this recipe in Query Explorer</a>'));
  const back = X.decodeRecipe(m[1].split('#r=')[1]);
  assert.equal(back.datasetId, 'mini');
  assert.equal(back.recipe.start, 'Streams');
});

test('encode/decode round trip keeps fields, drops ids, handles non-ASCII', () => {
  const recipe = { start: 'Songs', steps: [
    { id: 7, op: 'filter', column: 'song_title', condition: 'is_one_of', values: ['Tití Me Preguntó', 'DtMF'], value: '', value2: '', on: true },
    { id: 8, op: 'aggregate', groupBy: ['artist_id'], summaries: [{ fn: 'count', column: '' }], on: false },
  ] };
  const s = X.encodeRecipe('mini', recipe);
  assert.match(s, /^[A-Za-z0-9_-]+$/);
  const back = X.decodeRecipe(s);
  assert.equal(back.datasetId, 'mini');
  assert.equal(back.recipe.start, 'Songs');
  assert.deepEqual(back.recipe.steps[0].values, ['Tití Me Preguntó', 'DtMF']);
  assert.equal(back.recipe.steps[1].on, false);
  assert.ok(back.recipe.steps.every(st => !('id' in st)));
});

test('decodeRecipe rejects garbage and malformed input', () => {
  const enc = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  for (const bad of ['', 'xyz', '!!!', null, undefined, 42, enc([]), enc({}), enc({ d: 'mini' }),
    enc({ d: 'mini', s: 'Streams', t: 'nope' }), enc({ d: 'mini', s: 'Streams', t: [1] }),
    enc({ d: 'mini', s: 'Streams', t: [{ op: 'drop_table' }] }),
    enc({ d: 'mini', s: 'Streams', t: [{ op: 'project', columns: 'a' }] }),
    enc({ d: 5, s: 'Streams', t: [] })]) {
    assert.equal(X.decodeRecipe(bad), null, String(bad));
  }
  assert.notEqual(X.decodeRecipe(enc({ d: 'mini', s: 'Streams', t: [] })), null);
});
