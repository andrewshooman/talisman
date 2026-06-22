/* ============================================================
   TALISMAN — legacy.js
   End-of-career scoring: weighted Legacy Score + ranking tier.

   Current status: BASIC working version (FWD weighting). Tune weights
   and add role-specific branches (GK/DEF) in later phases.

   TODO (future sessions):
     - Role-adjusted output (GK saves/clean sheets, DEF def-rating).
     - Loyalty (one-club) vs journeyman variety bonus.
     - Awards weighting once awards exist.
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

    const raw = (output + peak + longevity);
    const score = Math.round(raw * diffMult);

    return {
      score,
      tier: Legacy.tierFor(score),
      breakdown: { output: Math.round(output), peak: Math.round(peak),
                   longevity, caps, diffMult, startTier },
    };
  };

  Legacy.tierFor = function (score) {
    let tier = T.LEGACY_TIERS[0];
    for (const lt of T.LEGACY_TIERS) if (score >= lt.min) tier = lt;
    return tier.name;
  };
})();
