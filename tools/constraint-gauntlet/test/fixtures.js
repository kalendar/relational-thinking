// Small table definitions shared by the logic tests (not the real levels).
const student = {
  name: 'Student',
  columns: [
    { name: 'student_id', type: 'int', pk: true },
    { name: 'first_name', type: 'varchar', size: 50, notNull: true },
    { name: 'last_name', type: 'varchar', size: 50 },
    { name: 'email', type: 'varchar', size: 255, notNull: true, unique: true },
    { name: 'is_active', type: 'boolean', notNull: true, default: true },
  ],
};
const concert = {
  name: 'Concert',
  columns: [
    { name: 'concert_id', type: 'int', pk: true },
    { name: 'artist', type: 'varchar', size: 100, notNull: true },
  ],
};
const ticket = {
  name: 'Ticket',
  columns: [
    { name: 'ticket_id', type: 'int', pk: true },
    { name: 'student_id', type: 'int', notNull: true, fk: { table: 'Student', column: 'student_id', onDelete: 'RESTRICT' } },
    { name: 'concert_id', type: 'int', notNull: true, fk: { table: 'Concert', column: 'concert_id', onDelete: 'RESTRICT' } },
    { name: 'price_paid', type: 'decimal', precision: [8, 2], notNull: true, check: { expr: 'price_paid >= 0', text: '`price_paid` must be 0 or more.' } },
    { name: 'purchase_date', type: 'date', notNull: true },
  ],
};
const level = {
  id: 99, title: 'Test level', section: '11.2', mission: 'Test.',
  tables: [student, concert, ticket],
  seed: {
    Student: [
      { student_id: 1, first_name: 'Maya', last_name: 'Patel', email: 'maya.patel@marshall.edu' },
      { student_id: 2, first_name: 'Jordan', last_name: 'Lee', email: 'jlee@marshall.edu', is_active: true },
    ],
    Concert: [{ concert_id: 1, artist: 'Zach Bryan' }, { concert_id: 2, artist: 'Noah Kahan' }],
    Ticket: [
      { ticket_id: 1, student_id: 1, concert_id: 1, price_paid: 89.5, purchase_date: '2026-11-01' },
      { ticket_id: 2, student_id: 2, concert_id: 2, price_paid: 62, purchase_date: '2026-11-03' },
    ],
  },
  variants: { nofk: { tables: [student, concert, Object.assign({}, ticket, { columns: ticket.columns.map(c => Object.assign({}, c, { fk: undefined })) })] } },
  rules: [], goals: [],
};
const clone = o => JSON.parse(JSON.stringify(o));
module.exports = { student, concert, ticket, level, clone };
