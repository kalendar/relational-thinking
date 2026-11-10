// Constraint Gauntlet: the hidden business rules. A row that the database accepts but a rule rejects has
// "slipped through". Rules are judged against the data as it was before the statement ran.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const D = isNode ? require('./db.js') : root.CG;

  // Empty text is not NULL to SQLite, but it is blank to a business (Review Focus 7).
  const isBlank = v => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

  // Rules that look at other rows must ignore the row with _rowid === ctx.self (an UPDATE's own row).
  const makeCtx = (game, self = null) => ({ query: (sql, params = []) => D.readQuery(game, sql, params).rows, self });

  function brokenRules(level, table, row, ctx) {
    const out = [];
    for (const r of level.rules || []) {
      if (r.table !== table) continue;
      let ok;
      try { ok = r.check(row, ctx); } catch (e) {
        ok = false;
        if (typeof console !== 'undefined') console.warn(`Level ${level.id}: rule ${r.id} threw: ${e.message}`);
      }
      if (!ok) out.push(r.id);
    }
    return out;
  }

  function ruleText(level, id) {
    const r = (level.rules || []).find(x => x.id === id);
    return r ? r.text : id;
  }

  const api = { isBlank, makeCtx, brokenRules, ruleText };
  if (isNode) module.exports = api;
  else root.CG = Object.assign(root.CG || {}, api);
})(this);
