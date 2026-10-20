// SQL Studio: keeps each data set's editor text for this visit. Results, errors, and checks are never kept,
// so switching back never shows them against the wrong data.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;

  function starterSql(schema) {
    const first = schema.tables[0] ? schema.tables[0].name : 'TableName';
    return `-- Write a query, then press Run (or Ctrl+Enter).\nSELECT *\nFROM ${first};\n`;
  }

  function createSessions() {
    const saved = new Map();
    return {
      // Call before switching away from a data set.
      leave(id, { text, cursor = null, exerciseIndex = 0 }) {
        saved.set(id, { text, cursor, exerciseIndex });
      },
      // Returns the editor state to show for a data set: the saved one, or a fresh starter.
      enter(id, schema) {
        const s = saved.get(id);
        return s ? { text: s.text, cursor: s.cursor, exerciseIndex: s.exerciseIndex } : { text: starterSql(schema), cursor: null, exerciseIndex: 0 };
      },
      // A new upload replaces "Your data", so its old text goes too.
      forget(id) {
        saved.delete(id);
      },
    };
  }

  const api = { starterSql, createSessions };
  if (isNode) module.exports = api;
  else root.SS = Object.assign(root.SS || {}, api);
})(this);
