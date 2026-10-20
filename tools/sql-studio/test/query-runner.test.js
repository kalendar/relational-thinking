const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../src/query-runner.js');
const S = require('../src/schema.js');
const { getSQL, loadDatasets } = require('./helpers.js');

// A stand-in for a Web Worker: answers like the real one, except that a query containing HANG never answers.
function fakeWorkerFactory(log) {
  return () => {
    const w = {
      dead: false,
      onmessage: null,
      postMessage(msg) {
        log.push(msg.type);
        setImmediate(() => {
          if (w.dead) return;
          if (msg.type === 'open') w.onmessage({ data: { type: 'opened' } });
          if (msg.type === 'run' && !/HANG/.test(msg.sql)) w.onmessage({ data: { type: 'result', id: msg.id, result: { ok: true, columns: ['q'], rows: [[msg.sql]], truncated: false } } });
        });
      },
      terminate() { w.dead = true; log.push('terminate'); },
    };
    return w;
  };
}

const schema = { id: 'x', tables: [], relationships: [] };

test('run sends the query to the worker and returns its result', async () => {
  const log = [];
  const runner = R.createQueryRunner({ makeWorker: fakeWorkerFactory(log), timeoutMs: 200 });
  await runner.open(schema);
  const r = await runner.run('SELECT 1');
  assert.deepEqual(r.rows, [['SELECT 1']]);
  assert.deepEqual(log, ['open', 'run']);
});

test('a query that runs too long is stopped: the worker is replaced and reopened, and later queries still work', async () => {
  const log = [];
  const runner = R.createQueryRunner({ makeWorker: fakeWorkerFactory(log), timeoutMs: 100 });
  await runner.open(schema);
  const started = Date.now();
  const r = await runner.run('SELECT HANG');
  assert.deepEqual(r, { ok: false, error: { kind: 'timeout', message: '' } });
  assert.ok(Date.now() - started >= 90);
  assert.deepEqual(log, ['open', 'run', 'terminate', 'open']);
  const after = await runner.run('SELECT 2');
  assert.equal(after.ok, true);
});

test('if no worker can be made, queries run on the fallback instead', async () => {
  const runner = R.createQueryRunner({ makeWorker: () => { throw new Error('blocked'); }, fallback: sql => ({ ok: true, columns: ['f'], rows: [[sql]], truncated: false }) });
  await runner.open(schema);
  assert.deepEqual((await runner.run('SELECT 3')).rows, [['SELECT 3']]);
  assert.equal(runner.usingWorker, false);
});

test('workerMain answers open and run messages using real sql.js', async () => {
  const SQL = await getSQL();
  const posted = [];
  const self = { postMessage: m => posted.push(m) };
  R.workerMain(self, async () => SQL);
  const spotify = S.buildSchema(loadDatasets()[0]);
  await self.onmessage({ data: { type: 'open', schema: spotify } });
  await self.onmessage({ data: { type: 'run', id: 7, sql: "SELECT artist_name FROM Artists WHERE genre = 'Latin'" } });
  await self.onmessage({ data: { type: 'run', id: 8, sql: 'DELETE FROM Artists' } });
  assert.deepEqual(posted[0], { type: 'opened' });
  assert.deepEqual(posted[1], { type: 'result', id: 7, result: { ok: true, columns: ['artist_name'], rows: [['Bad Bunny'], ['Karol G']], truncated: false } });
  assert.equal(posted[2].result.error.kind, 'readonly');
});

test('workerMain handles messages in order, even a run sent before open has finished', async () => {
  const SQL = await getSQL();
  const posted = [];
  const self = { postMessage: m => posted.push(m) };
  R.workerMain(self, () => new Promise(resolve => setTimeout(() => resolve(SQL), 30)));
  const done = [
    self.onmessage({ data: { type: 'open', schema: S.buildSchema(loadDatasets()[0]) } }),
    self.onmessage({ data: { type: 'run', id: 1, sql: 'SELECT COUNT(*) FROM Songs' } }),
  ];
  await Promise.all(done);
  assert.deepEqual(posted.map(m => m.type), ['opened', 'result']);
  assert.deepEqual(posted[1].result.rows, [[14]]);
});
