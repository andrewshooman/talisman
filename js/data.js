/* ============================================================
   TALISMAN — data.js
   Static game data: positions, stats, club tiers, perks, events,
   nations, and tuning constants. No game logic here.

   Everything hangs off the global namespace window.TALISMAN (alias T).
   ============================================================ */
(function () {
  const T = (window.TALISMAN = window.TALISMAN || {});

  // ---- Meta ----
  T.VERSION = "0.1.0";
  T.SAVE_KEY = "talisman.save.v1";
  T.START_AGE = 17;
  T.SEASON_GAMES = 38;

  // ---- Positions ------------------------------------------------------
  // FIRST BUILD: FWD only. GK/DEF/MID are scaffolded for later phases.
  // Each position lists its 5 role stats (keys + display labels).
  T.POSITIONS = {
    FWD: {
      label: "Forward",
      stats: ["finishing", "pace", "dribbling", "positioning", "physical"],
      prime: 28, // age of peak
    },
    // --- Later phases (do not build yet) ---
    MID: {
      label: "Midfielder",
      stats: ["passing", "vision", "stamina", "dribbling", "shooting"],
      prime: 29,
      locked: true,
    },
    DEF: {
      label: "Defender",
      stats: ["tackling", "marking", "heading", "positioning", "passing"],
      prime: 30,
      locked: true,
    },
    GK: {
      label: "Goalkeeper",
      stats: ["reflexes", "handling", "positioning", "distribution", "composure"],
      prime: 31,
      locked: true,
    },
  };

  // Human-readable stat labels (shared across positions)
  T.STAT_LABELS = {
    finishing: "Finishing",
    pace: "Pace",
    dribbling: "Dribbling",
    positioning: "Positioning",
    physical: "Physical",
    passing: "Passing",
    vision: "Vision",
    stamina: "Stamina",
    shooting: "Shooting",
    tackling: "Tackling",
    marking: "Marking",
    heading: "Heading",
    reflexes: "Reflexes",
    handling: "Handling",
    distribution: "Distribution",
    composure: "Composure",
  };

  // ---- Club tiers -----------------------------------------------------
  // Tier 1 = hardest start (small club) -> biggest legacy multiplier.
  // Tier 5 = elite club -> smallest multiplier.
  // base = team base quality used by the sim engine.
  T.CLUB_TIERS = {
    1: { label: "Lower League",   base: 45, legacyMult: 1.6 },
    2: { label: "Mid-Table",      base: 55, legacyMult: 1.35 },
    3: { label: "Establishment",  base: 65, legacyMult: 1.15 },
    4: { label: "Contender",      base: 75, legacyMult: 1.0 },
    5: { label: "Super Club",     base: 85, legacyMult: 0.85 },
  };

  // ---- Perks ----------------------------------------------------------
  // Each perk hooks a real calculation. `apply` hints document intent;
  // the actual effects live in engine/moments/progression (see TODOs there).
  T.PERKS = {
    clutch:       { name: "Clutch",         desc: "+ key-moment rolls in big games." },
    bigGame:      { name: "Big-Game Player",desc: "Bonus output & rolls in finals/derbies." },
    engine:       { name: "Engine",         desc: "Slower fitness decay; strong late-season." },
    ironMan:      { name: "Iron Man",       desc: "Lower injury chance." },
    glassCannon:  { name: "Glass Cannon",   desc: "+ output, but higher injury risk." },
    leader:       { name: "Leader",         desc: "+ morale and team finish." },
    loyal:        { name: "Loyal",          desc: "Legacy bonus for staying one club." },
    mercenary:    { name: "Mercenary",      desc: "More/bigger offers; variety legacy bonus." },
    wonderkid:    { name: "Wonderkid",      desc: "Faster stat growth while young." },
    injuryProne:  { name: "Injury-Prone",   desc: "(Acquired) higher injury risk.", negative: true },
  };

  // ---- Legacy ranking tiers (ascending) ------------------------------
  T.LEGACY_TIERS = [
    { name: "Squad Player", min: 0 },
    { name: "Cult Hero",    min: 250 },
    { name: "Star",         min: 600 },
    { name: "Legend",       min: 1200 },
    { name: "Immortal",     min: 2200 },
    { name: "GOAT",         min: 3600 },
  ];

  // ---- Fictional flavor data (legally clean: no real names/crests) ----
  T.NATIONS = [
    "Alberia", "Brandia", "Castellia", "Drenmark", "Eshova", "Farland",
    "Goyana", "Helvania", "Itralia", "Korvia", "Lusitia", "Montara",
    "Norvik", "Ostmark", "Pelagia", "Quetza", "Rhodia", "Solterra",
    "Tavora", "Ustria", "Vendar", "Wessel", "Yundai", "Zephra",
  ];

  // Generic club names by tier feel; engine picks/levels these later.
  T.CLUB_NAMES = [
    "Athletic", "United", "City", "Rovers", "Wanderers", "Albion",
    "Sporting", "Dynamo", "Real", "Inter", "Olympic", "Forest",
    "County", "Town", "Borough", "Harbour", "Vale", "Park",
  ];
  T.CLUB_PLACES = [
    "Ashford", "Brockton", "Calder", "Dunmore", "Elmsworth", "Fenwick",
    "Granby", "Hollow", "Ironbridge", "Kestrel", "Larkfield", "Mercia",
    "Norbury", "Oldgate", "Pendle", "Riverton", "Stonely", "Thornwood",
  ];

  // Player first/last name pools (generic).
  T.FIRST_NAMES = [
    "Leo", "Marco", "Diego", "Kai", "Noah", "Mateo", "Jude", "Ravi",
    "Tariq", "Yuto", "Andre", "Felix", "Otis", "Bruno", "Niko", "Eden",
  ];
  T.LAST_NAMES = [
    "Vance", "Moreno", "Sato", "Okafor", "Lindqvist", "Romano", "Haas",
    "Petrov", "Costa", "Bauer", "Nyari", "Sol", "Verra", "Kane-Doe",
  ];

  // ---- Tuning constants for the sim engine (see engine.js) ------------
  T.TUNING = {
    MAX_GOALS: 30,        // soft cap for a god-tier striker season
    MAX_ASSISTS: 18,
    BASE_INJURY_CHANCE: 0.12,    // per season, before modifiers
    CAREER_END_INJURY_CHANCE: 0.015, // rare catastrophic
    XP_PER_LEVEL: 100,
    KEY_MOMENTS_PER_SEASON: 4,   // 3-5
  };
})();
