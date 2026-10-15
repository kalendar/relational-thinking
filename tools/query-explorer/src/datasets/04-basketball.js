(function (root) {
  'use strict';
  const dataset = {
    id: 'basketball',
    number: 4,
    name: 'Thundering Herd Basketball',
    description: 'Players · Games · BoxScores',
    start: 'BoxScores',
    tables: [
      {
        name: 'Players',
        columns: [
          { name: 'player_id', type: 'number', key: 'pk' },
          { name: 'player_name', type: 'text' },
          { name: 'position', type: 'text' },
          { name: 'class_year', type: 'text' },
          { name: 'jersey_number', type: 'number', plain: true },
        ],
        rows: [
          [1, 'Marcus Reed', 'Guard', 'Senior', 1],
          [2, 'Darius Cole', 'Guard', 'Junior', 3],
          [3, 'Tyler Briggs', 'Forward', 'Sophomore', 11],
          [4, 'Jalen Ortiz', 'Guard', 'Freshman', 5],
          [5, 'Caleb Winters', 'Forward', 'Senior', 23],
          [6, 'Andre Mason', 'Center', 'Junior', 34],
          [7, 'Noah Pruitt', 'Forward', 'Freshman', 14],
          [8, 'Isaiah Foster', 'Center', 'Sophomore', 42],
          [9, 'Devin Hale', 'Guard', 'Sophomore', 12],
          [10, 'Eli Thornton', 'Forward', 'Redshirt Freshman', 21],
        ],
      },
      {
        name: 'Games',
        columns: [
          { name: 'game_id', type: 'number', key: 'pk' },
          { name: 'opponent', type: 'text' },
          { name: 'game_date', type: 'date' },
          { name: 'home_away', type: 'text' },
          { name: 'result', type: 'text' },
        ],
        rows: [
          [1, 'Georgia Southern', '2026-01-03', 'Home', 'W'],
          [2, 'Old Dominion', '2026-01-08', 'Away', 'L'],
          [3, 'App State', '2026-01-15', 'Home', 'W'],
          [4, 'James Madison', '2026-01-22', 'Away', 'L'],
          [5, 'Coastal Carolina', '2026-01-29', 'Home', 'W'],
          [6, 'Texas State', '2026-02-05', 'Away', 'W'],
          [7, 'Arkansas State', '2026-02-12', 'Home', 'L'],
          [8, 'Troy', '2026-02-19', 'Away', 'W'],
        ],
      },
      {
        name: 'BoxScores',
        columns: [
          { name: 'box_id', type: 'number', key: 'pk' },
          { name: 'game_id', type: 'number', key: 'fk', ref: 'Games' },
          { name: 'player_id', type: 'number', key: 'fk', ref: 'Players' },
          { name: 'points', type: 'number' },
          { name: 'rebounds', type: 'number' },
          { name: 'assists', type: 'number' },
        ],
        rows: [
          [1, 1, 1, 24, 4, 6],
          [2, 1, 5, 15, 9, 2],
          [3, 1, 6, 8, 7, 1],
          [4, 2, 2, 12, 3, 5],
          [5, 2, 3, 10, 6, 1],
          [6, 2, 8, 6, 8, 0],
          [7, 3, 1, 18, 3, 7],
          [8, 3, 4, 21, 4, 3],
          [9, 3, 6, 14, 10, 0],
          [10, 4, 2, 9, 2, 4],
          [11, 4, 5, 16, 7, 2],
          [12, 4, 9, 5, 1, 3],
          [13, 5, 1, 22, 5, 8],
          [14, 5, 3, 13, 6, 2],
          [15, 5, 8, 11, 9, 1],
          [16, 6, 4, 7, 3, 2],
          [17, 6, 5, 27, 11, 1],
          [18, 6, 7, 10, 4, 0],
          [19, 7, 2, 22, 3, 6],
          [20, 7, 6, 12, 8, 1],
          [21, 7, 9, 0, 1, 2],
          [22, 8, 1, 32, 6, 5],
          [23, 8, 7, 9, 5, 1],
          [24, 8, 8, 20, 12, 2],
        ],
      },
    ],
    questions: [
      {
        text: 'How many total points did each player score this season?',
        recipe: {
          start: 'BoxScores',
          steps: [
            { op: 'join', table: 'Players', leftColumn: 'player_id', rightColumn: 'player_id' },
            { op: 'aggregate', groupBy: ['player_name'], summaries: [{ fn: 'total', column: 'points' }] },
          ],
        },
      },
      {
        text: 'What is the average number of points for each position in home games?',
        recipe: {
          start: 'BoxScores',
          steps: [
            { op: 'join', table: 'Games', leftColumn: 'game_id', rightColumn: 'game_id' },
            { op: 'filter', column: 'home_away', condition: 'is', value: 'Home' },
            { op: 'join', table: 'Players', leftColumn: 'player_id', rightColumn: 'player_id' },
            { op: 'aggregate', groupBy: ['position'], summaries: [{ fn: 'average', column: 'points' }] },
          ],
        },
      },
      {
        text: 'In the games the Herd won, which players scored 20 or more points?',
        recipe: {
          start: 'BoxScores',
          steps: [
            { op: 'filter', column: 'points', condition: 'at_least', value: '20' },
            { op: 'join', table: 'Games', leftColumn: 'game_id', rightColumn: 'game_id' },
            { op: 'filter', column: 'result', condition: 'is', value: 'W' },
            { op: 'join', table: 'Players', leftColumn: 'player_id', rightColumn: 'player_id' },
            { op: 'project', columns: ['player_name', 'opponent', 'points'] },
          ],
        },
      },
    ],
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = dataset;
  else (root.QE_DATASETS = root.QE_DATASETS || []).push(dataset);
})(this);
