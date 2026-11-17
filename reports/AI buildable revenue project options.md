# AI buildable revenue project options

*17 November 2026. Research for deciding whether to keep spending AI credits on TALISMAN.*

## Bottom line

> **Update, same day:** the owner had played TALISMAN and found it not fun, with no real
> football on screen. That outweighs the "keep TALISMAN" recommendation below, which rested on
> it being already built, not on evidence it was enjoyable. The project moved to option 2 in
> this report: a short, shareable daily football game (SET PIECE, in `setpiece/`).

**Keep TALISMAN, but stop paying for new features until real players have tried it.** No category I looked at gives a solo builder with no audience good odds of revenue. What the AI can build is not the limit; getting people to show up is. TALISMAN is already built, costs nothing to host, and sits in the one niche where small sports games have twice broken out this decade without a marketing budget. The cheapest useful next step is a two-week demand test (about two short AI sessions), not more content.

If the test fails, the best pivot is a **two-minute, shareable daily football game** built from TALISMAN's existing engine, not a switch to apps or SaaS.

## The base rates

Every channel has the same shape: a few winners, and a median near zero.

| Channel | What typical looks like | Source |
|---|---|---|
| Steam (premium) | Median 2025 release earned about $249; about 66% earned under $1,000 | Gamalytic estimate, via press |
| Subscription mobile apps | 17% of new apps reach $1,000/month within two years; average about $72/month after a year | RevenueCat 2026 |
| Shopify apps | Median listed app estimated under $1,000/month | Third-party model, not Shopify |
| Chrome extensions | One developer's corrected figure: $31/month across 38 extensions | Single anecdote |
| Content and tool sites | Top result loses about 58% of clicks when an AI Overview shows; small publishers' search traffic down about 60% | Ahrefs, Chartbeat, via secondary reports |
| Web game portals | A game that performs well: roughly $200 to $2,000/month | Unsourced guide figure |

AI has made this worse, not better, for new entrants. About half of Steam games launched in October 2026 disclosed AI use (1.7% in January 2024). Itch.io's daily new pages doubled in two months with no rise in downloads, and it deleted "a couple of terabytes of AI slop" this month. Reddit's game hackathon rules say it does not want "obvious AI slop".

The famous AI-built game success, Pieter Levels' flight sim, reportedly passed $87,000/month within 17 days. He already had a very large following and sold ad space inside the game to sponsors. I found no documented case of an AI-built game earning sustained revenue for someone who started with no audience. One analyst who tracks this said the same.

## How TALISMAN stacks up

**For it**

