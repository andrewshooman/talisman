# TALISMAN — Build Brief & Handoff

> Hand this file to a fresh Claude (Claude Code / dispatch) to **start or continue** the build.
> It is self-contained: it captures the concept, the decisions already made, and the build order.

---

## 0. Status (as of this handoff)

- **No code written yet.** This document is the only artifact.
- **Decisions locked in:**
  - **Name:** **TALISMAN** (was originally pitched as "Career 38-0"). Rationale: a talisman is the star player the whole team leans on — fits an attacking-focused career RPG, one word, no real-world branding.
  - **Build location:** `C:\Users\sushi\OneDrive\Desktop\Soccer Game` (currently empty).
  - **First milestone:** Nail the **single-player career gameplay loop for an ATTACKING player (FWD)** before adding other positions or stretch features.
  - **Target:** GitHub repo under account `andrewshooman` (gh CLI is authenticated on this machine).
- **Tech:** Self-contained web app. Single `index.html` with vanilla JS + Canvas/CSS preferred (ports to iOS later via "Add to Home Screen"). No backend, no external APIs. `localStorage` for persistence (works in a real deploy).

---

## 1. Concept

Live one footballer's entire career as a **roguelike RPG**. Create a player, progress season by season, make choices in key match moments that roll against your stats, then retire with a weighted **Legacy Score** and ranking tier.

**Feel:** Dark sporty palette (near-black `#0a0a0f`), a gold/amber "legacy" accent for awards (NOT default green). Mobile-first, big tap targets, one-screen flows. Juicy feedback on key moments and trophy wins (animation, color pop). Legally clean — generic/fictional clubs and players, no real names, crests, or logos.

---

## 2. Scope for the FIRST build (do this first)

Focus on **FWD (attacking player)** only, end-to-end, so the core loop *feels good* before generalizing.

Deliver a playable loop:

1. **Player creation (FWD):** name, nation, starting club tier (1–5).
2. **Season loop:** Spin → Train → Season sim → Key moments → Feedback.
3. **Progression:** XP/training, age curve, injuries, transfers/offers.
4. **Endgame:** Legacy Score + ranking tier + career summary screen.
5. **Polish/juice** for FWD before adding GK/DEF/MID.

Other positions (GK/DEF/MID) and stretch features come AFTER the FWD loop feels right.

---

## 3. Data model

### Player
```
{
  name, nation,
  position: "FWD",          // only FWD for first build
  age,                      // start 17
  club, clubTier,           // 1..5
  stats: { finishing, pace, dribbling, positioning, physical }, // 1..99
  form,                     // volatile, per-season modifier
  morale,                   // 0..100
  fitness,                  // 0..100 (injury-proneness derived)
  xp, level,
  perks: [],
  history: [ /* per-season records */ ],
  careerTotals: { goals, assists, apps, trophies, awards, cleanSheets? }
}
```

### FWD stats (1–99)
`Finishing, Pace, Dribbling, Positioning, Physical`
Shared: `Form` (volatile per-season), `Morale`, `Fitness` (injury-proneness).

> Role-specific stat sets for later positions (reference, not for first build):
> - **GK:** Reflexes, Handling, Positioning, Distribution, Composure
> - **DEF:** Tackling, Marking, Heading, Positioning, Passing
> - **MID:** Passing, Vision, Stamina, Dribbling, Shooting

### Club tiers (1–5)
- **Tier 1 = hardest start** (small club, weakest squad) → **biggest legacy multiplier**.
- **Tier 5 = elite club** (strongest squad) → smallest multiplier.
- Tier sets the team's base quality, which drives league finish, trophy chances, and how many goals are realistically available.

### Perks (pick on level-up)
`Clutch, Engine (stamina), Glass Cannon, Leader, Loyal, Mercenary, Big-Game Player, Injury-Prone, Wonderkid, Iron Man`
Each perk should hook a real calculation (see §4–§6), e.g.:
- **Clutch / Big-Game Player:** bonus on key-moment rolls.
- **Engine / Iron Man:** slower fitness decay, lower injury chance.
- **Glass Cannon:** +output, +injury risk.
- **Leader:** +morale, +team finish.
- **Loyal:** legacy bonus for staying at one club; **Mercenary:** legacy bonus for variety + more/bigger transfer offers.
- **Wonderkid:** faster growth while young.
- **Injury-Prone:** (usually acquired via event) higher injury chance.

---

## 4. Season-sim engine (build & tune this FIRST — it's the heart)

Turn stats → believable results for a 38-game season.

