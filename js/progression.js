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
    // Benchmarks are a genuine title-race number so honours stay rare & earned.
    const rivalGoals = T.randInt(24, 32) + (record.clubTier - 3);
    const rivalAssists = T.randInt(15, 21);
    if (record.goals >= rivalGoals) awards.push("goldenBoot");
    if (record.assists >= rivalAssists) awards.push("playmaker");

    // Player of the Season — elite average rating + a top-3 finish, or the title.
    const wonTitle = record.trophies.includes("League Title");
    const potsBar = T.hasPerk("bigGame") ? 7.5 : 7.65;
    if ((record.rating >= potsBar && record.finish <= 3) || (wonTitle && record.rating >= 7.4)) {
      awards.push("pots");
    }

    // Young Player of the Season — standout under-22.
    if (p.age <= 21 && (record.goals >= 18 || record.assists >= 13 || record.rating >= 7.4)) {
      awards.push("youngPlayer");
    }

    // National team: first call-up, then accumulating caps and an outstanding-year gong.
    p.caps = p.caps || 0;
    const intlReady = ovr >= 74 || record.goals >= 16 || awards.length > 0;
    if (intlReady) {
      if (p.caps === 0) awards.push("callUp");
      p.caps += T.clamp(Math.round(record.apps / 5), 2, 9);
      if (record.rating >= 7.85 && (record.goals >= 24 || record.trophies.length >= 2)) {
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

    const strOf = (x) => x === "P"
      ? (T.CLUB_TIERS[g.club.tier].base + (T.overall() - 60) * 0.2)
      : T.CLUB_DB[x].str;

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

  // TODO: Prog.generateOffers(record) -> [ {club, tier} ] based on perf.
  Prog.generateOffers = function () { return []; };
})();
