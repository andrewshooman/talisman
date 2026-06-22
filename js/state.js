/* ============================================================
   TALISMAN — state.js
   Game state container, new-game factory, save/load (localStorage),
   and a small seeded RNG (for the future "daily seed" feature).
   ============================================================ */
(function () {
  const T = window.TALISMAN;

  // ---- RNG ------------------------------------------------------------
  // Mulberry32 — deterministic when seeded; defaults to Math.random-ish.
  T.makeRng = function (seed) {
    let a = seed >>> 0 || (Date.now() >>> 0);
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  // Global rng instance; reseeded on new game.
  T.rng = T.makeRng(Date.now());
  T.rand = (min, max) => min + T.rng() * (max - min);
  T.randInt = (min, max) => Math.floor(T.rand(min, max + 1));
  T.pick = (arr) => arr[Math.floor(T.rng() * arr.length)];
  T.clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // Knuth Poisson sampler (uses T.rng) — for match score lines.
  T.poisson = function (lambda) {
    if (lambda <= 0) return 0;
    const L = Math.exp(-lambda);
    let k = 0, p = 1;
    do { k++; p *= T.rng(); } while (p > L);
    return k - 1;
  };

  // ---- The live game state -------------------------------------------
  // Single source of truth. UI reads from T.game; logic mutates it.
  T.game = null;

  // Factory: build a fresh player + career. opts from the creation screen.
  T.newGame = function (opts) {
    const seed = opts.seed != null ? opts.seed : Date.now();
    T.rng = T.makeRng(seed);

    const pos = opts.position || "FWD";
    const statKeys = T.POSITIONS[pos].stats;

    // Starting stats: a raw 17-yo. Lower club tier -> slightly lower start.
    const tier = opts.clubTier || 2;
    const base = 40 + tier * 2;
    const stats = {};
    statKeys.forEach((k) => {
      stats[k] = T.clamp(Math.round(base + T.rand(-6, 8)), 25, 70);
    });

    T.game = {
      seed,
      version: T.VERSION,
      createdAt: Date.now(),

      player: {
        name: opts.name || T.randomPlayerName(),
        nation: opts.nation || T.pick(T.NATIONS),
        position: pos,
        number: T.pick([7, 9, 10, 11, 19]), // striker squad numbers
        age: T.START_AGE,
        stats,
        form: 0,          // -10..+10, volatile each season
        morale: 70,       // 0..100
        fitness: 90,      // 0..100
        xp: 0,
        level: 1,
        trainingPoints: 6,
        perks: [],
        injuries: [],     // active status effects
        caps: 0,          // national-team appearances (earned via Prog.rollAwards)
      },

      club: {
        name: opts.clubName || T.randomClubName(),
        tier: tier,
      },

      // league pyramid: current division + the persistent club ladder (set below)
      division: 0,
      league: null,

      season: 1,
      careerOver: false,

      // per-season records appended here
      history: [],

      // running totals for the legacy screen
      totals: {
        apps: 0, goals: 0, assists: 0, cleanSheets: 0,
        trophies: 0, awards: 0,
        peakRating: 0, clubsPlayedFor: 1,
      },

      // narrative log of defining moments
      momentsLog: [],

      // transient: the current season's pending event/result, set by engine
      pending: null,
    };

    T.initLeague(tier);
    return T.game;
  };

  // ---- League pyramid setup ------------------------------------------
  // Map the chosen starting club tier (1..5) to a starting division (0=top).
  T.DIV_FOR_START_TIER = { 1: 3, 2: 2, 3: 1, 4: 0, 5: 0 };

  // Build the persistent club ladder for a new career. Every division holds 20
  // clubs from T.CLUB_DB; the player ("P" sentinel) takes a slot in the starting
  // division, displacing that division's weakest club for the whole career so the
  // promotion/relegation maths stays balanced at 20 teams per division forever.
  T.initLeague = function (startTier) {
    const g = T.game;
    const divs = [[], [], [], []];
    T.CLUB_DB.forEach((c, cid) => divs[c.div].push(cid));
    const pDiv = T.DIV_FOR_START_TIER[startTier] != null ? T.DIV_FOR_START_TIER[startTier] : 2;
    let weakest = -1, weakStr = 999;
    divs[pDiv].forEach(cid => { if (T.CLUB_DB[cid].str < weakStr) { weakStr = T.CLUB_DB[cid].str; weakest = cid; } });
    divs[pDiv] = divs[pDiv].filter(cid => cid !== weakest);
    divs[pDiv].push("P");
    g.division = pDiv;
    g.league = { divs };
  };

  // Convenience: the current division's display name (guards old saves).
  T.divisionName = function () {
    const g = T.game;
    return (g && T.DIVISIONS[g.division]) ? T.DIVISIONS[g.division].name : ("Tier " + (g ? g.club.tier : "?"));
  };

  // Player's club strength for the league (anchored to tier, nudged by overall).
  T.playerClubStr = function () {
    const g = T.game;
    let s = T.CLUB_TIERS[g.club.tier].base + (T.overall() - 60) * 0.2;
    if (T.hasPerk && T.hasPerk("leader")) s += 3;
    return T.clamp(Math.round(s), 25, 95);
  };

  // Resolve a ladder entry to a club { cid, name, str, isPlayer? }. Entries are
  // "P" (the player), a number (T.CLUB_DB id), or an object (a club the player
  // has left behind after a transfer — its own name/strength, hashed colours).
  T.ladderClub = function (entry) {
    if (entry === "P") return { cid: "P", name: T.game.club.name, str: T.playerClubStr(), isPlayer: true };
    if (entry && typeof entry === "object") return { cid: entry, name: entry.name, str: entry.str };
    const c = T.CLUB_DB[entry];
    return { cid: entry, name: c.name, str: c.str };
  };

  // ---- Random name helpers -------------------------------------------
  T.randomPlayerName = () => `${T.pick(T.FIRST_NAMES)} ${T.pick(T.LAST_NAMES)}`;
  T.randomClubName = () => {
    // e.g. "Ashford United" or "Sporting Calder"
    return T.rng() < 0.5
      ? `${T.pick(T.CLUB_PLACES)} ${T.pick(T.CLUB_NAMES)}`
      : `${T.pick(T.CLUB_NAMES)} ${T.pick(T.CLUB_PLACES)}`;
  };

  // ---- Persistence (localStorage; works in real deploy) --------------
  T.save = function () {
    try {
      localStorage.setItem(T.SAVE_KEY, JSON.stringify(T.game));
      return true;
    } catch (e) {
      console.warn("Save failed (localStorage unavailable?)", e);
      return false;
    }
  };

  T.load = function () {
    try {
      const raw = localStorage.getItem(T.SAVE_KEY);
      if (!raw) return null;
      T.game = JSON.parse(raw);
      return T.game;
    } catch (e) {
      console.warn("Load failed", e);
      return null;
    }
  };

  T.hasSave = function () {
    try { return !!localStorage.getItem(T.SAVE_KEY); }
    catch (e) { return false; }
  };

  T.clearSave = function () {
    try { localStorage.removeItem(T.SAVE_KEY); } catch (e) {}
  };

  // ---- Derived helpers shared across modules -------------------------
  // Overall rating = mean of role stats (simple for now; weight later).
  T.overall = function (player) {
    const p = player || T.game.player;
    const keys = T.POSITIONS[p.position].stats;
    const sum = keys.reduce((a, k) => a + p.stats[k], 0);
    return Math.round(sum / keys.length);
  };

  T.hasPerk = (id) => T.game && T.game.player.perks.includes(id);

  // ---- Career score competition: Hall of Fame, daily seed, sharing ----
  T.HOF_KEY = "talisman.hof.v1";

  T.loadHOF = function () {
    try { return JSON.parse(localStorage.getItem(T.HOF_KEY)) || []; }
    catch (e) { return []; }
  };
  T.saveHOF = function (list) {
    try { localStorage.setItem(T.HOF_KEY, JSON.stringify(list.slice(0, 50))); } catch (e) {}
  };
  // Add a finished career; returns { list, rank } (1-based rank by score).
  T.addToHOF = function (entry) {
    const list = T.loadHOF();
    list.push(entry);
    list.sort((a, b) => b.score - a.score);
    T.saveHOF(list);
    return { list, rank: list.findIndex(e => e === entry) + 1 };
  };

  // Daily seed: identical career start for everyone on a given calendar day.
  T.todayKey = function () {
    const d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  };
  T.dailySeed = function () { return T.todayKey() >>> 0; };

  // Shareable career codes (base64 of compact JSON) for comparing with friends.
  T.encodeCareer = function (e) {
    try { return btoa(unescape(encodeURIComponent(JSON.stringify(e)))); }
    catch (err) { return ""; }
  };
  T.decodeCareer = function (s) {
    try { return JSON.parse(decodeURIComponent(escape(atob(String(s).trim())))); }
    catch (err) { return null; }
  };
  T.shareText = function (e) {
    return `TALISMAN — ${e.name}: ${e.tier} · ${e.score.toLocaleString()} pts · ` +
      `${e.goals}G ${e.assists}A · ${e.trophies}🏆 over ${e.seasons} seasons. Can you beat it?`;
  };
})();
