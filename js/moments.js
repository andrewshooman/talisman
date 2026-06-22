/* ============================================================
   TALISMAN — moments.js
   Key-moment choice system: a handful of interactive scenes per season,
   each tied to a SPECIFIC league match (see engine.runSeason / ui.js).
   Player picks an action -> plays a SKILL-GAME (minigames.js) -> the
   skill result (0..1) blends with (stat + form [+ perk]) -> resolves.
   A successful scoring/assisting choice adds a goal to THAT match,
   which can change the result and the league table.

   choice = { label, stat, difficulty, game, effect, impact, success, fail }
     stat   : one of the FWD stats only (finishing/pace/dribbling/
              positioning/physical). NB: earlier versions referenced
              `composure`, which a forward doesn't have, so those rolls
              silently defaulted to 50 — that bug is fixed here.
     effect : "goal" | "assist" | "none" — what a SUCCESS does to the match.
     game   : { type, action? } — which mini-game to play.

   Each scenario also carries match context: comp, minute, stakes, stakesMult.
   ============================================================ */
(function () {
  const T = window.TALISMAN;
  const Moments = (T.Moments = {});

  Moments.POOL_FWD = [
    {
      id: "edge_box_loose", scene: "goal", comp: "LEAGUE", minute: 78, stakesMult: 1.15,
      stakes: "A goal here swings a tight league game your way.",
      prompt: "A loose ball spills to you at the edge of the box, a defender closing fast.",
      choices: [
        { label: "First-time volley", stat: "finishing", difficulty: 66, effect: "goal",
          game: { type: "timingBar", action: "VOLLEY" },
          impact: "High risk, high reward — a clean strike finds the net.",
          success: "Caught it sweetly — top corner!", fail: "Leaned back and ballooned it over." },
        { label: "Take a touch, drive past him", stat: "dribbling", difficulty: 62, effect: "goal",
          game: { type: "dribbleDodge" },
          impact: "Beat your man and the angle opens up for a finish.",
          success: "Knocked it by him and slotted home.", fail: "Defender nicked it off your toe." },
        { label: "Lay it off to the overlap", stat: "positioning", difficulty: 46, effect: "assist",
          game: { type: "aimTarget" },
          impact: "Safe, smart — a weighted pass sets up a teammate.",
          success: "Perfect lay-off — tap-in for the winger. Assist!", fail: "Overhit it out of play." },
      ],
    },
    {
      id: "through_ball_1v1", scene: "goal", comp: "LEAGUE", minute: 72, stakesMult: 1.2,
      stakes: "Through on goal — the kind of chance strikers are judged on.",
      prompt: "A defence-splitting pass puts you one-on-one with the keeper.",
      choices: [
        { label: "Round the keeper", stat: "dribbling", difficulty: 64, effect: "goal",
          game: { type: "oneOnOne" },
          impact: "Dance round the keeper and roll it in.",
          success: "Dummied the keeper and walked it in.", fail: "He read it and smothered the ball." },
        { label: "Shoot early, low and hard", stat: "finishing", difficulty: 60, effect: "goal",
          game: { type: "timingBar", action: "SHOOT" },
          impact: "Catch the keeper before he sets — clinical.",
          success: "Drilled it under the diving keeper.", fail: "Straight at him — saved." },
      ],
    },
    {
      id: "corner_back_post", scene: "goal", comp: "LEAGUE", minute: 84, stakesMult: 1.25,
      stakes: "Late corner — a chance to steal three points.",
      prompt: "A corner curls toward the back post and you've lost your marker.",
      choices: [
        { label: "Attack it — power header", stat: "physical", difficulty: 64, effect: "goal",
          game: { type: "timingBar", action: "HEAD" },
          impact: "Rise highest and bury the header.",
          success: "Thumped it down and in!", fail: "Got under it — over the bar." },
        { label: "Glance it across goal", stat: "positioning", difficulty: 56, effect: "goal",
          game: { type: "aimTarget" },
          impact: "Subtle redirection wrong-foots the keeper.",
          success: "Flicked it into the far corner.", fail: "Couldn't keep it down." },
      ],
    },
    {
      id: "penalty", scene: "goal", comp: "LEAGUE", minute: 80, stakesMult: 1.3,
      stakes: "A penalty to win it — ice in the veins required.",
      prompt: "The referee points to the spot. The whole stadium holds its breath.",
      choices: [
        { label: "Blast it", stat: "finishing", difficulty: 56, effect: "goal",
          game: { type: "timingBar", action: "STRIKE" },
          impact: "Pure power — pick your spot and hit it hard.",
          success: "Unstoppable — roof of the net.", fail: "Leaned back and skied it." },
        { label: "Side-foot, pick a corner", stat: "positioning", difficulty: 52, effect: "goal",
          game: { type: "aimTarget" },
          impact: "Placement over power — send the keeper the wrong way.",
          success: "Cool as you like — wrong-footed him.", fail: "Telegraphed it; keeper saved." },
      ],
    },
    {
      id: "counter_2v1", scene: "goal", comp: "DERBY", minute: 76, stakesMult: 1.35,
      stakes: "Derby day on the break — bragging rights on the line.",
      prompt: "You break two-on-one against the last defender.",
      choices: [
        { label: "Back yourself, shoot", stat: "finishing", difficulty: 62, effect: "goal",
          game: { type: "timingBar", action: "SHOOT" },
          impact: "Take the glory — finish it yourself.",
          success: "Smashed it past the keeper. Derby goal!", fail: "Snatched at it, wide." },
        { label: "Slip in the runner", stat: "positioning", difficulty: 50, effect: "assist",
          game: { type: "aimTarget" },
          impact: "Unselfish — the perfectly timed pass sets up a tap-in.",
          success: "Slid it through — easy tap-in. Assist!", fail: "Pass was behind him; chance gone." },
      ],
    },
    {
      id: "byline_angle", scene: "goal", comp: "LEAGUE", minute: 70, stakesMult: 1.15,
      stakes: "A chance to break the deadlock from a tight angle.",
      prompt: "You reach the byline with a tight angle and the keeper at his near post.",
      choices: [
        { label: "Go near post", stat: "finishing", difficulty: 66, effect: "goal",
          game: { type: "aimTarget" },
          impact: "Audacious — beat the keeper at his near post.",
          success: "Squeezed it in at the near post!", fail: "Hit the side netting." },
        { label: "Cut it back to the spot", stat: "positioning", difficulty: 48, effect: "assist",
          game: { type: "aimTarget" },
          impact: "The percentage ball — cut it back for the arriving runner.",
          success: "Cutback finished first time. Assist!", fail: "Defender cut out the cutback." },
      ],
    },
    {
      id: "hold_up", scene: "goal", comp: "LEAGUE", minute: 68, stakesMult: 1.1,
      stakes: "Back to goal with a defender tight — make something happen.",
      prompt: "The ball comes into your feet with a defender leaning on your back.",
      choices: [
        { label: "Spin and shoot", stat: "dribbling", difficulty: 62, effect: "goal",
          game: { type: "reactionTap" },
          impact: "Quick feet — turn your man and get a shot away.",
          success: "Spun him and finished low.", fail: "Lost the ball in the turn." },
        { label: "Hold it up, lay it back", stat: "physical", difficulty: 46, effect: "assist",
          game: { type: "timingBar", action: "HOLD" },
          impact: "Bully the defender, hold play, tee up the midfield runner.",
          success: "Shielded it and laid it back. Assist!", fail: "Muscled off the ball." },
      ],
    },
    {
      id: "free_kick_edge", scene: "wall", comp: "LEAGUE", minute: 74, stakesMult: 1.2,
      stakes: "A free kick in a dangerous spot — the wall lines up.",
      prompt: "You stand over a free kick just outside the box, a four-man wall in front.",
      choices: [
        { label: "Curl it over the wall", stat: "finishing", difficulty: 66, effect: "goal",
          game: { type: "freeKick" },
          impact: "Bend it round the wall into the top corner.",
          success: "Whipped it over the wall — sensational free kick!", fail: "Cannoned into the wall." },
        { label: "Roll it to a runner", stat: "positioning", difficulty: 48, effect: "assist",
          game: { type: "aimTarget" },
          impact: "A clever short routine sets up a teammate.",
          success: "Slipped it sideways — tap-in. Assist!", fail: "The routine broke down." },
      ],
    },
    {
      id: "give_and_go", scene: "pitch", comp: "DERBY", minute: 66, stakesMult: 1.3,
      stakes: "Derby day — a quick combination could cut them open.",
      prompt: "You play it into midfield and burst past your marker for the return.",
      choices: [
        { label: "Give and go, then finish", stat: "dribbling", difficulty: 62, effect: "goal",
          game: { type: "oneTwo" },
          impact: "A sharp one-two splits the defence — finish first time.",
          success: "One-two and slotted home — superb combination!", fail: "The return pass was cut out." },
        { label: "Drift wide and cross", stat: "pace", difficulty: 52, effect: "assist",
          game: { type: "reactionTap" },
          impact: "Beat your man for pace and whip in a cross.",
          success: "Burned him and crossed for a tap-in. Assist!", fail: "Overran it out of play." },
      ],
    },
  ];

  // Build runtime context for a moment. League moments merge the real fixture
  // (moment._match); special cup/international moments carry their own opponent
  // via moment._opp / moment._home and have no live league scoreline.
  Moments.context = function (moment) {
    const comp = T.COMPETITIONS[moment.comp] || T.COMPETITIONS.LEAGUE;
    const m = moment._match;
    return {
      comp: moment.comp, compLabel: comp.label, tone: comp.tone,
      minute: moment.minute, stakes: moment.stakes,
      tournament: moment.tournament || null,
      opponent: m ? m.oppName : (moment._opp != null ? moment._opp : (moment.comp === "MEDIA" ? null : T.randomClubName())),
      home: m ? m.home : (moment._home != null ? moment._home : true),
      gh: m ? m.gh : null, ga: m ? m.ga : null,
      round: m ? m.rd : null,
    };
  };

  // Resolve a chosen action, blended with the skill-game result (0..1).
  // Outcomes scale by the scenario's stakes. Returns success, text, impact,
  // the effect type, and effect deltas (form/morale/rating).
  Moments.resolve = function (choice, skill, moment) {
    const p = T.game.player;
    const s = typeof skill === "number" ? skill : 0.5;
    const mult = (moment && moment.stakesMult) || 1;
    const statVal = p.stats[choice.stat] != null ? p.stats[choice.stat] : 50;

    let roll = statVal + p.form + (s - 0.5) * 44 + T.rand(-8, 8);
    if (T.hasPerk("clutch")) roll += 6;
    if (T.hasPerk("bigGame") && mult >= 1.3) roll += 6;

    const success = roll >= choice.difficulty;
    const deltas = success
      ? { form: Math.round(2 * mult), morale: Math.round(6 * mult), rating: +((0.2 + s * 0.3) * mult).toFixed(2) }
      : { form: -Math.round(2 * mult), morale: -Math.round(5 * mult), rating: -+(0.2 * mult).toFixed(2) };

    return {
      success, skill: s,
      text: success ? choice.success : choice.fail,
      impact: choice.impact,
      effect: choice.effect || "none",
      deltas,
    };
  };

  // Plain-language read of a key-moment result for the UI: the animation kind,
  // a headline, descriptive consequences (no raw rating/morale numbers), an
  // insight line that teaches what it means, and whether to celebrate big.
  Moments.describeResult = function (res, moment, gameType) {
    const keeperGame = gameType === "oneOnOne" || gameType === "aimTarget" || gameType === "freeKick";
    const outcome = res.success
      ? (res.effect === "assist" ? "assist" : "goal")
      : (keeperGame ? "saved" : "miss");
    const headline = { goal: "GOAL!", assist: "ASSIST!", saved: "SAVED!", miss: "MISSED" }[outcome];

    const d = res.deltas || {};
    const cons = [];
    if (res.success && res.effect === "goal") cons.push({ tone: "good", text: "⚽ You found the net" });
    if (res.success && res.effect === "assist") cons.push({ tone: "good", text: "🅰 You teed up a teammate" });
    const m = d.morale || 0, f = d.form || 0;
    if (m) cons.push({ tone: m >= 0 ? "good" : "bad",
      text: m >= 8 ? "😎 Confidence soaring" : m >= 4 ? "🙂 Confidence up" : m > 0 ? "Confidence lifted"
          : m <= -6 ? "😟 Head dropped" : "😕 Confidence dented" });
    if (f) cons.push({ tone: f >= 0 ? "good" : "bad",
      text: f >= 3 ? "🔥 In the groove" : f > 0 ? "📈 Form sharper" : "📉 Form dipped" });

    const stakes = (moment && moment.stakesMult) || 1;
    const big = stakes >= 1.5 || !!res.wonTitle;
    let insight;
    if (res.wonTitle) insight = `You delivered when it mattered most — ${res.wonTitle} is yours. This is the kind of moment a legacy is built on.`;
    else if (moment && moment.track === "intl") insight = res.success
      ? "On the international stage the whole nation is watching — these are the goals that make you a hero of a country."
      : "The world stage is unforgiving, but the great ones always answer back.";
    else if (res.success && res.effect === "assist") insight = "Not every defining moment is a goal — the best strikers create as well as finish, and assists still build your reputation.";
    else if (res.success) insight = big
      ? "A goal on a stage this big echoes for years — exactly the kind of moment careers are remembered for."
      : "Goals are a striker's currency, and the confidence you take from this carries your form through the season.";
    else insight = big
      ? "It slips away this time — but the best strikers are defined by how they respond to the big misses."
      : "A chance gone. Shake it off — your form and confidence ride on bouncing straight back.";

    return { outcome, headline, consequences: cons, insight, big };
  };

  Moments.pickSeason = function (n) {
    const count = n || T.TUNING.KEY_MOMENTS_PER_SEASON;
    const pool = Moments.POOL_FWD.slice();
    const out = [];
    while (out.length < count && pool.length) {
      out.push(pool.splice(Math.floor(T.rng() * pool.length), 1)[0]);
    }
    return out;
  };

  // ---- Special moments: domestic cup run + international / World Cup ----
  // These are NOT tied to a league fixture (no scoreline / table change). A
  // FINAL whose `grant` is set awards silverware on a successful finish:
  //   grant.trophy -> pushed to the season record's trophies
  //   grant.award  -> added to the season's awards (e.g. World Cup Winner)
  Moments.POOL_CUP = [
    {
      id: "cup_quarter", track: "cup", stage: "early", scene: "goal", comp: "CUP", minute: 79, stakesMult: 1.3,
      tournament: "Domestic Cup · Quarter-Final",
      stakes: "A cup quarter-final against a bigger club — a chance to make headlines.",
      prompt: "The tie is level late on when a half-chance drops to you in the box.",
      choices: [
        { label: "Smash it first time", stat: "finishing", difficulty: 64, effect: "goal", game: { type: "timingBar", action: "SHOOT" },
          impact: "Knock the favourites out and reach the semis.", success: "Buried it — giant-killing!", fail: "Snatched at it — wide." },
        { label: "Compose and place it", stat: "positioning", difficulty: 54, effect: "goal", game: { type: "aimTarget" },
          impact: "Pick your spot and send them through.", success: "Cool finish — into the semis!", fail: "The keeper read it." },
      ],
    },
    {
      id: "cup_semi", track: "cup", stage: "early", scene: "goal", comp: "CUP", minute: 85, stakesMult: 1.4,
      tournament: "Domestic Cup · Semi-Final",
      stakes: "A cup semi-final, deadlocked — win it and you reach the final.",
      prompt: "Extra time looms as you wriggle free at the far post.",
      choices: [
        { label: "Volley it home", stat: "finishing", difficulty: 66, effect: "goal", game: { type: "timingBar", action: "VOLLEY" },
          impact: "Send your club to the final.", success: "Volleyed in — you're in the FINAL!", fail: "Leaned back — over." },
        { label: "Power header", stat: "physical", difficulty: 60, effect: "goal", game: { type: "timingBar", action: "HEAD" },
          impact: "Rise highest and win it.", success: "Thumping header — final booked!", fail: "Couldn't keep it down." },
      ],
    },
    {
      id: "cup_final", track: "cup", stage: "final", scene: "goal", comp: "FINAL", minute: 88, stakesMult: 1.8,
      tournament: "Domestic Cup Final", grant: { trophy: "Domestic Cup" },
      stakes: "The Cup Final, all square. This is what careers are remembered for.",
      prompt: "Deep into the final, the ball breaks to you with the keeper to beat.",
      choices: [
        { label: "Round the keeper", stat: "dribbling", difficulty: 66, effect: "goal", game: { type: "oneOnOne" },
          impact: "Win the cup and lift the trophy.", success: "Round him and in — YOU'VE WON THE CUP!", fail: "The keeper spread himself." },
        { label: "Curl it far post", stat: "finishing", difficulty: 64, effect: "goal", game: { type: "freeKick" },
          impact: "A cup-winning goal lives forever.", success: "Bent it in — the cup is yours!", fail: "Inches wide." },
      ],
    },
  ];

  Moments.POOL_INTL = [
    {
      id: "intl_qualifier", track: "intl", stage: "qual", scene: "goal", comp: "INTL", minute: 77, stakesMult: 1.35,
      tournament: "World Cup Qualifier",
      stakes: "A World Cup qualifier for your nation — a goal could seal your place at the finals.",
      prompt: "Your country needs a goal. The cross comes in and you've found space.",
      choices: [
        { label: "Attack the cross", stat: "physical", difficulty: 62, effect: "goal", game: { type: "timingBar", action: "HEAD" },
          impact: "Send your nation toward the World Cup.", success: "Headed home for your country!", fail: "Missed your header." },
        { label: "Cushion and finish", stat: "finishing", difficulty: 60, effect: "goal", game: { type: "timingBar", action: "SHOOT" },
          impact: "A clinical finish on the international stage.", success: "Clinical — what a finish for your country!", fail: "Dragged it wide." },
      ],
    },
    {
      id: "wc_group", track: "intl", stage: "wcgroup", scene: "goal", comp: "WORLDCUP", minute: 74, stakesMult: 1.5,
      tournament: "World Cup · Group Stage",
      stakes: "Your first World Cup. A group-stage goal could light up the tournament.",
      prompt: "On the biggest stage of all, the ball sits up for you 18 yards out.",
      choices: [
        { label: "Let fly", stat: "finishing", difficulty: 66, effect: "goal", game: { type: "timingBar", action: "STRIKE" },
          impact: "Announce yourself at the World Cup.", success: "Top corner — a World Cup goal!", fail: "Whistled over." },
        { label: "Skip past and slot", stat: "dribbling", difficulty: 64, effect: "goal", game: { type: "dribbleDodge" },
          impact: "Dance through and finish on the world stage.", success: "Mazy run and finish — the world is watching!", fail: "Crowded out." },
      ],
    },
    {
      id: "wc_final", track: "intl", stage: "wcfinal", scene: "goal", comp: "WORLDCUP", minute: 90, stakesMult: 2.0,
      tournament: "World Cup Final", grant: { award: "worldCup", trophy: "World Cup" },
      stakes: "The World Cup Final. Win this and you are immortal.",
      prompt: "The final, level, the last minute — the ball falls to you on the edge of the box.",
      choices: [
        { label: "Shoot for glory", stat: "finishing", difficulty: 68, effect: "goal", game: { type: "timingBar", action: "STRIKE" },
          impact: "A World Cup winner — the greatest goal of all.", success: "GOAL! YOU'VE WON THE WORLD CUP!", fail: "Agonisingly wide." },
        { label: "Round the keeper", stat: "dribbling", difficulty: 70, effect: "goal", game: { type: "oneOnOne" },
          impact: "Beat the keeper and lift the World Cup.", success: "Round him and in — CHAMPIONS OF THE WORLD!", fail: "The keeper saved it." },
      ],
    },
  ];

  const byId = (pool, id) => pool.find(m => m.id === id);

  // Pick this season's special moments: a domestic cup run (which may reach the
  // final) and, once the player is a capped international, an international game
  // (a World Cup match every 4th season, otherwise a qualifier).
  Moments.pickSpecials = function (g, season) {
    const p = g.player, out = [];
    const clubStr = T.playerClubStr ? T.playerClubStr() : 60;

    // Domestic cup: reach the final (prob scales with club strength), else a tie.
    if (T.rng() < T.clamp((clubStr - 48) / 80, 0.1, 0.55)) {
      out.push(byId(Moments.POOL_CUP, "cup_final"));
    } else if (T.rng() < 0.7) {
      const early = Moments.POOL_CUP.filter(m => m.stage === "early");
      out.push(T.pick(early));
    }

    // International: only once capped. World Cup every 4th season.
    if ((p.caps || 0) > 0) {
      if (g.season % 4 === 0) {
        const reachFinal = T.rng() < T.clamp((T.overall() - 74) / 55, 0.05, 0.5);
        out.push(byId(Moments.POOL_INTL, reachFinal ? "wc_final" : "wc_group"));
      } else if (T.rng() < 0.6) {
        out.push(byId(Moments.POOL_INTL, "intl_qualifier"));
      }
    }

    // Attach a synthetic opponent (cup: a club; international: another nation).
    out.forEach(mo => {
      if (!mo) return;
      mo._home = T.rng() < 0.5;
      mo._opp = mo.track === "intl"
        ? T.pick(T.NATIONS.filter(n => n !== p.nation))
        : T.randomClubName();
    });
    return out.filter(Boolean);
  };
})();
