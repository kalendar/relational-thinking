(function (root) {
  'use strict';
  const dataset = {
    id: 'spotify',
    number: 1,
    name: 'Spotify Streams',
    description: 'Artists · Songs · Streams',
    start: 'Streams',
    tables: [
      {
        name: 'Artists',
        columns: [
          { name: 'artist_id', type: 'number', key: 'pk' },
          { name: 'artist_name', type: 'text' },
          { name: 'genre', type: 'text' },
          { name: 'home_country', type: 'text' },
        ],
        rows: [
          [1, 'Bad Bunny', 'Latin', 'Puerto Rico'],
          [2, 'Taylor Swift', 'Pop', 'United States'],
          [3, 'Kendrick Lamar', 'Hip-Hop', 'United States'],
          [4, 'SZA', 'R&B', 'United States'],
          [5, 'Karol G', 'Latin', 'Colombia'],
          [6, 'Drake', 'Hip-Hop', 'Canada'],
          [7, 'Olivia Rodrigo', 'Pop', 'United States'],
          [8, 'Doechii', 'Hip-Hop', 'United States'],
        ],
      },
      {
        name: 'Songs',
        columns: [
          { name: 'song_id', type: 'number', key: 'pk' },
          { name: 'song_title', type: 'text' },
          { name: 'artist_id', type: 'number', key: 'fk', ref: 'Artists' },
          { name: 'release_date', type: 'date' },
          { name: 'duration_sec', type: 'number' },
        ],
        rows: [
          [1, 'DtMF', 1, '2025-01-05', 237],
          [2, 'Tití Me Preguntó', 1, '2022-05-06', 243],
          [3, 'Anti-Hero', 2, '2022-10-21', 200],
          [4, 'Cruel Summer', 2, '2019-08-23', 178],
          [5, 'Not Like Us', 3, '2024-05-04', 274],
          [6, 'luther', 3, '2024-11-22', 177],
          [7, 'Kill Bill', 4, '2022-12-09', 153],
          [8, 'Saturn', 4, '2024-02-22', 186],
          [9, 'TQG', 5, '2023-02-24', 198],
          [10, 'Si Antes Te Hubiera Conocido', 5, '2024-06-21', 196],
          [11, "God's Plan", 6, '2018-01-19', 199],
          [12, 'NOKIA', 6, '2025-02-14', 241],
          [13, 'drivers license', 7, '2021-01-08', 242],
          [14, 'vampire', 7, '2023-06-30', 219],
        ],
      },
      {
        name: 'Streams',
        columns: [
          { name: 'stream_id', type: 'number', key: 'pk' },
          { name: 'song_id', type: 'number', key: 'fk', ref: 'Songs' },
          { name: 'stream_date', type: 'date' },
          { name: 'stream_count', type: 'number' },
        ],
        rows: [
          [1, 1, '2026-03-02', 2150000],
          [2, 5, '2026-03-02', 1980000],
          [3, 3, '2026-03-05', 1420000],
          [4, 9, '2026-03-05', 1310000],
          [5, 2, '2026-03-09', 1760000],
          [6, 7, '2026-03-09', 1120000],
          [7, 12, '2026-03-12', 1650000],
          [8, 13, '2026-03-12', 890000],
          [9, 6, '2026-03-16', 1540000],
          [10, 1, '2026-03-16', 2040000],
          [11, 4, '2026-03-20', 1230000],
          [12, 10, '2026-03-20', 1180000],
          [13, 11, '2026-03-24', 970000],
          [14, 14, '2026-03-24', 1060000],
          [15, 5, '2026-03-28', 1870000],
          [16, 3, '2026-03-28', 1390000],
          [17, 1, '2026-04-02', 1920000],
          [18, 6, '2026-04-02', 1610000],
          [19, 9, '2026-04-06', 1270000],
          [20, 12, '2026-04-06', 1580000],
          [21, 7, '2026-04-10', 1090000],
          [22, 2, '2026-04-10', 1700000],
          [23, 14, '2026-04-14', 1150000],
          [24, 13, '2026-04-14', 840000],
        ],
      },
    ],
    questions: [
      {
        text: 'Which artist had the most total streams in March 2026?',
        recipe: {
          start: 'Streams',
          steps: [
            { op: 'filter', column: 'stream_date', condition: 'between', value: '2026-03-01', value2: '2026-03-31' },
            { op: 'join', table: 'Songs', leftColumn: 'song_id', rightColumn: 'song_id' },
            { op: 'join', table: 'Artists', leftColumn: 'artist_id', rightColumn: 'artist_id' },
            { op: 'aggregate', groupBy: ['artist_name'], summaries: [{ fn: 'total', column: 'stream_count' }] },
          ],
        },
      },
      {
        text: 'What are the titles and release dates of all Latin songs?',
        recipe: {
          start: 'Songs',
          steps: [
            { op: 'join', table: 'Artists', leftColumn: 'artist_id', rightColumn: 'artist_id' },
            { op: 'filter', column: 'genre', condition: 'is', value: 'Latin' },
            { op: 'project', columns: ['song_title', 'release_date'] },
          ],
        },
      },
      {
        text: 'How many songs does each artist have?',
        note: 'Is anyone missing? Why?',
        recipe: {
          start: 'Artists',
          steps: [
            { op: 'join', table: 'Songs', leftColumn: 'artist_id', rightColumn: 'artist_id' },
            { op: 'aggregate', groupBy: ['artist_name'], summaries: [{ fn: 'count' }] },
          ],
        },
      },
    ],
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = dataset;
  else (root.QE_DATASETS = root.QE_DATASETS || []).push(dataset);
})(this);
