# TALISMAN — Roadmap & Task Board

> **Living document.** Update the checkboxes and "Now / Next / Later" as work lands.
> Built piecewise across many sessions. Pair this with [PROJECT_NOTES.md](PROJECT_NOTES.md)
> (architecture + conventions + tuning log) and [TALISMAN_BRIEF.md](TALISMAN_BRIEF.md) (the design spec).

Status legend: `[ ]` todo · `[~]` in progress · `[x]` done

---

## Phase 0 — Skeleton (DONE)

- [x] Project structure (modular, no build step, opens from `file://`)
- [x] Dark theme + gold accent CSS, mobile-first
- [x] `data.js` constants (positions, FWD stats, club tiers, perks, legacy tiers, flavor)
- [x] `state.js` (new game, save/load localStorage, RNG, overall())
- [x] `engine.js` basic FWD season sim (stats -> goals/assists/finish/rating)
- [x] `moments.js` key-moment pool + resolver (FWD, 4 scenarios)
- [x] `progression.js` form, age curve, injuries, XP, advance-season
- [x] `legacy.js` legacy score + tier
- [x] `ui.js` full loop: title -> create -> hub -> moments -> results -> retirement
- [x] Confetti juice on success/trophy/retire
- [x] GitHub repo created + pushed
- [x] **Interactive key moments**: SVG stadium scenes + skill mini-games
      (`minigames.js`: timingBar / aimTarget / reactionTap). Skill (0..1)
      blends into the stat roll. Moment pool grown to 6 FWD scenarios.
- [x] **Visual identity** (`visuals.js`): procedural player card, club crests,
      jersey kits, nation flags, radar stat chart, rating/fitness rings,
      league-position ladder, season form sparkline, trophy cabinet. Every
      screen now reads like a game rather than a text menu.

---

## Phase 1 — Make the FWD loop *feel right* (NOW)

The skeleton plays end-to-end but numbers are first-pass. This phase is about feel.

- [ ] **Tune the sim** (`engine.js`): sanity-check that a tier-1 17-yo doesn't score 40,
      a prime tier-5 striker flirts with ~30. Log tuning passes in PROJECT_NOTES.
- [ ] **Spin / event screen** (new `UI.screens.spin`): season-opening situation —
      transfer offer, manager change, rivalry, captaincy, loan, injury scare.
- [ ] **Train screen** (new `UI.screens.train`): spend `trainingPoints` across the 5
      stats; confirm; persists. (Currently points accrue but can't be spent.)
- [ ] **Perk pick on level-up** (`progression.awardXp` hook + `UI.screens.perkPick`).
- [ ] **Transfers/feedback** (`progression.generateOffers`): strong seasons attract
      bigger clubs; poor seasons -> drop/loan/relegation. Wire into post-results.
- [ ] **Awards & call-ups**: Player of the Season, Ballon-style, national team.
      Increment `totals.awards`; surface in results + legacy.
- [ ] Grow the **key-moment pool** to 8-10 FWD scenarios (now at 6); context-aware
      selection (finals only when in a cup run / late season).
- [ ] More **mini-game types** (1v1 dribble dodge, header timing arc) + per-opponent
      difficulty scaling. See `minigames.js`.
- [ ] Wire **perks into math** (Leader/Glass Cannon/Engine/Clutch/etc.).

---

## Phase 2 — Depth & polish (NEXT)

- [ ] Retirement screen: trophy cabinet, defining moments (from `momentsLog`),
      stat totals, shareable score string.
- [ ] Legacy weighting pass: loyalty (one-club) vs journeyman variety bonus.
- [ ] Rating count-up animation, trophy-win full-screen flourish, haptic-style juice.
- [ ] PWA: `manifest.json` + icons so "Add to Home Screen" looks native.
- [ ] Settings: reset save, toggle confetti, (optional) sound.

---

## Phase 3 — Other positions (LATER)

- [ ] Generalize engine/moments/legacy to be role-aware (already partly scaffolded).
- [ ] **MID** stats + scenarios + scoring.
- [ ] **DEF** (clean sheets, tackles, def rating) + scenarios + scoring.
- [ ] **GK** (saves, save %, clean sheets) + scenarios + scoring.
- [ ] Unlock locked positions in the create screen.

---

## Phase 4 — Stretch (LATER)

- [ ] **Daily seed** — same career start for everyone that day (RNG already seedable).
- [ ] **New Game+** — carry one perk into the next run.
- [ ] **Rivals** — generate AI careers; rank the player against them on retirement.

---

## Now / Next / Later (quick view)

- **Now:** Tune sim feel · Spin screen · Train screen.
- **Next:** Transfers/awards · perk picks · grow moment pool · retirement polish.
- **Later:** Other positions · PWA · stretch (daily seed, NG+, rivals).
