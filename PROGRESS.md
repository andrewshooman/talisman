# Progress — SET PIECE (the daily free kick)

State file for the scheduled check-ins. Keep it short and current.

## Where things stand (17 Nov 2026)

- **Decision:** TALISMAN (the career sim at the repo root) is parked. Its owner played it and
  found it not fun: no real football on screen. The research in `reports/` pointed to short,
  one-mechanic, shareable daily games, so the project is now **SET PIECE** in `setpiece/`.
- **Built (v0.1.0):** swipe-to-shoot free kicks with ball physics (drag, curl, wind), a jumping
  wall, a diving keeper, woodwork, net bulge, slow motion at the goal, synthesised sound,
  confetti. Daily mode (same five kicks for everyone, one attempt, streaks, emoji share card)
  and endless practice. Anonymous play counters and `setpiece/stats.html`.
- **Tests:** `npm test` runs both suites (`tests/run.js`, `tests/setpiece.js`).
- **Launch kit:** `launch/` has screenshots and ready-to-post drafts (`launch/POSTS.md`).

## Waiting on the human

1. **Turn on GitHub Pages** (one time): repo Settings → Pages → Source "Deploy from a branch"
   → branch `main`, folder `/ (root)` → Save. The game is then at
   `https://andrewshooman.github.io/talisman/setpiece/`.
2. **Play it on a phone and say what feels wrong.** Swipe feel cannot be judged headlessly.
3. **Posting** needs accounts (Reddit, itch.io, CrazyGames). Either post the drafts in
   `launch/POSTS.md`, or attach a computer to a session so posting can be done from a
   logged-in browser.

## Next steps that do not need the human

- [ ] Act on player feedback: GitHub issues labelled or titled "Feedback".
- [ ] Feel pass once someone has played on a real phone (power curve, curl sensitivity, keeper).
- [ ] Landscape/desktop framing: the goal is small on wide screens; use a closer camera.
- [ ] Shot variety: knuckleball (no spin wobble), wet pitch skid, moving wall, indirect kicks.
- [ ] PWA manifest + icon so "Add to Home Screen" looks native.
- [ ] Portal build (CrazyGames SDK wrapper) once the live game holds players.

## Known unknowns

- The counter service (abacus.jasoncameron.dev) and the live site could not be reached from the
  build session's network, so play counting is untested end to end. The game works without it.
- Balance was tuned by simulation with assumed human aiming error, not by real players.

## In progress (started 17 Nov, after first phone playtest)

Owner feedback: keeper clips into the post; cannot get a free kick over the wall. New direction:
**merge SET PIECE into TALISMAN** so a career's key moments are *played* in the 3D scene engine
(a career RPG with playable match scenarios; original, not a clone of any existing game).

Plan:
1. `setpiece/core.js`: fix keeper clamp; add dip so shots can clear the wall; generalise the wall
   into `blockers`; add scene kinds (penalty, shot under pressure, one-on-one, header, volley,
   through-ball pass) and stat modifiers.
2. `setpiece/engine.js`: embeddable renderer/input/audio (`SPE.play(scene, opts, onDone)`),
   used by both the SET PIECE daily shell and TALISMAN.
3. TALISMAN `UI.playMomentGame`: play the scene; the real outcome decides success
   (`Moments.resolvePlayed`); player stats change scatter, power, curl, time on the ball.
4. Tests for all of it; update docs; merge.
