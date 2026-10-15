(function (root) {
  'use strict';
  const dataset = {
    id: 'festival',
    number: 10,
    name: 'Music Festival Lineup',
    description: 'Stages · Acts · SetTimes',
    start: 'SetTimes',
    tables: [
      {
        name: 'Stages',
        columns: [
          { name: 'stage_id', type: 'number', key: 'pk' },
          { name: 'stage_name', type: 'text' },
          { name: 'stage_capacity', type: 'number' },
        ],
        rows: [
          [1, 'Main Stage', 60000],
          [2, 'Sahara Tent', 15000],
          [3, 'Riverside Stage', 22000],
          [4, 'Garden Stage', 8000],
          [5, 'The Dome', 12000],
          [6, 'Lakeside Stage', 18000],
          [7, 'Forest Stage', 3500],
          [8, 'Pier Stage', 1500],
        ],
      },
      {
        name: 'Acts',
        columns: [
          { name: 'act_id', type: 'number', key: 'pk' },
          { name: 'act_name', type: 'text' },
          { name: 'genre', type: 'text' },
          { name: 'headliner', type: 'text' },
        ],
        rows: [
          [1, 'Sabrina Carpenter', 'Pop', 'Yes'],
          [2, 'Tyler, The Creator', 'Hip-Hop', 'Yes'],
          [3, 'Chappell Roan', 'Pop', 'Yes'],
          [4, 'Billie Eilish', 'Pop', 'Yes'],
          [5, 'Fred again..', 'Electronic', 'No'],
          [6, 'Charli xcx', 'Electropop', 'No'],
          [7, 'Zach Bryan', 'Country', 'No'],
          [8, 'Doja Cat', 'Hip-Hop', 'No'],
          [9, 'Tems', 'R&B', 'No'],
          [10, 'Gracie Abrams', 'Indie Pop', 'No'],
          [11, 'Benson Boone', 'Pop', 'No'],
          [12, 'Kaytranada', 'Electronic', 'No'],
          [13, 'Remi Wolf', 'Funk Pop', 'No'],
          [14, 'Djo', 'Indie Rock', 'No'],
          [15, 'Role Model', 'Indie Pop', 'No'],
        ],
      },
      {
        name: 'SetTimes',
        columns: [
          { name: 'set_id', type: 'number', key: 'pk' },
          { name: 'act_id', type: 'number', key: 'fk', ref: 'Acts' },
          { name: 'stage_id', type: 'number', key: 'fk', ref: 'Stages' },
          { name: 'festival_date', type: 'date' },
          { name: 'set_length_min', type: 'number' },
        ],
        rows: [
          [1, 1, 1, '2026-04-10', 90],
          [2, 2, 1, '2026-04-11', 105],
          [3, 3, 1, '2026-04-12', 90],
          [4, 4, 1, '2026-04-12', 100],
          [5, 5, 2, '2026-04-10', 75],
          [6, 6, 1, '2026-04-11', 75],
          [7, 7, 3, '2026-04-11', 60],
          [8, 8, 5, '2026-04-10', 60],
          [9, 9, 4, '2026-04-12', 50],
          [10, 10, 6, '2026-04-11', 55],
          [11, 11, 3, '2026-04-12', 60],
          [12, 12, 2, '2026-04-12', 80],
          [13, 13, 7, '2026-04-10', 45],
          [14, 14, 8, '2026-04-11', 45],
        ],
      },
    ],
    questions: [
      {
        text: 'How many minutes of music does each stage host?',
      },
      {
        text: 'Which acts play the Main Stage on Saturday?',
      },
      {
        text: 'How many headliners play each day?',
      },
    ],
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = dataset;
  else (root.QE_DATASETS = root.QE_DATASETS || []).push(dataset);
})(this);
