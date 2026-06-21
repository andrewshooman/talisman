# ⚽ TALISMAN

**A single-player football career RPG — live a striker's whole career, season by season.**

Create a player, progress through seasons, make choices in key match moments that roll
against your stats, then retire with a weighted **Legacy Score** and a ranking tier:
*Squad Player → Cult Hero → Star → Legend → Immortal → GOAT.*

> Roguelike RPG energy: an age curve to a prime then decline, injuries as status effects
> (a rare catastrophic one can end your career), perks that shape your identity, and a
> difficulty multiplier that rewards starting at a smaller club.

Dark sporty look, gold "legacy" accent, mobile-first. Fictional clubs & players only —
no real names, crests, or logos.

---

## Play it

It's a static web app with **no build step**.

- **Quickest:** open `index.html` in any modern browser.
- **Local server (optional):** `python -m http.server` then open http://localhost:8000.
- **On a phone:** open the deployed URL and use **Add to Home Screen** for a full-screen,
  app-like experience.

Progress saves automatically to `localStorage`.

## Current status

**Phase 0 (skeleton) complete** — the **Forward (FWD)** career loop plays end-to-end:
create → season (with interactive key moments) → results → repeat → retirement & legacy.
Numbers are first-pass and being tuned. Other positions (GK/DEF/MID) and stretch features
(daily seed, New Game+, rivals) are planned.

See the [Roadmap](ROADMAP.md) for what's next.

## Project layout

```
index.html          # shell; loads CSS + scripts in order (no bundler)
css/styles.css      # dark theme, gold accent, mobile-first components
js/
  data.js           # constants: positions, stats, club tiers, perks, flavor
  state.js          # game state, new game, save/load, RNG, helpers
  engine.js         # season-sim engine (stats -> results)  ← the heart
  visuals.js        # procedural SVG art (cards, crests, kits, radar, rings)
  minigames.js      # key-moment skill games + SVG stadium scenes
  moments.js        # key-moment scenarios + dice-roll resolver
  progression.js    # XP, age curve, injuries, season advance
  legacy.js         # legacy score + ranking tier
  ui.js             # screens + rendering + confetti juice
  main.js           # bootstrap
docs:
  TALISMAN_BRIEF.md # full design spec
  ROADMAP.md        # phased task board (living)
  PROJECT_NOTES.md  # architecture, conventions, tuning log (read first)
```

## Contributing / continuing the build

This project is built piecewise across many sessions. Before changing anything:

1. Read **[PROJECT_NOTES.md](PROJECT_NOTES.md)** — architecture, conventions, state shape.
2. Check **[ROADMAP.md](ROADMAP.md)** — grab the next task, tick it when done.
3. Keep logic out of the DOM layer (`ui.js` is the only file that touches the DOM),
   use the RNG helpers (not `Math.random`), and theme via CSS variables.

## License

MIT — see [LICENSE](LICENSE).
