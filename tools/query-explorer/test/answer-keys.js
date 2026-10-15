// Answer keys for the assessment data sets (7–10). These recipes are kept OUT of the
// published page on purpose, so students can't find them in the page source. The data set
// validator still runs them to prove each question has a working, non-empty answer.
module.exports = {
  "boxoffice": [
    {
      "start": "WeekendGrosses",
      "steps": [
        {
          "op": "join",
          "table": "Movies",
          "leftColumn": "movie_id",
          "rightColumn": "movie_id"
        },
        {
          "op": "join",
          "table": "Studios",
          "leftColumn": "studio_id",
          "rightColumn": "studio_id"
        },
        {
          "op": "aggregate",
          "groupBy": [
            "studio_name"
          ],
          "summaries": [
            {
              "fn": "total",
              "column": "gross_millions"
            }
          ]
        }
      ]
    },
    {
      "start": "WeekendGrosses",
      "steps": [
        {
          "op": "filter",
          "column": "gross_millions",
          "condition": "more_than",
          "value": "50"
        },
        {
          "op": "join",
          "table": "Movies",
          "leftColumn": "movie_id",
          "rightColumn": "movie_id"
        },
        {
          "op": "filter",
          "column": "rating",
          "condition": "is",
          "value": "PG-13"
        },
        {
          "op": "project",
          "columns": [
            "movie_title",
            "weekend_date",
            "gross_millions"
          ]
        }
      ]
    },
    {
      "start": "WeekendGrosses",
      "steps": [
        {
          "op": "join",
          "table": "Movies",
          "leftColumn": "movie_id",
          "rightColumn": "movie_id"
        },
        {
          "op": "aggregate",
          "groupBy": [
            "movie_title"
          ],
          "summaries": [
            {
              "fn": "highest",
              "column": "gross_millions"
            }
          ]
        }
      ]
    }
  ],
  "esports": [
    {
      "start": "MatchStats",
      "steps": [
        {
          "op": "join",
          "table": "Gamers",
          "leftColumn": "gamer_id",
          "rightColumn": "gamer_id"
        },
        {
          "op": "join",
          "table": "Teams",
          "leftColumn": "team_id",
          "rightColumn": "team_id"
        },
        {
          "op": "aggregate",
          "groupBy": [
            "team_name"
          ],
          "summaries": [
            {
              "fn": "total",
              "column": "kills"
            }
          ]
        }
      ]
    },
    {
      "start": "MatchStats",
      "steps": [
        {
          "op": "filter",
          "column": "kills",
          "condition": "at_least",
          "value": "20"
        },
        {
          "op": "join",
          "table": "Gamers",
          "leftColumn": "gamer_id",
          "rightColumn": "gamer_id"
        },
        {
          "op": "project",
          "columns": [
            "gamertag",
            "map_name",
            "kills"
          ]
        }
      ]
    },
    {
      "start": "MatchStats",
      "steps": [
        {
          "op": "join",
          "table": "Gamers",
          "leftColumn": "gamer_id",
          "rightColumn": "gamer_id"
        },
        {
          "op": "aggregate",
          "groupBy": [
            "role"
          ],
          "summaries": [
            {
              "fn": "average",
              "column": "assists"
            }
          ]
        }
      ]
    }
  ],
  "tiktok": [
    {
      "start": "DailyViews",
      "steps": [
        {
          "op": "join",
          "table": "Videos",
          "leftColumn": "video_id",
          "rightColumn": "video_id"
        },
        {
          "op": "aggregate",
          "groupBy": [
            "meme_format"
          ],
          "summaries": [
            {
              "fn": "total",
              "column": "views"
            }
          ]
        }
      ]
    },
    {
      "start": "DailyViews",
      "steps": [
        {
          "op": "join",
          "table": "Videos",
          "leftColumn": "video_id",
          "rightColumn": "video_id"
        },
        {
          "op": "join",
          "table": "Creators",
          "leftColumn": "creator_id",
          "rightColumn": "creator_id"
        },
        {
          "op": "aggregate",
          "groupBy": [
            "handle"
          ],
          "summaries": [
            {
              "fn": "total",
              "column": "likes"
            }
          ]
        }
      ]
    },
    {
      "start": "Videos",
      "steps": [
        {
          "op": "filter",
          "column": "post_date",
          "condition": "between",
          "value": "2026-04-01",
          "value2": "2026-04-15"
        },
        {
          "op": "join",
          "table": "Creators",
          "leftColumn": "creator_id",
          "rightColumn": "creator_id"
        },
        {
          "op": "filter",
          "column": "niche",
          "condition": "is",
          "value": "Comedy"
        },
        {
          "op": "project",
          "columns": [
            "handle",
            "caption",
            "post_date"
          ]
        }
      ]
    }
  ],
  "festival": [
    {
      "start": "SetTimes",
      "steps": [
        {
          "op": "join",
          "table": "Stages",
          "leftColumn": "stage_id",
          "rightColumn": "stage_id"
        },
        {
          "op": "aggregate",
          "groupBy": [
            "stage_name"
          ],
          "summaries": [
            {
              "fn": "total",
              "column": "set_length_min"
            }
          ]
        }
      ]
    },
    {
      "start": "SetTimes",
      "steps": [
        {
          "op": "filter",
          "column": "festival_date",
          "condition": "on",
          "value": "2026-04-11"
        },
        {
          "op": "join",
          "table": "Stages",
          "leftColumn": "stage_id",
          "rightColumn": "stage_id"
        },
        {
          "op": "filter",
          "column": "stage_name",
          "condition": "is",
          "value": "Main Stage"
        },
        {
          "op": "join",
          "table": "Acts",
          "leftColumn": "act_id",
          "rightColumn": "act_id"
        },
        {
          "op": "project",
          "columns": [
            "act_name",
            "set_length_min"
          ]
        }
      ]
    },
    {
      "start": "SetTimes",
      "steps": [
        {
          "op": "join",
          "table": "Acts",
          "leftColumn": "act_id",
          "rightColumn": "act_id"
        },
        {
          "op": "filter",
          "column": "headliner",
          "condition": "is",
          "value": "Yes"
        },
        {
          "op": "aggregate",
          "groupBy": [
            "festival_date"
          ],
          "summaries": [
            {
              "fn": "count"
            }
          ]
        }
      ]
    }
  ]
};
