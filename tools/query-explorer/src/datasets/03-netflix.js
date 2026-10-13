(function (root) {
  'use strict';
  const dataset = {
    id: 'netflix',
    name: 'Netflix Binge',
    description: 'Series · Episodes · ViewingSessions',
    start: 'ViewingSessions',
    tables: [
      {
        name: 'Series',
        columns: [
          { name: 'series_id', type: 'number', key: 'pk' },
          { name: 'series_title', type: 'text' },
          { name: 'genre', type: 'text' },
          { name: 'release_year', type: 'number', plain: true },
        ],
        rows: [
          [1, 'Stranger Things', 'Sci-Fi', 2016],
          [2, 'Wednesday', 'Fantasy', 2022],
          [3, 'Squid Game', 'Thriller', 2021],
          [4, 'Bridgerton', 'Drama', 2020],
          [5, 'Outer Banks', 'Thriller', 2020],
          [6, 'Cobra Kai', 'Comedy', 2018],
          [7, 'Ginny & Georgia', 'Drama', 2021],
          [8, 'Adolescence', 'Drama', 2025],
        ],
      },
      {
        name: 'Episodes',
        columns: [
          { name: 'episode_id', type: 'number', key: 'pk' },
          { name: 'series_id', type: 'number', key: 'fk', ref: 'Series' },
          { name: 'season', type: 'number', plain: true },
          { name: 'episode_number', type: 'number', plain: true },
          { name: 'runtime_min', type: 'number' },
        ],
        rows: [
          [1, 1, 1, 1, 50],
          [2, 1, 1, 2, 55],
          [3, 1, 2, 1, 48],
          [4, 2, 1, 1, 58],
          [5, 2, 1, 2, 47],
          [6, 3, 1, 1, 60],
          [7, 3, 1, 2, 62],
          [8, 4, 1, 1, 62],
          [9, 4, 1, 2, 56],
          [10, 5, 1, 1, 52],
          [11, 5, 1, 2, 49],
          [12, 6, 1, 1, 30],
          [13, 6, 1, 2, 32],
          [14, 7, 1, 1, 55],
          [15, 7, 1, 2, 50],
          [16, 8, 1, 1, 51],
          [17, 8, 1, 2, 54],
        ],
      },
      {
        name: 'ViewingSessions',
        columns: [
          { name: 'session_id', type: 'number', key: 'pk' },
          { name: 'episode_id', type: 'number', key: 'fk', ref: 'Episodes' },
          { name: 'viewer_name', type: 'text' },
          { name: 'watch_date', type: 'date' },
          { name: 'minutes_watched', type: 'number' },
        ],
        rows: [
          [1, 1, 'Maya', '2026-01-04', 50],
          [2, 2, 'Maya', '2026-01-04', 55],
          [3, 4, 'Chris', '2026-01-09', 58],
          [4, 6, 'Priya', '2026-01-11', 60],
          [5, 7, 'Priya', '2026-01-11', 62],
          [6, 10, 'Devon', '2026-01-15', 52],
          [7, 1, 'Jordan', '2026-01-18', 50],
          [8, 8, 'Maya', '2026-01-22', 62],
          [9, 12, 'Chris', '2026-01-25', 30],
          [10, 13, 'Chris', '2026-01-25', 32],
          [11, 14, 'Priya', '2026-01-30', 55],
          [12, 6, 'Jordan', '2026-02-03', 60],
          [13, 7, 'Jordan', '2026-02-04', 62],
          [14, 3, 'Devon', '2026-02-07', 40],
          [15, 16, 'Maya', '2026-02-09', 51],
          [16, 12, 'Maya', '2026-02-09', 30],
          [17, 9, 'Jordan', '2026-02-14', 56],
          [18, 11, 'Chris', '2026-02-16', 49],
          [19, 5, 'Priya', '2026-02-20', 47],
          [20, 15, 'Devon', '2026-02-23', 50],
          [21, 2, 'Jordan', '2026-02-27', 55],
          [22, 10, 'Priya', '2026-03-03', 45],
          [23, 16, 'Jordan', '2026-03-08', 51],
          [24, 3, 'Maya', '2026-03-14', 48],
          [25, 8, 'Devon', '2026-03-20', 62],
        ],
      },
    ],
    questions: [
      {
        text: 'How many total minutes were watched for each series?',
        recipe: {
          start: 'ViewingSessions',
          steps: [
            { op: 'join', table: 'Episodes', leftColumn: 'episode_id', rightColumn: 'episode_id' },
            { op: 'join', table: 'Series', leftColumn: 'series_id', rightColumn: 'series_id' },
            { op: 'aggregate', groupBy: ['series_title'], summaries: [{ fn: 'total', column: 'minutes_watched' }] },
          ],
        },
      },
      {
        text: 'What did Jordan watch in February 2026?',
        recipe: {
          start: 'ViewingSessions',
          steps: [
            { op: 'filter', column: 'viewer_name', condition: 'is', value: 'Jordan' },
            { op: 'filter', column: 'watch_date', condition: 'between', value: '2026-02-01', value2: '2026-02-28' },
            { op: 'join', table: 'Episodes', leftColumn: 'episode_id', rightColumn: 'episode_id' },
            { op: 'join', table: 'Series', leftColumn: 'series_id', rightColumn: 'series_id' },
            { op: 'project', columns: ['series_title', 'season', 'episode_number', 'watch_date'] },
          ],
        },
      },
      {
        text: 'What is the average episode runtime for each genre?',
        recipe: {
          start: 'Episodes',
          steps: [
            { op: 'join', table: 'Series', leftColumn: 'series_id', rightColumn: 'series_id' },
            { op: 'aggregate', groupBy: ['genre'], summaries: [{ fn: 'average', column: 'runtime_min' }] },
          ],
        },
      },
    ],
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = dataset;
  else (root.QE_DATASETS = root.QE_DATASETS || []).push(dataset);
})(this);
