/* ============================================================
   TALISMAN — engine.js
   The season-sim engine: stats + form + club tier -> results.
   THIS IS THE HEART. Tune the numbers here until seasons feel right.

   Current status: BASIC working version (FWD). Numbers are first-pass.
   TODO (future sessions):
     - Tune goal/assist curves vs club tier & age (see PROJECT_NOTES.md).
     - Add team finish -> trophies (league title, cups) properly.
     - Fold key-moment outcomes into avg rating & trophies.
     - Wire perks (Leader, Glass Cannon, Engine...) into the math.
   ============================================================ */
(function () {
  const T = window.TALISMAN;
  const Engine = (T.Engine = {});

  // Team quality blends club base with the player's contribution.
  Engine.teamQuality = function () {
    const g = T.game;
    const clubBase = T.CLUB_TIERS[g.club.tier].base;
    const ovr = T.overall();
    let q = clubBase * 0.85 + ovr * 0.15 + T.rand(-4, 4);
    if (T.hasPerk("leader")) q += 3;
    return T.clamp(q, 20, 99);
  };

  // Deterministic, noise-free projection of a season for a given stat set.
  // Powers the Train screen so the player can SEE how stat changes move their
  // expected output. Same formulas as simSeason() with randomness removed.
  Engine.projectSeason = function (statsOverride) {
    const g = T.game, p = g.player, TUNE = T.TUNING;
    const s = statsOverride || p.stats;
    const keys = T.POSITIONS[p.position].stats;
    const ovr = Math.round(keys.reduce((a, k) => a + s[k], 0) / keys.length);

    let quality = T.CLUB_TIERS[g.club.tier].base * 0.85 + ovr * 0.15;
    if (T.hasPerk("leader")) quality += 3;
    quality = T.clamp(quality, 20, 99);

    const formMul = 1 + p.form / 40;
    const fitMul = 0.7 + (p.fitness / 100) * 0.3;
    const apps = Math.round(T.clamp(T.SEASON_GAMES * (p.fitness / 100), 8, 38));
    const attackFactor = 0.7 + (quality / 99) * 0.5;

    let xg = ((s.finishing * 0.5 + s.positioning * 0.3 + s.pace * 0.2) / 99) *
      TUNE.MAX_GOALS * formMul * fitMul * attackFactor;
    if (T.hasPerk("glassCannon")) xg *= 1.12;
    const goals = Math.round(T.clamp(xg, 0, TUNE.MAX_GOALS + 5));

    const assists = Math.round(T.clamp(((s.dribbling * 0.6 + s.positioning * 0.4) / 99) *
      TUNE.MAX_ASSISTS * formMul * attackFactor, 0, TUNE.MAX_ASSISTS + 4));

    const contrib = (goals + assists * 0.7) / Math.max(apps, 1);
    const rating = +T.clamp(6.0 + contrib * 1.6 + p.form * 0.02, 4, 9.9).toFixed(1);

    return { ovr, goals, assists, rating };
  };

  // Map team quality -> final league position (1..20).
  Engine.leagueFinish = function (quality) {
    // Higher quality -> lower (better) position. Add noise.
    const norm = (quality - 40) / 50; // ~0..1 across tiers
    let pos = Math.round(20 - norm * 18 + T.rand(-3, 3));
    return T.clamp(pos, 1, 20);
  };

  // Find the player's league match for a given round index (0-based).
  Engine.playerMatchAt = function (season, rd) {
    return season.matches.find(m => m.rd === rd && (m.h === 0 || m.a === 0));
  };

  // A single match rating from the player's involvement + the result.
  function matchRating(pg, pa, goalDiff) {
    let r = 6.0 + pg * 0.95 + pa * 0.55 + (goalDiff > 0 ? 0.4 : goalDiff < 0 ? -0.4 : 0);
    r += T.rand(-0.5, 0.5);
    return +T.clamp(r, 4, 10).toFixed(1);
  }

  // ----------------------------------------------------------------
  // runSeason() — build the league, simulate EVERY match game-by-game,
  // and mark a few rounds as key-moment matches. Returns a transient
  // `season` object the UI plays through; key-moment outcomes are
  // applied via applyMoment(), then finalizeSeason() builds the record.
  // ----------------------------------------------------------------
  Engine.runSeason = function () {
    const g = T.game, p = g.player;
    const teams = T.League.buildTeams(g.club, g.club.tier, T.overall());
    const sched = T.League.schedule(teams.length);

    const matches = [];
    sched.forEach((day, rd) => day.forEach(([h, a]) => matches.push({ rd, h, a, gh: 0, ga: 0 })));

    // Missed matches from low fitness (injuries add more in progression).
    const missCount = Math.round(T.clamp((1 - p.fitness / 100) * 8, 0, 16));
    const missed = new Set();
    while (missed.size < missCount) missed.add(T.randInt(0, 37));

    // Player's per-match scoring rate, calibrated so the season total lands
    // near the deterministic projection shown on the Train screen.
    const proj = Engine.projectSeason(p.stats);
    const played = Math.max(38 - missCount, 1);
    const perMatchG = proj.goals / played;
    const perMatchA = proj.assists / played;

    const pmeta = {}; // round -> { missed, oppId, home, pg, pa, rating }

    matches.forEach(m => {
      const home = teams[m.h], away = teams[m.a];
      let gh = T.League.matchGoals(home.str, away.str, true);
      let ga = T.League.matchGoals(away.str, home.str, false);

      if (m.h === 0 || m.a === 0) {
        const isHome = m.h === 0;
        const oppId = isHome ? m.a : m.h;
        if (missed.has(m.rd)) {
          pmeta[m.rd] = { missed: true, oppId, home: isHome, pg: 0, pa: 0, rating: 0 };
        } else {
          const pg = T.poisson(perMatchG);
          const pa = T.poisson(perMatchA);
          // ensure the player's team scores at least the player's goals + assists
          const need = pg + pa;
          if (isHome) gh = Math.max(gh, need); else ga = Math.max(ga, need);
          const my = isHome ? gh : ga, op = isHome ? ga : gh;
          pmeta[m.rd] = { missed: false, oppId, home: isHome, pg, pa, rating: matchRating(pg, pa, my - op) };
        }
      }
      m.gh = gh; m.ga = ga;
    });

    // Pick spread-out key rounds among matches the player actually plays.
    const playable = [];
    for (let rd = 0; rd < 38; rd++) if (pmeta[rd] && !pmeta[rd].missed) playable.push(rd);
    const wantKeys = Math.min(T.TUNING.KEY_MOMENTS_PER_SEASON, playable.length);
    const keyRounds = [];
    if (playable.length) {
      for (let i = 0; i < wantKeys; i++) {
        const idx = Math.floor(((i + 0.5) / wantKeys) * playable.length);
        keyRounds.push(playable[T.clamp(idx, 0, playable.length - 1)]);
      }
    }

    // Is there a cup run this season? Stronger clubs go deep more often.
    // Gates the cup-final / penalty key moments and the Domestic Cup trophy.
    const cupRun = T.rng() < T.clamp((teams[0].str - 50) / 110, 0.05, 0.7);

    return { teams, matches, pmeta, keyRounds: [...new Set(keyRounds)], cupRun };
  };

  // Apply a successful key-moment to its match: add a goal/assist for the
  // player and bump that match's rating. Updates the underlying match score.
  Engine.applyMoment = function (season, rd, effect) {
    const m = Engine.playerMatchAt(season, rd);
    const pm = season.pmeta[rd];
    if (!m || !pm) return;
    if (effect === "goal" || effect === "assist") {
      if (pm.home) m.gh++; else m.ga++;
      if (effect === "goal") pm.pg++; else pm.pa++;
    }
    pm.rating = +T.clamp(pm.rating + 0.3, 4, 10).toFixed(1);
  };

  // Build the season record from the (possibly moment-adjusted) season.
  Engine.finalizeSeason = function (season) {
    const g = T.game, p = g.player;
    const table = T.League.computeTable(season.teams, season.matches);
    const finish = table.findIndex(t => t.id === 0) + 1;

    let goals = 0, assists = 0, apps = 0;
    const matchRatings = [];
    const matchList = [];
    for (let rd = 0; rd < 38; rd++) {
      const pm = season.pmeta[rd];
      if (!pm) continue;
      const m = Engine.playerMatchAt(season, rd);
      const my = pm.home ? m.gh : m.ga, op = pm.home ? m.ga : m.gh;
      if (!pm.missed) { apps++; goals += pm.pg; assists += pm.pa; matchRatings.push(pm.rating); }
      matchList.push({
        rd: rd + 1, opp: season.teams[pm.oppId].name, home: pm.home,
        my, op, pg: pm.pg, pa: pm.pa, rating: pm.rating, missed: pm.missed,
        res: my > op ? "W" : my < op ? "L" : "D",
        key: season.keyRounds.includes(rd),
      });
    }
    const rating = +(matchRatings.reduce((a, b) => a + b, 0) / Math.max(matchRatings.length, 1)).toFixed(2);

    const trophies = [];
    if (finish === 1) trophies.push("League Title");
    if (season.cupRun && T.rng() < 0.45) trophies.push("Domestic Cup");

    // Individual awards & national call-up, from this season's output.
    const awards = [];
    if (goals >= 22 || (goals >= 18 && finish <= 3)) awards.push("Golden Boot");
    if (rating >= 7.3 && finish <= 4) awards.push("Player of the Season");
    else if (rating >= 7.0) awards.push("Team of the Season");
    if (p.age <= 21 && (goals >= 15 || rating >= 7.1)) awards.push("Young Player of the Year");
    if (!p.international && (rating >= 7.0 || goals >= 16)) {
      awards.push("National Call-Up");
      p.international = true;
    }

    return {
      season: g.season, age: p.age, club: g.club.name, clubTier: g.club.tier,
      apps, goals, assists, rating, finish, trophies, awards, matchRatings,
      cleanSheets: 0, keyMoments: [],
      matches: matchList,
      table: table.map((t, i) => ({
        pos: i + 1, name: t.name, P: t.P, W: t.W, D: t.D, L: t.L,
        GD: t.GD, Pts: t.Pts, isPlayer: t.id === 0,
      })),
    };
  };
})();
