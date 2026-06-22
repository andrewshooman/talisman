/* ============================================================
   TALISMAN — data.js
   Static game data: positions, stats, club tiers, perks, events,
   nations, and tuning constants. No game logic here.

   Everything hangs off the global namespace window.TALISMAN (alias T).
   ============================================================ */
(function () {
  const T = (window.TALISMAN = window.TALISMAN || {});

  // ---- Meta ----
  T.VERSION = "0.6.0";
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

  // ---- Competitions (context for key moments) ------------------------
  T.COMPETITIONS = {
    LEAGUE: { label: "League", tone: "pop" },
    DERBY:  { label: "Derby", tone: "pop" },
    CUP:    { label: "Cup Tie", tone: "gold" },
    FINAL:  { label: "Cup Final", tone: "gold" },
    MEDIA:  { label: "Press", tone: "muted" },
  };

  // ---- Awards & national call-ups ------------------------------------
  // Earned at season end from performance (see Prog.rollAwards). Each one
  // counts toward totals.awards, which the Legacy score weights heavily.
  T.AWARDS = {
    goldenBoot:  { name: "Golden Boot",               icon: "🥇", desc: "Top scorer in the league." },
    playmaker:   { name: "Playmaker of the Season",   icon: "🅰", desc: "Most assists in the league." },
    pots:        { name: "Player of the Season",      icon: "🏆", desc: "The league's standout performer." },
    youngPlayer: { name: "Young Player of the Season", icon: "🌟", desc: "Best player aged 21 or under." },
    callUp:      { name: "International Call-Up",      icon: "🌍", desc: "Named in your national squad for the first time." },
    intlStar:    { name: "International of the Year",  icon: "🎖", desc: "Your nation's standout player." },
  };

  // ---- Legacy ranking tiers (ascending) ------------------------------
  // Calibrated against ~1500 simulated near-optimal careers (see PROJECT_NOTES
  // tuning log, 2026-06-22): median strong career ~Legend, Immortal ~top 15%,
  // GOAT ~top 1-2% — so the top tiers are a genuine achievement, not the default.
  T.LEGACY_TIERS = [
    { name: "Squad Player", min: 0 },
    { name: "Cult Hero",    min: 1200 },
    { name: "Star",         min: 2400 },
    { name: "Legend",       min: 3600 },
    { name: "Immortal",     min: 4600 },
    { name: "GOAT",         min: 5500 },
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

  // ---- Glossary: plain-language help for every mechanic ---------------
  T.GLOSSARY = [
    { term: "The Season (38 games)", text: "Your league has 20 clubs; everyone plays everyone twice — that's 38 matchdays. Every match is simulated and shown game-by-game, and the standings decide your finish and the title." },
    { term: "Club Tier (1–5)", text: "How strong your club is. Tier 5 is an elite, title-chasing side; Tier 1 is a lower-league battler. Starting lower is harder but multiplies your final Legacy Score." },
    { term: "Overall (OVR)", text: "The average of your five attributes — a quick read on how good your striker is right now." },
    { term: "Attributes", text: "Finishing (scoring), Pace (speed), Dribbling (beating defenders), Positioning (movement & passing), Physical (strength & aerials). Higher attributes mean more goals/assists and easier key-moment skill games." },
    { term: "Form", text: "A volatile, per-season modifier (-10 to +10). Good runs and good morale lift it; it boosts (or drags) your output and key-moment rolls." },
    { term: "Morale", text: "How happy you are (0–100). Scoring in big moments lifts it; failures and poor seasons lower it. It feeds into your form." },
    { term: "Fitness", text: "Your condition (0–100). Low fitness means you miss more matches (fewer appearances) and score less. Injuries cut it; resting recovers it." },
    { term: "Training", text: "Spend training points to raise attributes. The Train screen shows a live projection of how your changes move your expected goals, assists and rating before you commit." },
    { term: "Key Moments", text: "A few matches each season pause on a decisive chance. Pick an action, play the skill mini-game, and the outcome is added to THAT match — it can turn a draw into a win and shift the table." },
    { term: "Mini-games", text: "Timing bar (strike on the gold zone), Aim target (place your shot), Reaction tap (beat the cue), Dribble dodge (weave past defenders), One-on-one (beat the onrushing keeper). Higher attributes make them more forgiving." },
    { term: "Perks", text: "Chosen on level-up, perks shape your identity — e.g. Clutch (better in key moments), Glass Cannon (more output, more injuries), Leader (lifts the team). They change the maths." },
    { term: "Awards & Call-Ups", text: "Strong seasons earn individual honours — Golden Boot (top scorer), Playmaker, Player (and Young Player) of the Season — plus a first national call-up and growing caps. Awards grant bonus XP and are weighted heavily in your Legacy Score." },
    { term: "Legacy Score & Tiers", text: "Your career score: goals, assists, trophies, peak rating and longevity, all multiplied by your starting difficulty. It ranks you Squad Player → Cult Hero → Star → Legend → Immortal → GOAT." },
    { term: "Hall of Fame & Sharing", text: "Every finished career is saved to your local Hall of Fame and ranked by Legacy Score. Share a career code with friends, or paste theirs in to compare. The Daily Challenge gives everyone the same starting career to compete on fairly." },
  ];
})();
