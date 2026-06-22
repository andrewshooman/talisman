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

## Phase 1.5 — League world & player agency (NOW — requested 2026-06-22)

A focused build to make the world feel like real English football and give the
player more control. See PROJECT_NOTES "League world (planned)" for data shapes.

- [ ] **Named league pyramid** (`data.js` + `league.js`): a four-division English-style
      pyramid (Premier-style top flight → Championship → League One → League Two feel),
      using **legally-distinct but recognisable** club identities — real-ish city names
      with altered club names and *stable* kit colours (a red Manchester side stays red).
      Map `CLUB_TIERS` (1–5) onto the pyramid. No real names, crests, or badges.
- [ ] **Consistent club identities** (`data.js` `T.CLUBS` table + `visuals.js`): each club
      has a fixed seed → same crest/kit/colours every season and across careers, so fans
      recognise the analogues. Player's club is drawn from the chosen division.
- [ ] **Promotion & relegation** (`league.js` + `progression.js`): top N go up, bottom N
      go down each season; the player's club moves divisions accordingly (tier shifts),
      and a fresh fixture list is built for the new division next season. Persist league
      membership across seasons on `game` (currently the league is rebuilt fresh).
- [ ] **More player control & match impact**: expand beyond ~4 key moments so the player
      has more input on matches, and make mini-game/user performance visibly drive the
      club's results & league position (and rival results) across the season.
      _Mechanic to confirm with the user before building — see open question._

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

- **Now:** Named English-style league pyramid + recognisable club identities ·
  promotion/relegation · more player control & match impact (Phase 1.5).
- **Next:** Transfers between clubs · spin/event screen · context-aware moments ·
  retirement polish (defining moments from `momentsLog`).
- **Later:** Other positions (MID/DEF/GK) · PWA · cups · contracts · NG+ · rivals.
