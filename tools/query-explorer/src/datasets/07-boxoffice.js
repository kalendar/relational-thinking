(function (root) {
  'use strict';
  const dataset = {
    id: 'boxoffice',
    name: 'Box Office Weekend',
    description: 'Studios · Movies · WeekendGrosses',
    start: 'WeekendGrosses',
    tables: [
      {
        name: 'Studios',
        columns: [
          { name: 'studio_id', type: 'number', key: 'pk' },
          { name: 'studio_name', type: 'text' },
          { name: 'headquarters', type: 'text' },
        ],
        rows: [
          [1, 'Warner Bros.', 'Burbank, CA'],
          [2, 'Disney', 'Burbank, CA'],
          [3, 'Universal', 'Universal City, CA'],
          [4, 'Paramount', 'Hollywood, CA'],
          [5, 'Sony Pictures', 'Culver City, CA'],
          [6, 'Lionsgate', 'Santa Monica, CA'],
          [7, 'A24', 'New York, NY'],
          [8, 'Neon', 'New York, NY'],
        ],
      },
      {
        name: 'Movies',
        columns: [
          { name: 'movie_id', type: 'number', key: 'pk' },
          { name: 'movie_title', type: 'text' },
          { name: 'studio_id', type: 'number', key: 'fk', ref: 'Studios' },
          { name: 'genre', type: 'text' },
          { name: 'rating', type: 'text' },
          { name: 'release_date', type: 'date' },
        ],
        rows: [
          [1, 'A Minecraft Movie', 1, 'Adventure', 'PG', '2025-04-04'],
          [2, 'Sinners', 1, 'Horror', 'R', '2025-04-18'],
          [3, 'Lilo & Stitch', 2, 'Family', 'PG', '2025-05-23'],
          [4, 'Mission: Impossible – The Final Reckoning', 4, 'Action', 'PG-13', '2025-05-23'],
          [5, 'How to Train Your Dragon', 3, 'Family', 'PG', '2025-06-13'],
          [6, '28 Years Later', 5, 'Horror', 'R', '2025-06-20'],
          [7, 'Jurassic World Rebirth', 3, 'Adventure', 'PG-13', '2025-07-02'],
          [8, 'Superman', 1, 'Superhero', 'PG-13', '2025-07-11'],
          [9, 'The Fantastic Four: First Steps', 2, 'Superhero', 'PG-13', '2025-07-25'],
          [10, 'Weapons', 1, 'Horror', 'R', '2025-08-08'],
        ],
      },
      {
        name: 'WeekendGrosses',
        columns: [
          { name: 'gross_id', type: 'number', key: 'pk' },
          { name: 'movie_id', type: 'number', key: 'fk', ref: 'Movies' },
          { name: 'weekend_date', type: 'date' },
          { name: 'gross_millions', type: 'number' },
          { name: 'theaters', type: 'number' },
        ],
        rows: [
          [1, 1, '2025-04-04', 163, 4175],
          [2, 1, '2025-04-11', 66.5, 4210],
          [3, 2, '2025-04-18', 48, 3618],
          [4, 2, '2025-04-25', 34.2, 3650],
          [5, 3, '2025-05-23', 146, 4410],
          [6, 3, '2025-05-30', 53.4, 4400],
          [7, 3, '2025-06-06', 32.1, 4300],
          [8, 4, '2025-05-23', 64, 4100],
          [9, 4, '2025-05-30', 27.3, 3900],
          [10, 5, '2025-06-13', 84.5, 4300],
          [11, 5, '2025-06-20', 38.9, 4250],
          [12, 6, '2025-06-20', 30, 3500],
          [13, 6, '2025-06-27', 10.5, 3200],
          [14, 7, '2025-07-04', 147, 4308],
          [15, 7, '2025-07-11', 40.4, 4300],
          [16, 7, '2025-07-18', 24.8, 4100],
          [17, 8, '2025-07-11', 125, 4135],
          [18, 8, '2025-07-18', 55.1, 4150],
          [19, 8, '2025-07-25', 22.6, 3900],
          [20, 9, '2025-07-25', 117.5, 4175],
          [21, 9, '2025-08-01', 40, 4200],
          [22, 10, '2025-08-08', 43.5, 3200],
          [23, 10, '2025-08-15', 25.2, 3300],
        ],
      },
    ],
    questions: [
      {
        text: 'How much did each studio earn in total?',
        recipe: {
          start: 'WeekendGrosses',
          steps: [
            { op: 'join', table: 'Movies', leftColumn: 'movie_id', rightColumn: 'movie_id' },
            { op: 'join', table: 'Studios', leftColumn: 'studio_id', rightColumn: 'studio_id' },
            { op: 'aggregate', groupBy: ['studio_name'], summaries: [{ fn: 'total', column: 'gross_millions' }] },
          ],
        },
      },
      {
        text: 'Which PG-13 movies had a weekend over $50 million?',
        recipe: {
          start: 'WeekendGrosses',
          steps: [
            { op: 'filter', column: 'gross_millions', condition: 'more_than', value: '50' },
            { op: 'join', table: 'Movies', leftColumn: 'movie_id', rightColumn: 'movie_id' },
            { op: 'filter', column: 'rating', condition: 'is', value: 'PG-13' },
            { op: 'project', columns: ['movie_title', 'weekend_date', 'gross_millions'] },
          ],
        },
      },
      {
        text: "What was each movie's best weekend?",
        recipe: {
          start: 'WeekendGrosses',
          steps: [
            { op: 'join', table: 'Movies', leftColumn: 'movie_id', rightColumn: 'movie_id' },
            { op: 'aggregate', groupBy: ['movie_title'], summaries: [{ fn: 'highest', column: 'gross_millions' }] },
          ],
        },
      },
    ],
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = dataset;
  else (root.QE_DATASETS = root.QE_DATASETS || []).push(dataset);
})(this);