- **The loop is proven.** New Star Soccer was the same idea (one player's career, mini-game moments, stats) and was a bedroom-coder hit. Score! Hero, a level-based take on a player's career, shows about 101 million installs and an estimated $100,000+/month, two-thirds from ads.
- **Licences are not required.** Retro Bowl uses generic teams and reached number one free app on US iOS in 2021 with 7 million downloads and no ad spend, driven by TikTok and an App Store feature.
- **Football web games are having a moment.** A browser draft game called 82-0 went viral in June 2026 (ESPN coverage, NBA players posting results). Its football spin-off is called 38-0, the name TALISMAN was originally pitched under, and it already has several clones.
- **Small sports web games do get bought.** Immaculate Grid was built by one developer in about two days, reached about 200,000 users on weekdays, and was acquired by Sports Reference three months later.
- **It is cheap to run.** A static site with no backend has no hosting bill and none of the security problems found in AI-built apps (one scan of 5,600 such apps found 2,000+ serious vulnerabilities and 400 exposed secrets).

**Against it**

- **Nobody has played it.** Fourteen rounds of features and balance tuning were validated by simulation, not by players. There is no analytics, so no evidence either way.
- **The format fights virality.** The breakout games above finish in about two minutes and end in a screenshot. A TALISMAN career is eight mini-games a season across a whole career. The Daily Challenge inherits that length, so it is unlikely to become a daily habit. This is my inference from the design docs, not a tested fact.
- **The World Cup bump has passed.** Football downloads surged in June and July 2026, but the winners were large studios (Soccer Superstar, Football League 2026, eFootball, FC Mobile).
- **Naming needs a check before any money is involved.** "The Championship", "League One" and "League Two" are the real names of English Football League divisions. I am not a lawyer, but renaming them is cheap insurance.

## Options, ranked for someone with no audience and a small budget

1. **Test TALISMAN as it is (recommended first).** Lowest cost; answers the only question that matters.
2. **Short shareable daily football game.** Best odds of wide use. It is hit-driven and gets cloned within days, and versions that use real player names carry legal exposure. TALISMAN's fictional world avoids that but loses the "real names" hook.
3. **Reddit games.** Built-in audience, and Reddit pays on engagement: the 2025 programme paid $500 at 500 daily engaged users, rising in tiers. I could not open the official page to confirm the 2026 terms. Needs a port to Reddit's platform.
4. **Web portals.** Poki reports 100 million monthly players and CrazyGames claims 60 million. Poki is hand-curated and wants web exclusivity; CrazyGames accepts open submissions. TALISMAN's size suits them technically, but their audience leans toward quick action games.
5. **App stores.** Google charges $25 once but requires 12 testers for 14 days on new personal accounts; Apple charges $99 a year. Worth doing only after the web version shows people come back.
6. **A non-game product.** Higher revenue per customer, but it needs knowledge of a specific niche, ongoing support, and a backend that handles payments and data safely. Only worth considering if you have insider knowledge of a problem from your own job or hobby.
7. **Premium Steam game, or a content/tool site.** Worst fit: lowest medians, and both are being hit hardest by AI.

## What to spend credits on

**Step 1 (about two short sessions):**
- Deploy to a public URL (GitHub Pages is free).
- Add a simple counter for: careers started, careers finished, next-day returns, share taps.
- Make the retirement result a one-tap share card with a link (already on the roadmap).
- Rename the three real division names.

**Step 2 (no credits):** post it yourself in a few places such as r/WebGames, itch.io and CrazyGames, and to football-playing friends. Check each community's self-promotion rules first.

**Step 3: decide on numbers.** After about two weeks and a few hundred visitors:
- If most people who start a career finish it, some return the next day, and a visible share post links back: invest in a portal submission and a Reddit port.
- If people drop out mid-career: build the two-minute daily mode rather than more positions or cups.
- If almost nobody returns or shares in either format: stop spending.

These thresholds are my rule of thumb, not a published benchmark.

**Hold off on:** other positions (midfielder, defender, goalkeeper), contracts, New Game+ and further balance passes. None of them changes whether a stranger plays a second time.

## Limits of this research

- I ran this as a single pass rather than the multi-agent deep dive first planned, to stay within Pro usage. Around 25 searches; most pages were not opened in full.
- Many revenue figures are third-party estimates or come from guide and blog sites. Treat them as rough.
- Two pages could not be opened: Reddit's official developer funds page and one article on the 38-0 game.
- I found no traffic or revenue numbers for 82-0 or 38-0, and no published acceptance rate for Poki.

## Sources

- [Retro Bowl tops US iOS chart, 7M downloads, zero UA spend (PocketGamer.biz)](https://www.pocketgamer.biz/uk-based-new-star-games-takes-us-by-storm-with-retro-bowl)
- [Retro Bowl and Retro Goal analysis (AppMagic)](https://appmagic.rocks/blog/retro-bowl-retro-goal)
- [Making an indie hit: New Star Soccer (MCV)](https://www.mcvuk.com/business-news/mobile/making-an-indie-hit-new-star-soccer-uncovered/)
- [Score! Hero install and revenue estimates (AppGoblin)](https://appgoblin.info/apps/847492141)
- [Top mobile games July 2026 (Sensor Tower)](https://sensortower.com/blog/top-10-worldwide-mobile-games-by-revenue-and-downloads-in-july-2026)
- [June 2026 rankings: World Cup demand lifted downloads (SocialPeta)](https://socialpeta.com/en/blog/top-mobile-games-by-revenue-and-downloads-june-2026)
- [82-0 viral game coverage (ABC7 / ESPN)](https://abc7chicago.com/post/82-0-pacers-haliburton-bucks-more-get-viral-game/19241341/)
- [38-0 Game](https://www.38-0-game.com/)
- [Sports Reference acquires Immaculate Grid](https://www.sports-reference.com/blog/2023/07/sports-reference-acquires-immaculate-grid)
- [The story behind Immaculate Grid (Action Network)](https://www.actionnetwork.com/mlb/the-story-behind-immaculate-grid-the-game-thats-captivated-baseball-fans)
- [40% of 2025 Steam games earned under $100 (MP1st, Gamalytic data)](https://mp1st.com/news/40-of-steam-games-in-2025-earned-less-than-100)
- [State of Subscription Apps 2026 (RevenueCat)](https://www.revenuecat.com/sosa-26-insights)
- [The average Shopify app is doing worse than you think (Barn2)](https://barn2.com/blog/shopify-app-store-saturation/)
- [Freemium Chrome extension numbers after six months (DEV)](https://dev.to/_350df62777eb55e1/real-numbers-freemium-chrome-extension-monetization-after-6-months-5hga)
- [AI Overviews and publisher traffic (Search Engine Journal)](https://www.searchenginejournal.com/google-ai-overviews-impact-on-publishers-how-to-adapt-into-2026/556843/)
- [State of Web Gaming 2026 (Poki)](https://poki.com/blog/state-of-web-gaming-report-2026)
- [Poki deals and exclusivity terms](https://sdk.poki.com/deals)
- [CrazyGames developer guide 2026 (Cinevva)](https://app.cinevva.com/guides/publish-game-crazygames)
- [Reddit and Phaser $40,000 hackathon](https://phaser.io/news/2026/06/reddit-and-phaser-launch-a-40-000-game-dev-hackathon)
- [Google Play 12-tester policy (Testers Community)](https://www.testerscommunity.com/guides/how-many-testers-do-you-need-google-play)
- [One year of vibe coding: Levels' flight sim (VibeCodeHQ)](https://vibecodehq.pages.dev/blog/levelsio-flight-simulator-one-year-vibe-coding)
- [Solo developers are shipping real games (Cinevva)](https://app.cinevva.com/signals/2026-03-23-solo-devs-shipping-not-vibing.html)
- [Itch.io deletes "a couple terabytes of AI slop" (PC Gamer)](https://pcgamer.com/software/ai/just-deleted-a-couple-terabytes-of-ai-slop-itch-io-pushes-back-against-the-flood-of-ai-on-its-storefront)
- [Steam AI disclosure study (Cinevva)](https://app.cinevva.com/news/2026-07-20-steam-ai-disclosure-study)
- [Vibe-coded app vulnerability research (Cloud Security Alliance)](https://labs.cloudsecurityalliance.org/research/csa-research-note-ai-codegen-vulnerability-debt-2026)
