// SQL Studio: compares a student's result with the expected result, and explains the difference kindly.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const X = isNode ? require('./db.js') : root.SS;

  function valuesEqual(a, b) {
    if (a === null || a === undefined || b === null || b === undefined) return (a === null || a === undefined) && (b === null || b === undefined);
    if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= Math.max(0.005, 1e-6 * Math.max(Math.abs(a), Math.abs(b)));
    return a === b;
  }

  const rowsEqual = (r1, r2) => r1.length === r2.length && r1.every((v, i) => valuesEqual(v, r2[i]));

  // A sort key that puts near-equal numbers next to each other (rounded to 2 decimals).
  const keyOf = row => JSON.stringify(row.map(v => (typeof v === 'number' ? ['n', Math.round(v * 100) / 100] : [v === null ? 'z' : 's', v])));
  const sorted = rows => rows.map(r => [keyOf(r), r]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map(x => x[1]);

  function sameMultiset(a, b) {
    const sa = sorted(a);
    const sb = sorted(b);
    if (sa.every((r, i) => rowsEqual(r, sb[i]))) return true;
    if (a.length > 2000) return false;
    // Rounding can place near-equal numbers in different order; fall back to greedy matching.
    const used = new Array(b.length).fill(false);
    return a.every(r => {
      const k = b.findIndex((r2, i) => !used[i] && rowsEqual(r, r2));
      if (k === -1) return false;
      used[k] = true;
      return true;
    });
  }

  const plural = (n, one, many) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

  function compareResults(student, expected, { orderMatters = false } = {}) {
    const sc = student.columns.length;
    const ec = expected.columns.length;
    const sr = student.rows.length;
    const er = expected.rows.length;
    if (sc !== ec) return { ok: false, code: 'columns', message: `Close! Your result has ${plural(sc, 'column', 'columns')}; the expected result has ${ec}. Check your SELECT list.` };
    if (sr > er) return { ok: false, code: 'more-rows', message: `Close! Your result has ${plural(sr, 'row', 'rows')}; the expected result has ${er}. Check your WHERE clause, or whether you need GROUP BY.` };
    if (sr < er) return { ok: false, code: 'fewer-rows', message: `Close! Your result has ${plural(sr, 'row', 'rows')}; the expected result has ${er}. Check your WHERE conditions and your JOINs.` };
    if (!sameMultiset(student.rows, expected.rows)) return { ok: false, code: 'values', message: 'Your result is the right size, but some values are different. Check your calculations and which columns you picked.' };
    if (orderMatters && !student.rows.every((r, i) => rowsEqual(r, expected.rows[i]))) return { ok: false, code: 'order', message: 'You have the right rows, but not in the right order. Check your ORDER BY.' };
    return { ok: true, code: 'match', message: `Nice! Your result matches. ${plural(er, 'row', 'rows')} × ${plural(ec, 'column', 'columns')}.` };
  }

  const stripSemi = s => s.replace(/;\s*$/, '');

  function checkExercise(studio, statementText, exercise) {
    const student = X.runQuery(studio, statementText);
    if (!student.ok) return { ok: false, code: 'error', message: 'Fix the error, then check again.', error: student.error };
    const expected = X.runQuery(studio, stripSemi(exercise.answer));
    if (!expected.ok) throw new Error(`Exercise answer failed: ${expected.error.message}`);
    return Object.assign(compareResults(student, expected, { orderMatters: !!exercise.orderMatters }), { student });
  }

  const api = { valuesEqual, compareResults, checkExercise };
  if (isNode) module.exports = api;
  else root.SS = Object.assign(root.SS || {}, api);
})(this);
