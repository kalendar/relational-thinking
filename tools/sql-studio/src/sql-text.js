// SQL Studio: SQL text tools: tokenizer, statement splitting, statement at cursor, aliases.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;

  const KEYWORDS = new Set(('SELECT DISTINCT ALL FROM WHERE AND OR NOT IN IS NULL LIKE GLOB BETWEEN EXISTS AS ON USING ' +
    'JOIN INNER LEFT RIGHT FULL OUTER CROSS NATURAL GROUP BY HAVING ORDER ASC DESC LIMIT OFFSET UNION INTERSECT EXCEPT ' +
    'CASE WHEN THEN ELSE END CAST WITH RECURSIVE VALUES INSERT INTO UPDATE SET DELETE CREATE TABLE DROP ALTER ' +
    'PRIMARY KEY REFERENCES COLLATE NOCASE ESCAPE TRUE FALSE').split(' '));
  const isKeyword = w => KEYWORDS.has(String(w).toUpperCase());

  const OPS = ['<>', '!=', '>=', '<=', '==', '||', '<<', '>>', '=', '<', '>', '+', '-', '*', '/', '%', '&', '|', '~'];

  function tokenize(sql) {
    const out = [];
    let i = 0;
    const n = sql.length;
    const push = (type, start, end, extra) => out.push(Object.assign({ type, text: sql.slice(start, end), start, end }, extra));
    while (i < n) {
      const c = sql[i];
      const start = i;
      if (/\s/.test(c)) {
        while (i < n && /\s/.test(sql[i])) i++;
        push('ws', start, i);
      } else if (c === '-' && sql[i + 1] === '-') {
        while (i < n && sql[i] !== '\n') i++;
        push('comment', start, i);
      } else if (c === '/' && sql[i + 1] === '*') {
        const close = sql.indexOf('*/', i + 2);
        i = close === -1 ? n : close + 2;
        push('comment', start, i, close === -1 ? { open: true } : undefined);
      } else if (c === "'" || c === '"' || c === '`' || c === '[') {
        const endCh = c === '[' ? ']' : c;
        i++;
        let open = true;
        while (i < n) {
          if (sql[i] === endCh) {
            if (endCh !== ']' && sql[i + 1] === endCh) { i += 2; continue; }
            i++;
            open = false;
            break;
          }
          i++;
        }
        push(c === "'" ? 'string' : 'qident', start, i, open ? { open: true } : undefined);
      } else if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(sql[i + 1] || ''))) {
        while (i < n && /[0-9.]/.test(sql[i])) i++;
        if (/[eE]/.test(sql[i] || '') && /[-+0-9]/.test(sql[i + 1] || '')) { i += 2; while (i < n && /[0-9]/.test(sql[i])) i++; }
        push('number', start, i);
      } else if (/[A-Za-z_À-￿]/.test(c)) {
        while (i < n && /[A-Za-z0-9_$À-￿]/.test(sql[i])) i++;
        push('word', start, i);
      } else {
        const op = OPS.find(o => sql.startsWith(o, i));
        if (op) { i += op.length; push('op', start, i); } else { i++; push('punct', start, i); }
      }
    }
    return out;
  }

  const isBlank = toks => toks.every(t => t.type === 'ws' || t.type === 'comment');

  function splitStatements(sql) {
    const toks = tokenize(sql);
    const parts = [];
    let start = 0;
    let bucket = [];
    for (const t of toks) {
      if (t.type === 'punct' && t.text === ';') {
        parts.push({ text: sql.slice(start, t.start), start, end: t.end, empty: isBlank(bucket) });
        start = t.end;
        bucket = [];
      } else bucket.push(t);
    }
    if (start < sql.length || parts.length === 0) parts.push({ text: sql.slice(start), start, end: sql.length, empty: isBlank(bucket) });
    return parts;
  }

  function statementAt(sql, offset) {
    const parts = splitStatements(sql);
    let idx = parts.findIndex(p => offset >= p.start && offset < p.end);
    if (idx === -1) idx = parts.length - 1;
    // Cursor at the very start of a statement belongs to the one before it if that one ended right here.
    while (idx >= 0 && parts[idx].empty) idx--;
    if (idx < 0) return null;
    const p = parts[idx];
    return { text: p.text, start: p.start, end: p.end };
  }

  const unquote = t => (t.type === 'qident' ? t.text.slice(1, -1).replace(/""/g, '"') : t.text);

  function aliasMap(statementText, tableNames) {
    const byLower = new Map(tableNames.map(n => [n.toLowerCase(), n]));
    const toks = tokenize(statementText).filter(t => t.type !== 'ws' && t.type !== 'comment');
    const map = new Map();
    for (let i = 0; i < toks.length; i++) {
      const w = toks[i].type === 'word' ? toks[i].text.toUpperCase() : '';
      const isSource = w === 'FROM' || w === 'JOIN' || (toks[i].type === 'punct' && toks[i].text === ',' && map.size > 0);
      if (!isSource) continue;
      const tt = toks[i + 1];
      if (!tt || (tt.type !== 'word' && tt.type !== 'qident')) continue;
      const table = byLower.get(unquote(tt).toLowerCase());
      if (!table) continue;
      map.set(table.toLowerCase(), table);
      let j = i + 2;
      if (toks[j] && toks[j].type === 'word' && toks[j].text.toUpperCase() === 'AS') j++;
      const a = toks[j];
      if (a && (a.type === 'word' || a.type === 'qident') && !isKeyword(a.text)) map.set(unquote(a).toLowerCase(), table);
    }
    return map;
  }

  function lineCol(text, offset) {
    const before = text.slice(0, offset);
    const lines = before.split('\n');
    return { line: lines.length, col: lines[lines.length - 1].length + 1 };
  }

  function offsetOf(text, line, col) {
    const lines = text.split('\n');
    let off = 0;
    for (let k = 0; k < line - 1 && k < lines.length; k++) off += lines[k].length + 1;
    return off + col - 1;
  }

  const api = { KEYWORDS, isKeyword, tokenize, splitStatements, statementAt, aliasMap, lineCol, offsetOf };
  if (isNode) module.exports = api;
  else root.SS = Object.assign(root.SS || {}, api);
})(this);