- `overall` = mean (or weighted mean) of the 5 FWD stats.
- **Club base quality** from tier, e.g. tier1≈45, tier2≈55, tier3≈65, tier4≈75, tier5≈85.
- `teamQuality = clubBase*0.85 + overall*0.15 + randomness`, modified by Leader perk.
- **League finish (1–20):** map `teamQuality` to a position with randomness. Finish 1 → League Title; cups are random chances scaled by teamQuality.
- **Goals (FWD):** expected goals ≈ `(finishing*0.5 + positioning*0.3 + pace*0.2)/99 * MAX_GOALS` (try MAX_GOALS≈30) × form factor × club-attack factor × fitness factor, plus noise. Glass Cannon/Wonderkid/Clutch can nudge.
- **Assists (FWD):** driven by dribbling/positioning + team quality.
- **Avg rating:** derived from goals+assists vs apps, form, team result.
- **Apps:** reduced by injuries (see §6).
- Output **per-season record** appended to `history` and folded into `careerTotals`.

> Get this loop producing sane numbers (a tier-1 17-year-old shouldn't score 40; a prime tier-5 striker can flirt with 30) BEFORE wiring UI polish.

---

## 5. Key-moment choice system (3–5 per season)

Data-driven scenarios (big match, penalty, derby, final, last-minute chance). Each scenario:
```
{ prompt, choices: [ { label, stat, risk, reward, successText, failText, effects } ] }
```
Resolution: **dice roll vs (relevant stat + form [+ perk bonus])**. Outcome swings rating, morale, narrative, and can affect goals/trophies. Clutch / Big-Game Player add to the roll.

---

## 6. Progression / roguelike elements

- **XP & training:** spend points across the 5 stats; level-up grants a **perk pick**.
- **Age curve:** stats rise to a **prime (~27–30 for FWD)**, then decline. Wonderkid speeds early growth.
- **Injuries as status effects:** reduce apps/fitness; rare **catastrophic injury can end the career early** (the roguelike "death"). Iron Man/Engine reduce risk; Glass Cannon/Injury-Prone raise it.
- **Transfers/feedback:** strong seasons → bigger clubs court you, awards (Player of the Season, Ballon-style), national call-ups; poor seasons → decline, getting dropped, relegation.

---

## 7. Role-specific scoring (FWD for now)

Judge FWD on: **goals, assists, key passes**, plus shared: avg rating, trophies, individual awards, peak rating, longevity, **loyalty (one-club bonus) vs journeyman variety bonus**.

(Later: DEF on clean sheets/tackles/def rating; GK on clean sheets/saves/save%.)

---

## 8. Endgame

- Retirement at decline or by choice.
- **Legacy Score** = weighted sum of trophies, awards, role-adjusted output, peak rating, longevity, **difficulty multiplier (lower starting tier = higher)**.
- **Ranking tiers:** Squad Player → Cult Hero → Star → Legend → Immortal → GOAT.
- **Career summary screen:** timeline of clubs, trophy cabinet, stat totals, defining moments, final tier + shareable score.

---

## 9. Design / feel checklist

- Background near-black `#0a0a0f`; **gold/amber accent** for legacy/awards; avoid default green.
- Mobile-first, big tap targets, one-screen flows.
- Juicy: animation + color pop on key moments and trophy wins (a small confetti canvas overlay is a good touch).
- All clubs/players/nations fictional or generic. No real crests/logos/names.

---

## 10. Recommended build order

1. **Data model** (player, FWD stats, club tiers, perks, events).
2. **Season-sim engine** (stats → results) — get the numbers feeling right first.
3. **Key-moment choice system** (action → stat roll → outcome).
4. **Progression** (XP, age curve, injuries, transfers).
5. **Legacy scoring + retirement summary.**
6. **UI polish, mobile, juice.**
7. THEN generalize to GK/DEF/MID.

## 11. Stretch (after the FWD loop is solid)

- **Daily seed** — same career start for everyone that day.
- **New Game+** — carry one perk into the next run.
- **Rivals** — other AI careers you're ranked against on retirement.

---

## 12. Shipping / repo

- Build into `C:\Users\sushi\OneDrive\Desktop\Soccer Game`.
- Single `index.html` (open directly in a browser to test; no build step needed if vanilla).
- Add `README.md` (how to play, how to run, "Add to Home Screen" note) and an MIT `LICENSE`.
- `git init` → commit → create GitHub repo under `andrewshooman` (gh CLI is authenticated) → push.
- Suggested repo name: `talisman` (description: "TALISMAN — a single-player football career RPG. Live an attacking player's whole career, season by season.").

---

## 13. First message a fresh Claude should act on

> "Read TALISMAN_BRIEF.md in this folder. Build the FWD (attacking player) career loop end-to-end as a single self-contained `index.html` (vanilla JS + Canvas/CSS), dark `#0a0a0f` theme with a gold/amber legacy accent, mobile-first. Start with the season-sim engine and get the numbers feeling right, then key moments, progression, and the retirement/legacy summary. Then init a git repo and push to GitHub under `andrewshooman`."
