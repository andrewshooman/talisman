/* ============================================================
   TALISMAN — test harness (plain Node, no dependencies)
   Run with `node tests/run.js` (or `npm test`).

   Loads the logic modules with a window/localStorage shim and asserts the
   invariants we care about: data integrity, RNG determinism, save/load,
   ladder integrity through promotion/relegation + transfers, the cup /
   international specials, and loose balance sanity (so a tuning change that
   blows up the legacy ladder or award rate fails CI).
   ============================================================ */

// ---- shims so the browser modules load under Node ----
global.window = {};
const store = new Map();
global.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const path = require("path");
const JS = (f) => require(path.join(__dirname, "..", "js", f + ".js"));
["data", "state", "league", "engine", "progression", "legacy", "visuals", "moments"].forEach(JS);
const T = global.window.TALISMAN;

// ---- tiny assert framework ----
let passed = 0, failed = 0;
const fails = [];
function ok(cond, msg) { if (cond) passed++; else { failed++; fails.push(msg); } }
function group(name, fn) { try { fn(); } catch (e) { failed++; fails.push(`${name}: threw ${e && e.stack || e}`); } }

// ---- simulation helpers (mirror ui.playSeason faithfully) ----
function skillFor(s) { return T.clamp(0.45 + (s - 55) / 110 + T.rand(-0.22, 0.22), 0, 1); }
function pickChoice(m) { const p = T.game.player; return m.choices.slice().sort((a, b) => (p.stats[b.stat] || 50) - (p.stats[a.stat] || 50))[0]; }
function train() {
  const p = T.game.player, pri = ["finishing", "positioning", "pace", "dribbling", "physical"];
  let tp = p.trainingPoints;
  while (tp > 0) { for (const k of pri) { if (tp <= 0) break; if (p.stats[k] < 99) { p.stats[k]++; tp--; } } if (pri.every(k => p.stats[k] >= 99)) break; }
  p.trainingPoints = 0;
}
function ladderOk(g) {
  if (!g.league) return false;
  const sizes = g.league.divs.map(d => d.length);
  let pc = 0; g.league.divs.forEach(d => d.forEach(x => { if (x === "P") pc++; }));
  return sizes.every(s => s === 20) && pc === 1;
}
// Play a full career; `onSeason` can assert per season. acceptPolicy: 'up' accepts step-ups.
function playCareer(startTier, opts) {
  opts = opts || {};
  T.newGame({ seed: (Math.random() * 1e9) | 0, position: "FWD", clubTier: startTier });
  const g = T.game, p = g.player;
  let guard = 0, transfers = 0, wcWins = 0;
  while (!g.careerOver && guard++ < 40) {
    g.eventShownFor = g.season;
    const ev = T.Prog.rollSeasonEvent(); if (ev) T.Prog.applyEvent(ev.options[Math.floor(T.rng() * ev.options.length)]);
    train(); T.Prog.rollForm();
    const season = T.Engine.runSeason();
    season.extraTrophies = []; season.extraAwards = [];
    const league = T.Moments.pickSeason(season.keyRounds.length);
    league.forEach((mo, i) => {
      const rd = season.keyRounds[i], pm = season.pmeta[rd]; if (!pm) return;
      const c = pickChoice(mo);
      const r = T.Moments.resolve(c, skillFor(p.stats[c.stat] || 50), mo);
      p.form = T.clamp(p.form + r.deltas.form, -10, 10); p.morale = T.clamp(p.morale + r.deltas.morale, 0, 100);
      if (r.success && r.effect && r.effect !== "none") T.Engine.applyMoment(season, rd, r.effect);
    });
    const specials = T.Moments.pickSpecials(g, season);
    specials.forEach(mo => {
      const c = pickChoice(mo);
      const r = T.Moments.resolve(c, skillFor(p.stats[c.stat] || 50), mo);
      if (r.success && mo.grant) {
        if (mo.grant.trophy) season.extraTrophies.push(mo.grant.trophy);
        if (mo.grant.award) { season.extraAwards.push(mo.grant.award); if (mo.grant.award === "worldCup") wcWins++; }
      }
    });
    const rec = T.Engine.finalizeSeason(season);
    rec.proRel = T.Prog.runPromRel(season);
    const offers = g.careerOver ? [] : T.Prog.generateOffers(rec);
    T.Prog.rollInjury(); if (T.Prog.rollCareerEndInjury()) g.careerOver = true;
    T.Prog.advanceSeason(rec);
    if (opts.onSeason) opts.onSeason(g, rec);
    if (offers.length && opts.acceptPolicy === "up") { const o = offers.find(x => x.type === "step-up") || offers[0]; if (T.Prog.acceptTransfer(o)) transfers++; }
    if (g.player.age >= 35) g.careerOver = true;
  }
  return { g, transfers, wcWins, legacy: T.Legacy.compute() };
}

