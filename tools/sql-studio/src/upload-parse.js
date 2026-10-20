// SQL Studio: turns uploaded CSV text or spreadsheet rows into a schema (same shape as schema.buildSchema). No DOM.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;
  const X = isNode ? Object.assign({}, require('./sql-text.js'), require('./schema.js')) : root.SS;

  const LIMITS = { maxBytes: 5 * 1024 * 1024, maxTables: 20, maxRows: 50000 };

  class UploadError extends Error {}

  // RFC 4180: quoted fields, "" escapes, commas/newlines inside quotes, CRLF, BOM. Drops blank lines.
  function parseCSV(text) {
    const s = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    let i = 0;
    const endField = () => { row.push(field); field = ''; };
    const endRow = () => { endField(); if (row.length > 1 || row[0] !== '') rows.push(row); row = []; };
    while (i < s.length) {
      const c = s[i];
      if (quoted) {
        if (c === '"' && s[i + 1] === '"') { field += '"'; i += 2; continue; }
        if (c === '"') { quoted = false; i++; continue; }
        field += c; i++; continue;
      }
      if (c === '"' && field === '') { quoted = true; i++; continue; }
      if (c === ',') { endField(); i++; continue; }
      if (c === '\r' && s[i + 1] === '\n') { endRow(); i += 2; continue; }
      if (c === '\n' || c === '\r') { endRow(); i++; continue; }
      field += c; i++;
    }
    if (quoted) throw new UploadError('This file has a quote (") that is never closed.');
    if (field !== '' || row.length) endRow();
    return rows;
  }

  function cleanColumnName(raw, used) {
    let n = String(raw === null || raw === undefined ? '' : raw).trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (!n) n = 'column';
    if (/^[0-9]/.test(n)) n = `c_${n}`;
    if (X.isKeyword(n)) n = `${n}_col`;
    return unique(n, used);
  }

  function cleanTableName(raw, used) {
    let n = String(raw || '').replace(/\.(csv|xlsx|xls)$/i, '').trim().replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (!n) n = 'Table';
    if (/^[0-9]/.test(n)) n = `T_${n}`;
    if (X.isKeyword(n)) n = `${n}_table`;
    return unique(n, used);
  }

  function unique(n, used) {
    let name = n;
    let k = 2;
    while (used.has(name.toLowerCase())) name = `${n}_${k++}`;
    used.add(name.toLowerCase());
    return name;
  }

  const NUM = /^[-+]?(\d{1,3}(,\d{3})+|\d+)?(\.\d+)?$/;
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  const US = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const pad = n => String(n).padStart(2, '0');
  const isoOfDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const empty = v => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

  function inferColumn(values) {
    const present = values.filter(v => !empty(v));
    const asNumber = v => (typeof v === 'number' ? v : Number(String(v).trim().replace(/,/g, '')));
    if (present.length && present.every(v => typeof v === 'number' || (typeof v === 'string' && NUM.test(v.trim()) && /\d/.test(v)))) {
      return { type: 'number', values: values.map(v => (empty(v) ? null : asNumber(v))) };
    }
    const toDate = v => {
      if (v instanceof Date && !isNaN(v)) return isoOfDate(v);
      const s = String(v).trim();
      if (ISO.test(s)) return s;
      const m = US.exec(s);
      return m ? `${m[3]}-${pad(m[1])}-${pad(m[2])}` : null;
    };
    if (present.length && present.every(v => toDate(v) !== null)) return { type: 'date', values: values.map(v => (empty(v) ? null : toDate(v))) };
    return { type: 'text', values: values.map(v => (empty(v) ? null : v instanceof Date ? isoOfDate(v) : String(v))) };
  }

  // sheets: [{ name, rows: any[][] }] where rows[0] is the header.
  function buildUploadSchema(sheets, limits = LIMITS) {
    const usable = sheets.filter(s => s.rows.length && s.rows[0].some(h => !empty(h)));
    if (!usable.length) throw new UploadError("We couldn't find any data. The first row should hold the column names.");
    if (usable.length > limits.maxTables) throw new UploadError(`That's ${usable.length} tables. SQL Studio can load up to ${limits.maxTables}.`);
    const usedTables = new Set();
    const renamed = [];
    const tables = usable.map(sheet => {
      const name = cleanTableName(sheet.name, usedTables);
      const header = sheet.rows[0];
      const body = sheet.rows.slice(1);
      if (body.length > limits.maxRows) throw new UploadError(`${name} has ${body.length.toLocaleString('en-US')} rows. SQL Studio can load up to ${limits.maxRows.toLocaleString('en-US')} per table.`);
      body.forEach((r, k) => {
        if (r.length > header.length && r.slice(header.length).some(v => !empty(v))) {
          throw new UploadError(`Row ${k + 2} in ${name} has more values than there are column names.`);
        }
      });
      const usedCols = new Set();
      const columns = header.map((raw, i) => {
        const clean = cleanColumnName(raw, usedCols);
        if (String(raw).trim() !== clean) renamed.push({ table: name, from: String(raw === null || raw === undefined ? '' : raw).trim(), to: clean });
        const inferred = inferColumn(body.map(r => r[i]));
        return { name: clean, type: inferred.type, values: inferred.values };
      });
      const rows = body.map((_, k) => columns.map(c => c.values[k]));
      return {
        name,
        columns: columns.map(c => ({ name: c.name, type: c.type, sqlType: c.type === 'number' ? (c.values.every(v => v === null || Number.isInteger(v)) ? 'INTEGER' : 'REAL') : 'TEXT', pk: false, fk: null })),
        rows,
      };
    });
    guessKeys(tables);
    return {
      schema: { id: 'upload', number: 0, name: 'Your data', description: tables.map(t => t.name).join(' · '), tables, relationships: X.relationshipsOf(tables) },
      renamed,
    };
  }

  const singular = s => s.toLowerCase().replace(/ies$/, 'y').replace(/s$/, '');

  // Primary key: first "id" or "<x>_id" column with unique, non-empty values.
  // Foreign key: "<x>_id" in another table, pointing at the table whose primary key is "<x>_id",
  // or at a table named like <x> (singular or plural) whose primary key is "id".
  function guessKeys(tables) {
    for (const t of tables) {
      const pk = t.columns.findIndex((c, i) => (c.name === 'id' || /_id$/.test(c.name)) && t.rows.length > 0
        && t.rows.every(r => r[i] !== null) && new Set(t.rows.map(r => r[i])).size === t.rows.length);
      if (pk !== -1) t.columns[pk].pk = true;
    }
    for (const t of tables) {
      for (const c of t.columns) {
        if (c.pk || !/_id$/.test(c.name)) continue;
        const stem = c.name.slice(0, -3);
        const target = tables.find(o => o !== t && o.columns.some(oc => oc.pk && oc.name === c.name))
          || tables.find(o => o !== t && singular(o.name) === singular(stem) && o.columns.some(oc => oc.pk && oc.name === 'id'));
        if (!target) continue;
        const pkCol = target.columns.find(oc => oc.pk);
        if (pkCol.type !== c.type) continue;
        c.fk = { table: target.name, column: pkCol.name };
      }
    }
    return tables;
  }

  const api = { LIMITS, UploadError, parseCSV, cleanColumnName, cleanTableName, inferColumn, buildUploadSchema, guessKeys };
  if (isNode) module.exports = api;
  else root.SS = Object.assign(root.SS || {}, api);
})(this);
