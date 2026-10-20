// SQL Studio: exercises for each data set, keyed by data set id. Edit by hand.
//
// Each exercise:
//   text          the question (the first three match the Query Explorer word for word)
//   note          optional extra prompt, shown in italics under the question
//   hint          practice data sets only (1–6): which tables and clauses are needed, never the query
//   answer        the reference query; students never see it
//   orderMatters  true only when the question asks for a sort order (the answer must have no ties)
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;

  // Data sets numbered this or higher are for assessment: no hints and no Check button.
  const ASSESSMENT_FROM = 7;

  const EXERCISES = {
    spotify: [
      {
        text: 'How many total streams did each artist have in March 2026?',
        hint: "You\'ll need Streams, Songs, and Artists, a WHERE on the date, and a GROUP BY.",
        answer: `SELECT a.artist_name, SUM(st.stream_count) AS total_streams
          FROM Streams st
          JOIN Songs so ON so.song_id = st.song_id
          JOIN Artists a ON a.artist_id = so.artist_id
          WHERE st.stream_date BETWEEN '2026-03-01' AND '2026-03-31'
          GROUP BY a.artist_name;`,
        orderMatters: false,
      },
      {
        text: 'What are the titles and release dates of all Latin songs?',
        hint: "You\'ll need Songs and Artists joined on artist_id, and a WHERE on genre.",
        answer: `SELECT so.song_title, so.release_date
          FROM Songs so
          JOIN Artists a ON a.artist_id = so.artist_id
          WHERE a.genre = 'Latin';`,
        orderMatters: false,
      },
      {
        text: 'How many songs does each artist have?',
        note: 'Is anyone missing? Why?',
        hint: "You\'ll need Artists and Songs joined on artist_id, COUNT, and a GROUP BY.",
        answer: `SELECT a.artist_name, COUNT(*) AS number_of_songs
          FROM Artists a
          JOIN Songs so ON so.artist_id = a.artist_id
          GROUP BY a.artist_name;`,
        orderMatters: false,
      },
      {
        text: 'List the five longest songs, longest first.',
        hint: 'You only need Songs. Sort with ORDER BY … DESC and keep five rows with LIMIT.',
        answer: `SELECT song_title, duration_sec
          FROM Songs
          ORDER BY duration_sec DESC
          LIMIT 5;`,
        orderMatters: true,
      },
      {
        text: "Show each song\'s title and its length in minutes.",
        hint: 'You only need Songs. Make a calculated column with AS. Divide by 60.0 (not 60) to keep the decimals.',
        answer: `SELECT song_title, duration_sec / 60.0 AS duration_min
          FROM Songs;`,
        orderMatters: false,
      },
      {
        text: 'Which artists had more than 5 million total streams?',
        hint: "You\'ll need Streams, Songs, and Artists, a GROUP BY, and HAVING to filter the totals.",
        answer: `SELECT a.artist_name, SUM(st.stream_count) AS total_streams
          FROM Streams st
          JOIN Songs so ON so.song_id = st.song_id
          JOIN Artists a ON a.artist_id = so.artist_id
          GROUP BY a.artist_name
          HAVING SUM(st.stream_count) > 5000000;`,
        orderMatters: false,
      },
    ],
    concert: [
      {
        text: 'How many tickets were sold in each city?',
        hint: "You\'ll need TicketSales, Shows, and Venues, SUM of quantity, and a GROUP BY.",
        answer: `SELECT v.city, SUM(t.quantity) AS tickets_sold
          FROM TicketSales t
          JOIN Shows s ON s.show_id = t.show_id
          JOIN Venues v ON v.venue_id = s.venue_id
          GROUP BY v.city;`,
        orderMatters: false,
      },
      {
        text: 'Which shows sold VIP tickets priced above $300?',
        hint: "You\'ll need TicketSales and Shows, and a WHERE with two conditions joined by AND.",
        answer: `SELECT s.artist_name, s.show_date, t.price_each
          FROM TicketSales t
          JOIN Shows s ON s.show_id = t.show_id
          WHERE t.ticket_type = 'VIP'
            AND t.price_each > 300;`,
        orderMatters: false,
      },
      {
        text: 'What is the average ticket price for each ticket type?',
        hint: 'You only need TicketSales, AVG, and a GROUP BY.',
        answer: `SELECT ticket_type, AVG(price_each) AS average_price
          FROM TicketSales
          GROUP BY ticket_type;`,
        orderMatters: false,
      },
      {
        text: 'Which artists have a show in July 2026? List each artist once.',
        hint: 'You only need Shows. Use DISTINCT, and a WHERE on show_date with BETWEEN.',
        answer: `SELECT DISTINCT artist_name
          FROM Shows
          WHERE show_date BETWEEN '2026-07-01' AND '2026-07-31';`,
        orderMatters: false,
      },
      {
        text: 'For each ticket sale, show the ticket type, quantity, and the total money from that sale.',
        hint: 'You only need TicketSales. Multiply quantity by price_each in a calculated column with AS.',
        answer: `SELECT ticket_type, quantity, quantity * price_each AS sale_total
          FROM TicketSales;`,
        orderMatters: false,
      },
      {
        text: 'Which venues sold more than 3,000 tickets in total?',
        hint: "You\'ll need TicketSales, Shows, and Venues, a GROUP BY on the venue, and HAVING.",
        answer: `SELECT v.venue_name, SUM(t.quantity) AS tickets_sold
          FROM TicketSales t
          JOIN Shows s ON s.show_id = t.show_id
          JOIN Venues v ON v.venue_id = s.venue_id
          GROUP BY v.venue_name
          HAVING SUM(t.quantity) > 3000;`,
        orderMatters: false,
      },
    ],
    netflix: [
      {
        text: 'How many total minutes were watched for each series?',
        hint: "You\'ll need ViewingSessions, Episodes, and Series, SUM, and a GROUP BY.",
        answer: `SELECT se.series_title, SUM(v.minutes_watched) AS total_minutes
          FROM ViewingSessions v
          JOIN Episodes e ON e.episode_id = v.episode_id
          JOIN Series se ON se.series_id = e.series_id
          GROUP BY se.series_title;`,
        orderMatters: false,
      },
      {
        text: 'What did Jordan watch in February 2026?',
        hint: "You\'ll need ViewingSessions, Episodes, and Series, and a WHERE on viewer_name AND watch_date.",
        answer: `SELECT se.series_title, e.season, e.episode_number, v.watch_date
          FROM ViewingSessions v
          JOIN Episodes e ON e.episode_id = v.episode_id
          JOIN Series se ON se.series_id = e.series_id
          WHERE v.viewer_name = 'Jordan'
            AND v.watch_date BETWEEN '2026-02-01' AND '2026-02-28';`,
        orderMatters: false,
      },
      {
        text: 'What is the average episode runtime for each genre?',
        hint: "You\'ll need Episodes and Series, AVG, and a GROUP BY on genre.",
        answer: `SELECT se.genre, AVG(e.runtime_min) AS average_runtime
          FROM Episodes e
          JOIN Series se ON se.series_id = e.series_id
          GROUP BY se.genre;`,
        orderMatters: false,
      },
      {
        text: 'Which series have a title that starts with "S"?',
        hint: 'You only need Series. Use LIKE with a % after the letter.',
        answer: `SELECT series_title
          FROM Series
          WHERE series_title LIKE 'S%';`,
        orderMatters: false,
      },
      {
        text: 'List the series released in 2020 or later that are not dramas, newest first.',
        hint: 'You only need Series. Combine two conditions with AND, use NOT (or <>), and sort with ORDER BY … DESC.',
        answer: `SELECT series_title, genre, release_year
          FROM Series
          WHERE release_year >= 2020
            AND NOT genre = 'Drama'
          ORDER BY release_year DESC;`,
        orderMatters: true,
      },
      {
        text: 'Which viewers watched more than 200 minutes in total?',
        hint: 'You only need ViewingSessions, SUM, a GROUP BY, and HAVING.',
        answer: `SELECT viewer_name, SUM(minutes_watched) AS total_minutes
          FROM ViewingSessions
          GROUP BY viewer_name
          HAVING SUM(minutes_watched) > 200;`,
        orderMatters: false,
      },
    ],
    basketball: [
      {
        text: 'How many total points did each player score this season?',
        hint: "You\'ll need BoxScores and Players, SUM, and a GROUP BY.",
        answer: `SELECT p.player_name, SUM(b.points) AS total_points
          FROM BoxScores b
          JOIN Players p ON p.player_id = b.player_id
          GROUP BY p.player_name;`,
        orderMatters: false,
      },
      {
        text: 'What is the average number of points for each position in home games?',
        hint: "You\'ll need BoxScores, Games, and Players, a WHERE on home_away, AVG, and a GROUP BY.",
        answer: `SELECT p.position, AVG(b.points) AS average_points
          FROM BoxScores b
          JOIN Games g ON g.game_id = b.game_id
          JOIN Players p ON p.player_id = b.player_id
          WHERE g.home_away = 'Home'
          GROUP BY p.position;`,
        orderMatters: false,
      },
      {
        text: 'In the games the Herd won, which players scored 20 or more points?',
        hint: "You\'ll need BoxScores, Games, and Players, and a WHERE with two conditions joined by AND.",
        answer: `SELECT p.player_name, g.opponent, b.points
          FROM BoxScores b
          JOIN Games g ON g.game_id = b.game_id
          JOIN Players p ON p.player_id = b.player_id
          WHERE b.points >= 20
            AND g.result = 'W';`,
        orderMatters: false,
      },
      {
        text: 'Show the three highest-scoring single games by a player: the player, the opponent, and the points.',
        hint: "You\'ll need BoxScores, Games, and Players, then ORDER BY points DESC and LIMIT.",
        answer: `SELECT p.player_name, g.opponent, b.points
          FROM BoxScores b
          JOIN Games g ON g.game_id = b.game_id
          JOIN Players p ON p.player_id = b.player_id
          ORDER BY b.points DESC
          LIMIT 3;`,
        orderMatters: true,
      },
      {
        text: 'List the games that were home wins, plus any game against App State.',
        hint: 'You only need Games. Use AND inside parentheses, then OR.',
        answer: `SELECT opponent, game_date, home_away, result
          FROM Games
          WHERE (home_away = 'Home' AND result = 'W')
             OR opponent = 'App State';`,
        orderMatters: false,
      },
      {
        text: 'Which players averaged more than 12 points a game? Round the average to one decimal place.',
        hint: "You\'ll need BoxScores and Players, AVG inside ROUND, a GROUP BY, and HAVING.",
        answer: `SELECT p.player_name, ROUND(AVG(b.points), 1) AS average_points
          FROM BoxScores b
          JOIN Players p ON p.player_id = b.player_id
          GROUP BY p.player_name
          HAVING AVG(b.points) > 12;`,
        orderMatters: false,
      },
    ],
    dining: [
      {
        text: 'How many dinner swipes did each dining hall get?',
        hint: "You\'ll need MealSwipes and DiningHalls, a WHERE on meal_period, COUNT, and a GROUP BY.",
        answer: `SELECT d.hall_name, COUNT(*) AS dinner_swipes
          FROM MealSwipes m
          JOIN DiningHalls d ON d.hall_id = m.hall_id
          WHERE m.meal_period = 'Dinner'
          GROUP BY d.hall_name;`,
        orderMatters: false,
      },
      {
        text: 'How many swipes came from each meal plan?',
        hint: "You\'ll need MealSwipes and Students, COUNT, and a GROUP BY on meal_plan.",
        answer: `SELECT s.meal_plan, COUNT(*) AS swipes
          FROM MealSwipes m
          JOIN Students s ON s.student_id = m.student_id
          GROUP BY s.meal_plan;`,
        orderMatters: false,
      },
      {
        text: 'Who ate late-night meals, and where?',
        hint: "You\'ll need MealSwipes, Students, and DiningHalls, and a WHERE on meal_period.",
        answer: `SELECT s.first_name, d.hall_name, m.swipe_date
          FROM MealSwipes m
          JOIN Students s ON s.student_id = m.student_id
          JOIN DiningHalls d ON d.hall_id = m.hall_id
          WHERE m.meal_period = 'Late Night';`,
        orderMatters: false,
      },
      {
        text: 'Which dining halls have "the" anywhere in their name?',
        note: 'Does LIKE care about upper and lower case?',
        hint: 'You only need DiningHalls. Use LIKE with % on both sides of the word.',
        answer: `SELECT hall_name
          FROM DiningHalls
          WHERE hall_name LIKE '%the%';`,
        orderMatters: false,
      },
      {
        text: 'Which residence halls do students on the Unlimited plan live in? List each hall once, A to Z.',
        hint: 'You only need Students. Use DISTINCT, a WHERE on meal_plan, and ORDER BY.',
        answer: `SELECT DISTINCT residence_hall
          FROM Students
          WHERE meal_plan = 'Unlimited'
          ORDER BY residence_hall;`,
        orderMatters: true,
      },
      {
        text: 'Which students swiped in at 3 or more different dining halls?',
        hint: "You\'ll need MealSwipes and Students, COUNT(DISTINCT …), a GROUP BY, and HAVING.",
        answer: `SELECT s.first_name, COUNT(DISTINCT m.hall_id) AS halls_visited
          FROM MealSwipes m
          JOIN Students s ON s.student_id = m.student_id
          GROUP BY s.student_id, s.first_name
          HAVING COUNT(DISTINCT m.hall_id) >= 3;`,
        orderMatters: false,
      },
    ],
    fantasy: [
      {
        text: 'How many total points did each fantasy team score?',
        hint: "You\'ll need WeeklyPoints, NFLPlayers, and FantasyTeams, SUM, and a GROUP BY.",
        answer: `SELECT f.team_name, SUM(w.fantasy_points) AS total_points
          FROM WeeklyPoints w
          JOIN NFLPlayers p ON p.player_id = w.player_id
          JOIN FantasyTeams f ON f.team_id = p.team_id
          GROUP BY f.team_name;`,
        orderMatters: false,
      },
      {
        text: 'Which players had a week with 25 or more points?',
        hint: "You\'ll need WeeklyPoints and NFLPlayers, and a WHERE on fantasy_points.",
        answer: `SELECT p.player_name, w.week, w.fantasy_points
          FROM WeeklyPoints w
          JOIN NFLPlayers p ON p.player_id = w.player_id
          WHERE w.fantasy_points >= 25;`,
        orderMatters: false,
      },
      {
        text: 'What is the average weekly score for each position?',
        hint: "You\'ll need WeeklyPoints and NFLPlayers, AVG, and a GROUP BY on position.",
        answer: `SELECT p.position, AVG(w.fantasy_points) AS average_points
          FROM WeeklyPoints w
          JOIN NFLPlayers p ON p.player_id = w.player_id
          GROUP BY p.position;`,
        orderMatters: false,
      },
      {
        text: 'List the wide receivers (WR) and running backs (RB), sorted by name.',
        hint: 'You only need NFLPlayers. Use OR (or IN) in the WHERE, then ORDER BY.',
        answer: `SELECT player_name, position, nfl_team
          FROM NFLPlayers
          WHERE position = 'WR' OR position = 'RB'
          ORDER BY player_name;`,
        orderMatters: true,
      },
      {
        text: 'Which player had the single highest-scoring week? Show the name, week, and points.',
        hint: "You\'ll need WeeklyPoints and NFLPlayers, ORDER BY … DESC, and LIMIT 1.",
        answer: `SELECT p.player_name, w.week, w.fantasy_points
          FROM WeeklyPoints w
          JOIN NFLPlayers p ON p.player_id = w.player_id
          ORDER BY w.fantasy_points DESC
          LIMIT 1;`,
        orderMatters: false,
      },
      {
        text: 'For each fantasy team, what was the average weekly score of its players? Only show teams that averaged more than 20.',
        hint: "You\'ll need WeeklyPoints, NFLPlayers, and FantasyTeams, AVG, a GROUP BY, and HAVING.",
        answer: `SELECT f.team_name, AVG(w.fantasy_points) AS average_points
          FROM WeeklyPoints w
          JOIN NFLPlayers p ON p.player_id = w.player_id
          JOIN FantasyTeams f ON f.team_id = p.team_id
          GROUP BY f.team_name
          HAVING AVG(w.fantasy_points) > 20;`,
        orderMatters: false,
      },
    ],
    boxoffice: [
      {
        text: 'How much did each studio earn in total?',
        answer: `SELECT st.studio_name, SUM(w.gross_millions) AS total_millions
          FROM WeekendGrosses w
          JOIN Movies m ON m.movie_id = w.movie_id
          JOIN Studios st ON st.studio_id = m.studio_id
          GROUP BY st.studio_name;`,
        orderMatters: false,
      },
      {
        text: 'Which PG-13 movies had a weekend over $50 million?',
        answer: `SELECT m.movie_title, w.weekend_date, w.gross_millions
          FROM WeekendGrosses w
          JOIN Movies m ON m.movie_id = w.movie_id
          WHERE m.rating = 'PG-13'
            AND w.gross_millions > 50;`,
        orderMatters: false,
      },
      {
        text: "What was each movie\'s best weekend?",
        answer: `SELECT m.movie_title, MAX(w.gross_millions) AS best_weekend
          FROM WeekendGrosses w
          JOIN Movies m ON m.movie_id = w.movie_id
          GROUP BY m.movie_title;`,
        orderMatters: false,
      },
      {
        text: 'Which R-rated movies are in the data set? Sort them from earliest to latest release.',
        answer: `SELECT movie_title, release_date
          FROM Movies
          WHERE rating = 'R'
          ORDER BY release_date;`,
        orderMatters: true,
      },
      {
        text: 'For each weekend gross, show the movie and how much it earned per theater, in dollars.',
        answer: `SELECT m.movie_title, w.weekend_date, w.gross_millions * 1000000 / w.theaters AS dollars_per_theater
          FROM WeekendGrosses w
          JOIN Movies m ON m.movie_id = w.movie_id;`,
        orderMatters: false,
      },
      {
        text: 'Which studios earned more than $300 million in total?',
        answer: `SELECT st.studio_name, SUM(w.gross_millions) AS total_millions
          FROM WeekendGrosses w
          JOIN Movies m ON m.movie_id = w.movie_id
          JOIN Studios st ON st.studio_id = m.studio_id
          GROUP BY st.studio_name
          HAVING SUM(w.gross_millions) > 300;`,
        orderMatters: false,
      },
    ],
    esports: [
      {
        text: 'How many total kills did each team get?',
        answer: `SELECT t.team_name, SUM(ms.kills) AS total_kills
          FROM MatchStats ms
          JOIN Gamers g ON g.gamer_id = ms.gamer_id
          JOIN Teams t ON t.team_id = g.team_id
          GROUP BY t.team_name;`,
        orderMatters: false,
      },
      {
        text: 'Which gamers had 20 or more kills in a match?',
        answer: `SELECT g.gamertag, ms.map_name, ms.kills
          FROM MatchStats ms
          JOIN Gamers g ON g.gamer_id = ms.gamer_id
          WHERE ms.kills >= 20;`,
        orderMatters: false,
      },
      {
        text: 'What is the average number of assists for each role?',
        answer: `SELECT g.role, AVG(ms.assists) AS average_assists
          FROM MatchStats ms
          JOIN Gamers g ON g.gamer_id = ms.gamer_id
          GROUP BY g.role;`,
        orderMatters: false,
      },
      {
        text: 'Which maps were played? List each map once, A to Z.',
        answer: `SELECT DISTINCT map_name
          FROM MatchStats
          ORDER BY map_name;`,
        orderMatters: true,
      },
      {
        text: 'For each match line, show the gamertag, the map, and the kills-per-death ratio rounded to 2 decimal places.',
        answer: `SELECT g.gamertag, ms.map_name, ROUND(ms.kills * 1.0 / ms.deaths, 2) AS kill_death_ratio
          FROM MatchStats ms
          JOIN Gamers g ON g.gamer_id = ms.gamer_id;`,
        orderMatters: false,
      },
      {
        text: 'Which gamers averaged at least 15 kills per match?',
        answer: `SELECT g.gamertag, AVG(ms.kills) AS average_kills
          FROM MatchStats ms
          JOIN Gamers g ON g.gamer_id = ms.gamer_id
          GROUP BY g.gamertag
          HAVING AVG(ms.kills) >= 15;`,
        orderMatters: false,
      },
    ],
    tiktok: [
      {
        text: 'How many total views did each meme format get?',
        answer: `SELECT v.meme_format, SUM(d.views) AS total_views
          FROM DailyViews d
          JOIN Videos v ON v.video_id = d.video_id
          GROUP BY v.meme_format;`,
        orderMatters: false,
      },
      {
        text: 'How many total likes did each creator get?',
        answer: `SELECT c.handle, SUM(d.likes) AS total_likes
          FROM DailyViews d
          JOIN Videos v ON v.video_id = d.video_id
          JOIN Creators c ON c.creator_id = v.creator_id
          GROUP BY c.handle;`,
        orderMatters: false,
      },
      {
        text: 'What did comedy creators post in the first half of April 2026?',
        answer: `SELECT c.handle, v.caption, v.post_date
          FROM Videos v
          JOIN Creators c ON c.creator_id = v.creator_id
          WHERE c.niche = 'Comedy'
            AND v.post_date BETWEEN '2026-04-01' AND '2026-04-15';`,
        orderMatters: false,
      },
      {
        text: 'Which videos have captions that start with "POV"?',
        answer: `SELECT caption
          FROM Videos
          WHERE caption LIKE 'POV%';`,
        orderMatters: false,
      },
      {
        text: 'Which creators have more than 100,000 followers and are not in the Gaming niche? Show the most followers first.',
        answer: `SELECT handle, niche, follower_count
          FROM Creators
          WHERE follower_count > 100000
            AND NOT niche = 'Gaming'
          ORDER BY follower_count DESC;`,
        orderMatters: true,
      },
      {
        text: 'Which videos got more than 1 million total views?',
        answer: `SELECT v.caption, SUM(d.views) AS total_views
          FROM DailyViews d
          JOIN Videos v ON v.video_id = d.video_id
          GROUP BY v.video_id, v.caption
          HAVING SUM(d.views) > 1000000;`,
        orderMatters: false,
      },
    ],
    festival: [
      {
        text: 'How many minutes of music does each stage host?',
        answer: `SELECT st.stage_name, SUM(s.set_length_min) AS total_minutes
          FROM SetTimes s
          JOIN Stages st ON st.stage_id = s.stage_id
          GROUP BY st.stage_name;`,
        orderMatters: false,
      },
      {
        text: 'Which acts play the Main Stage on Saturday?',
        answer: `SELECT a.act_name, s.set_length_min
          FROM SetTimes s
          JOIN Stages st ON st.stage_id = s.stage_id
          JOIN Acts a ON a.act_id = s.act_id
          WHERE st.stage_name = 'Main Stage'
            AND s.festival_date = '2026-04-11';`,
        orderMatters: false,
      },
      {
        text: 'How many headliners play each day?',
        answer: `SELECT s.festival_date, COUNT(*) AS headliners
          FROM SetTimes s
          JOIN Acts a ON a.act_id = s.act_id
          WHERE a.headliner = 'Yes'
          GROUP BY s.festival_date;`,
        orderMatters: false,
      },
      {
        text: 'List the acts that are not headliners, A to Z.',
        answer: `SELECT act_name
          FROM Acts
          WHERE NOT headliner = 'Yes'
          ORDER BY act_name;`,
        orderMatters: true,
      },
      {
        text: 'Which genres have "Pop" in their name? List each genre once.',
        answer: `SELECT DISTINCT genre
          FROM Acts
          WHERE genre LIKE '%Pop%';`,
        orderMatters: false,
      },
      {
        text: 'Which stages host more than one set?',
        answer: `SELECT st.stage_name, COUNT(*) AS number_of_sets
          FROM SetTimes s
          JOIN Stages st ON st.stage_id = s.stage_id
          GROUP BY st.stage_name
          HAVING COUNT(*) > 1;`,
        orderMatters: false,
      },
    ],
  };

  const isAssessment = datasetNumber => datasetNumber >= ASSESSMENT_FROM;
  const exerciseLabel = (datasetNumber, index) => `${datasetNumber}.${index + 1}`;

  const api = { EXERCISES, ASSESSMENT_FROM, isAssessment, exerciseLabel };
  if (isNode) module.exports = api;
  else root.SS = Object.assign(root.SS || {}, api);
})(this);
