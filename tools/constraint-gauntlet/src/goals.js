// Constraint Gauntlet: level goals, checked against the attempt log and session state (no AI judging).
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;

  const list = v => (Array.isArray(v) ? v : [v]);
  const matches = (match, row) => (typeof match === 'function' ? !!match(row)
    : Object.entries(match || {}).every(([k, v]) => row[k] === v));

  const CHECKS = {
    accepted: (g, st) => st.log.some(a => (a.outcome === 'accepted' || a.outcome === 'slipped') && a.kind !== 'delete'
      && a.table === g.table && a.rows.some(r => matches(g.match, r))),
    'rejected-by': (g, st) => {
      const hits = st.log.filter(a => a.outcome === 'rejected' && a.error
        && (!g.errorKind || list(g.errorKind).includes(a.error.kind))
        && (!g.column || (a.error.columns || []).includes(g.column))
        && (!g.attemptKind || a.kind === g.attemptKind)
        && (!g.table || a.table === g.table));
      if (!g.distinct) return hits.length > 0;
      const key = g.distinctBy === 'rule' ? a => a.error.chips.rule : a => `${a.table}.${(a.error.columns || [])[0]}`;
      return new Set(hits.map(key)).size >= g.distinct;
    },
    slipped: (g, st) => st.log.some(a => a.outcome === 'slipped' && (!g.rule || a.broken.includes(g.rule)) && (!g.table || a.table === g.table)),
    predicted: (g, st) => st.predictions[g.predict] !== undefined,
    fixed: (g, st) => st.fixes.some(f => f.table === g.table && f.passed),
    flag: (g, st) => !!st.flags[g.flag],
    state: (g, st) => { try { return !!g.check(st); } catch (_) { return false; } },
  };

  function evaluate(level, st) {
    return (level.goals || []).map(g => {
      const check = CHECKS[g.kind];
      if (!check) throw new Error(`Level ${level.id}: unknown goal kind "${g.kind}"`);
      return { id: g.id, text: g.text, optional: !!g.optional, met: check(g, st) };
    });
  }

  const complete = (level, st) => evaluate(level, st).every(g => g.met || g.optional);

  const api = { evaluate, complete, GOAL_KINDS: Object.keys(CHECKS) };
  if (isNode) module.exports = api;
  else root.CG = Object.assign(root.CG || {}, api);
})(this);
