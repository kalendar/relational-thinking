// SQL Studio: runs students' queries in a Web Worker, so a query that takes too long can be stopped
// (sql.js itself can't be interrupted). The worker is replaced and reopened after a timeout.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const X = isNode ? require('./db.js') : root.SS;

  const TIMEOUT_MS = 6000;
  const TIMEOUT_RESULT = () => ({ ok: false, error: { kind: 'timeout', message: '' } });

  // makeWorker() returns a Worker-like object (postMessage, onmessage, terminate). If it throws,
  // queries run through `fallback(sql)` on the page instead (no timeout possible then).
  function createQueryRunner({ makeWorker, timeoutMs = TIMEOUT_MS, fallback = null }) {
    let worker = null;
    let schema = null;
    let nextId = 1;
    const pending = new Map(); // id -> { resolve, timer }
    let opened = null; // { resolve } while waiting for 'opened'

    function start() {
      try {
        worker = makeWorker();
      } catch (e) {
        worker = null;
        return;
      }
      worker.onmessage = e => {
        const m = e.data;
        if (m.type === 'opened' && opened) { opened.resolve(); opened = null; }
        if (m.type === 'result' && pending.has(m.id)) {
          const p = pending.get(m.id);
          clearTimeout(p.timer);
          pending.delete(m.id);
          p.resolve(m.result);
        }
      };
    }

    function open(next) {
      schema = next;
      if (!worker) start();
      if (!worker) return Promise.resolve();
      return new Promise(resolve => {
        opened = { resolve };
        worker.postMessage({ type: 'open', schema });
      });
    }

    // Stops the stuck worker, answers every waiting query with a timeout, and opens a fresh worker.
    function restart() {
      worker.terminate();
      for (const p of pending.values()) { clearTimeout(p.timer); p.resolve(TIMEOUT_RESULT()); }
      pending.clear();
      start();
      if (worker && schema) {
        opened = { resolve() {} };
        worker.postMessage({ type: 'open', schema });
      }
    }

    function run(sql, { maxRows } = {}) {
      if (!worker) return Promise.resolve(fallback ? fallback(sql, { maxRows }) : { ok: false, error: { kind: 'sqlite', message: 'No database is open.' } });
      const id = nextId++;
      return new Promise(resolve => {
        const timer = setTimeout(restart, timeoutMs);
        pending.set(id, { resolve, timer });
        worker.postMessage({ type: 'run', id, sql, maxRows });
      });
    }

    function close() {
      if (worker) worker.terminate();
      worker = null;
    }

    return { open, run, close, get usingWorker() { return !!worker; } };
  }

  // The worker side. `self` is the worker global; loadSQL() resolves to the sql.js module.
  function workerMain(self, loadSQL) {
    let SQL = null;
    let studio = null;
    // Messages are handled one at a time, in order, so a run never starts before its open has finished.
    let queue = Promise.resolve();
    async function handle(m) {
      if (m.type === 'open') {
        if (!SQL) SQL = await loadSQL();
        if (studio) X.closeStudio(studio);
        studio = X.openStudio(SQL, m.schema);
        self.postMessage({ type: 'opened' });
      } else if (m.type === 'run') {
        const result = studio ? X.runQuery(studio, m.sql, m.maxRows ? { maxRows: m.maxRows } : undefined) : { ok: false, error: { kind: 'sqlite', message: 'No database is open.' } };
        self.postMessage({ type: 'result', id: m.id, result });
      }
    }
    self.onmessage = e => (queue = queue.then(() => handle(e.data)));
  }

  const api = { TIMEOUT_MS, createQueryRunner, workerMain };
  if (isNode) module.exports = api;
  else root.SS = Object.assign(root.SS || {}, api);
})(this);
