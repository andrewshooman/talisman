/* ============================================================
   TALISMAN — data.js
   Static game data: positions, stats, club tiers, perks, events,
   nations, and tuning constants. No game logic here.

   Everything hangs off the global namespace window.TALISMAN (alias T).
   ============================================================ */
(function () {
  const T = (window.TALISMAN = window.TALISMAN || {});

  // ---- Meta ----
  T.VERSION = "0.14.0";
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
    LEAGUE:   { label: "League", tone: "pop" },
    DERBY:    { label: "Derby", tone: "pop" },
    CUP:      { label: "Cup Tie", tone: "gold" },
    FINAL:    { label: "Cup Final", tone: "gold" },
    INTL:     { label: "International", tone: "gold" },
    WORLDCUP: { label: "World Cup", tone: "gold" },
    MEDIA:    { label: "Press", tone: "muted" },
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
    worldCup:    { name: "World Cup Winner",          icon: "🌐", desc: "Lifted the World Cup with your nation." },
  };

  // ---- Legacy ranking tiers (ascending) ------------------------------
  // Recalibrated against ~1200 fully-integrated simulated careers (events + 8 key
  // moments + pro/rel; see PROJECT_NOTES tuning log, 2026-06-22 #2): a well-played
  // career lands ~Legend median, Immortal ~top 18%, GOAT ~top 3-4%.
  T.LEGACY_TIERS = [
    { name: "Squad Player", min: 0 },
    { name: "Cult Hero",    min: 1800 },
    { name: "Star",         min: 3400 },
    { name: "Legend",       min: 4700 },
    { name: "Immortal",     min: 5900 },
    { name: "GOAT",         min: 7000 },
  ];

  // ---- League pyramid (English-style, legally distinct) ---------------
  // Four divisions, ~20 clubs each. Names are fictional but evoke real clubs
  // via city + stable colour + nickname so fans recognise the analogue — no
  // real names, crests, kits or competition logos are used. `tier` is the
  // effective club tier (strength/legacy feel) while a club sits in a division.
  T.DIVISIONS = [
    { name: "Prime League",     short: "Prime",  tier: 4 },
    { name: "The Championship", short: "Champ",  tier: 3 },
    { name: "League One",       short: "Lg One", tier: 2 },
    { name: "League Two",       short: "Lg Two", tier: 1 },
  ];

  // Each row: [name, strength(25..95), primaryHue, nickname, opt?]
  //   opt.w = predominantly white kit · opt.d = dark/black kit
  //   opt.sec = explicit secondary hue (two-tone clubs)
  const PRIME = [
    ["Manchester Crimson", 90, 2,   "Red Devils"],
    ["Manchester Azure", 91, 200,   "Sky Blues"],
    ["Mersey Red", 90, 0,           "The Kop"],
    ["Mersey Toffees", 76, 222,     "The Toffees"],
    ["North London Cannons", 88, 4, "The Gunners", { sec: 30 }],
    ["Tottenham Cockerels", 80, 230,"Lilywhites", { w: 1, sec: 230 }],
    ["West London Blues", 87, 222,  "The Pensioners"],
    ["East London Hammers", 75, 345,"The Irons", { sec: 200 }],
    ["Tyneside Magpies", 80, 210,   "The Toon", { d: 1 }],
    ["Birmingham Claret", 79, 345,  "The Villans", { sec: 200 }],
    ["Wolverton Gold", 70, 45,      "Wolves", { sec: 0 }],
    ["South Coast Gulls", 73, 205,  "Seagulls"],
    ["South London Eagles", 68, 222,"The Eagles", { sec: 0 }],
    ["Brentside Bees", 67, 2,       "The Bees", { sec: 50 }],
    ["Thames Cottagers", 66, 210,   "Cottagers", { w: 1, sec: 0 }],
    ["Trentside Forest", 69, 2,     "Tricky Trees"],
    ["Leyfield Foxes", 67, 222,     "The Foxes"],
    ["Solent Saints", 65, 2,        "The Saints", { w: 1, sec: 2 }],
    ["Yorkshire Whites", 70, 210,   "The Whites", { w: 1 }],
    ["Southbourne Cherries", 64, 353,"The Cherries", { d: 1, sec: 353 }],
  ];
  const CHAMP = [
    ["Wearside Cats", 73, 2,        "Black Cats", { w: 1, sec: 2 }],
    ["Steel City Owls", 70, 222,    "The Owls", { w: 1, sec: 222 }],
    ["Steel City Blades", 71, 2,    "The Blades"],
    ["Teesside Reds", 69, 2,        "Boro"],
    ["Norfolk Canaries", 68, 50,    "Canaries", { sec: 140 }],
    ["Hertford Hornets", 66, 48,    "Hornets", { sec: 0 }],
    ["Potters Vale", 64, 2,         "The Potters", { w: 1, sec: 2 }],
    ["Severnside Robins", 63, 2,    "The Robins"],
    ["Cardibay Bluebirds", 65, 218, "Bluebirds"],
    ["Swansea Swans", 64, 200,      "The Swans", { w: 1 }],
    ["Humberside Tigers", 62, 38,   "The Tigers", { d: 1 }],
    ["Deepdale Lilies", 60, 210,    "Lilywhites", { w: 1, sec: 230 }],
    ["Blackmoor Rovers", 61, 222,   "Rovers", { w: 1, sec: 222 }],
    ["Coventry Sky", 63, 200,       "Sky Blues"],
    ["West London Hoops", 59, 222,  "The Hoops", { w: 1, sec: 222 }],
    ["Docklands Lions", 58, 225,    "The Lions"],
    ["Brumfield Blues", 62, 222,    "Blues"],
    ["Black Country Baggies", 64, 230,"Baggies", { w: 1, sec: 230 }],
    ["Bedford Hatters", 60, 28,     "The Hatters"],
    ["Derwent Rams", 61, 210,       "The Rams", { w: 1 }],
  ];
  const LGONE = [
    ["Portsea Pompey", 58, 215,     "Pompey"],
    ["Border Dragons", 60, 0,       "Red Dragons"],
    ["Boltby Trotters", 56, 210,    "Trotters", { w: 1 }],
    ["Charlford Addicks", 55, 2,    "The Addicks"],
    ["Suffolk Tractors", 59, 218,   "Tractor Boys", { w: 1, sec: 218 }],
    ["Latical Athletic", 53, 222,   "Latics"],
    ["Barnswick Tykes", 54, 2,      "The Tykes"],
    ["Oxbridge United", 52, 45,     "The U's", { sec: 222 }],
    ["Royal Berks", 55, 218,        "The Royals", { w: 1, sec: 218 }],
    ["Fenland Posh", 53, 225,       "The Posh"],
    ["Plymsea Pilgrims", 54, 150,   "The Pilgrims"],
    ["Wessex Glovers", 50, 150,     "The Glovers"],
    ["Shropvale Town", 51, 40,      "Shrews", { d: 1 }],
    ["Lincanshire Imps", 50, 2,     "The Imps"],
    ["Burton Brewers", 49, 50,      "Brewers"],
    ["Cambria City", 52, 222,       "City"],
    ["Wycombe Chairboys", 50, 225,  "Chairboys", { sec: 200 }],
    ["Fleetwick Town", 48, 0,       "Cod Army"],
    ["Rothervale Millers", 51, 2,   "The Millers"],
    ["Stevenidge Boro", 49, 2,      "Boro"],
  ];
  const LGTWO = [
    ["Bradvale Bantams", 50, 345,   "The Bantams", { sec: 45 }],
    ["Nottswick Pies", 48, 210,     "The Magpies", { d: 1 }],
    ["Stockfield Hatters", 49, 222, "The Hatters"],
    ["Grimsby Mariners", 47, 222,   "The Mariners", { w: 1, sec: 222 }],
    ["Tranfield Rovers", 46, 200,   "Rovers", { w: 1 }],
    ["Walsea Saddlers", 45, 2,      "The Saddlers"],
    ["Crewdon Railwaymen", 46, 0,   "Railwaymen"],
    ["Gillingdon Gills", 44, 222,   "The Gills"],
    ["Mansvale Stags", 47, 40,      "The Stags"],
    ["Colchurch United", 43, 218,   "The U's", { w: 1, sec: 218 }],
    ["Newgate Exiles", 44, 40,      "The Exiles"],
    ["Salterford Reds", 48, 2,      "The Reds"],
    ["Doncrest Rovers", 45, 2,      "Donny", { w: 1, sec: 2 }],
    ["Harrowgate Town", 42, 50,     "Town"],
    ["Morefield Shrimps", 41, 18,   "The Shrimps"],
    ["Swinton Robins", 44, 2,       "The Robins"],
    ["Accardale Stanley", 43, 0,    "Stanley"],
    ["Bromfield Ravens", 42, 210,   "The Ravens", { d: 1 }],
    ["Wimbourne Dons", 46, 222,     "The Dons", { sec: 52 }],
    ["Carlavon Cumbrians", 40, 218, "The Cumbrians"],
  ];

  // Flatten into a single club table; index = clubId. Stable across careers.
  T.CLUB_DB = [];
  [PRIME, CHAMP, LGONE, LGTWO].forEach((rows, div) => {
    rows.forEach(r => T.CLUB_DB.push({
      name: r[0], div, str: r[1], hue: r[2], nick: r[3], opt: r[4] || {},
    }));
  });

  // Deterministic colour identity per named club, keyed by club name so all
  // of visuals.js (crest/kit/flag) renders the same colours every time.
  function clubPalette(hue, opt) {
    const s = opt.w ? 14 : opt.d ? 0 : 62;
    const l = opt.w ? 88 : opt.d ? 15 : 46;
    const ink = opt.w ? "#0a0a0f" : "#f5f5f7";
    const sh = opt.sec != null ? opt.sec : (hue + 150) % 360;
    return {
      primary: `hsl(${hue} ${s}% ${l}%)`,
      primaryDark: `hsl(${hue} ${Math.max(s - 6, 0)}% ${Math.max(l - 14, 8)}%)`,
      secondary: `hsl(${sh} 58% 52%)`,
      ink, hue,
    };
  }
  T.CLUB_COLORS = {};   // name -> palette (used by V.palette override)
  T.CLUB_NICK = {};     // name -> nickname
  T.CLUB_DB.forEach(c => {
    T.CLUB_COLORS[c.name] = clubPalette(c.hue, c.opt);
    T.CLUB_NICK[c.name] = c.nick;
  });

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
    MAX_GOALS: 27,        // soft cap for a god-tier striker season (key moments add more)
    MAX_ASSISTS: 16,
    BASE_INJURY_CHANCE: 0.12,    // per season, before modifiers
    CAREER_END_INJURY_CHANCE: 0.015, // rare catastrophic
    XP_PER_LEVEL: 100,
    KEY_MOMENTS_PER_SEASON: 8,   // more player control: a decisive moment in many games
    PROMOTE_COUNT: 3,            // top/bottom N go up/down each season
    SEASON_EVENT_CHANCE: 0.8,    // chance of a season-opening "spin" event
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
    { term: "Match Rating", text: "Your average performance score out of 10 across the season, built from your goals, assists and results. It's the engine of progression: higher ratings earn more XP (faster level-ups and training points), put you in contention for Player of the Season, and your career-best (peak) rating adds a bonus to your final Legacy Score." },
    { term: "Training", text: "Spend training points to raise attributes. The Train screen shows a live projection of how your changes move your expected goals, assists and rating before you commit." },
    { term: "Key Moments", text: "A few matches each season pause on a decisive chance. Pick an action, play the skill mini-game, and the outcome is added to THAT match — it can turn a draw into a win and shift the table." },
    { term: "Mini-games", text: "Timing bar (strike on the gold zone), Aim target (place your shot), Reaction tap (beat the cue), Dribble dodge (weave past defenders), One-on-one (beat the onrushing keeper), Free kick (set power then curl it over the wall), Give & go (a three-tap one-two rhythm). Higher attributes make them more forgiving." },
    { term: "Perks", text: "Chosen on level-up, perks shape your identity — e.g. Clutch (better in key moments), Glass Cannon (more output, more injuries), Leader (lifts the team). They change the maths." },
    { term: "Awards & Call-Ups", text: "Strong seasons earn individual honours — Golden Boot (top scorer), Playmaker, Player (and Young Player) of the Season — plus a first national call-up and growing caps. Awards grant bonus XP and are weighted heavily in your Legacy Score." },
    { term: "Pre-Season Events", text: "Most seasons open with a situation — a new manager, the captain's armband, a pre-season camp, contract talks, a knock — and your choice nudges your morale, form, fitness or training points heading into the campaign." },
    { term: "Promotion & Relegation", text: "You play in a four-division English-style pyramid (Prime League → Championship → League One → League Two). Finish in the top three and you go up; bottom three and you go down — and the clubs around you move too. Climbing the pyramid is the heart of a great career." },
    { term: "Transfers", text: "A strong season turns heads. In the transfer window you may get offers to join a bigger club — a step up the pyramid or a marquee move — and you adopt that club's name, colours and division. Move on to climb faster, or stay loyal and build your story at one club." },
    { term: "Cups & The World Cup", text: "Beyond the league you get cup runs — win the final to lift the Domestic Cup. Once you earn a national call-up, you'll play international games, and every fourth season is a World Cup: win the final and you're a World Cup Winner, one of the rarest honours of all. Cup and international moments aren't league games, so they don't change the table — but the silverware shapes your legacy." },
    { term: "Legacy Score & Tiers", text: "Your career score: goals, assists, trophies, peak rating, longevity, your international caps, and a loyalty bonus, all multiplied by your starting difficulty. It ranks you Squad Player → Cult Hero → Star → Legend → Immortal → GOAT." },
    { term: "Loyalty vs Journeyman", text: "How you build your career counts. Spend it all at one club to become a One-Club Legend (boosted by the Loyal perk), or move around to become a Journeyman/Globetrotter (boosted by the Mercenary perk). Each path earns its own legacy bonus, and your career-shape archetype is revealed when you retire." },
    { term: "Hall of Fame & Sharing", text: "Every finished career is saved to your local Hall of Fame and ranked by Legacy Score. Share a career code with friends, or paste theirs in to compare. The Daily Challenge gives everyone the same starting career to compete on fairly." },
  ];
})();
