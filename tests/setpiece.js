/* ============================================================
   SET PIECE — tests (plain Node, no dependencies)
   Run with `node tests/setpiece.js` (or `npm test`).
   Covers the daily generator, the launch solver, wall / keeper /
   scoring rules, share text, streaks, and loose balance bounds.
   ============================================================ */
const path = require("path");
const SP = require(path.join(__dirname, "..", "setpiece", "core.js"));

let passed = 0, failed = 0; const fails = [];
function ok(c, m) { if (c) passed++; else { failed++; fails.push(m); } }

// ---- daily generator ----
const d1 = SP.dailyShots(1), d1b = SP.dailyShots(1), d2 = SP.dailyShots(2);
ok(d1.length === 5, "five shots a day");
ok(JSON.stringify(d1) === JSON.stringify(d1b), "same day gives the same shots");
ok(JSON.stringify(d1) !== JSON.stringify(d2), "different days differ");
ok(SP.dayNumber(new Date(2026, 10, 17)) === 1, "17 Nov 2026 is Daily #1");
ok(SP.dayNumber(new Date(2026, 10, 18, 23, 59)) === 2, "next local day is #2");
for (let d = 1; d <= 60; d++) SP.dailyShots(d).forEach((s, i) => {
  ok(s.bz >= 17 && s.dist < 32, `day ${d} shot ${i}: sensible distance`);
  ok(s.wall.n >= 3 && s.wall.n <= 5, `day ${d} shot ${i}: wall of 3-5`);
  ok(Math.abs(s.keeper.x0) < 1.5, `day ${d} shot ${i}: keeper near the middle`);
  const wd = Math.hypot(s.wall.cx - s.bx, s.wall.cz - s.bz);
  ok(Math.abs(wd - SP.WALL_DIST) < 1e-6, `day ${d} shot ${i}: wall is 9.15 m away`);
});

// ---- launch solver: a clean strike arrives where the swipe ended ----
let worst = 0;
for (let d = 1; d <= 30; d++) for (const s of SP.dailyShots(d)) {
  for (const [x, y, p, c] of [[3.1, 2.1, 0.8, 0.5], [-3.1, 0.5, 0.5, -0.6], [0, 1.2, 1, 0], [2, 1.8, 0.4, 0.8]]) {
    const e = SP.simFree(s, SP.launch(s, { x, y }, p, c, null));
    worst = Math.max(worst, Math.hypot(e.x - x, e.y - y));
  }
}
ok(worst < 0.12, `launch solve lands within 12 cm (worst ${worst.toFixed(3)} m)`);

// ---- outcomes ----
const rng = SP.makeRng(7);
let keeperGoals = 0, wideGoals = 0, wallBlocks = 0, n = 0;
for (let d = 1; d <= 40; d++) for (const s of SP.dailyShots(d)) {
  n++;
  if (SP.resolve(s, { x: s.keeper.x0, y: 1.0 }, 0.5, 0, rng).type === "goal") keeperGoals++;
  if (SP.resolve(s, { x: 9, y: 1.0 }, 0.6, 0, rng).type === "goal") wideGoals++;
  // Low and hard at the middle of the wall.
  const w = s.wall, t = s.bz / (s.bz - w.cz);
  const aim = { x: s.bx + (w.cx - s.bx) * t, y: 0.5 };
  if (SP.resolve(s, aim, 0.9, 0, rng).type === "wall") wallBlocks++;
}
ok(keeperGoals === 0, `straight at the keeper never scores (${keeperGoals}/${n})`);
ok(wideGoals === 0, `a shot aimed well wide never scores (${wideGoals}/${n})`);
ok(wallBlocks >= n * 0.9, `low through the wall is blocked (${wallBlocks}/${n})`);

// ---- balance: a good strategy scores sometimes, not always ----
function rate(pick) {
  let g = 0, c = 0;
  for (let d = 1; d <= 60; d++) for (const s of SP.dailyShots(d)) {
    const [t, p, cu] = pick(s); c++;
    if (SP.resolve(s, t, p, cu, rng).type === "goal") g++;
  }
  return g / c;
}
const far = (s) => -Math.sign(s.keeper.x0);
const curled = rate((s) => [{ x: far(s) * 2.9, y: 2.0 }, 0.7, far(s) * -0.6]);
const lob = rate((s) => [{ x: far(s) * 3.1, y: 2.1 }, 0.15, 0]);
const centre = rate(() => [{ x: 0, y: 1.2 }, 0.5, 0]);
ok(curled > 0.15 && curled < 0.8, `curling round the wall scores sometimes (${(curled * 100).toFixed(0)}%)`);
ok(lob < 0.9, `the slow lob is not a guaranteed goal (${(lob * 100).toFixed(0)}%)`);
ok(centre < 0.1, `down the middle rarely scores (${(centre * 100).toFixed(0)}%)`);

// ---- scoring ----
const top = SP.score({ type: "goal", top: true, x: 3.2, y: 2.2, speed: 22 });
const plain = SP.score({ type: "goal", top: false, x: 0.5, y: 0.5, speed: 22 });
ok(top.points > plain.points && top.emoji === "🎯" && plain.emoji === "⚽", "top corner beats a plain goal");
ok(plain.points > SP.score({ type: "woodwork" }).points, "a goal beats the woodwork");
ok(SP.score({ type: "woodwork" }).points > SP.score({ type: "saved" }).points, "woodwork beats a save");
ok(SP.score({ type: "wall" }).points === 0 && SP.score({ type: "miss", sub: "over" }).points === 0, "wall and miss score nothing");
ok(SP.score({ type: "miss", sub: "over" }).label === "OVER THE BAR", "miss label names what happened");

// ---- share text & streaks ----
const res = [{ type: "goal", top: true, x: 3, y: 2, speed: 20 }, { type: "saved" }, { type: "wall" }, { type: "goal", x: 1, y: 1, speed: 20 }, { type: "miss", sub: "wide" }];
const txt = SP.shareText(12, res, 4, "https://example.test/");
const lines = txt.split("\n");
ok(lines[0] === "SET PIECE #12  2/5", "share: title line");
ok(lines[1] === "🎯🧤🧱⚽❌", "share: emoji row");
ok(/pts · 🔥4$/.test(lines[2]) && lines[3] === "https://example.test/", "share: points, streak, link");
ok(!/🔥/.test(SP.shareText(12, res, 1, "")), "share: no streak badge on day one");
let st = SP.nextStreak(null, 5);
ok(st.count === 1 && st.best === 1, "streak starts at 1");
st = SP.nextStreak(st, 6); ok(st.count === 2, "consecutive day extends the streak");
ok(SP.nextStreak(st, 6).count === 2, "same day does not double count");
st = SP.nextStreak(st, 9); ok(st.count === 1 && st.best === 2, "a missed day resets, best is kept");

console.log(`set piece: ${passed} passed, ${failed} failed`);
if (failed) { fails.slice(0, 20).forEach((f) => console.log("  FAIL " + f)); process.exit(1); }
