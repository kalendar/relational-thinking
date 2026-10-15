(function (root) {
  'use strict';
  const dataset = {
    id: 'dining',
    number: 5,
    name: 'Campus Dining',
    description: 'Students · DiningHalls · MealSwipes',
    start: 'MealSwipes',
    tables: [
      {
        name: 'Students',
        columns: [
          { name: 'student_id', type: 'number', key: 'pk' },
          { name: 'first_name', type: 'text' },
          { name: 'meal_plan', type: 'text' },
          { name: 'residence_hall', type: 'text' },
        ],
        rows: [
          [1, 'Maya', 'Unlimited', 'Maple Hall'],
          [2, 'Jordan', '14 per week', 'Cedar Hall'],
          [3, 'Aaliyah', 'Block 100', 'Riverside Hall'],
          [4, 'Carlos', 'Unlimited', 'Hilltop Hall'],
          [5, 'Priya', '14 per week', 'Maple Hall'],
          [6, 'Tyler', 'Block 100', 'Cedar Hall'],
          [7, 'Sofia', 'Unlimited', 'Riverside Hall'],
          [8, 'Devon', '14 per week', 'Hilltop Hall'],
          [9, 'Emma', 'Block 100', 'Maple Hall'],
          [10, 'Marcus', 'Block 100', 'Commuter'],
        ],
      },
      {
        name: 'DiningHalls',
        columns: [
          { name: 'hall_id', type: 'number', key: 'pk' },
          { name: 'hall_name', type: 'text' },
          { name: 'campus_area', type: 'text' },
          { name: 'seats', type: 'number' },
        ],
        rows: [
          [1, 'Herd Commons', 'Central Campus', 450],
          [2, 'Late Night @ the Union', 'Student Union', 120],
          [3, 'Twin Towers Grill', 'North Campus', 200],
          [4, 'Green Machine Cafe', 'Science Quad', 80],
          [5, 'Bison Bowl', 'South Campus', 160],
          [6, 'The Thunder Deli', 'Central Campus', 90],
          [7, 'Hilltop Kitchen', 'North Campus', 140],
          [8, 'Sunrise Smoothie Bar', 'Rec Center', 40],
        ],
      },
      {
        name: 'MealSwipes',
        columns: [
          { name: 'swipe_id', type: 'number', key: 'pk' },
          { name: 'student_id', type: 'number', key: 'fk', ref: 'Students' },
          { name: 'hall_id', type: 'number', key: 'fk', ref: 'DiningHalls' },
          { name: 'swipe_date', type: 'date' },
          { name: 'meal_period', type: 'text' },
        ],
        rows: [
          [1, 1, 1, '2026-02-02', 'Breakfast'],
          [2, 2, 1, '2026-02-02', 'Lunch'],
          [3, 3, 3, '2026-02-02', 'Dinner'],
          [4, 4, 2, '2026-02-03', 'Late Night'],
          [5, 5, 1, '2026-02-03', 'Dinner'],
          [6, 1, 5, '2026-02-04', 'Lunch'],
          [7, 6, 7, '2026-02-04', 'Dinner'],
          [8, 7, 2, '2026-02-05', 'Late Night'],
          [9, 2, 4, '2026-02-05', 'Breakfast'],
          [10, 8, 1, '2026-02-06', 'Lunch'],
          [11, 9, 3, '2026-02-09', 'Dinner'],
          [12, 3, 1, '2026-02-09', 'Breakfast'],
          [13, 4, 6, '2026-02-10', 'Lunch'],
          [14, 5, 2, '2026-02-10', 'Late Night'],
          [15, 6, 5, '2026-02-11', 'Dinner'],
          [16, 1, 1, '2026-02-12', 'Dinner'],
          [17, 7, 7, '2026-02-12', 'Lunch'],
          [18, 8, 3, '2026-02-13', 'Breakfast'],
          [19, 9, 1, '2026-02-16', 'Lunch'],
          [20, 2, 5, '2026-02-17', 'Dinner'],
          [21, 3, 6, '2026-02-18', 'Lunch'],
          [22, 4, 4, '2026-02-19', 'Breakfast'],
          [23, 5, 1, '2026-02-20', 'Lunch'],
          [24, 6, 2, '2026-02-23', 'Late Night'],
          [25, 7, 3, '2026-02-24', 'Dinner'],
        ],
      },
    ],
    questions: [
      {
        text: 'How many dinner swipes did each dining hall get?',
        recipe: {
          start: 'MealSwipes',
          steps: [
            { op: 'filter', column: 'meal_period', condition: 'is', value: 'Dinner' },
            { op: 'join', table: 'DiningHalls', leftColumn: 'hall_id', rightColumn: 'hall_id' },
            { op: 'aggregate', groupBy: ['hall_name'], summaries: [{ fn: 'count' }] },
          ],
        },
      },
      {
        text: 'How many swipes came from each meal plan?',
        recipe: {
          start: 'MealSwipes',
          steps: [
            { op: 'join', table: 'Students', leftColumn: 'student_id', rightColumn: 'student_id' },
            { op: 'aggregate', groupBy: ['meal_plan'], summaries: [{ fn: 'count' }] },
          ],
        },
      },
      {
        text: 'Who ate late-night meals, and where?',
        recipe: {
          start: 'MealSwipes',
          steps: [
            { op: 'filter', column: 'meal_period', condition: 'is', value: 'Late Night' },
            { op: 'join', table: 'Students', leftColumn: 'student_id', rightColumn: 'student_id' },
            { op: 'join', table: 'DiningHalls', leftColumn: 'hall_id', rightColumn: 'hall_id' },
            { op: 'project', columns: ['first_name', 'hall_name', 'swipe_date'] },
          ],
        },
      },
    ],
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = dataset;
  else (root.QE_DATASETS = root.QE_DATASETS || []).push(dataset);
})(this);
