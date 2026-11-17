# TALISMAN launch prompts

Copy-paste prompts for an AI coding chat (Opus) working in this repo. They follow the
plan in `reports/AI buildable revenue project options.md`: launch what exists, measure,
then decide what to build or sell.

**How to use them**

- Run them in order, **one prompt per fresh chat**. A fresh chat with a narrow task uses
  far fewer credits than one long chat.
- Prompts 1 and 2 are the only ones to run now. Prompt 3 waits for two weeks of real
  numbers. Run 4A, 4B or neither depending on what Prompt 3 says. Prompt 5 only makes
  sense once people are playing.
- Each prompt ends with a list of things only you can do (create accounts, post, click
  settings). The AI cannot do those for you.

---

## Prompt 1: Make it launchable (run now)

```
You are working in the TALISMAN repo, a vanilla-JS football career game with no build
step and no backend. Read PROJECT_NOTES.md first, then ROADMAP.md.

Goal: get the existing game in front of real players and able to tell me whether they
enjoy it. Do not add or rebalance any gameplay in this session.

Do these four things:

1. Public URL. Check whether the game is already served by GitHub Pages. If not, add
   whatever the repo needs (it is a static site served from the root) and tell me the
   exact clicks to turn Pages on in the repo settings.

2. Play counters. Add a small analytics module (one new file, loaded from index.html)
   that records these events and nothing personal: career_started, season_completed
   (with the season number), career_finished (with the legacy tier), daily_started,
   share_tapped, and returned_next_day (set from a first-visit date in localStorage).
   Use a free, cookie-less analytics service that supports custom events on a static
   site. Check its current free-tier limits before choosing, tell me which one you
   picked and why, and leave a single clearly marked place for me to paste the site
   ID. The game must work unchanged if the service is blocked or the ID is empty.

3. Share card. On the retirement screen add one "Share" button. It should use the
   phone's share sheet where available and fall back to copy-to-clipboard. The text is
   short and spoiler-free in the style of daily puzzle games: the tier reached, legacy
   score, seasons played, goals, trophies as a row of emoji, and the game's URL. On the
   Daily Challenge include the date so friends can compare the same start.

4. Division names. "The Championship", "League One" and "League Two" are the real names
   of English Football League divisions. Rename the bottom three to generic names
   (default: Division One, Division Two, Division Three; keep "Prime League") everywhere
   they appear, including tests and docs. Old saves must still load.

Constraints: keep the existing conventions (only ui.js touches the DOM, use the RNG
helpers, theme through CSS variables). Add tests for the share text and for loading an
old save. Run `npm test` and show me the result. Do not use subagents. Update ROADMAP.md
and PROJECT_NOTES.md, then commit, push and open a pull request.

Finish with a short list of what I must do by hand, in order.
```

**You do by hand:** turn on GitHub Pages, create the analytics account, paste the site ID, merge the pull request, open the URL on your phone and play one full career.

---

## Prompt 2: Launch kit (run after Prompt 1 is live)

```
You are working in the TALISMAN repo. The game is live at: [PASTE URL].
Read README.md and reports/AI buildable revenue project options.md first.

Goal: give me everything I need to post the game myself in several places this week.
I have no audience and no budget. Do not change gameplay.

Produce a folder called launch/ containing:

1. Screenshots and one short looping clip. Run the game in the pre-installed headless
   browser at phone size and capture: the title screen, a key-moment mini-game, an
   outcome animation, the league table, and a retirement screen with a high tier.
   Save PNGs, plus a GIF or MP4 under 10 seconds of one mini-game being played.

2. A one-line pitch (under 100 characters), a short description (under 300), and a
   long description (about 150 words). Plain and specific. No hype words, and do not
   call it "AI-built" in the copy.

3. Ready-to-post drafts, each written for that community's tone and rules:
   - r/WebGames
   - an itch.io game page (title, tagline, description, tags, genre)
   - a CrazyGames submission (title, description, controls, category)
   - one more football or sim community you judge to be a good fit
   For each, look up the current self-promotion rules and put a two-line summary of
   them at the top of the draft. If a community bans self-promotion, say so and leave
   it out rather than writing a post that will be removed.

4. Three short captions for a 10-second vertical video, for TikTok, Shorts or Reels.

5. A file launch/CHECKLIST.md listing what to post where and in what order over five
   days, and which of the play counters to look at each morning.

Be honest in every draft: single developer, free, no sign-up, saves on your device.
Do not invent player counts, reviews or awards. Do not use subagents. Commit and push
the launch/ folder.

Finish by telling me which single place you would post first, and why.
```

**You do by hand:** create the accounts, post each draft yourself, reply to comments, and write down the daily numbers for two weeks.

---

## Prompt 3: Read the numbers and decide (run after about two weeks)

