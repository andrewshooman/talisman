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
      id: "penalty", scene: "goal", comp: "CUP", minute: 80, stakesMult: 1.4,
      stakes: "A penalty in the cup — ice in the veins required.",
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
    {
      id: "final_breakaway", scene: "goal", comp: "FINAL", minute: 88, stakesMult: 1.7,
      stakes: "Cup final, late — this is the moment careers are remembered for.",
      prompt: "You break clear in the cup final with only the keeper to beat.",
      choices: [
        { label: "Round the keeper", stat: "dribbling", difficulty: 66, effect: "goal",
          game: { type: "oneOnOne" },
          impact: "Win the cup here and it headlines your legacy.",
          success: "Round him and into an empty net — you've won the cup!", fail: "Keeper spread himself and saved." },
        { label: "Early shot, low", stat: "finishing", difficulty: 60, effect: "goal",
          game: { type: "timingBar", action: "SHOOT" },
          impact: "A final-winning goal is worth a mountain of reputation.",
          success: "Through his legs — final winner!", fail: "Dragged it just wide." },
      ],
    },
  ];

  // Build runtime context for a moment, merging the real fixture if the UI
  // attached one (moment._match: { rd, oppName, home, gh, ga }).
  Moments.context = function (moment) {
    const comp = T.COMPETITIONS[moment.comp] || T.COMPETITIONS.LEAGUE;
    const m = moment._match;
    return {
      comp: moment.comp, compLabel: comp.label, tone: comp.tone,
      minute: moment.minute, stakes: moment.stakes,
      opponent: m ? m.oppName : (moment.comp === "MEDIA" ? null : T.randomClubName()),
      home: m ? m.home : true,
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

  Moments.pickSeason = function (n) {
    const count = n || T.TUNING.KEY_MOMENTS_PER_SEASON;
    const pool = Moments.POOL_FWD.slice();
    const out = [];
    while (out.length < count && pool.length) {
      out.push(pool.splice(Math.floor(T.rng() * pool.length), 1)[0]);
    }
    return out;
  };
})();
