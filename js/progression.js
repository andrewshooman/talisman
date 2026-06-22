/* ============================================================
   TALISMAN — progression.js
   XP, leveling/perk picks, age curve, injuries, transfers, and the
   per-season "advance" that folds results into totals & history.

   Current status: BASIC working version. Age curve + injuries + totals
   work; transfers and perk-picks are stubbed.

   TODO (future sessions):
     - Transfer offers driven by performance & club tier (bigger clubs
       court strong seasons; loans/drops on poor ones).
     - Perk pick UI on level-up (currently auto-skipped).
     - Awards (Player of the Season, Ballon-style), national call-ups.
     - Catastrophic injury -> early career end ("the death").
   ============================================================ */
(function () {
  const T = window.TALISMAN;
  const Prog = (T.Prog = {});

  // Roll this season's volatile form (-10..+10), nudged by morale.
  Prog.rollForm = function () {
    const p = T.game.player;
    const moraleBias = (p.morale - 50) / 10; // -5..+5
    p.form = Math.round(T.clamp(T.rand(-10, 10) + moraleBias * 0.5, -10, 10));
    return p.form;
  };

  // Apply the age curve to stats: growth toward prime, decline after.
  Prog.applyAgeCurve = function () {
    const p = T.game.player;
    const prime = T.POSITIONS[p.position].prime;
    const keys = T.POSITIONS[p.position].stats;
    let drift;
    if (p.age < prime) {
      drift = T.hasPerk("wonderkid") && p.age < 23 ? 3 : 2; // growth
    } else if (p.age <= prime + 1) {
      drift = 0; // plateau
    } else {
      drift = -(1 + Math.floor((p.age - prime) / 2)); // accelerating decline
    }
    keys.forEach((k) => {
      const jitter = T.randInt(-1, 1);
      p.stats[k] = T.clamp(p.stats[k] + drift + jitter, 10, 99);
    });
  };

  // Injury roll. Returns an injury object or null.
  Prog.rollInjury = function () {
    const p = T.game.player;
    let chance = T.TUNING.BASE_INJURY_CHANCE;
    if (T.hasPerk("glassCannon")) chance += 0.06;
    if (T.hasPerk("injuryProne")) chance += 0.08;
    if (T.hasPerk("ironMan")) chance -= 0.05;
    if (T.hasPerk("engine")) chance -= 0.02;
    chance += (p.age > 30 ? (p.age - 30) * 0.01 : 0);

    if (T.rng() < chance) {
      const weeks = T.randInt(2, 16);
      p.fitness = T.clamp(p.fitness - weeks * 2, 30, 100);
      const inj = { season: T.game.season, weeks };
      p.injuries.push(inj);
      return inj;
    }
    // recover a little if uninjured
    p.fitness = T.clamp(p.fitness + 5, 0, 100);
    return null;
  };

  // Rare catastrophic injury -> career ends.
  Prog.rollCareerEndInjury = function () {
    const p = T.game.player;
    let chance = T.TUNING.CAREER_END_INJURY_CHANCE;
    if (T.hasPerk("glassCannon")) chance *= 2;
    if (T.hasPerk("ironMan")) chance *= 0.5;
    chance += (p.age > 32 ? (p.age - 32) * 0.005 : 0);
    return T.rng() < chance;
  };

  // Season awards & national-team progress. Returns the award ids earned,
  // and advances the player's cap count once they're an international.
  // League-best honours (Golden Boot / Playmaker) are judged against a
  // synthesised rival benchmark so the race feels contested season to season.
  Prog.rollAwards = function (record) {
    const g = T.game, p = g.player;
    const awards = [];
    const ovr = T.overall();

    // Stronger leagues set a higher bar for the individual scoring/creating gongs.
    // Bar scales with division so honours stay rare & earned at every level.
    const rivalGoals = T.randInt(26, 34) + (record.clubTier - 2) * 2;
    const rivalAssists = T.randInt(16, 23);
    if (record.goals >= rivalGoals) awards.push("goldenBoot");
    if (record.assists >= rivalAssists) awards.push("playmaker");

    // Player of the Season — elite average rating + a top-2 finish, or the title.
    // (Title trophies are named per division, e.g. "Prime League Title".)
    const wonTitle = record.trophies.some(t => /Title$/.test(t));
    const potsBar = T.hasPerk("bigGame") ? 7.55 : 7.7;
    if ((record.rating >= potsBar && record.finish <= 2) || (wonTitle && record.rating >= 7.45)) {
      awards.push("pots");
    }

    // Young Player of the Season — standout under-22.
    if (p.age <= 21 && (record.goals >= 20 || record.assists >= 14 || record.rating >= 7.45)) {
      awards.push("youngPlayer");
    }

    // National team: first call-up, then accumulating caps and an outstanding-year gong.
    p.caps = p.caps || 0;
    const intlReady = ovr >= 76 || record.goals >= 18 || awards.length > 0;
    if (intlReady) {
      if (p.caps === 0) awards.push("callUp");
      p.caps += T.clamp(Math.round(record.apps / 5), 2, 9);
      if (record.rating >= 7.9 && (record.goals >= 26 || record.trophies.length >= 2)) {
        awards.push("intlStar");
      }
    }

    return awards;
  };

  // Award XP; return how many levels were gained (UI offers a perk pick each).
  Prog.awardXp = function (record) {
    const p = T.game.player;
    const gained = 20 + record.goals * 3 + record.assists * 2 +
      record.trophies.length * 25 + (record.awards ? record.awards.length * 30 : 0) +
      Math.round((record.rating - 6) * 20);
    p.xp += Math.max(gained, 5);
    let levels = 0;
    while (p.xp >= T.TUNING.XP_PER_LEVEL) {
      p.xp -= T.TUNING.XP_PER_LEVEL;
      p.level += 1;
      p.trainingPoints += 4;
      levels += 1;
    }
    return levels;
  };

  // Offer up to `count` perks the player doesn't already own.
  Prog.offerPerks = function (count) {
    const owned = T.game.player.perks;
    const pool = Object.keys(T.PERKS).filter(id => !T.PERKS[id].negative && !owned.includes(id));
    const out = [];
    while (out.length < (count || 3) && pool.length) {
      out.push(pool.splice(Math.floor(T.rng() * pool.length), 1)[0]);
    }
    return out;
  };

  // Fold a finished season record into history + totals, advance age.
  Prog.advanceSeason = function (record) {
    const g = T.game;
    const t = g.totals;

    // Season awards (sets record.awards, advances national caps) before XP/totals.
    record.awards = Prog.rollAwards(record);
    t.awards += record.awards.length;

    t.apps += record.apps;
    t.goals += record.goals;
    t.assists += record.assists;
    t.cleanSheets += record.cleanSheets || 0;
    t.trophies += record.trophies.length;
    if (record.rating > t.peakRating) t.peakRating = record.rating;

    g.history.push(record);
    const levelsGained = Prog.awardXp(record);

    // morale settles toward 50 a touch each year
    g.player.morale = Math.round(T.clamp(g.player.morale * 0.9 + 5, 0, 100));

    // age up, then apply growth/decline for the new age
    g.player.age += 1;
    g.season += 1;
    Prog.applyAgeCurve();

    // decline-based natural retirement check (UI offers retire too)
    if (g.player.age >= 38 && T.overall() < 60) {
      g.careerOver = true;
    }
    return { levelsGained };
  };

  // Promotion / relegation across the whole pyramid. The player's division is
  // ordered by the real final table (season.finalOrder); other divisions are
  // ordered by club strength + noise. Top/bottom N swap across each boundary so
  // every division stays at 20 clubs. Updates the player's division & club tier.
  // Returns { moved:"up"|"down", fromName, toName } if the player changed division.
  Prog.runPromRel = function (season) {
    const g = T.game;
    if (!g.league) return null;
    const divs = g.league.divs;
    const N = T.TUNING.PROMOTE_COUNT || 3;
    const prevDiv = g.division;

    const strOf = (x) => T.ladderClub(x).str;

    // Build a finishing order for every division.
    const order = divs.map((members, d) => {
      if (d === prevDiv && season && season.finalOrder) return season.finalOrder.slice();
      return members
        .map(x => ({ x, key: strOf(x) + T.rand(-7, 7) }))
        .sort((a, b) => b.key - a.key)
        .map(o => o.x);
    });

    // Apply N-up / N-down across each adjacent boundary.
    for (let d = 0; d < divs.length - 1; d++) {
      const up = order[d + 1].slice(0, N);                  // promoted to div d
      const down = order[d].slice(order[d].length - N);     // relegated to div d+1
      divs[d] = divs[d].filter(x => up.indexOf(x) < 0 && down.indexOf(x) < 0).concat(up);
      divs[d + 1] = divs[d + 1].filter(x => up.indexOf(x) < 0 && down.indexOf(x) < 0).concat(down);
    }

    // Where did the player end up?
    let newDiv = prevDiv;
    for (let d = 0; d < divs.length; d++) if (divs[d].indexOf("P") >= 0) newDiv = d;
    g.division = newDiv;
    g.club.tier = T.DIVISIONS[newDiv].tier;

    if (newDiv === prevDiv) return null;
    return {
      moved: newDiv < prevDiv ? "up" : "down",
      fromName: T.DIVISIONS[prevDiv].name,
      toName: T.DIVISIONS[newDiv].name,
    };
  };

  // ---- Season-opening events (the "spin") ----------------------------
  // A narrative situation at the start of a season with a choice that nudges
  // morale / form / fitness / training points. Pure data + a generic applier so
  // the UI stays dumb. `when(p,g)` gates which events are eligible.
  Prog.SEASON_EVENTS = [
    {
      id: "newManager", icon: "📋", title: "New Manager",
      text: "The board appoints a new manager with big ideas for the season.",
      options: [
        { label: "Buy into the project", desc: "Embrace the new philosophy.",
          effects: { morale: 8, form: 1 }, text: "You're energised by the new regime." },
        { label: "Keep your head down", desc: "Let your football do the talking.",
          effects: { training: 1 }, text: "You focus on your own game and put in the work." },
      ],
    },
    {
      id: "captaincy", icon: "🎖", title: "The Armband",
      when: (p, g) => p.age >= 24 || p.level >= 4,
      text: "The manager offers you the captain's armband.",
      options: [
        { label: "Wear it with pride", desc: "Lead the dressing room.",
          effects: { morale: 10, form: 2 }, text: "You lead from the front — the squad responds." },
        { label: "Lead quietly", desc: "Set the example without the title.",
          effects: { morale: 4, fitness: 3 }, text: "You let your standards speak instead." },
      ],
    },
    {
      id: "preseasonCamp", icon: "🏕", title: "Pre-Season Camp",
      text: "An intense pre-season training camp is on the schedule.",
      options: [
        { label: "Push to the limit", desc: "Bank the work, pay in fatigue.",
          effects: { training: 2, fitness: -4 }, text: "Brutal sessions — but you're sharper for it." },
        { label: "Balanced preparation", desc: "Build steadily into the season.",
          effects: { training: 1, fitness: 3 }, text: "A measured camp leaves you fresh and ready." },
      ],
    },
    {
      id: "injuryScare", icon: "🩹", title: "Pre-Season Knock",
      when: (p) => p.fitness < 96,
      text: "You pick up a knock in a friendly. The physios are cautious.",
      options: [
        { label: "Play through it", desc: "You don't want to lose your place.",
          effects: { fitness: -2, morale: 3 }, text: "You grit through it — the manager notes your steel." },
        { label: "Rest and recover", desc: "Take the time to heal properly.",
          effects: { fitness: 9, training: -1 }, text: "A proper rest — you come back fully fit." },
      ],
    },
    {
      id: "rivalryHype", icon: "🔥", title: "Rivalry Hype",
      text: "The media stoke a grudge match ahead of the season opener.",
      options: [
        { label: "Embrace the spotlight", desc: "Feed off the big-game energy.",
          effects: { morale: 6, form: 2 }, text: "You thrive on the noise — bring it on." },
        { label: "Tune out the noise", desc: "Stay ice-cold and focused.",
          effects: { morale: 3, fitness: 2 }, text: "You block it all out and prepare calmly." },
      ],
    },
    {
      id: "contractTalks", icon: "✍️", title: "Contract Talks",
      when: (p, g) => g.season >= 2,
      text: "The club table improved terms to keep you around.",
      options: [
        { label: "Sign the extension", desc: "Security and a vote of confidence.",
          effects: { morale: 9 }, text: "Pen to paper — the fans are delighted." },
        { label: "Hold out for more", desc: "Bet on yourself.",
          effects: { morale: 3, training: 1 }, text: "You back yourself and knuckle down." },
      ],
    },
    {
      id: "bootDeal", icon: "👟", title: "Boot Deal",
      when: () => T.overall() >= 70,
      text: "A boot sponsor comes calling with a flashy offer.",
      options: [
        { label: "Cash in", desc: "Enjoy the limelight.",
          effects: { morale: 7 }, text: "New boots, new buzz — you're loving life." },
        { label: "Stay hungry", desc: "Keep your edge.",
          effects: { form: 3 }, text: "You park the hype and sharpen your game." },
      ],
    },
    {
      id: "fanFavourite", icon: "💛", title: "Fans' Player of the Year",
      when: (p, g) => g.totals.goals >= 20,
      text: "The supporters' club names you their player of the year.",
      options: [
        { label: "Soak it up", desc: "You've earned this.",
          effects: { morale: 8 }, text: "The adoration lifts you — what a feeling." },
        { label: "Promise them more", desc: "Set the bar higher.",
          effects: { morale: 3, form: 2 }, text: "You vow to repay them with goals." },
      ],
    },
  ];

  // Roll a season-opening event (or null for a quiet pre-season).
  Prog.rollSeasonEvent = function () {
    if (T.rng() > (T.TUNING.SEASON_EVENT_CHANCE || 0.8)) return null;
    const g = T.game, p = g.player;
    const pool = Prog.SEASON_EVENTS.filter(e => !e.when || e.when(p, g));
    return pool.length ? T.pick(pool) : null;
  };

  // Apply a chosen option's effects; returns { text, fx:[{label,delta}] } for the UI.
  Prog.applyEvent = function (option) {
    const p = T.game.player, e = option.effects || {}, fx = [];
    if (e.morale) { p.morale = T.clamp(p.morale + e.morale, 0, 100); fx.push({ label: "Morale", delta: e.morale }); }
    if (e.form) { p.form = T.clamp(p.form + e.form, -10, 10); fx.push({ label: "Form", delta: e.form }); }
    if (e.fitness) { p.fitness = T.clamp(p.fitness + e.fitness, 0, 100); fx.push({ label: "Fitness", delta: e.fitness }); }
    if (e.training) { p.trainingPoints = Math.max(0, p.trainingPoints + e.training); fx.push({ label: "Training pts", delta: e.training }); }
    return { text: option.text, fx };
  };

  // ---- Transfers -----------------------------------------------------
  // After a season, a strong campaign attracts bigger clubs. Offers can be a
  // step UP the pyramid (join a club a division or two above) or a marquee
  // lateral move to a stronger club in the same division. Returns [] or offers
  // [{cid, division, type, blurb}]. Accepting adopts that club's identity.
  Prog.generateOffers = function (record) {
    const g = T.game, p = g.player;
    if (g.careerOver || !g.league) return [];

    // "Stock" — how attractive the player is right now.
    let stock = (record.rating - 6.5) * 12 + record.goals * 0.9 +
      (record.awards ? record.awards.length * 8 : 0);
    if (record.finish <= 3) stock += 6;
    if (p.age > 30) stock -= (p.age - 30) * 3;
    if (T.hasPerk("mercenary")) stock += 8;
    if (stock < 16) return [];

    const offers = [];
    const curDiv = g.division;
    const ladderDivOf = (cid) => g.league.divs.findIndex(arr => arr.indexOf(cid) >= 0);
    const strongIn = (d, n, minStr) => g.league.divs[d]
      .filter(e => typeof e === "number" && (minStr == null || T.CLUB_DB[e].str >= minStr))
      .sort((a, b) => T.CLUB_DB[b].str - T.CLUB_DB[a].str).slice(0, n);

    // Step up: a club from the division above (two above for elite stock).
    if (curDiv > 0) {
      const targetDiv = (stock > 36 && curDiv > 1) ? curDiv - 2 : curDiv - 1;
      const cands = strongIn(targetDiv, 6);
      if (cands.length) {
        const cid = T.pick(cands);
        offers.push({ cid, division: ladderDivOf(cid), type: "step-up",
          blurb: `${T.CLUB_DB[cid].name} of the ${T.DIVISIONS[targetDiv].name} want you as their marquee signing.` });
      }
    }
    // Marquee lateral: a bigger club in your own division.
    if (stock > 24) {
      const cands = strongIn(curDiv, 5, T.playerClubStr() + 5);
      if (cands.length) {
        const cid = T.pick(cands);
        offers.push({ cid, division: ladderDivOf(cid), type: "marquee",
          blurb: `${T.CLUB_DB[cid].name}, one of the ${T.DIVISIONS[curDiv].name}'s giants, come calling.` });
      }
    }
    return offers;
  };

  // Accept a transfer: the player adopts the target club's identity & division;
  // the club they leave becomes an AI side. Keeps every division at 20.
  Prog.acceptTransfer = function (offer) {
    const g = T.game;
    const targetCid = offer.cid;
    const targetDiv = g.league.divs.findIndex(arr => arr.indexOf(targetCid) >= 0);
    if (targetDiv < 0) return false;
    const oldDiv = g.division;
    const left = { name: g.club.name, str: T.clamp(T.CLUB_TIERS[g.club.tier].base, 25, 95) };
    if (targetDiv === oldDiv) {
      g.league.divs[oldDiv] = g.league.divs[oldDiv].map(x => x === "P" ? left : (x === targetCid ? "P" : x));
    } else {
      g.league.divs[oldDiv] = g.league.divs[oldDiv].map(x => x === "P" ? left : x);
      g.league.divs[targetDiv] = g.league.divs[targetDiv].map(x => x === targetCid ? "P" : x);
    }
    g.club.name = T.CLUB_DB[targetCid].name;
    g.division = targetDiv;
    g.club.tier = T.DIVISIONS[targetDiv].tier;
    g.totals.clubsPlayedFor = (g.totals.clubsPlayedFor || 1) + 1;
    return true;
  };
})();
