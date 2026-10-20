const test = require('node:test');
const assert = require('node:assert/strict');
const U = require('../src/upload-parse.js');
const D = require('../src/db.js');
const { getSQL } = require('./helpers.js');

test('parseCSV: quotes, doubled quotes, commas and newlines inside quotes, CRLF, BOM, blank lines', () => {
  const text = '﻿name,notes\r\n"Swift, Taylor","said ""hi""\nthen left"\r\n\r\nSZA,\n';
  assert.deepEqual(U.parseCSV(text), [['name', 'notes'], ['Swift, Taylor', 'said "hi"\nthen left'], ['SZA', '']]);
});

test('parseCSV: an unclosed quote is a clear error', () => {
  assert.throws(() => U.parseCSV('a,b\n"oops,1\n'), /never closed/);
});

test('cleanColumnName: snake_case, digits, keywords, duplicates', () => {
  const used = new Set();
  assert.equal(U.cleanColumnName('Order Date', used), 'order_date');
  assert.equal(U.cleanColumnName('2025 Sales', used), 'c_2025_sales');
  assert.equal(U.cleanColumnName('Group', used), 'group_col');
  assert.equal(U.cleanColumnName('order date', used), 'order_date_2');
  assert.equal(U.cleanColumnName('', used), 'unnamed');
});

test('cleanTableName keeps case and drops the extension', () => {
  const used = new Set();
  assert.equal(U.cleanTableName('My Orders.csv', used), 'My_Orders');
  assert.equal(U.cleanTableName('my orders.xlsx', used), 'my_orders_2');
  assert.equal(U.cleanTableName('Order', used), 'Order_table');
});

test('inferColumn: numbers with commas, dates in two forms, text, empties', () => {
  assert.deepEqual(U.inferColumn(['1,200', '3.5', '', '-4']), { type: 'number', values: [1200, 3.5, null, -4] });
  assert.deepEqual(U.inferColumn(['2026-03-01', '3/9/2026', null]), { type: 'date', values: ['2026-03-01', '2026-03-09', null] });
  assert.deepEqual(U.inferColumn(['12', 'twelve']), { type: 'text', values: ['12', 'twelve'] });
  assert.deepEqual(U.inferColumn([new Date(2026, 0, 5)]), { type: 'date', values: ['2026-01-05'] });
  assert.equal(U.inferColumn(['', '']).type, 'text');
});

test('buildUploadSchema guesses keys and relationships, and loads into SQLite', async () => {
  const { schema, renamed } = U.buildUploadSchema([
    { name: 'Customers.csv', rows: [['customer_id', 'Full Name'], ['1', 'Ana'], ['2', 'Ben']] },
    { name: 'Orders.csv', rows: [['order_id', 'customer_id', 'Order Date', 'Total'], ['10', '1', '2026-03-01', '19.99'], ['11', '1', '2026-03-02', '5'], ['12', '2', '', '7.5']] },
  ]);
  assert.deepEqual(schema.tables.map(t => t.name), ['Customers', 'Orders']);
  const orders = schema.tables[1];
  assert.equal(orders.columns[0].pk, true);
  assert.deepEqual(orders.columns[1].fk, { table: 'Customers', column: 'customer_id' });
  assert.equal(orders.columns[2].type, 'date');
  assert.equal(orders.columns[3].sqlType, 'REAL');
  assert.deepEqual(schema.relationships, [{ from: { table: 'Orders', column: 'customer_id' }, to: { table: 'Customers', column: 'customer_id' } }]);
  assert.deepEqual(renamed.map(r => `${r.from}->${r.to}`), ['Full Name->full_name', 'Order Date->order_date', 'Total->total']);
  const st = D.openStudio(await getSQL(), schema);
  const r = D.runQuery(st, 'SELECT c.full_name, SUM(o.total) FROM Orders o JOIN Customers c ON c.customer_id = o.customer_id GROUP BY c.full_name');
  assert.deepEqual(r.rows, [['Ana', 24.99], ['Ben', 7.5]]);
  D.closeStudio(st);
});

test('"id" primary keys link from "<table>_id" columns, singular or plural', () => {
  const { schema } = U.buildUploadSchema([
    { name: 'Artists', rows: [['id', 'name'], [1, 'SZA'], [2, 'Drake']] },
    { name: 'Songs', rows: [['id', 'artist_id', 'title'], [1, 1, 'Saturn'], [2, 2, 'NOKIA']] },
  ]);
  assert.deepEqual(schema.relationships, [{ from: { table: 'Songs', column: 'artist_id' }, to: { table: 'Artists', column: 'id' } }]);
});

test('a column with repeated values is not a primary key', () => {
  const { schema } = U.buildUploadSchema([{ name: 'T', rows: [['team_id', 'x'], [1, 'a'], [1, 'b']] }]);
  assert.equal(schema.tables[0].columns[0].pk, false);
});

test('limits and bad shapes give plain messages', () => {
  assert.throws(() => U.buildUploadSchema([{ name: 'a', rows: [] }]), /couldn't find any data/);
  assert.throws(() => U.buildUploadSchema([{ name: 'a', rows: [['x'], [1, 2]] }]), /Row 2 in a has more values/);
  assert.throws(() => U.buildUploadSchema([{ name: 'a', rows: [['x'], [1], [2], [3]] }], { maxTables: 5, maxRows: 2 }), /up to 2 per table/);
  const many = Array.from({ length: 3 }, (_, i) => ({ name: `t${i}`, rows: [['x'], [1]] }));
  assert.throws(() => U.buildUploadSchema(many, { maxTables: 2, maxRows: 10 }), /up to 2\./);
});

test('every SQLite reserved word is renamed, so uploaded columns and tables are usable without quotes', async () => {
  const headers = ['id', 'index', 'transaction', 'check', 'default', 'amount', 'to', 'from', 'unique', 'commit'];
  const { schema } = U.buildUploadSchema([
    { name: 'Sales', rows: [headers, headers.map((_, i) => i + 1)] },
    { name: 'sqlite_stats.csv', rows: [['x'], [1]] },
    { name: 'Index.csv', rows: [['y'], [2]] },
  ]);
  const names = schema.tables[0].columns.map(c => c.name);
  assert.deepEqual(names, ['id', 'index_col', 'transaction_col', 'check_col', 'default_col', 'amount', 'to_col', 'from_col', 'unique_col', 'commit_col']);
  assert.deepEqual(schema.tables.map(t => t.name), ['Sales', 'T_sqlite_stats', 'Index_table']);
  const st = D.openStudio(await getSQL(), schema);
  const r = D.runQuery(st, `SELECT ${names.join(', ')} FROM Sales`);
  assert.equal(r.ok, true, r.error && r.error.message);
  assert.equal(D.runQuery(st, 'SELECT x FROM T_sqlite_stats').ok, true);
  D.closeStudio(st);
});
