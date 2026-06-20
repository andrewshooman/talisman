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
- **Stubbed / not built yet:** spin/event screen, train screen (points accrue but
  can't be spent), perk-pick UI, transfer offers, awards/call-ups, catastrophic-injury
  is wired but rare, retirement trophy cabinet/defining-moments are minimal.

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

## Tuning log (append each pass — most recent first)

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