// ============================================================
// 1. Static data integrity
// ============================================================
group("data", () => {
  ok(T.CLUB_DB.length === 80, "CLUB_DB has 80 clubs");
  const per = [0, 0, 0, 0]; T.CLUB_DB.forEach(c => per[c.div]++);
  ok(per.every(n => n === 20), `20 clubs per division (${per})`);
  ok(new Set(T.CLUB_DB.map(c => c.name)).size === 80, "club names unique");
  ok(T.CLUB_DB.every(c => T.CLUB_COLORS[c.name]), "every club has a colour identity");
  ok(T.DIVISIONS.length === 4, "four divisions");
  ok(!!T.AWARDS.worldCup, "World Cup award exists");
  ok(T.LEGACY_TIERS.length === 6 && T.LEGACY_TIERS[0].min === 0, "6 legacy tiers from 0");
});

// ============================================================
// 2. RNG determinism
// ============================================================
group("rng", () => {
  const a = T.makeRng(123), b = T.makeRng(123);
  const seqA = [a(), a(), a()], seqB = [b(), b(), b()];
  ok(JSON.stringify(seqA) === JSON.stringify(seqB), "same seed -> same RNG sequence");
  ok(seqA.every(x => x >= 0 && x < 1), "rng in [0,1)");
});

// ============================================================
// 3. New game + league init + division mapping
// ============================================================
group("newgame", () => {
  for (const tier of [1, 2, 3, 4, 5]) {
    T.newGame({ seed: 1, position: "FWD", clubTier: tier });
    ok(ladderOk(T.game), `tier${tier}: ladder 20/div + one player`);
    ok(T.game.division === T.DIV_FOR_START_TIER[tier], `tier${tier}: starts in correct division`);
    ok(T.overall() >= 25 && T.overall() <= 70, `tier${tier}: starting OVR sane`);
  }
});

// ============================================================
// 4. Save / load round-trip
// ============================================================
group("save", () => {
  T.newGame({ seed: 42, position: "FWD", clubTier: 2 });
  T.game.player.stats.finishing = 71;
  ok(T.save(), "save returns true");
  const before = JSON.stringify(T.game);
  T.game = null;
  const loaded = T.load();
  ok(!!loaded, "load returns a game");
  ok(JSON.stringify(loaded) === before, "save/load round-trips exactly");
  ok(loaded.player.stats.finishing === 71, "loaded stat preserved");
  T.clearSave();
  ok(!T.hasSave(), "clearSave removes the save");
});

// ============================================================
// 5. Ladder integrity across full careers (incl. transfers + specials)
// ============================================================
group("ladder-integrity", () => {
  let breaks = 0;
  for (let i = 0; i < 120; i++) {
    const r = playCareer(1 + (i % 5), {
      acceptPolicy: "up",
      onSeason: (g) => { if (!ladderOk(g)) breaks++; },
    });
    if (!ladderOk(r.g)) breaks++;
  }
  ok(breaks === 0, `0 ladder-integrity breaks across 120 careers (saw ${breaks})`);
});

// ============================================================
// 6. Transfers change identity and keep integrity
// ============================================================
group("transfers", () => {
  T.newGame({ seed: 7, position: "FWD", clubTier: 3 });
  const g = T.game;
  // find a real club in the division above to poach
  const targetDiv = g.division - 1 >= 0 ? g.division - 1 : g.division;
  const targetCid = g.league.divs[targetDiv].find(e => typeof e === "number");
  const oldName = g.club.name;
  const okAccept = T.Prog.acceptTransfer({ cid: targetCid, division: targetDiv });
  ok(okAccept, "acceptTransfer succeeds");
  ok(g.club.name === T.CLUB_DB[targetCid].name, "adopts target club identity");
  ok(g.club.name !== oldName, "club name actually changed");
  ok(ladderOk(g), "ladder still 20/div + one player after transfer");
  ok((g.totals.clubsPlayedFor || 1) >= 2, "clubsPlayedFor incremented");
});