```
You are working in the TALISMAN repo. Read reports/AI buildable revenue project
options.md, especially "What to spend credits on".

The game has been public for [N] days. Here are the numbers from the analytics
dashboard and from the places I posted:

[PASTE: visitors, career_started, season_completed by season number, career_finished,
daily_started, returned_next_day, share_tapped, and any comments or feedback worth
reading, good and bad.]

Tell me plainly which of these three situations I am in, and show the arithmetic:

A. People drop out partway through a career. (Rule of thumb: fewer than about 4 in 10
   started careers reach retirement, with a clear season where most leave.)
B. People finish and come back. (Rule of thumb: about 4 in 10 or more finish, about
   15% or more return the next day, and at least some share taps or posts.)
C. Almost nobody plays twice or shares, whatever the format.

These thresholds are rough guides, not benchmarks. If the sample is too small to say
(under about 200 visitors), say that instead of guessing, and tell me the cheapest way
to get more visitors.

Then give one recommendation: build the short daily mode (A), move on to portals and
monetization (B), or stop spending (C). List the three most common complaints or
confusions in the feedback. Do not write any code in this session.
```

---

## Prompt 4A: Two-minute daily mode (only if Prompt 3 says A)

```
You are working in the TALISMAN repo. Read PROJECT_NOTES.md and ROADMAP.md first.

Players like the moments but do not finish a full career. Build a short mode that can
be finished in about two minutes and shared, reusing the existing engine, mini-games
and seeded RNG. Do not rewrite or rebalance the full career.

Design:
- "Daily Run": everyone gets the same seeded player and the same five key moments on a
  given date. One attempt per day, stored in localStorage.
- Each moment is one mini-game. No training, transfers or perk screens in between.
- The end screen shows a score out of five as a row of emoji, a one-line verdict, a
  streak counter, and the Share button. The share text has the date, the emoji row,
  the streak and the URL, and does not spoil the moments.
- Make Daily Run the main button on the title screen, with the full career as the
  second button.

Add the events daily_run_started and daily_run_finished to the existing analytics
module. Add tests for: the same date giving the same run, one attempt per day, streak
counting across midnight, and the share text. Run `npm test`. Keep ui.js as the only
file that touches the DOM. Do not use subagents. Update the docs, commit, push and open
a pull request.

Finish by telling me how long a run actually takes when you play it in the headless
browser, and what you would cut if it is over two minutes.
```

**You do by hand:** play it for three days running to check the streak, then repost with the new mode and watch the same numbers for two more weeks.

---

## Prompt 4B: Portals (only if Prompt 3 says B)

```
You are working in the TALISMAN repo. Read PROJECT_NOTES.md first.

Players finish careers and come back. Prepare the game for web game portals, which
bring players and pay a share of ad revenue.

1. Read the current developer requirements for CrazyGames and for Poki from their own
   developer sites, and list every requirement the game does not yet meet (file size,
   aspect ratios, loading screen, SDK calls, branding rules, save handling, their
   policy on AI-assisted games). Tell me which portal to submit to first and whether
   either demands web exclusivity, before changing any code.

2. For the portal you recommend, add its SDK behind a small wrapper so the normal web
   version keeps working with no SDK present. Wire up: loading and gameplay start/stop
   signals, an optional rewarded ad with a fair in-game reward (for example one retry
   of a failed key moment per season), and a break between seasons where the portal
   allows an ad. No ad may interrupt a mini-game.

3. Produce the portal build as a folder or zip, and the submission text and images it
   asks for.

Run `npm test`, and test the portal build in the headless browser at phone and desktop
sizes. Do not use subagents. Commit, push and open a pull request.

Finish with what I must do by hand to submit, and what the portal says about review
times and payment thresholds.
```

**You do by hand:** create the portal developer account, give tax and payment details, upload the build, and answer the reviewer.

---

## Prompt 5: Start earning (only once people are playing every day)

```
You are working in the TALISMAN repo. The game has about [N] daily players, mostly
from [SOURCE]. Read reports/AI buildable revenue project options.md first.

I want the simplest ways to earn from the players I already have, without a backend
and without annoying them. Before writing code, compare these for my numbers and tell
me roughly what each could earn per month, with your reasoning and how sure you are:

- a tip link (Ko-fi or similar) on the retirement screen and title screen
- pay-what-you-want on itch.io
- portal ad revenue, if the game is on a portal
- a one-time "supporter" purchase that unlocks cosmetic extras (kit colours, card
  frames, a gold crest) through a hosted checkout that needs no server of mine
- wrapping the game for Google Play and the App Store, with the real costs and the
  Google 12-tester rule for new accounts

Recommend one or two to do now and say why the others can wait. Then build only those.
Cosmetic extras must never affect the legacy score or the Daily leaderboard. Anything
that takes money must have a clear price, no dark patterns, and a link to a short
privacy note and contact address. Check each service's current fees and terms before
relying on them.

Run `npm test`. Do not use subagents. Commit, push and open a pull request.

Finish with what I must do by hand, and whether I need to think about tax or business
registration where I live. Flag that as something to confirm with a professional, not
as advice.
```

**You do by hand:** create the payment or tip account, complete identity and tax forms, and test one real purchase yourself.
