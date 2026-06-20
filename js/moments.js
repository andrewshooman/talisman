/* ============================================================
   TALISMAN — moments.js
   Key-moment choice system: 3-5 interactive scenes per season.
   Player picks an action -> plays a small SKILL-GAME (see minigames.js)
   -> the skill result (0..1) blends with (stat + form [+ perk]) to
   resolve the outcome -> swings rating / morale / goals / narrative.

   Each choice carries a `game` descriptor:
     game: { type: "timingBar"|"aimTarget"|"reactionTap", action?: "SHOOT" }
   The relevant stat sizes the difficulty of the skill-game in ui.js.

   TODO (future sessions):
     - Grow scenario pool (last-minute, transfer ultimatum, captaincy,
       injury gamble) + new minigame types.
     - Context-aware selection (finals only late season, etc.).
     - Apply outcomes to trophies/awards where relevant.
   ============================================================ */
(function () {
  const T = window.TALISMAN;
  const Moments = (T.Moments = {});

  // Scenario shape:
  // { id, scene, prompt, choices: [ { label, stat, difficulty, game, success, fail } ] }
  Moments.POOL_FWD = [
    {
      id: "penalty_late",
      scene: "goal",
      prompt: "90th minute, level score, you win a penalty. The keeper is a giant.",
      choices: [
        { label: "Smash it down the middle", stat: "finishing", difficulty: 58,
          game: { type: "timingBar", action: "STRIKE" },
          success: "Roofed it. The net bulges. Bedlam.", fail: "Saved! The keeper guessed right." },
        { label: "Cool side-foot, pick a corner", stat: "composure", difficulty: 54,
          game: { type: "aimTarget" },
          success: "Sent the keeper the wrong way. Ice cold.", fail: "Dragged it wide under pressure." },
      ],
    },
    {
      id: "derby_chance",
      scene: "goal",
      prompt: "Derby day. A loose ball drops at the edge of the box with a defender closing.",
      choices: [
        { label: "First-time volley", stat: "finishing", difficulty: 68,
          game: { type: "timingBar", action: "VOLLEY" },
          success: "Top corner. A derby goal they'll sing about.", fail: "Skied it into the stands." },
        { label: "Take a touch, go round him", stat: "dribbling", difficulty: 64,
          game: { type: "reactionTap" },
          success: "Nutmeg and slot home. Silenced the away end.", fail: "Dispossessed. Counter-attack." },
        { label: "Place it into the corner", stat: "positioning", difficulty: 50,
          game: { type: "aimTarget" },
          success: "Picked the corner with class.", fail: "Keeper read it all the way." },
      ],
    },
    {
      id: "final_breakaway",
      scene: "goal",
      prompt: "Cup final, breakaway, just you and the keeper bearing down.",
      choices: [
        { label: "Round the keeper", stat: "dribbling", difficulty: 66,
          game: { type: "reactionTap" },
          success: "Dummy, round him, tap in. Final winner!", fail: "Keeper smothers it at your feet." },
        { label: "Early shot, low and hard", stat: "finishing", difficulty: 60,
          game: { type: "timingBar", action: "SHOOT" },
          success: "Through his legs. You've won the cup.", fail: "Straight at him." },
      ],
    },
    {
      id: "last_minute_header",
      scene: "goal",
      prompt: "Injury time, corner swings in. You peel off your marker at the back post.",
      choices: [
        { label: "Power header", stat: "physical", difficulty: 64,
          game: { type: "timingBar", action: "HEAD" },
          success: "Thumped it in off the bar. Scenes.", fail: "Got under it — over the bar." },
        { label: "Glance it into the corner", stat: "positioning", difficulty: 58,
          game: { type: "aimTarget" },
          success: "Subtle flick, wrong-foots the keeper.", fail: "Flicked it just wide." },
      ],
    },
    {
      id: "one_on_one_sprint",
      scene: "goal",
      prompt: "Through ball splits the defence — it's a foot race with the last man.",
      choices: [
        { label: "Burst past him", stat: "pace", difficulty: 60,
          game: { type: "reactionTap" },
          success: "Gone. Just the keeper to beat — and you do.", fail: "He recovers and nicks it." },
        { label: "Shield, wait for support", stat: "physical", difficulty: 48,
          game: { type: "timingBar", action: "HOLD" },
          success: "Held him off, laid it back, assist.", fail: "Muscled off the ball." },
      ],
    },
    {
      id: "press_question",
      scene: "goal",
      prompt: "A journalist baits you about a rival club's interest. Cameras rolling.",
      choices: [
        { label: "Commit to the club (stay composed)", stat: "composure", difficulty: 46,
          game: { type: "timingBar", action: "STEADY" },
          success: "Fans love it. Morale soars.", fail: "Sounded rehearsed; nobody's convinced." },
        { label: "Stay coy, keep options open", stat: "composure", difficulty: 56,
          game: { type: "timingBar", action: "STEADY" },
          success: "Played it perfectly — leverage gained.", fail: "Backlash from the stands." },
      ],
    },
  ];

  // Roll an outcome for a chosen action, blended with the skill-game result.
  // skill: 0..1 from the minigame (default 0.5 if no game was played).
  // Returns { success, text, deltas:{ form, morale, goals, rating }, skill }
  Moments.resolve = function (choice, skill) {
    const p = T.game.player;
    const s = typeof skill === "number" ? skill : 0.5;
    const statVal = p.stats[choice.stat] != null ? p.stats[choice.stat] : 50;

    // Skill swings the roll by up to ±22; stat + form provide the base.
    let roll = statVal + p.form + (s - 0.5) * 44 + T.rand(-8, 8);
    if (T.hasPerk("clutch")) roll += 6;
    if (T.hasPerk("bigGame")) roll += 5;

    const success = roll >= choice.difficulty;
    const scored = success && choiceScores(choice);

    const deltas = success
      ? { form: +2, morale: +6, goals: scored ? 1 : 0, rating: +0.2 + s * 0.3 }
      : { form: -2, morale: -5, goals: 0, rating: -0.2 };

    return { success, text: success ? choice.success : choice.fail, deltas, skill: s };
  };

  // Does a successful choice represent an actual goal? (finishing/dribbling/etc.)
  function choiceScores(choice) {
    return ["finishing", "dribbling", "physical", "positioning", "pace"].includes(choice.stat)
      && choice.stat !== "composure";
  }

  // Pick N distinct scenarios for the season.
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
