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

  // Map team quality -> final league position (1..20).
  Engine.leagueFinish = function (quality) {
    // Higher quality -> lower (better) position. Add noise.
    const norm = (quality - 40) / 50; // ~0..1 across tiers
    let pos = Math.round(20 - norm * 18 + T.rand(-3, 3));
    return T.clamp(pos, 1, 20);
  };

  // Simulate a single FWD season. Returns a season record (also pushed
  // to history and folded into totals by progression.advanceSeason()).
  Engine.simSeason = function () {
    const g = T.game;
    const p = g.player;
    const s = p.stats;
    const TUNE = T.TUNING;

    const quality = Engine.teamQuality();
    const finish = Engine.leagueFinish(quality);

    // Form & fitness multipliers
    const formMul = 1 + p.form / 40;            // ~0.75..1.25
    const fitMul = 0.7 + (p.fitness / 100) * 0.3;

    // Apps reduced by low fitness (injuries handled in progression).
    const apps = Math.round(T.clamp(T.SEASON_GAMES * (p.fitness / 100), 8, 38));

    // Expected goals from FWD stats, scaled by team attack & form.
    const attackFactor = 0.7 + (quality / 99) * 0.5;
    let xg =
      ((s.finishing * 0.5 + s.positioning * 0.3 + s.pace * 0.2) / 99) *
      TUNE.MAX_GOALS * formMul * fitMul * attackFactor;
    if (T.hasPerk("glassCannon")) xg *= 1.12;
    let goals = Math.round(T.clamp(xg + T.rand(-3, 3), 0, TUNE.MAX_GOALS + 5));

    // Assists from dribbling/positioning + team quality.
    let assists = Math.round(
      T.clamp(((s.dribbling * 0.6 + s.positioning * 0.4) / 99) *
        TUNE.MAX_ASSISTS * formMul * attackFactor + T.rand(-2, 2),
        0, TUNE.MAX_ASSISTS + 4)
    );

    // Avg rating from contribution per app + team success + form.
    const contrib = (goals + assists * 0.7) / Math.max(apps, 1);
    let rating = 6.0 + contrib * 1.6 + (20 - finish) * 0.03 + p.form * 0.02;
    rating = +T.clamp(rating, 4.0, 9.9).toFixed(2);

    // Trophies (very rough first pass): title for winning the league.
    const trophies = [];
    if (finish === 1) trophies.push("League Title");
    if (T.rng() < (quality - 55) / 120) trophies.push("Cup");

    return {
      season: g.season,
      age: p.age,
      club: g.club.name,
      clubTier: g.club.tier,
      apps, goals, assists,
      rating,
      finish,
      trophies,
      cleanSheets: 0, // FWD: n/a (kept for schema parity)
      keyMoments: [], // filled by moments.js if a moment season
    };
  };
})();
