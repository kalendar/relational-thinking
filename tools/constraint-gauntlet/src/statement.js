// Constraint Gauntlet: decides which statements may run in SQL mode, and which table they change.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const T = isNode ? require('../../sql-studio/src/sql-text.js') : root.SS;

  const MESSAGES = {
    empty: "There's no statement here to run.",
    many: 'Run one statement at a time. Put the cursor in the one you want, then press Run.',
    conflict: '`OR REPLACE`, `OR IGNORE`, and `ON CONFLICT` tell the database to skip its own rules or quietly remove rows. ' +
      'In the Gauntlet, the database always says what it thinks. Take that part out and run it again.',
    rules: 'To change the rules, use **Fix the rule** below. That keeps your table’s data safe.',
    transaction: 'Transactions come in section 11.3. This tool runs each statement on its own.',
    internal: 'That’s one of SQLite’s own tables. The Gauntlet only works with this level’s tables.',
    other: 'The Gauntlet runs INSERT, UPDATE, DELETE, and SELECT.',
  };

  const RULE_WORDS = new Set(['CREATE', 'ALTER', 'DROP']);
  const TX_WORDS = new Set(['BEGIN', 'COMMIT', 'END', 'ROLLBACK', 'SAVEPOINT', 'RELEASE']);
  const unquote = t => (t.type === 'qident' ? t.text.slice(1, -1).replace(/""/g, '"') : t.text);
  const fail = (reason, extra) => ({ ok: false, reason, message: extra || MESSAGES[reason] });
  const listNames = names => (names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

  function classify(text, tableNames) {
    const parts = T.splitStatements(text || '').filter(p => !p.empty);
    if (!parts.length) return fail('empty');
    if (parts.length > 1) return fail('many');
    const toks = T.tokenize(parts[0].text).filter(t => t.type !== 'ws' && t.type !== 'comment');
    const W = i => (toks[i] && toks[i].type === 'word' ? toks[i].text.toUpperCase() : '');
    if (toks.some(t => (t.type === 'word' || t.type === 'qident') && /^sqlite_/i.test(unquote(t)))) return fail('internal');
    for (let i = 0; i < toks.length - 1; i++) if (W(i) === 'ON' && W(i + 1) === 'CONFLICT') return fail('conflict');
    const first = W(0);
    if (first === 'REPLACE') return fail('conflict');
    if ((first === 'INSERT' || first === 'UPDATE') && W(1) === 'OR') return fail('conflict');
    if (RULE_WORDS.has(first)) return fail('rules');
    if (TX_WORDS.has(first)) return fail('transaction');
    if (first === 'SELECT' || (first === 'WITH' && toks.some((t, i) => i > 0 && W(i) === 'SELECT') && !toks.some((t, i) => ['INSERT', 'UPDATE', 'DELETE'].includes(W(i))))) {
      return { ok: true, kind: 'select', table: null };
    }
    let at = -1;
    let kind = null;
    if (first === 'INSERT' && W(1) === 'INTO') { kind = 'insert'; at = 2; }
    else if (first === 'UPDATE') { kind = 'update'; at = 1; }
    else if (first === 'DELETE' && W(1) === 'FROM') { kind = 'delete'; at = 2; }
    if (!kind) return fail('other');
    let tok = toks[at];
    // Allow main.Student; anything else qualified (temp.X) isn't a level table.
    if (tok && toks[at + 1] && toks[at + 1].text === '.' && /^main$/i.test(unquote(tok))) tok = toks[at + 2];
    else if (tok && toks[at + 1] && toks[at + 1].text === '.') tok = null;
    const name = tok && (tok.type === 'word' || tok.type === 'qident') ? unquote(tok) : '';
    const table = tableNames.find(n => n.toLowerCase() === name.toLowerCase());
    if (!table) return fail('table', `This level’s tables are ${listNames(tableNames)}.`);
    return { ok: true, kind, table };
  }

  const api = { classify, STATEMENT_MESSAGES: MESSAGES };
  if (isNode) module.exports = api;
  else root.CG = Object.assign(root.CG || {}, api);
})(this);
