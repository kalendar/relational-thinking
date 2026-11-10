const test = require('node:test');
const assert = require('node:assert/strict');
const { homeworkText, homeworkFilename } = require('../src/export.js');
const { playSolution } = require('./drive.js');
const { getSQL } = require('./helpers.js');
const { level } = require('../src/levels/03-duplicates.js');

test('homework text for a finished Level 3', async () => {
  const { session } = playSolution(await getSQL(), level);
  const text = homeworkText(level, session.state());
  const lines = text.split('\n');
  assert.equal(lines[0], 'Constraint Gauntlet — Level 3: Duplicate Accounts (Chapter 11.1)');
  assert.equal(lines[1], 'Goals: 6 of 6 complete — level complete');
  assert.match(text, /Attempts \(6\): 2 accepted, 3 rejected, 1 slipped through/);
  assert.match(text, /! SLIPPED +INSERT INTO Student VALUES \(6, '901234566', 'Taylor', 'Brooks', 'Taylor@marshall\.edu', NULL\)/);
  assert.match(text, /breaks: an email address belongs to one person, whatever the capital letters/);
  assert.match(text, /UNIQUE \(email\) COLLATE NOCASE on Student/, 'the last rejection is under the new rule');
  assert.match(text, /My fix:\n {2}Student: nocase/);
  assert.match(text, /Predictions:\n {2}"Two students already have no secondary email/);
  assert.match(text, /I said: No, it will be accepted\./);
  assert.ok(lines.every(l => l.length <= 120), 'lines stay short');
  assert.equal(homeworkFilename(level), 'constraint-gauntlet-level-3.txt');
});

test('the attempt list is capped at 20, newest first', async () => {
  const { session } = playSolution(await getSQL(), level);
  for (let i = 0; i < 25; i++) session.run(`INSERT INTO Student VALUES (${100 + i}, '9000000${String(i).padStart(2, '0')}', 'A', 'B', 'a${i}@x.edu', NULL)`);
  const text = homeworkText(level, session.state());
  assert.match(text, /\(showing 20 of 31 attempts\)/);
  assert.match(text.split('Attempts')[1].split('\n')[1], /124/, 'newest first');
});
