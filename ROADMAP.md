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
- [x] **Real simulated league** (`league.js`): 20 named clubs, double round-robin
      (38 matchdays), game-by-game match sim, full standings table. Key moments
      are tied to a real fixture & live scoreline and can change that result.
- [x] **Glossary / How to Play** screen explaining every mechanic (`T.GLOSSARY`).
- [x] **Career-score competition**: local Hall of Fame leaderboard, shareable
      career codes (import a friend's to rank against them), and a Daily Challenge
      (deterministic shared start). See state.js + UI halloffame/glossary/startDaily.

---

## Phase 1 — Make the FWD loop *feel right* (NOW)

The skeleton plays end-to-end but numbers are first-pass. This phase is about feel.

- [x] **Tune the sim** — balance audit via a headless harness (~1500 simulated
      careers through the real logic modules). Findings & fixes (2026-06-22, logged in
      PROJECT_NOTES): goal output is sound (prime tier-5 peaks ~30–38, tier-1 stays
      lower — matches the target); **legacy tiers were badly mis-calibrated** (≈85% of
      careers ranked GOAT) and **awards fired ~1.5×/season**. Tightened award
      benchmarks, recalibrated `LEGACY_TIERS`, and folded national caps into the score.
      A well-played career now lands ~Legend median, Immortal ~top 20–30%, GOAT ~2–5%.
      _Open follow-up:_ per-stat goal/assist curve tuning and an age-curve playtest.
- [ ] **Spin / event screen** (new `UI.screens.spin`): season-opening situation —
      transfer offer, manager change, rivalry, captaincy, loan, injury scare.
- [x] **Train screen** (`UI.screens.train`): spend `trainingPoints` across the 5 stats
      with a live radar + a **projected season** preview (Engine.projectSeason) so stat
      gains visibly move OVR/goals/assists/rating. Confirm persists.
- [x] **Perk pick on level-up** (`Prog.offerPerks` + `UI.showPerkPick`): level-ups from
      a season offer 3 perks; chosen perks hook the math (clutch/bigGame/leader/etc.).
- [x] **Scenario context & consequences**: key moments show a competition badge, your
      club vs a generated opponent, the stakes, per-choice career impact, and an effect-
      chip breakdown of the outcome. Outcomes scale by stakes (final swings > league).
- [ ] **Transfers/feedback** (`progression.generateOffers`): strong seasons attract
      bigger clubs; poor seasons -> drop/loan/relegation. Wire into post-results.
- [x] **Awards & call-ups**: Golden Boot, Playmaker, Player & Young Player of the
      Season, first national call-up + growing caps (`Prog.rollAwards`). Increments
      `totals.awards`, grants bonus XP, and surfaces on the results & retirement
      screens; Legacy already weights `awards * 80`.
- [x] Grow the **key-moment pool** to 8 football-true FWD scenarios; all tied to a
      match with goal/assist effects. Fixed the `composure`-stat bug (FWDs lack it).
- [x] More **mini-game types**: added Dribble Dodge (lane weaving) and One-on-One
      (beat the onrushing keeper) — now 5 total. See `minigames.js`.
- [x] Wire **perks into math** (clutch / bigGame / leader / glassCannon / engine /
      ironMan / wonderkid all hooked).
- [ ] Context-aware moment selection (finals only during a cup run / late season).

---

## Phase 1.5 — League world & player agency (DONE — requested 2026-06-22)

Made the world feel like English football and gave the player more control. See
PROJECT_NOTES "League world" for the data shapes & ladder model.

- [x] **Named league pyramid** (`data.js` `T.DIVISIONS` + `T.CLUB_DB`): four divisions
      (Prime League → The Championship → League One → League Two), 20 clubs each = 80
      **legally-distinct but recognisable** clubs (city + colour + nickname; no real
      names/crests/logos). `league.js` `buildDivision` builds the player's division.
- [x] **Consistent club identities** (`data.js` `T.CLUB_COLORS` + `visuals.js`): each club
      has a fixed colour identity keyed by name; `V.palette` returns it so crest/kit
      colours are stable every season and across careers (a red Mersey side stays red).
- [x] **Promotion & relegation** (`progression.js` `runPromRel`): top/bottom 3 swap across
      each boundary every season; the player rises/falls with their finish, their club
      tier shifts, and the ladder persists on `game.league`. Results screen shows a
      PROMOTED/RELEGATED banner. Validated headlessly (ladder stays 20/division).
- [x] **More player control & match impact**: key moments per season 4 → **8** (chosen:
      "more key moments + bigger ripple"); each successful scoring moment still adds a
      goal to its real fixture, so with more moments the user's mini-game performance
      moves more matches → shifts the table, the title race, and who gets promoted.

### Phase 1.5 follow-ups

- [x] **New mini-game types** (`minigames.js`): added **Free Kick** (set power, then curl
      it over a defensive wall) and **Give & Go** (a three-tap one-two rhythm) — now 7
      total. Two new scenarios (`free_kick_edge`, `give_and_go`) use them, so the moment
      pool is 10 (8 picked/season). All wired to the `onDone({skill,text})` contract.
- [x] **Improved mini-game visuals** (`minigames.js` scenes + CSS): `MG.scene(kind)` now
      varies by kind (`goal` / `wall` / `pitch`) with floodlight beams & pylons, a denser
      crowd, mown-stripe pitch depth, a keeper, and a free-kick wall; marker/zone glow,
      track inset shadow, and a scene vignette. Scenes read like a moment, not a bar.
- [x] **Menu / screen visual polish** (`styles.css`): button depth + hover lift, card top
      sheen, a living title-brand glow, taller scenes. _Further screen-level polish
      (division crest banner, transitions, count-ups) remains open under Phase 2._
- [ ] **More new games (ideas):** headed power+placement (jump-timing then aim), a keeper
      reaction-save (for when GK lands in Phase 3), a long-shot swerve meter. Context-map
      games to scenarios (free kick only on set-pieces, one-two in open play).

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

- [x] **Daily seed** — same career start for everyone that day. Shipped as the
      **Daily Challenge** (title screen → `UI.startDaily`, `T.dailySeed`).
- [ ] **New Game+** — carry one perk into the next run.
- [ ] **Rivals** — generate AI careers; rank the player against them on retirement.
- [ ] **Cup competitions** — a real knockout bracket (currently the Domestic Cup is a
      coin-flip in `finalizeSeason`); tie cup-final key moments to actual rounds.
- [ ] **Contracts & wages** — multi-year contracts, renewal decisions, a wage/budget
      number that feeds transfer realism and a "mercenary vs loyal" legacy fork.
- [ ] **Loyalty / journeyman legacy** — wire the dangling `loyal` & `mercenary` perks
      into `legacy.compute` once transfers exist (one-club bonus vs variety bonus).

---

## Now / Next / Later (quick view)

- **Now:** Transfers between clubs · spin/event screen · context-aware moment selection
  (free kick only on set-pieces, one-two in open play).
- **Next:** Retirement polish (defining moments from `momentsLog`) · awards in Hall of
  Fame/share · more mini-games (headed power, long-shot swerve) · screen count-ups.
- **Later:** Other positions (MID/DEF/GK) · PWA · cups · contracts · NG+ · rivals.
