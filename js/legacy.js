/* ============================================================
   TALISMAN — legacy.js
   End-of-career scoring: weighted Legacy Score + ranking tier.

   Current status: BASIC working version (FWD weighting). Tune weights
   and add role-specific branches (GK/DEF) in later phases.

   Done since: awards weighting, international caps, and the loyalty / journeyman
   fork (one-club vs well-travelled, amplified by the loyal/mercenary perks) +
   a retirement archetype label.

   TODO (future sessions):
     - Role-adjusted output (GK saves/clean sheets, DEF def-rating).
     - "Defining moments" extraction for the summary screen.
   ============================================================ */
(function () {
  const T = window.TALISMAN;
  const Legacy = (T.Legacy = {});

  Legacy.compute = function () {
    const g = T.game;
    const t = g.totals;
    const startTier = (g.history[0] && g.history[0].clubTier) || g.club.tier;
    const diffMult = T.CLUB_TIERS[startTier].legacyMult;

    // FWD-weighted output. (Branch by position in later phases.)
    const caps = (g.player && g.player.caps) || 0;
    const output =
      t.goals * 4 +
      t.assists * 2.5 +
      t.trophies * 60 +
      t.awards * 80 +
      caps * 1.2;                                // international career counts

    const peak = (t.peakRating - 6) * 120;       // reward a high ceiling
    const longevity = g.history.length * 18;     // seasons played

    // Loyalty vs journeyman: one-club careers and well-travelled careers each
    // earn their own bonus, amplified by the loyal / mercenary perks.
    const clubs = t.clubsPlayedFor || 1;
    const seasons = g.history.length;
    const loyal = T.hasPerk("loyal"), merc = T.hasPerk("mercenary");
    let loyalty;
    if (clubs === 1) {
      loyalty = seasons * (loyal ? 16 : 7);                 // stayed your whole career
    } else {
      loyalty = (clubs - 1) * (merc ? 40 : 13);             // variety across clubs
      if (loyal) loyalty += seasons * 3;                    // loyal-leaning, but did move
    }
    loyalty = Math.round(T.clamp(loyalty, 0, 420));

    const raw = (output + peak + longevity + loyalty);
    const score = Math.round(raw * diffMult);

    return {
      score,
      tier: Legacy.tierFor(score),
      breakdown: { output: Math.round(output), peak: Math.round(peak),
                   longevity, loyalty, caps, clubs, diffMult, startTier },
    };
  };

  // A career-shape label for the retirement screen (one-club vs journeyman).
  Legacy.archetype = function () {
    const g = T.game, clubs = (g.totals.clubsPlayedFor || 1), seasons = g.history.length;
    if (clubs === 1 && seasons >= 6) return { name: "One-Club Legend", icon: "🛡️", blurb: "A whole career at one club — the supporters will never forget you." };
    if (clubs >= 5) return { name: "Globetrotter", icon: "🌍", blurb: "You wrote your story across the game, club by club." };
    if (clubs >= 3) return { name: "Journeyman", icon: "🧳", blurb: "A well-travelled career, leaving your mark wherever you went." };
    if (clubs === 1) return { name: "One-Club Man", icon: "🛡️", blurb: "Loyal to the badge from start to finish." };
    return { name: "Settled Pro", icon: "⚽", blurb: "A steady career with a move or two along the way." };
  };

  Legacy.tierFor = function (score) {
    let tier = T.LEGACY_TIERS[0];
    for (const lt of T.LEGACY_TIERS) if (score >= lt.min) tier = lt;
    return tier.name;
  };
})();
