// http://games.espn.com/ffl/api/v2/teams?leagueId=888433&seasonId=2016
// https://www.reddit.com/r/fantasyfootball/comments/56u8bc/espn_fantasy_football_api_wrapper_for_python_3/

import Xray from 'x-ray';
import express from 'express';
import noodle from 'noodlejs';

const router = express.Router();
const x = Xray({
  filters: {
    trim: function (value) {
      return typeof value === 'string' ? value.trim() : value
    },
    toNumber: function (value) {
      return typeof value === 'number' ? value : Number.parseFloat(value);
    }
  }
});

function sortTeams (sortBy, dir = 'asc') {
  if (dir === 'asc') {
    return function(a, b) {
      if (a[sortBy] < b[sortBy]) return -1;
      if (a[sortBy] > b[sortBy]) return 1;
      return 0;
    }
  } else {
    return function(a, b) {
      if (a[sortBy] > b[sortBy]) return -1;
      if (a[sortBy] < b[sortBy]) return 1;
      return 0;
    }
  }
}

function reduceTeamData (mergedArr, team) {
  if (!mergedArr[0] || mergedArr[0].name !== team.name) {
    mergedArr.unshift(team);
  } else {
    mergedArr[0] = Object.assign({}, mergedArr[0], team);
  }
  return mergedArr;
}

function reduceTeams (mergedArr, team) {
  const teamIndex = mergedArr.findIndex(mergedTeam => mergedTeam.name === team.name);

  if (mergedArr.length === 0 || teamIndex === -1) {
    mergedArr.push(team);
    return mergedArr;
  } else {
    mergedArr[teamIndex] = Object.assign(mergedArr[teamIndex], team);
    return mergedArr;
  }
}

function addScore (team) {
  team.score = team.recordScore + team.pointsScore + team.ecrScore;
  return team;
}

// function reduceRankings (mergedArr, team) {
//   if (!mergedArr[0] || mergedArr[0].name !== team.name) {
//     mergedArr.unshift(team);
//   } else {
//     if (!mergedArr[0].score) {
//       mergedArr[0].score = 0;
//     }

//     if (team.recordScore || team.recordScore === 0) {
//       mergedArr[0].score = mergedArr[0].score + team.recordScore;
//       mergedArr[0].recordScore = team.recordScore;
//     }
//     if (team.pointsScore) {
//       mergedArr[0].score = mergedArr[0].score + team.pointsScore;
//       mergedArr[0].pointsScore = team.pointsScore;
//     }
//     if (team.ecrScore) {
//       mergedArr[0].score = mergedArr[0].score + team.ecrScore;
//       mergedArr[0].ecrScore = team.ecrScore;
//     }
//   }
//   return mergedArr;
// }

function mergeArrays (...arrays) {
  return arrays.reduce((a, b) => a.concat(b))
    .map(team => {
      team.sortName = team.name.toUpperCase();
      return team;
    })
    .sort(sortTeams('sortName'))
    .map(team => {
      team.sortName = undefined;
      return team;
    })
    .reduce(reduceTeamData, []);
}

function mergeRankings (...arrays) {
  return arrays.reduce((a, b) => a.concat(b))
    .map(team => {
      team.sortName = team.name.toUpperCase();
      return team;
    })
    .sort(sortTeams('sortName'))
    .map(team => {
      team.sortName = undefined;
      return team;
    })
    .reduce(reduceTeams, [])
    .map(addScore)
    .sort(sortTeams('score', 'desc'))
    .map((team, index) => {
      team.rank = index + 1;
      return team;
    });
}

function getBasicInfo (teams) {
  return teams.map(team => {
    return {
      name: team.name,
      url: team.url,
      record: team.wins + '-' + team.losses + '-' + team.ties,
      previousRank: team.previousRank
    }
  })
}

function rankRecord (teams) {
  return teams.map(team => {
    return {
      name: team.name,
      recordScore: parseFloat((team.pct * 12).toFixed(2))
    }
  });
}

function rankPointsScored (teams) {
  return teams.sort(sortTeams('pointsFor'))
    .map((team, index) => {
      return {
        name: team.name,
        pointsScore: index + 1
      }
    });
}

function rankEcr (teams) {
  return teams.map(team => {
    return {
      name: team.name,
      ecrScore: team.ecrRank
    }
  })
}

