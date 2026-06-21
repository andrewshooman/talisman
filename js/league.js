/* ============================================================
   TALISMAN — league.js
   A real, simulated league: 20 named fictional clubs, a full
   double round-robin (each team plays every other twice = 38
   matchdays — which is where "38" comes from), and a standings
   table. The engine (engine.js) drives the player's contribution
   on top of this; this module owns the structure & scheduling.

   Public API:
     T.League.buildTeams(club, tier, overall) -> [team]
     T.League.schedule(n)  -> [ round: [ [homeIdx, awayIdx], ... ] ]
     T.League.matchGoals(attStr, defStr, home) -> int goals
     T.League.computeTable(teams, matches) -> sorted [team] (with P/W/D/L/GF/GA/GD/Pts)
   ============================================================ */
(function () {
  const T = window.TALISMAN;
  const League = (T.League = {});

  // Build 20 teams. Index 0 is always the player's club.
  League.buildTeams = function (club, tier, overall) {
    const base = T.CLUB_TIERS[tier].base;
    const teams = [];

    // Player's club strength: anchored to its tier (so tier really sets how
    // strong your team is), only mildly nudged by the player's quality.
    let str0 = base + (overall - 60) * 0.2;
    if (T.hasPerk && T.hasPerk("leader")) str0 += 3;
    teams.push({ id: 0, name: club.name, str: T.clamp(Math.round(str0), 25, 95), isPlayer: true });

    // 19 rivals spread around the division so the table feels varied:
    // a couple of powerhouses, a couple of strugglers, the rest mid.
    const used = new Set([club.name]);
    for (let i = 1; i < 20; i++) {
      let name;
      let guard = 0;
      do { name = T.randomClubName(); } while (used.has(name) && guard++ < 40);
      used.add(name);
      const str = T.clamp(Math.round(base + T.rand(-22, 22)), 25, 95);
      teams.push({ id: i, name, str });
    }
    return teams;
  };

  // Double round-robin schedule via the circle method. n must be even.
  // Returns (n-1)*2 rounds, each an array of [homeIdx, awayIdx] pairs.
  League.schedule = function (n) {
    const arr = Array.from({ length: n }, (_, i) => i);
    const half = n / 2;
    const firstHalf = [];
    for (let r = 0; r < n - 1; r++) {
      const day = [];
      for (let i = 0; i < half; i++) {
        const h = arr[i], a = arr[n - 1 - i];
        // alternate home/away by round so it's not always the same side
        day.push(r % 2 ? [a, h] : [h, a]);
      }
      firstHalf.push(day);
      // rotate, keeping arr[0] fixed
      arr.splice(1, 0, arr.pop());
    }
    // second half mirrors home/away
    const secondHalf = firstHalf.map(day => day.map(([h, a]) => [a, h]));
    return firstHalf.concat(secondHalf);
  };

  // Goals for one side from a Poisson whose mean reflects strength gap + home edge.
  League.matchGoals = function (attStr, defStr, home) {
    let lambda = 1.25 + (attStr - defStr) * 0.025 + (home ? 0.25 : 0);
    lambda = T.clamp(lambda, 0.15, 4.5);
    return T.poisson(lambda);
  };

  // Aggregate a standings table from the played matches.
  League.computeTable = function (teams, matches) {
    teams.forEach(t => { t.P = t.W = t.D = t.L = t.GF = t.GA = t.Pts = 0; });
    matches.forEach(m => {
      const H = teams[m.h], A = teams[m.a];
      H.P++; A.P++;
      H.GF += m.gh; H.GA += m.ga; A.GF += m.ga; A.GA += m.gh;
      if (m.gh > m.ga) { H.W++; A.L++; H.Pts += 3; }
      else if (m.gh < m.ga) { A.W++; H.L++; A.Pts += 3; }
      else { H.D++; A.D++; H.Pts++; A.Pts++; }
    });
    teams.forEach(t => { t.GD = t.GF - t.GA; });
    return teams.slice().sort((a, b) => b.Pts - a.Pts || b.GD - a.GD || b.GF - a.GF);
  };
})();
