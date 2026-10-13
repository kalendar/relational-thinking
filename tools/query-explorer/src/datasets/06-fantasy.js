(function (root) {
  'use strict';
  const dataset = {
    id: 'fantasy',
    name: 'Fantasy Football League',
    description: 'FantasyTeams · NFLPlayers · WeeklyPoints',
    start: 'WeeklyPoints',
    tables: [
      {
        name: 'FantasyTeams',
        columns: [
          { name: 'team_id', type: 'number', key: 'pk' },
          { name: 'team_name', type: 'text' },
          { name: 'manager_name', type: 'text' },
        ],
        rows: [
          [1, 'Mahomes Alone', 'Alex'],
          [2, 'Bijan Mustard', 'Brooke'],
          [3, 'Allen Wrench', 'Chris'],
          [4, 'Hurts So Good', 'Dana'],
          [5, 'Kelce Me Maybe', 'Evan'],
          [6, 'Gibbs Me a Break', 'Faith'],
          [7, 'Jefferson Airplane', 'Grant'],
          [8, 'Chase Your Dreams', 'Hannah'],
        ],
      },
      {
        name: 'NFLPlayers',
        columns: [
          { name: 'player_id', type: 'number', key: 'pk' },
          { name: 'player_name', type: 'text' },
          { name: 'position', type: 'text' },
          { name: 'nfl_team', type: 'text' },
          { name: 'team_id', type: 'number', key: 'fk', ref: 'FantasyTeams' },
        ],
        rows: [
          [1, 'Patrick Mahomes', 'QB', 'Kansas City Chiefs', 1],
          [2, 'Travis Kelce', 'TE', 'Kansas City Chiefs', 5],
          [3, 'Josh Allen', 'QB', 'Buffalo Bills', 3],
          [4, 'CeeDee Lamb', 'WR', 'Dallas Cowboys', 4],
          [5, 'Saquon Barkley', 'RB', 'Philadelphia Eagles', 2],
          [6, 'Bijan Robinson', 'RB', 'Atlanta Falcons', 2],
          [7, 'Derrick Henry', 'RB', 'Baltimore Ravens', 4],
          [8, 'Jahmyr Gibbs', 'RB', 'Detroit Lions', 6],
          [9, 'Ja\'Marr Chase', 'WR', 'Cincinnati Bengals', 8],
          [10, 'Justin Jefferson', 'WR', 'Minnesota Vikings', 7],
          [11, 'Puka Nacua', 'WR', 'Los Angeles Rams', 6],
          [12, 'Lamar Jackson', 'QB', 'Baltimore Ravens', 3],
          [13, 'Christian McCaffrey', 'RB', 'San Francisco 49ers', 8],
        ],
      },
      {
        name: 'WeeklyPoints',
        columns: [
          { name: 'points_id', type: 'number', key: 'pk' },
          { name: 'player_id', type: 'number', key: 'fk', ref: 'NFLPlayers' },
          { name: 'week', type: 'number', plain: true },
          { name: 'game_date', type: 'date' },
          { name: 'fantasy_points', type: 'number' },
        ],
        rows: [
          [1, 1, 1, '2026-09-13', 24.6],
          [2, 2, 1, '2026-09-13', 9.4],
          [3, 3, 1, '2026-09-13', 31.4],
          [4, 4, 1, '2026-09-13', 18.7],
          [5, 5, 1, '2026-09-13', 21.5],
          [6, 6, 1, '2026-09-13', 26.2],
          [7, 7, 1, '2026-09-13', 16.3],
          [8, 8, 1, '2026-09-13', 20.8],
          [9, 9, 1, '2026-09-13', 15.2],
          [10, 10, 1, '2026-09-13', 12.9],
          [11, 11, 1, '2026-09-13', 22.6],
          [12, 12, 1, '2026-09-13', 29],
          [13, 1, 2, '2026-09-20', 19.2],
          [14, 2, 2, '2026-09-20', 12.1],
          [15, 3, 2, '2026-09-20', 27.8],
          [16, 4, 2, '2026-09-20', 22.3],
          [17, 5, 2, '2026-09-20', 14.8],
          [18, 6, 2, '2026-09-20', 17.9],
          [19, 7, 2, '2026-09-20', 24.1],
          [20, 8, 2, '2026-09-20', 28.4],
          [21, 9, 2, '2026-09-20', 11.6],
          [22, 10, 2, '2026-09-20', 19.5],
          [23, 11, 2, '2026-09-20', 8.4],
          [24, 12, 2, '2026-09-20', 33.6],
        ],
      },
    ],
    questions: [
      {
        text: 'Which fantasy team scored the most total points?',
        recipe: {
          start: 'WeeklyPoints',
          steps: [
            { op: 'join', table: 'NFLPlayers', leftColumn: 'player_id', rightColumn: 'player_id' },
            { op: 'join', table: 'FantasyTeams', leftColumn: 'team_id', rightColumn: 'team_id' },
            { op: 'aggregate', groupBy: ['team_name'], summaries: [{ fn: 'total', column: 'fantasy_points' }] },
          ],
        },
      },
      {
        text: 'Which players had a week with 25 or more points?',
        recipe: {
          start: 'WeeklyPoints',
          steps: [
            { op: 'filter', column: 'fantasy_points', condition: 'at_least', value: '25' },
            { op: 'join', table: 'NFLPlayers', leftColumn: 'player_id', rightColumn: 'player_id' },
            { op: 'project', columns: ['player_name', 'week', 'fantasy_points'] },
          ],
        },
      },
      {
        text: 'What is the average weekly score for each position?',
        recipe: {
          start: 'WeeklyPoints',
          steps: [
            { op: 'join', table: 'NFLPlayers', leftColumn: 'player_id', rightColumn: 'player_id' },
            { op: 'aggregate', groupBy: ['position'], summaries: [{ fn: 'average', column: 'fantasy_points' }] },
          ],
        },
      },
    ],
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = dataset;
  else (root.QE_DATASETS = root.QE_DATASETS || []).push(dataset);
})(this);
