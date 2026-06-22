# TALISMAN — Project Notes (for models)

> **Read this first when picking up the project.** It captures architecture,
> conventions, and decisions so any session can continue cleanly.
> Keep it updated: when you change a convention or tune the sim, note it here.
> Companion docs: [TALISMAN_BRIEF.md](TALISMAN_BRIEF.md) (design spec) · [ROADMAP.md](ROADMAP.md) (tasks).

---

## How to run

- It's a static app, **no build step**. Easiest: open `index.html` in a browser.
- Scripts are **classic `<script>` tags** (not ES modules) specifically so it works
  from `file://` with no server. Keep it that way unless you add a dev server.
- For a clean local server (optional): `python -m http.server` in this folder, then
  open http://localhost:8000.

## Architecture / load order

Everything hangs off the global `window.TALISMAN` (alias `T` inside each file's IIFE).
Load order is fixed in `index.html`:

```
data.js  -> constants only (no logic)
state.js -> T.game, newGame(), save/load, RNG, overall(), hasPerk()
visuals.js -> T.Vis: procedural SVG art (crest, kit, flag, radar, ring,
              trophy, sparkline, leaguePos, playerCard). Deterministic
              from a seed string (same club name => same crest/kit colors).
engine.js  -> T.Engine: simSeason(), teamQuality(), leagueFinish()
minigames.js -> T.Minigames: run(host,opts,onDone), scene(kind) — skill games
moments.js -> T.Moments: POOL_FWD, resolve(choice, skill), pickSeason()
progression.js -> T.Prog: rollForm, applyAgeCurve, rollInjury, awardXp, advanceSeason
legacy.js  -> T.Legacy: compute(), tierFor()
ui.js      -> T.UI: screen router + screens + confetti
main.js    -> bootstrap (shows title)
```

Rule of thumb: **data has no logic; logic modules don't touch the DOM; ui.js is the
only DOM layer.** If you need a new shared helper, add it to `state.js`.

## State shape (source of truth: `T.game`)

```
T.game = {
  seed, version, createdAt,
  player: { name, nation, position, age, stats{...5}, form, morale, fitness,
            xp, level, trainingPoints, perks[], injuries[] },
  club:   { name, tier },
  season, careerOver,
  history: [ seasonRecord ],
  totals: { apps, goals, assists, cleanSheets, trophies, awards, peakRating, clubsPlayedFor },
  momentsLog: [ { season, text, success } ],
  pending: null   // transient slot for engine/ui handoff
}
```

`seasonRecord` (from `engine.simSeason`):
```
{ season, age, club, clubTier, apps, goals, assists, rating, finish,
  trophies[], cleanSheets, keyMoments[] }
```

## Conventions

- **RNG:** use `T.rng()` / `T.rand(min,max)` / `T.randInt` / `T.pick` — never
  `Math.random()` directly (keeps the daily-seed feature possible). RNG is reseeded in
  `T.newGame` from `opts.seed` or `Date.now()`.
- **Clamp** with `T.clamp(v, lo, hi)`. Stats live in 1..99 (gameplay range ~25..99).
- **Perks:** gate effects with `T.hasPerk(id)`. Perk ids are the keys in `T.PERKS`.
- **Save** after meaningful changes (`T.save()`); UI calls it at season end & menu.
- **No real-world IP.** Clubs/players/nations are generated from pools in `data.js`.
- **Colors via CSS vars** in `styles.css` (`--gold` accent, `--bg` #0a0a0f). Don't
  hardcode hex in markup; reuse `.card`, `.btn`, `.pill`, `.stat`, `.seg`.
- New screens: add to `UI.screens.<name>` returning a DOM node, route via `UI.show("<name>")`.

## Current state of the build (Phase 0 complete)

- Plays the **full FWD loop**: create -> season (4 key moments) -> results -> repeat
  -> retirement with legacy score/tier. Saves to localStorage.
- **First-pass numbers** — not yet tuned. See ROADMAP Phase 1.
- **Stubbed / not built yet:** spin/event screen, transfer offers, catastrophic-injury
  is wired but rare, retirement defining-moments are minimal. (Train screen, perk-pick
  UI and awards/call-ups are now built — see sections below.)

## Key moments + mini-games (how it fits together)

- A key moment shows an SVG `scene` + prompt + action choices (ui.js `renderMoment`).
- Picking a choice launches its skill-game (ui.js `playMomentGame` -> `T.Minigames.run`).
  Choice descriptor: `game: { type, action? }`; the chosen stat sizes game difficulty.
- The game calls back with `{ skill: 0..1, text }`. `Moments.resolve(choice, skill)`
  blends skill into the roll: `roll = stat + form + (skill-0.5)*44 + noise [+perks]`.
- Mini-games use `requestAnimationFrame`. NOTE: browsers PAUSE rAF on hidden tabs and
  CLAMP setTimeout to ~1s — so automated headless preview shows a frozen marker. This is
  expected; it animates fine on a visible page. Don't "fix" the frozen-marker symptom.
- To add a game type: add to `MG._games`, render into `host`, call `onDone({skill,text})`,
  and add matching CSS in styles.css. Always honor the rAF cleanup (`stopLoop`).

## Visuals (visuals.js)

- Every screen uses procedural SVG so it reads like a game, not a quiz:
  title hero, FUT-style **player card** (OVR + position + flag + kit + crest),
  **radar** stat chart on the hub, **rings** for fitness/morale/rating/legacy,
  **league-position ladder** + **form sparkline** on results, **trophy cabinet**
  + crest **timeline** on retirement, live **card preview** on create.
- All art is deterministic from a string seed via `V.palette(seed)` (hashed hue),
  so a club's crest/kit colors are stable. Player gets `player.number` (state.js).
- The engine adds `record.matchRatings` (synthesized per-match ratings) purely to
  drive the sparkline; it does not affect the season average.
- Backward-compatible with old saves: `playerCard` defaults number to 9 and the
  sparkline guards empty arrays, so pre-0.2.0 saves still render.
- To add art: add a `V.fn` returning an SVG/HTML string + matching CSS class in
  styles.css. Use CSS vars for color; only seed-derived kit/crest/flag use inline hsl.

## Training, progression & scenario context (RPG loop)

- **Train screen** (`UI.screens.train`): a working copy of `player.stats` is edited with
  +/- steppers (1 point = +1 stat, clamp 99). A live radar + `Engine.projectSeason(stats)`
  (deterministic, noise-free clone of simSeason) show how allocation moves OVR/goals/
  assists/rating. Confirm writes back to `player.stats`/`trainingPoints` and saves.
  Reached from the hub's **Train** button. Training applies BEFORE the season is simmed,
  so it matters immediately.
- **Stats -> performance:** `simSeason` already derives goals (finishing/positioning/pace),
  assists (dribbling/positioning) and rating from stats; `projectSeason` mirrors it so the
  player can SEE the link. Key-moment minigame difficulty and the resolve roll both use the
  chosen stat, so training also improves big moments.
- **Level-up perks:** `Prog.advanceSeason` returns `{levelsGained}`; `playSeason` stashes
  it in `game.pendingPerks`; the results "Continue" routes through `UI.showPerkPick(n, ...)`
  which offers 3 unowned non-negative perks. Perk effects are gated by `T.hasPerk()` in
  engine/moments/progression (clutch, bigGame, leader, glassCannon, engine, ironMan,
  wonderkid all wired).
- **Scenario context:** each scenario has `comp` (T.COMPETITIONS), `stakes`, `stakesMult`,
  and per-choice `impact`. `Moments.context(moment)` generates an opponent club; the UI
  renders `V.matchHeader` (comp badge + your crest vs opponent crest + stakes). Outcome
  deltas are multiplied by `stakesMult` (final 1.7 > derby 1.35 > league ~1.2), shown as
  effect chips on the result screen with the choice's impact line.

## League, game-by-game season & competition (v0.4)

- **league.js** (`T.League`): builds 20 named clubs (index 0 = player), a double
  round-robin `schedule(20)` = 38 matchdays, `matchGoals()` (Poisson from strength +
  home edge), and `computeTable()`. Club strength is anchored to tier (`base +
  (overall-60)*0.2`) so tier really sets how strong your side is.
- **engine.js** new flow (replaces simSeason):
  - `runSeason()` builds the league, sims EVERY match, marks spread-out key rounds,
    returns a transient `season` ({teams, matches, pmeta, keyRounds}) stashed on
    `game._season`. Player per-match goals come from `projectSeason().goals / playedGames`
    so season totals land near the Train-screen projection.
  - `applyMoment(season, rd, effect)` adds a goal/assist to that match (changes the
    scoreline + table) on a successful key moment.
  - `finalizeSeason(season)` → the season record, now incl. `matches` (game-by-game)
    and `table` (final standings); `matchRatings` are now real per-match ratings.
- **moments.js**: 8 football-true FWD scenarios, each tied to its real fixture via
  `moment._match` (set in ui.playSeason) and carrying `effect: goal|assist|none`.
  FIXED the long-standing bug where several choices rolled vs `composure` (not an FWD
  stat) and silently defaulted to 50 — all choices now use the five FWD stats.
- **minigames.js**: added `dribbleDodge` (lane weaving) and `oneOnOne` (beat the
  onrushing keeper); 5 types total. Same `onDone({skill,text})` contract.
- **visuals.js**: `leagueTable(rows)`, `matchList(matches)`, and `matchHeader` now
  shows the real opponent crest + matchday + minute + live score.
- **state.js compete features**: `poisson()`, Hall of Fame (`loadHOF/saveHOF/addToHOF`,
  key `talisman.hof.v1`), `dailySeed()/todayKey()`, and share `encodeCareer/decodeCareer/
  shareText`. Retirement auto-saves an entry once (`game._hofSaved`).
- **UI**: new screens `halloffame` and `glossary`; title adds Daily Challenge / Hall of
  Fame / How to Play; results show table (compact↔full) + game-by-game (6↔all).
- **Cache-busting**: index.html asset URLs carry `?v=<VERSION>`. BUMP this when you
  change CSS/JS or the preview/deploy may serve stale files (we hit this in testing).

## Awards & national call-ups (v0.5)

- **data.js** `T.AWARDS`: id -> `{name, icon, desc}` for the six honours
  (goldenBoot, playmaker, pots, youngPlayer, callUp, intlStar). Display-only data.
- **progression.js** `Prog.rollAwards(record)`: judges season honours at advance time.
  Golden Boot / Playmaker compare `record.goals|assists` to a synthesised rival
  benchmark (`T.randInt`, harder in higher tiers) so the race is contested each year.
  POTS needs elite avg rating + top-5 finish (or the title); Young POTS is the U22
  branch. International logic lives here too: once `intlReady`, the first season grants
  `callUp`, then `player.caps` accrues (`apps/4`, clamped 2..12); a standout year adds
  `intlStar`. Returns award ids; `advanceSeason` stores them on `record.awards`,
  bumps `totals.awards`, and `awardXp` grants `+30 XP` each.
- **state.js**: new `player.caps` (0). Old saves lack it — all reads guard with
  `p.caps = p.caps || 0` / `g.player.caps || 0`, and `h.awards || []` over history.
- **legacy.js**: already weighted `t.awards * 80`; it now actually moves because the
  counter increments. No legacy.js change was needed.
- **ui.js**: results screen shows an "Individual honours" card (icons + caps) after
  the trophy card and fires confetti on any award; retirement adds Awards/Caps stat
  chips and an honours cabinet tallying awards across the whole career (`×N`).
- Reuses existing `.cabinet`/`.trophy-item` CSS — no new styles. Bumped asset
  `?v=` to 0.5.0 (data.js `T.VERSION` + index.html) for cache-busting.

## Tuning log (append each pass — most recent first)

- _2026-06-22_ — Added awards/call-ups (above). Benchmarks are first-pass: Golden Boot
  bar `randInt(17,27)+(tier-3)`, Playmaker `randInt(11,18)`, POTS rating ≥ 7.5 (7.35
  with bigGame) & finish ≤ 5. Validate alongside the Phase-1 sim tuning pass — if goal
  output shifts, revisit these thresholds so honours stay roughly one-in-a-few-seasons.
- _2026-06-20_ — Phase 0 first-pass constants set in `data.js` `T.TUNING`
  (MAX_GOALS 30, MAX_ASSISTS 18, BASE_INJURY_CHANCE 0.12). Engine goal formula:
  `(finishing*.5 + positioning*.3 + pace*.2)/99 * MAX_GOALS * form * fitness * attack`.
  **Not validated by playtest yet** — first Phase-1 task is to sanity-check ranges.

## Gotchas / decisions

- localStorage works in a real deploy and in Claude Code, but **not inside Claude.ai
  artifacts** — fine here.
- Age curve (`progression.applyAgeCurve`) is applied inside `advanceSeason()` right
  after `age++`, so each new season reflects growth (pre-prime) or decline (post-prime).
  Tune drift magnitudes there if progression feels too fast/slow.
- `engine.leagueFinish` uses a rough linear map; trophies beyond league title are a
  coin-flip scaled by quality — replace with a real competition model in Phase 1/2.

## Definition of done for a feature

1. Logic in the right module (no DOM in logic files).
2. State changes persist via `T.save()` where appropriate.
3. UI reachable from a screen and mobile-friendly (tap targets ≥ 52px).
4. ROADMAP checkbox ticked + this file updated if a convention/number changed.