// ============================================================
// 7. Cup / international specials
// ============================================================
group("specials", () => {
  ok(T.Moments.POOL_CUP.some(m => m.id === "cup_final" && m.grant && m.grant.trophy === "Domestic Cup"), "cup final grants the cup");
  ok(T.Moments.POOL_INTL.some(m => m.id === "wc_final" && m.grant && m.grant.award === "worldCup"), "WC final grants the World Cup award");
  // every special choice uses a valid FWD stat and a real mini-game type
  const FWD = T.POSITIONS.FWD.stats, games = ["timingBar", "aimTarget", "reactionTap", "dribbleDodge", "oneOnOne", "freeKick", "oneTwo"];
  let bad = 0;
  T.Moments.POOL_CUP.concat(T.Moments.POOL_INTL).forEach(m => m.choices.forEach(c => {
    if (!FWD.includes(c.stat)) bad++;
    if (c.game && !games.includes(c.game.type)) bad++;
  }));
  ok(bad === 0, "special scenarios use valid stats + games");
  // international specials only appear once capped; force caps and a WC season
  T.newGame({ seed: 9, position: "FWD", clubTier: 5 });
  T.game.player.caps = 0; T.game.season = 4;
  ok(!T.Moments.pickSpecials(T.game, {}).some(m => m.track === "intl"), "no international games before a call-up");
  T.game.player.caps = 12;
  let sawIntl = false;
  for (let i = 0; i < 40; i++) { if (T.Moments.pickSpecials(T.game, {}).some(m => m.track === "intl")) { sawIntl = true; break; } }
  ok(sawIntl, "international games appear once capped");
  // a won World Cup final actually records the award
  T.newGame({ seed: 11, position: "FWD", clubTier: 5 });
  const rec = { season: 4, age: 26, club: "x", clubTier: 5, division: 0, apps: 34, goals: 24, assists: 10, rating: 7.6, finish: 1, trophies: [], extraAwards: ["worldCup"] };
  T.Prog.advanceSeason(rec);
  ok(rec.awards.includes("worldCup"), "World Cup award folded into the season's awards");
  ok(T.game.totals.awards >= 1, "World Cup award counts toward totals");
});

// ============================================================
// 7b. Result insight (the mini-game payoff description)
// ============================================================
group("result-insight", () => {
  const dr = T.Moments.describeResult;
  const mLeague = { stakesMult: 1.15 }, mFinal = { stakesMult: 1.8 }, mIntl = { track: "intl", stakesMult: 1.5 };
  const ch = (type, action) => ({ game: { type, action } });

  const g1 = dr({ success: true, effect: "goal", deltas: { morale: 6, form: 2 } }, mLeague, ch("timingBar", "SHOOT"));
  ok(g1.outcome === "goal" && g1.headline === "GOAL!", "scored -> goal headline");
  ok(g1.consequences.length >= 1 && g1.insight, "goal has consequences + insight");
  ok(g1.consequences.every(c => !/[+\-]\d/.test(c.text)), "consequences are words, not raw numbers");

  const a1 = dr({ success: true, effect: "assist", deltas: { morale: 4 } }, mLeague, ch("aimTarget"));
  ok(a1.outcome === "assist" && a1.action === "cutback", "assist -> assist outcome + cutback action");
  const s1 = dr({ success: false, effect: "goal", deltas: { morale: -5, form: -2 } }, mLeague, ch("oneOnOne"));
  ok(s1.outcome === "saved" && s1.action === "roundkeeper", "missed one-on-one -> saved + roundkeeper");
  const miss = dr({ success: false, effect: "goal", deltas: { morale: -5 } }, mLeague, ch("dribbleDodge"));
  ok(miss.outcome === "miss" && miss.action === "dribble", "missed dribble -> miss + dribble action");

  // representative action variants
  ok(dr({ success: true, effect: "goal", deltas: {} }, mLeague, ch("freeKick")).action === "freekick", "free kick -> freekick action");
  ok(dr({ success: true, effect: "goal", deltas: {} }, mLeague, ch("timingBar", "HEAD")).action === "header", "header action");
  ok(dr({ success: true, effect: "goal", deltas: {} }, mLeague, ch("timingBar", "VOLLEY")).action === "volley", "volley action");
  ok(dr({ success: true, effect: "goal", deltas: {} }, { id: "penalty", stakesMult: 1.3 }, ch("timingBar", "STRIKE")).action === "penalty", "penalty action");
  ok(dr({ success: true, effect: "goal", deltas: {} }, mLeague, ch("timingBar", "SHOOT")).action === "strike", "default -> strike action");

  const wc = dr({ success: true, effect: "goal", wonTitle: "World Cup", deltas: { morale: 10 } }, mIntl, ch("timingBar", "STRIKE"));
  ok(wc.big === true && /World Cup/.test(wc.insight), "trophy win -> big celebration + tailored insight");
  const fin = dr({ success: true, effect: "goal", deltas: { morale: 8 } }, mFinal, ch("freeKick"));
  ok(fin.big === true, "high-stakes success flagged big");
});

