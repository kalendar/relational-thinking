// ERD Playground: the examples in the picker. Edit freely: every example must parse with no errors
// or notes (a test checks), so each one is also valid Mermaid. The first four come straight from the book.
(function (root) {
  'use strict';
  const isNode = typeof module !== 'undefined' && module.exports;

  const EXAMPLES = [
    {
      id: "artist-song",
      title: "Artist records Song",
      description: "The first example in 6.1: an artist records zero or more songs, and each song has exactly one artist.",
      text: `erDiagram
    ARTIST ||--o{ SONG : "records"`,
    },
    {
      id: "five-patterns",
      title: "The five patterns",
      description: "The five common patterns from 6.1, from one-to-one to many-to-many.",
      text: `erDiagram
    A1 ||--|| B1 : "one-to-one, both mandatory"
    A2 ||--o| B2 : "one-to-one, B optional"
    A3 ||--o{ B3 : "one-to-many, zero or more"
    A4 ||--|{ B4 : "one-to-many, one or more"
    A5 }o--o{ B5 : "many-to-many"`,
    },
    {
      id: "music-streaming",
      title: "Music streaming (Chapters 8–9)",
      description: "The music streaming database used in Chapters 8 and 9, with each entity's attributes.",
      text: `erDiagram
    ARTIST ||--o{ SONG : "records"
    SONG ||--o{ STREAM : "generates"
    USER ||--o{ STREAM : "creates"

    ARTIST {
        int artist_id PK
        string artist_name
        string genre
        string hometown
    }
    SONG {
        int song_id PK
        string song_title
        int artist_id FK
        int duration_seconds
        boolean explicit
        date release_date
    }
    USER {
        int user_id PK
        string username
        string email
        string subscription_tier
        date signup_date
    }
    STREAM {
        int stream_id PK
        int user_id FK
        int song_id FK
        date stream_date
        int seconds_listened
    }`,
    },
    {
      id: "campus-concert",
      title: "Campus concert series (6.2)",
      description: "The worked example from 6.2, with junction tables for the two many-to-many relationships.",
      text: `erDiagram
    VENUE ||--|{ EVENT : "hosts"
    ARTIST ||--o{ ARTIST_EVENT : "performs in"
    EVENT ||--o{ ARTIST_EVENT : "features"
    EVENT ||--|{ TICKET : "has"
    STUDENT ||--o{ TICKET : "purchases"
    SPONSOR ||--o{ SPONSOR_EVENT : "provides"
    EVENT ||--o{ SPONSOR_EVENT : "receives"

    VENUE {
        int venue_id PK
        string venue_name
        int capacity
        string location_on_campus
    }
    ARTIST {
        int artist_id PK
        string artist_name
        string genre
        string contact_email
    }
    EVENT {
        int event_id PK
        string event_name
        int venue_id FK
        date event_date
        time start_time
        decimal ticket_price
    }
    ARTIST_EVENT {
        int artist_id FK
        int event_id FK
        int set_length_minutes
        boolean is_headliner
        int performance_order
    }
    STUDENT {
        int student_id PK
        string student_name
        string email
        int grad_year
    }
    TICKET {
        int ticket_id PK
        int event_id FK
        int student_id FK
        string seat_assignment
        date purchase_date
    }
    SPONSOR {
        int sponsor_id PK
        string sponsor_name
        string contact_name
        string contact_email
    }
    SPONSOR_EVENT {
        int sponsor_id FK
        int event_id FK
        decimal contribution_amount
        string sponsorship_tier
    }`,
    },
    {
      id: "many-to-many",
      title: "Many-to-many, before and after",
      description: "A many-to-many relationship, and the same thing drawn with a junction table in the middle.",
      text: `erDiagram
    %% Before: students take many classes, and classes have many students.
    STUDENT }o--o{ CLASS : "takes"
    %% After: the junction table ENROLLMENT turns it into two one-to-many relationships.
    STUDENT ||--o{ ENROLLMENT : "has"
    CLASS ||--o{ ENROLLMENT : "has"`,
    },
    {
      id: "basketball",
      title: "Thundering Herd basketball",
      description: "Players and games meet in box scores: one row per player per game.",
      text: `erDiagram
    PLAYER ||--o{ BOX_SCORE : "earns"
    GAME ||--|{ BOX_SCORE : "records"

    PLAYER {
        int player_id PK
        string player_name
        string position
    }
    GAME {
        int game_id PK
        string opponent
        date game_date
    }
    BOX_SCORE {
        int box_id PK
        int player_id FK
        int game_id FK
        int points
    }`,
    },
    {
      id: "dining",
      title: "Campus dining",
      description: "Every meal swipe belongs to one student and one dining hall.",
      text: `erDiagram
    STUDENT ||--o{ MEAL_SWIPE : "makes"
    DINING_HALL ||--o{ MEAL_SWIPE : "takes"

    STUDENT {
        int student_id PK
        string first_name
        string meal_plan
    }
    DINING_HALL {
        int hall_id PK
        string hall_name
        int seats
    }
    MEAL_SWIPE {
        int swipe_id PK
        int student_id FK
        int hall_id FK
        date swipe_date
    }`,
    },
    {
      id: "netflix",
      title: "Netflix binge",
      description: "A series has one or more episodes, and viewers watch episodes in viewing sessions.",
      text: `erDiagram
    SERIES ||--|{ EPISODE : "includes"
    EPISODE ||--o{ VIEWING_SESSION : "is watched in"
    VIEWER ||--o{ VIEWING_SESSION : "starts"

    SERIES {
        int series_id PK
        string series_title
        string genre
    }
    EPISODE {
        int episode_id PK
        int series_id FK
        int season
        int runtime_min
    }
    VIEWING_SESSION {
        int session_id PK
        int episode_id FK
        int viewer_id FK
        date watch_date
    }
    VIEWER {
        int viewer_id PK
        string viewer_name
    }`,
    },
    {
      id: "fantasy",
      title: "Fantasy football league",
      description: "One-to-one and optional ends: each manager runs one team, and a team may win a trophy.",
      text: `erDiagram
    MANAGER ||--|| FANTASY_TEAM : "runs"
    FANTASY_TEAM ||--o| TROPHY : "wins"
    FANTASY_TEAM ||--o{ ROSTER_SPOT : "fills"
    NFL_PLAYER ||--o{ ROSTER_SPOT : "takes"

    MANAGER {
        int manager_id PK
        string manager_name
    }
    FANTASY_TEAM {
        int team_id PK
        int manager_id FK
        string team_name
    }
    TROPHY {
        int trophy_id PK
        int team_id FK
        int season
    }
    ROSTER_SPOT {
        int spot_id PK
        int team_id FK
        int player_id FK
        int week
    }
    NFL_PLAYER {
        int player_id PK
        string player_name
        string position
    }`,
    },
    {
      id: "self",
      title: "A relationship to itself",
      description: "An entity can relate to itself: a student can mentor zero or more other students, and each student has zero or one mentor.",
      text: `erDiagram
    STUDENT |o--o{ STUDENT : "mentors"

    STUDENT {
        int student_id PK
        string student_name
        int mentor_id FK
    }`,
    },
  ];

  const api = { EXAMPLES };
  if (isNode) module.exports = api;
  else root.SS = Object.assign(root.SS || {}, api);
})(this);
