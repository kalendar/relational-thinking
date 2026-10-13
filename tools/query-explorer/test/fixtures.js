// A tiny data set for engine tests. Saturn has no streams; Doechii has no songs.
const MINI = {
  id: 'mini',
  name: 'Mini',
  description: 'Artists · Songs · Streams',
  start: 'Streams',
  tables: [
    {
      name: 'Artists',
      columns: [
        { name: 'artist_id', type: 'number', key: 'pk' },
        { name: 'artist_name', type: 'text' },
        { name: 'genre', type: 'text' },
      ],
      rows: [[1, 'Bad Bunny', 'Latin'], [2, 'SZA', 'R&B'], [3, 'Doechii', 'Hip-Hop']],
    },
    {
      name: 'Songs',
      columns: [
        { name: 'song_id', type: 'number', key: 'pk' },
        { name: 'song_title', type: 'text' },
        { name: 'artist_id', type: 'number', key: 'fk', ref: 'Artists' },
        { name: 'release_date', type: 'date' },
      ],
      rows: [[10, 'DtMF', 1, '2025-01-05'], [11, 'Kill Bill', 2, '2022-12-09'], [12, 'Saturn', 2, '2024-02-22']],
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
        [100, 10, '2026-03-02', 500],
        [101, 11, '2026-03-02', 300],
        [102, 10, '2026-04-01', 200],
        [103, 11, '2026-03-15', 100],
      ],
    },
  ],
  questions: [],
};

module.exports = { MINI };
