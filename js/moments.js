/* ============================================================
   TALISMAN — moments.js
   Key-moment choice system: 3-5 interactive scenes per season.
   Player picks an action -> dice roll vs (stat + form [+ perk]) ->
   outcome swings rating / morale / goals / narrative.

   Current status: STUB with a small FWD scenario pool + a working
   resolver, so the loop is demonstrable. Expand the pool and wire
   outcomes into the season record in future sessions.

   TODO (future sessions):
     - Grow scenario pool (penalty, derby, final, last-minute, transfer
       ultimatum, captaincy, injury gamble).
     - Apply outcomes to the current season record (goals/rating/trophies).
     - Hook Clutch / Big-Game Player into the roll bonus.
     - Context-aware selection (finals only late season, etc.).
   ============================================================ */
(function () {
  const T = window.TALISMAN;
  const Moments = (T.Moments = {});

  // Scenario shape:
  // { id, prompt, choices: [ { label, stat, difficulty, success, fail } ] }
  Moments.POOL_FWD = [
    {
      id: "penalty_late",
      prompt: "90th minute, level score, you win a penalty. The keeper is a giant. What do you do?",
      choices: [
        { label: "Smash it down the middle", stat: "finishing", difficulty: 60,
          success: "Roofed it. The net bulges. Bedlam.", fail: "Saved! The keeper guessed right." },
        { label: "Cool side-foot, pick a corner", stat: "composure", difficulty: 55,
          success: "Sent the keeper the wrong way. Ice cold.", fail: "Dragged it wide under pressure." },
      ],
    },
    {
      id: "derby_chance",
      prompt: "Derby day. A loose ball drops at the edge of the box with the defender closing.",
      choices: [
        { label: "First-time volley", stat: "finishing", difficulty: 70,
          success: "Top corner. A derby goal they'll sing about.", fail: "Skied it into the stands." },
        { label: "Take a touch, go round him", stat: "dribbling", difficulty: 65,
          success: "Nutmeg and slot home. Silenced the away end.", fail: "Dispossessed. Counter-attack." },
        { label: "Lay it off, play safe", stat: "positioning", difficulty: 40,
          success: "Smart link-up keeps possession.", fail: "Overhit the pass; chance gone." },
      ],
    },
    {
      id: "final_breakaway",
      prompt: "Cup final, breakaway, just you and the keeper bearing down.",
      choices: [
        { label: "Round the keeper", stat: "dribbling", difficulty: 68,
          success: "Dummy, round him, tap in. Final winner!", fail: "Keeper smothers it at your feet." },
        { label: "Early shot, low and hard", stat: "finishing", difficulty: 62,
          success: "Through his legs. You've won the cup.", fail: "Straight at him." },
      ],
    },
    {
      id: "press_question",
      prompt: "A journalist baits you about your future at a rival club. Cameras rolling.",
      choices: [
        { label: "Commit to the club", stat: "composure", difficulty: 45,
          success: "Fans love it. Morale soars.", fail: "Sounded rehearsed; nobody's convinced." },
        { label: "Stay coy, keep options open", stat: "composure", difficulty: 55,
          success: "Played it perfectly — leverage gained.", fail: "Backlash from the stands." },
      ],
    },
  ];

  // Roll an outcome for a chosen action.
  // Returns { success, text, deltas:{ form, morale, goals, rating } }
  Moments.resolve = function (choice) {
    const p = T.game.player;
    const statVal = p.stats[choice.stat] != null ? p.stats[choice.stat] : 50;
    let roll = statVal + p.form + T.rand(-15, 15);

    // Perk hooks
    if (T.hasPerk("clutch")) roll += 6;
    if (T.hasPerk("bigGame")) roll += 5;

    const success = roll >= choice.difficulty;

    const deltas = success
      ? { form: +2, morale: +6, goals: choiceScores(choice) ? 1 : 0, rating: +0.3 }
      : { form: -2, morale: -5, goals: 0, rating: -0.2 };

    return {
      success,
      text: success ? choice.success : choice.fail,
      deltas,
    };
  };

  // Does a successful choice represent an actual goal? (finishing/dribbling scenes)
  function choiceScores(choice) {
    return choice.stat === "finishing" || choice.stat === "dribbling";
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
