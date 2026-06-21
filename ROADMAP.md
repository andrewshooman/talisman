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
- [x] **Live game-by-game season playback**: watch a scrolling match feed with live
      league position & points, Pause / Fast / Skip controls, and the broadcast
      INTERRUPTS for each key moment (tied to its real fixture & scoreline), then
      resumes. See UI.playSeason / seasonTick / revealRound.
- [x] **8 mini-games** with attribute-scaled difficulty + on-screen impact readout:
      added Sprint Duel (mash), Free Kick (bend over the wall), Power Header (apex
      timing) on top of timing/aim/reaction/dribble/1-on-1.
- [x] **Transfers between clubs**: post-season offers from bigger clubs (transfer
      screen) + promotion/relegation by finish. `Prog.generateOffers/applyClubMovement`.
- [x] **Awards & national call-ups**: Golden Boot, Player/Team of the Season, Young
      Player, one-time National Call-Up — shown on results, fed into legacy.
- [x] **Context-aware moments**: cup-final/penalty scenarios only appear on a cup-run
      season; the final lands last.

---

## Phase 1 — Make the FWD loop *feel right* (NOW)

The skeleton plays end-to-end but numbers are first-pass. This phase is about feel.

- [ ] **Tune the sim** (`engine.js`): sanity-check that a tier-1 17-yo doesn't score 40,
      a prime tier-5 striker flirts with ~30. Log tuning passes in PROJECT_NOTES.
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
- [x] **Transfers/feedback** (`progression.generateOffers`): strong seasons attract
      bigger clubs (transfer screen); finish drives promotion/relegation.
- [x] **Awards & call-ups**: Golden Boot, Player/Team of the Season, Young Player,
      one-time National Call-Up. `totals.awards`; shown in results + fed to legacy.
- [x] Grow the **key-moment pool** to 10 football-true FWD scenarios; all tied to a
      match with goal/assist effects. Fixed the `composure`-stat bug (FWDs lack it).
- [x] More **mini-game types**: 8 total (timing/aim/reaction/dribble/1-on-1 + sprint
      duel / free kick / power header), each attribute-scaled. See `minigames.js`.
- [x] Wire **perks into math** (clutch / bigGame / leader / glassCannon / engine /
      ironMan / wonderkid all hooked).
- [x] Context-aware moment selection (cup final/penalty only during a cup run).
- [ ] **Awards & call-ups**: Player of the Season, Ballon-style, national team.

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

- **Now:** Tune sim feel · Spin/event screen · transfers between clubs.
- **Next:** Awards/call-ups · grow moment pool · more mini-game types.
- **Later:** Other positions · PWA · stretch (daily seed, NG+, rivals).