// ============================================================
// 7c. Loyalty vs journeyman legacy fork
// ============================================================
group("loyalty", () => {
  function setup(clubs, seasons, perks) {
    T.newGame({ seed: 5, position: "FWD", clubTier: 3 });
    T.game.totals.clubsPlayedFor = clubs;
    T.game.history = Array.from({ length: seasons }, () => ({ clubTier: 3 }));
    T.game.player.perks = perks || [];
    T.game.totals.goals = 200; T.game.totals.assists = 100; T.game.totals.peakRating = 7.2;
    return T.Legacy.compute();
  }
  const oneClub = setup(1, 14, []);
  const oneClubLoyal = setup(1, 14, ["loyal"]);
  ok(oneClubLoyal.score > oneClub.score, "Loyal perk boosts a one-club career");
  ok(oneClub.breakdown.loyalty > 0, "one-club career earns a loyalty bonus");
  const jman = setup(5, 14, []);
  const jmanMerc = setup(5, 14, ["mercenary"]);
  ok(jmanMerc.score > jman.score, "Mercenary perk boosts a journeyman career");
  ok(jman.breakdown.clubs === 5, "breakdown reports clubs played");
  ok(setup(1, 14, []).breakdown.loyalty <= 420, "loyalty bonus is capped");
  setup(1, 10, []); ok(T.Legacy.archetype().name === "One-Club Legend", "long one-club -> One-Club Legend");
  setup(6, 14, []); ok(T.Legacy.archetype().name === "Globetrotter", "many clubs -> Globetrotter");
  setup(3, 14, []); ok(T.Legacy.archetype().name === "Journeyman", "a few clubs -> Journeyman");
});

// ============================================================
// 8. Balance sanity — loose bounds so a blow-up fails CI
// ============================================================
group("balance", () => {
  const order = ["Squad Player", "Cult Hero", "Star", "Legend", "Immortal", "GOAT"];
  const tierCounts = {};
  const medByStart = {};
  for (const st of [1, 3, 5]) {
    const scores = [];
    for (let i = 0; i < 120; i++) { const r = playCareer(st); scores.push(r.legacy.score); tierCounts[r.legacy.tier] = (tierCounts[r.legacy.tier] || 0) + 1; }
    scores.sort((a, b) => a - b); medByStart[st] = scores[scores.length >> 1];
  }
  const total = Object.values(tierCounts).reduce((a, b) => a + b, 0);
  const goatPct = (tierCounts["GOAT"] || 0) / total;
  ok(goatPct > 0 && goatPct < 0.18, `GOAT rate is rare but reachable (${(goatPct * 100).toFixed(1)}%)`);
  const topish = ((tierCounts["Legend"] || 0) + (tierCounts["Immortal"] || 0) + (tierCounts["GOAT"] || 0)) / total;
  ok(topish > 0.3 && topish < 0.85, `most careers Legend+ but not everyone (${(topish * 100).toFixed(0)}%)`);
  // difficulty multiplier: starting lower should not score lower on average
  ok(medByStart[1] >= medByStart[5] - 200, `low start rewarded (t1 ${medByStart[1]} >= t5 ${medByStart[5]})`);
  ok(order.every(o => o in T.LEGACY_TIERS.reduce((m, t) => (m[t.name] = 1, m), {})), "tier names consistent");
});

// ---- report ----
console.log(`\nTALISMAN tests: ${passed} passed, ${failed} failed`);
if (failed) { console.log("\nFAILURES:"); fails.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
else { console.log("All green ✓"); process.exit(0); }
