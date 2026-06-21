/* ============================================================
   TALISMAN — moments.js
   Key-moment choice system: 3-5 interactive scenes per season.
   Player picks an action -> plays a small SKILL-GAME (see minigames.js)
   -> the skill result (0..1) blends with (stat + form [+ perk]) to
   resolve the outcome -> swings rating / morale / goals / narrative.

   Each scenario now carries CONTEXT (competition + stakes) and each
   choice carries a `game` descriptor + an `impact` line describing how
   it shapes your career. Outcomes are scaled by the scenario's stakes,
   so a cup final swings your career more than a routine league game.

   choice = { label, stat, difficulty, game, impact, success, fail }
   game   = { type: "timingBar"|"aimTarget"|"reactionTap", action?: "SHOOT" }

   TODO (future sessions):
     - More scenarios + minigame types; context-aware selection.
     - Tie specific outcomes to trophies/awards/transfer interest.
   ============================================================ */
(function () {
  const T = window.TALISMAN;
  const Moments = (T.Moments = {});

  Moments.POOL_FWD = [
    {
      id: "penalty_late",
      scene: "goal", comp: "LEAGUE", stakesMult: 1.2,
      stakes: "Score and you snatch all three points in the title race.",
      prompt: "90th minute, level score, you win a penalty. The keeper is a giant.",
      choices: [
        { label: "Smash it down the middle", stat: "finishing", difficulty: 58,
          game: { type: "timingBar", action: "STRIKE" },
          impact: "A late winner spikes morale and the fans' faith in you.",
          success: "Roofed it. The net bulges. Bedlam.", fail: "Saved! The keeper guessed right." },
        { label: "Cool side-foot, pick a corner", stat: "composure", difficulty: 54,
          game: { type: "aimTarget" },
          impact: "Ice in the veins — a composed finish builds your big-game reputation.",
          success: "Sent the keeper the wrong way. Ice cold.", fail: "Dragged it wide under pressure." },
      ],
    },
    {
      id: "derby_chance",
      scene: "goal", comp: "DERBY", stakesMult: 1.35,
      stakes: "It's the derby — bragging rights and a season's worth of pride.",
      prompt: "A loose ball drops at the edge of the box with a defender closing.",
      choices: [
        { label: "First-time volley", stat: "finishing", difficulty: 68,
          game: { type: "timingBar", action: "VOLLEY" },
          impact: "A derby screamer becomes part of your legend if it goes in.",
          success: "Top corner. A derby goal they'll sing about.", fail: "Skied it into the stands." },
        { label: "Take a touch, go round him", stat: "dribbling", difficulty: 64,
          game: { type: "reactionTap" },
          impact: "Beating your man in the derby sends morale soaring.",
          success: "Nutmeg and slot home. Silenced the away end.", fail: "Dispossessed. Counter-attack." },
        { label: "Place it into the corner", stat: "positioning", difficulty: 50,
          game: { type: "aimTarget" },
          impact: "A tidy, low-risk finish — keeps your rating steady.",
          success: "Picked the corner with class.", fail: "Keeper read it all the way." },
      ],
    },
    {
      id: "final_breakaway",
      scene: "goal", comp: "FINAL", stakesMult: 1.7,
      stakes: "Cup final. This is the moment careers are remembered for.",
      prompt: "Breakaway, just you and the keeper bearing down.",
      choices: [
        { label: "Round the keeper", stat: "dribbling", difficulty: 66,
          game: { type: "reactionTap" },
          impact: "Win the cup here and it headlines your legacy.",
          success: "Dummy, round him, tap in. Final winner!", fail: "Keeper smothers it at your feet." },
        { label: "Early shot, low and hard", stat: "finishing", difficulty: 60,
          game: { type: "timingBar", action: "SHOOT" },
          impact: "A final-winning goal is worth a mountain of morale and reputation.",
          success: "Through his legs. You've won the cup.", fail: "Straight at him." },
      ],
    },
    {
      id: "last_minute_header",
      scene: "goal", comp: "LEAGUE", stakesMult: 1.2,
      stakes: "Injury time, chasing a winner to rescue the points.",
      prompt: "A corner swings in. You peel off your marker at the back post.",
      choices: [
        { label: "Power header", stat: "physical", difficulty: 64,
          game: { type: "timingBar", action: "HEAD" },
          impact: "A bullet header shows you're a threat in the air.",
          success: "Thumped it in off the bar. Scenes.", fail: "Got under it — over the bar." },
        { label: "Glance it into the corner", stat: "positioning", difficulty: 58,
          game: { type: "aimTarget" },
          impact: "A clever glancing header rewards smart movement.",
          success: "Subtle flick, wrong-foots the keeper.", fail: "Flicked it just wide." },
      ],
    },
    {
      id: "one_on_one_sprint",
      scene: "goal", comp: "LEAGUE", stakesMult: 1.1,
      stakes: "A chance to break the deadlock in a tight game.",
      prompt: "A through ball splits the defence — it's a foot race with the last man.",
      choices: [
        { label: "Burst past him", stat: "pace", difficulty: 60,
          game: { type: "reactionTap" },
          impact: "Out-sprinting defenders cements your pace reputation.",
          success: "Gone. Just the keeper to beat — and you do.", fail: "He recovers and nicks it." },
        { label: "Shield, wait for support", stat: "physical", difficulty: 48,
          game: { type: "timingBar", action: "HOLD" },
          impact: "Hold-up play earns an assist and the manager's trust.",
          success: "Held him off, laid it back, assist.", fail: "Muscled off the ball." },
      ],
    },
    {
      id: "press_question",
      scene: "goal", comp: "MEDIA", stakesMult: 1.0,
      stakes: "Cameras rolling — your words will shape how fans see you.",
      prompt: "A journalist baits you about a rival club's interest.",
      choices: [
        { label: "Commit to the club (stay composed)", stat: "composure", difficulty: 46,
          game: { type: "timingBar", action: "STEADY" },
          impact: "Loyalty talk wins the fans over and lifts morale.",
          success: "Fans love it. Morale soars.", fail: "Sounded rehearsed; nobody's convinced." },
        { label: "Stay coy, keep options open", stat: "composure", difficulty: 56,
          game: { type: "timingBar", action: "STEADY" },
          impact: "Playing it cool keeps leverage for a future transfer.",
          success: "Played it perfectly — leverage gained.", fail: "Backlash from the stands." },
      ],
    },
  ];

  // Build runtime context for a moment: competition + a generated opponent.
  Moments.context = function (moment) {
    const comp = T.COMPETITIONS[moment.comp] || T.COMPETITIONS.LEAGUE;
    const opponent = moment.comp === "MEDIA" ? null : T.randomClubName();
    return { comp: moment.comp, compLabel: comp.label, tone: comp.tone, opponent, stakes: moment.stakes };
  };

  // Resolve a chosen action, blended with the skill-game result (0..1).
  // Outcomes are scaled by the scenario's stakes. Returns success, text,
  // the human-readable impact line, and the effect deltas (for display).
  Moments.resolve = function (choice, skill, moment) {
    const p = T.game.player;
    const s = typeof skill === "number" ? skill : 0.5;
    const mult = (moment && moment.stakesMult) || 1;
    const statVal = p.stats[choice.stat] != null ? p.stats[choice.stat] : 50;

    // Skill swings the roll by up to ±22; stat + form provide the base.
    let roll = statVal + p.form + (s - 0.5) * 44 + T.rand(-8, 8);
    if (T.hasPerk("clutch")) roll += 6;
    if (T.hasPerk("bigGame") && mult >= 1.3) roll += 6; // shines in big games

    const success = roll >= choice.difficulty;
    const scored = success && choiceScores(choice);

    const deltas = success
      ? { form: Math.round(2 * mult), morale: Math.round(6 * mult),
          goals: scored ? 1 : 0, rating: +((0.2 + s * 0.3) * mult).toFixed(2) }
      : { form: -Math.round(2 * mult), morale: -Math.round(5 * mult),
          goals: 0, rating: -+(0.2 * mult).toFixed(2) };

    return {
      success, skill: s,
      text: success ? choice.success : choice.fail,
      impact: choice.impact,
      deltas,
    };
  };

  function choiceScores(choice) {
    return ["finishing", "dribbling", "physical", "positioning", "pace"].includes(choice.stat);
  }

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
