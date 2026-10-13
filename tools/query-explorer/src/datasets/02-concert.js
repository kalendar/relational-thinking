(function (root) {
  'use strict';
  const dataset = {
    id: 'concert',
    name: 'Concert Tour',
    description: 'Venues · Shows · TicketSales',
    start: 'TicketSales',
    tables: [
      {
        name: 'Venues',
        columns: [
          { name: 'venue_id', type: 'number', key: 'pk' },
          { name: 'venue_name', type: 'text' },
          { name: 'city', type: 'text' },
          { name: 'state', type: 'text' },
          { name: 'capacity', type: 'number' },
        ],
        rows: [
          [1, 'Mountain Health Arena', 'Huntington', 'WV', 8500],
          [2, 'Madison Square Garden', 'New York', 'NY', 19500],
          [3, 'Ryman Auditorium', 'Nashville', 'TN', 2360],
          [4, 'Red Rocks Amphitheatre', 'Morrison', 'CO', 9500],
          [5, 'United Center', 'Chicago', 'IL', 23500],
          [6, 'Hollywood Bowl', 'Los Angeles', 'CA', 17500],
          [7, 'Climate Pledge Arena', 'Seattle', 'WA', 17000],
          [8, 'Gillette Stadium', 'Foxborough', 'MA', 65000],
        ],
      },
      {
        name: 'Shows',
        columns: [
          { name: 'show_id', type: 'number', key: 'pk' },
          { name: 'venue_id', type: 'number', key: 'fk', ref: 'Venues' },
          { name: 'artist_name', type: 'text' },
          { name: 'show_date', type: 'date' },
        ],
        rows: [
          [1, 1, 'Zach Bryan', '2026-06-12'],
          [2, 2, 'Billie Eilish', '2026-06-20'],
          [3, 5, 'Sabrina Carpenter', '2026-06-27'],
          [4, 6, 'Tyler, The Creator', '2026-07-08'],
          [5, 3, 'Chappell Roan', '2026-07-11'],
          [6, 8, 'Morgan Wallen', '2026-07-18'],
          [7, 7, 'Post Malone', '2026-07-25'],
          [8, 1, 'Morgan Wallen', '2026-08-01'],
          [9, 2, 'Sabrina Carpenter', '2026-08-06'],
          [10, 5, 'Billie Eilish', '2026-08-14'],
          [11, 6, 'Chappell Roan', '2026-08-22'],
        ],
      },
      {
        name: 'TicketSales',
        columns: [
          { name: 'sale_id', type: 'number', key: 'pk' },
          { name: 'show_id', type: 'number', key: 'fk', ref: 'Shows' },
          { name: 'ticket_type', type: 'text' },
          { name: 'quantity', type: 'number' },
          { name: 'price_each', type: 'number' },
        ],
        rows: [
          [1, 1, 'GA', 1800, 70],
          [2, 1, 'Floor', 700, 165],
          [3, 1, 'VIP', 150, 275],
          [4, 2, 'GA', 1500, 120],
          [5, 2, 'Floor', 900, 240],
          [6, 2, 'VIP', 200, 450],
          [7, 3, 'GA', 1900, 110],
          [8, 3, 'Floor', 1200, 260],
          [9, 3, 'VIP', 300, 520],
          [10, 4, 'GA', 1400, 95],
          [11, 4, 'Floor', 800, 210],
          [12, 5, 'GA', 1000, 85],
          [13, 5, 'VIP', 80, 350],
          [14, 6, 'GA', 2000, 140],
          [15, 6, 'Floor', 1100, 290],
          [16, 6, 'VIP', 250, 600],
          [17, 7, 'GA', 1600, 105],
          [18, 7, 'Floor', 500, 185],
          [19, 8, 'GA', 1300, 60],
          [20, 8, 'VIP', 100, 300],
          [21, 9, 'GA', 1700, 150],
          [22, 9, 'Floor', 950, 280],
          [23, 10, 'GA', 1450, 130],
          [24, 10, 'VIP', 180, 480],
        ],
      },
    ],
    questions: [
      {
        text: 'How many tickets were sold in each city?',
        recipe: {
          start: 'TicketSales',
          steps: [
            { op: 'join', table: 'Shows', leftColumn: 'show_id', rightColumn: 'show_id' },
            { op: 'join', table: 'Venues', leftColumn: 'venue_id', rightColumn: 'venue_id' },
            { op: 'aggregate', groupBy: ['city'], summaries: [{ fn: 'total', column: 'quantity' }] },
          ],
        },
      },
      {
        text: 'Which shows sold VIP tickets priced above $300?',
        recipe: {
          start: 'TicketSales',
          steps: [
            { op: 'filter', column: 'ticket_type', condition: 'is', value: 'VIP' },
            { op: 'filter', column: 'price_each', condition: 'more_than', value: '300' },
            { op: 'join', table: 'Shows', leftColumn: 'show_id', rightColumn: 'show_id' },
            { op: 'project', columns: ['artist_name', 'show_date', 'price_each'] },
          ],
        },
      },
      {
        text: 'What is the average ticket price for each ticket type?',
        recipe: {
          start: 'TicketSales',
          steps: [
            { op: 'aggregate', groupBy: ['ticket_type'], summaries: [{ fn: 'average', column: 'price_each' }] },
          ],
        },
      },
    ],
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = dataset;
  else (root.QE_DATASETS = root.QE_DATASETS || []).push(dataset);
})(this);
