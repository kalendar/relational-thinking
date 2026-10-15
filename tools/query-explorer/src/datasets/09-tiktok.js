(function (root) {
  'use strict';
  const dataset = {
    id: 'tiktok',
    number: 9,
    name: 'TikTok Creators & Memes',
    description: 'Creators · Videos · DailyViews',
    start: 'DailyViews',
    tables: [
      {
        name: 'Creators',
        columns: [
          { name: 'creator_id', type: 'number', key: 'pk' },
          { name: 'handle', type: 'text' },
          { name: 'niche', type: 'text' },
          { name: 'follower_count', type: 'number' },
        ],
        rows: [
          [1, '@dormroomchef', 'Food', 184000],
          [2, '@sleepyseniorsam', 'Comedy', 52000],
          [3, '@quadquips', 'Comedy', 310000],
          [4, '@twirlwithtess', 'Dance', 895000],
          [5, '@lootboxlenny', 'Gaming', 27500],
          [6, '@finalsweekfiona', 'Comedy', 8400],
          [7, '@ramenrachel', 'Food', 2300],
          [8, '@stepbystepsyd', 'Dance', 61000],
        ],
      },
      {
        name: 'Videos',
        columns: [
          { name: 'video_id', type: 'number', key: 'pk' },
          { name: 'creator_id', type: 'number', key: 'fk', ref: 'Creators' },
          { name: 'caption', type: 'text' },
          { name: 'meme_format', type: 'text' },
          { name: 'post_date', type: 'date' },
        ],
        rows: [
          [1, 1, 'Five dollar dorm ramen upgrade', 'Tutorial', '2026-04-02'],
          [2, 2, 'POV: your alarm goes off during finals week', 'POV', '2026-04-03'],
          [3, 3, 'A day in the life of a quad squirrel', 'Day in the Life', '2026-04-05'],
          [4, 4, 'Learning the new dance in the hallway', 'Tutorial', '2026-04-06'],
          [5, 5, 'Get ready with me for a tournament', 'Get Ready With Me', '2026-04-08'],
          [6, 3, 'Storytime: I walked into the wrong lecture', 'Storytime', '2026-04-10'],
          [7, 6, 'POV: the library closes in five minutes', 'POV', '2026-04-12'],
          [8, 1, 'Get ready with me for a cookout', 'Get Ready With Me', '2026-04-14'],
          [9, 4, 'Dance duet with my roommate', 'Duet', '2026-04-17'],
          [10, 2, 'Storytime: the group project that worked', 'Storytime', '2026-04-20'],
          [11, 8, 'Day in the life of a dance major', 'Day in the Life', '2026-04-23'],
          [12, 5, 'Duet with my favorite streamer', 'Duet', '2026-04-27'],
        ],
      },
      {
        name: 'DailyViews',
        columns: [
          { name: 'view_id', type: 'number', key: 'pk' },
          { name: 'video_id', type: 'number', key: 'fk', ref: 'Videos' },
          { name: 'view_date', type: 'date' },
          { name: 'views', type: 'number' },
          { name: 'likes', type: 'number' },
        ],
        rows: [
          [1, 1, '2026-04-03', 85000, 6800],
          [2, 1, '2026-04-05', 42000, 3400],
          [3, 2, '2026-04-04', 120000, 12600],
          [4, 2, '2026-04-06', 64000, 6100],
          [5, 3, '2026-04-06', 910000, 91000],
          [6, 3, '2026-04-08', 2400000, 264000],
          [7, 4, '2026-04-07', 1800000, 144000],
          [8, 4, '2026-04-09', 950000, 76000],
          [9, 5, '2026-04-09', 14000, 1400],
          [10, 6, '2026-04-11', 560000, 61000],
          [11, 6, '2026-04-13', 230000, 25000],
          [12, 7, '2026-04-13', 3200, 320],
          [13, 8, '2026-04-15', 76000, 5900],
          [14, 8, '2026-04-16', 31000, 2500],
          [15, 9, '2026-04-18', 1300000, 104000],
          [16, 9, '2026-04-19', 700000, 52500],
          [17, 10, '2026-04-21', 47000, 4700],
          [18, 10, '2026-04-23', 22000, 2000],
          [19, 11, '2026-04-24', 38000, 3100],
          [20, 11, '2026-04-26', 19000, 1500],
          [21, 12, '2026-04-28', 8500, 850],
          [22, 12, '2026-04-30', 4100, 380],
          [23, 1, '2026-04-08', 17000, 1300],
          [24, 5, '2026-04-11', 9200, 930],
          [25, 7, '2026-04-14', 1000, 90],
        ],
      },
    ],
    questions: [
      {
        text: 'How many total views did each meme format get?',
        recipe: {
          start: 'DailyViews',
          steps: [
            { op: 'join', table: 'Videos', leftColumn: 'video_id', rightColumn: 'video_id' },
            { op: 'aggregate', groupBy: ['meme_format'], summaries: [{ fn: 'total', column: 'views' }] },
          ],
        },
      },
      {
        text: 'How many total likes did each creator get?',
        recipe: {
          start: 'DailyViews',
          steps: [
            { op: 'join', table: 'Videos', leftColumn: 'video_id', rightColumn: 'video_id' },
            { op: 'join', table: 'Creators', leftColumn: 'creator_id', rightColumn: 'creator_id' },
            { op: 'aggregate', groupBy: ['handle'], summaries: [{ fn: 'total', column: 'likes' }] },
          ],
        },
      },
      {
        text: 'What did comedy creators post in the first half of April 2026?',
        recipe: {
          start: 'Videos',
          steps: [
            { op: 'filter', column: 'post_date', condition: 'between', value: '2026-04-01', value2: '2026-04-15' },
            { op: 'join', table: 'Creators', leftColumn: 'creator_id', rightColumn: 'creator_id' },
            { op: 'filter', column: 'niche', condition: 'is', value: 'Comedy' },
            { op: 'project', columns: ['handle', 'caption', 'post_date'] },
          ],
        },
      },
    ],
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = dataset;
  else (root.QE_DATASETS = root.QE_DATASETS || []).push(dataset);
})(this);