function getRankClasses (teams) {
  return teams.map(team => {
    const change = team.previousRank - team.rank;
    let changeText, directionClass, deltaClass;

    if (change === 0) {
      changeText = '--';
      directionClass = 'no-change';
      deltaClass = 'delta';
    } else if (change > 0) {
      changeText = Math.abs(change);
      directionClass = 'up';
      deltaClass = 'delta delta-up';
    } else {
      changeText = Math.abs(change);
      directionClass = 'down';
      deltaClass = 'delta delta-down';
    }

    return {
      name: team.name,
      change: changeText,
      direction: directionClass,
      delta: deltaClass
    }
  })
}

function scrapeDashboard(req, res) {
  const url = {
    base: 'http://games.espn.com',
    paths: {
      home: '/ffl/leagueoffice',
      standings: '/ffl/standings',
      scoreboard: '/ffl/scoreboard'
    },
    query: '?leagueId=' + req.params.leagueId + '&seasonId=2016'
  };

  return new Promise((resolve, reject) => {
    x(url.base + url.paths.home + url.query, {
      name: '.gamesmain h1 | trim',
      teams: x('.rank', [{
        name: '.team-name | trim',
        previousRank: '.ranking | toNumber'
      }]),
      standings: x('#games-tabs li:nth-child(3) a@href', {
        divisions: x('.gamesmain table.tableBody:not([id^=xstandTbl_div])', [{
          name: '.tableHead td | trim',
          teams: ['.tableBody .tableBody a | trim']
        }]),
        leaderboard: x('.gamesmain table.tableBody:not([id^=xstandTbl_div])', '.tableBody .tableBody', [{
          name: 'a | trim',
          url: 'a@href',
          wins: 'td:nth-child(2) | toNumber',
          losses: 'td:nth-child(3) | toNumber',
          ties: 'td:nth-child(4) | toNumber',
          pct: 'td:nth-child(5) | toNumber',
          gamesBack: 'td:nth-child(6)'
        }]),
        points: x('.gamesmain table[id^=xstandTbl_div]', '.bodyCopy', [{
          name: 'a | trim',
          pointsFor: 'td:nth-child(2) | toNumber',
          pointsAgainst: 'td:nth-child(3) | toNumber',
          home: 'td:nth-child(4)',
          away: 'td:nth-child(5)',
          division: 'td:nth-child(6)',
          streak: 'td:nth-child(7)'
        }])
      })
    })((err, data) => {
      if (err) reject(err);

      const league = {};

      league.name = data.name;

      const ecrRankings = [
        {name: `Zeke and Dez's Homemade Soup`,  previousRank: 1, ecrRank: 12},
        {name: `Puttin' on the  Fitz`,          previousRank: 5, ecrRank: 11},
        {name: `DeezNutz Dee`,                  previousRank: 3, ecrRank: 10},
        {name: `Make America  Gronk Again`,     previousRank: 2, ecrRank: 9},
        {name: `League Champ`,                  previousRank: 8, ecrRank: 8},
        {name: `Saskatoon Spankers`,            previousRank: 4, ecrRank: 7},
        {name: `Choke  Champs`,                 previousRank: 10, ecrRank: 6},
        {name: `When I Palm'er It Fitz`,        previousRank: 7, ecrRank: 5},
        {name: `Off Constantly`,                previousRank: 6, ecrRank: 4},
        {name: `Team Lengyel`,                  previousRank: 12, ecrRank: 3},
        {name: `I Hugged Calais Campbell`,      previousRank: 9, ecrRank: 2},
        {name: `DJBetrayedUs Traitor`,          previousRank: 11, ecrRank: 1}
      ];

      league.teams = mergeArrays(data.standings.leaderboard, data.standings.points, ecrRankings);
      league.rankings = mergeRankings(rankRecord(league.teams), rankPointsScored(league.teams), rankEcr(league.teams));
      league.rankings = mergeArrays(getBasicInfo(league.teams), league.rankings);
      league.rankings = mergeArrays(getRankClasses(league.rankings), league.rankings).sort(sortTeams('rank', 'asc'));

      resolve(league);
    });
  });
}

router.get('/', async function (req, res) {
  res.send({"message": "Missing league ID parameter."});
});

router.get('/:leagueId', async (req, res) => {
  const league = await scrapeDashboard(req, res);

  // res.status(200).json(league);
  res.status(200).render('powerrankings', {rankings: league.rankings});
});

export default router;