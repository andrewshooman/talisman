/* ============================================================
   TALISMAN — ui.js
   Screen router + rendering. Mobile-first, one-screen flows.
   Screens: title -> create -> hub -> season (moments) -> results
            -> retirement. State lives in T.game; UI re-renders from it.

   Current status: WORKING skeleton that plays the full FWD loop with
   first-pass content. Lots of TODO hooks for polish & new screens.

   TODO (future sessions):
     - Spin/event screen (transfer offers, manager change, rivalry...).
     - Train screen: spend trainingPoints across stats + perk pick.
     - Richer results & feedback (offers, awards, call-ups).
     - Juice: trophy confetti, rating count-up, sound (optional).
     - Career timeline / trophy cabinet on retirement.
   ============================================================ */
(function () {
  const T = window.TALISMAN;
  const UI = (T.UI = {});
  const app = () => document.getElementById("app");
  const el = (html) => { const d = document.createElement("div"); d.innerHTML = html; return d.firstElementChild; };
  const lbl = (k) => T.STAT_LABELS[k] || k;

  // Simple screen router
  UI.show = function (screen, data) {
    const root = app();
    root.innerHTML = "";
    const node = (UI.screens[screen] || UI.screens.title)(data);
    node.classList.add("screen");
    root.appendChild(node);
  };

  UI.screens = {};

  // ---- Title ----------------------------------------------------------
  UI.screens.title = function () {
    const wrap = el(`<div class="col"></div>`);
    wrap.innerHTML = `
      <div style="height:4vh"></div>
      <div class="brand pop-in">TALISMAN</div>
      <div class="tagline">Live a striker's whole career.</div>
      <div class="hero">${T.Minigames.scene("goal")}</div>
      <div class="col">
        <button class="btn primary" id="new">New Career</button>
        ${T.hasSave() ? `<button class="btn" id="continue">Continue</button>` : ``}
        <button class="btn" id="daily">⚡ Daily Challenge</button>
        <div class="btn-row">
          <button class="btn ghost" id="hof">🏅 Hall of Fame</button>
          <button class="btn ghost" id="help">How to Play</button>
        </div>
      </div>
      <div class="spacer"></div>
      <div class="center muted" style="font-size:12px">v${T.VERSION} · fictional clubs & players · no real branding</div>
    `;
    wrap.querySelector("#new").onclick = () => UI.show("create");
    const cont = wrap.querySelector("#continue");
    if (cont) cont.onclick = () => { if (T.load()) { T.game.careerOver ? UI.show("retirement") : UI.enterSeason(); } };
    wrap.querySelector("#daily").onclick = () => UI.startDaily();
    wrap.querySelector("#hof").onclick = () => UI.show("halloffame");
    wrap.querySelector("#help").onclick = () => UI.show("glossary", { from: "title" });
    return wrap;
  };

  // Daily Challenge: a deterministic career start shared by everyone today.
  UI.startDaily = function () {
    const seed = T.dailySeed();
    const r = T.makeRng(seed);
    const pick = (arr) => arr[Math.floor(r() * arr.length)];
    const opts = {
      seed,
      name: `${pick(T.FIRST_NAMES)} ${pick(T.LAST_NAMES)}`,
      nation: pick(T.NATIONS),
      position: "FWD",
      clubTier: 1 + Math.floor(r() * 5),
      clubName: r() < 0.5 ? `${pick(T.CLUB_PLACES)} ${pick(T.CLUB_NAMES)}` : `${pick(T.CLUB_NAMES)} ${pick(T.CLUB_PLACES)}`,
    };
    T.newGame(opts);
    T.game.daily = T.todayKey();
    T.save();
    UI.enterSeason();
  };

  // ---- Player creation (FWD) -----------------------------------------
  UI.screens.create = function () {
    const draft = { name: "", nation: T.NATIONS[0], position: "FWD", clubTier: 2, clubName: T.randomClubName(), number: 9 };
    const wrap = el(`<div class="col"></div>`);

    wrap.innerHTML = `
      <h2>Create your striker</h2>
      <div id="cardPreview"></div>
      <div class="card col">
        <div class="field">
          <label>Name</label>
          <input id="name" type="text" placeholder="Leave blank for random" />
        </div>
        <div class="field">
          <label>Nation</label>
          <select id="nation">${T.NATIONS.map(n => `<option>${n}</option>`).join("")}</select>
        </div>
        <div class="field">
          <label>Club</label>
          <div class="row" style="gap:8px">
            <div class="crest-inline" id="clubCrest"></div>
            <b id="clubName" class="grow"></b>
            <button class="btn ghost" id="rerollClub" style="width:auto;min-height:40px;padding:0 14px">↻</button>
          </div>
        </div>
        <div class="field">
          <label>Position</label>
          <div class="seg" id="pos">
            ${Object.entries(T.POSITIONS).map(([k, v]) =>
              `<div class="opt ${k === 'FWD' ? 'active' : ''} ${v.locked ? 'locked' : ''}"
                    data-k="${k}" ${v.locked ? 'style="opacity:.4"' : ''}>${k}</div>`).join("")}
          </div>
          <div class="muted" style="font-size:12px;margin-top:6px">Only Forward is playable in this build.</div>
        </div>
        <div class="field">
          <label>Starting club tier — lower = harder start, bigger legacy</label>
          <div class="seg" id="tier">
            ${Object.entries(T.CLUB_TIERS).map(([k, v]) =>
              `<div class="opt ${+k === 2 ? 'active' : ''}" data-k="${k}" title="${v.label}">${k}</div>`).join("")}
          </div>
          <div class="muted" id="tierLabel" style="font-size:12px;margin-top:6px"></div>
        </div>
      </div>
      <button class="btn primary" id="start">Begin Career</button>
      <button class="btn ghost" id="back">Back</button>
    `;

    // Live preview card + club identity, updates as the draft changes.
    const updateCard = () => {
      const base = 40 + draft.clubTier * 2;
      const keys = T.POSITIONS[draft.position].stats;
      const stats = {}; keys.forEach(k => stats[k] = base);
      const previewPlayer = {
        name: (wrap.querySelector("#name").value.trim()) || "New Striker",
        nation: draft.nation, position: draft.position, number: draft.number, age: 17, stats,
      };
      wrap.querySelector("#cardPreview").innerHTML =
        T.Vis.playerCard(previewPlayer, { name: draft.clubName }, base);
      wrap.querySelector("#clubName").textContent = draft.clubName;
      wrap.querySelector("#clubCrest").innerHTML = T.Vis.crest(draft.clubName, 30);
    };

    const setTierLabel = () => {
      const v = T.CLUB_TIERS[draft.clubTier];
      const divIdx = T.DIV_FOR_START_TIER[draft.clubTier];
      const divName = T.DIVISIONS[divIdx] ? T.DIVISIONS[divIdx].name : v.label;
      wrap.querySelector("#tierLabel").textContent =
        `Starts in ${divName} · legacy ×${v.legacyMult}`;
    };
    setTierLabel();
    updateCard();

    wrap.querySelector("#name").oninput = updateCard;
    wrap.querySelector("#nation").onchange = (e) => { draft.nation = e.target.value; updateCard(); };
    wrap.querySelector("#rerollClub").onclick = () => { draft.clubName = T.randomClubName(); updateCard(); };

    wrap.querySelector("#pos").querySelectorAll(".opt").forEach(opt => {
      opt.onclick = () => {
        if (T.POSITIONS[opt.dataset.k].locked) return;
        wrap.querySelectorAll("#pos .opt").forEach(o => o.classList.remove("active"));
        opt.classList.add("active");
        draft.position = opt.dataset.k;
        updateCard();
      };
    });
    wrap.querySelector("#tier").querySelectorAll(".opt").forEach(opt => {
      opt.onclick = () => {
        wrap.querySelectorAll("#tier .opt").forEach(o => o.classList.remove("active"));
        opt.classList.add("active");
        draft.clubTier = +opt.dataset.k;
        setTierLabel();
        updateCard();
      };
    });

    wrap.querySelector("#back").onclick = () => UI.show("title");
    wrap.querySelector("#start").onclick = () => {
      draft.name = wrap.querySelector("#name").value.trim();
      draft.nation = wrap.querySelector("#nation").value;
      T.newGame(draft);
      T.save();
      UI.enterSeason();
    };
    return wrap;
  };

  // ---- Season hub (dashboard) ----------------------------------------
  UI.screens.hub = function () {
    const g = T.game, p = g.player;
    const wrap = el(`<div class="col"></div>`);

    const keys = T.POSITIONS[p.position].stats;
    wrap.innerHTML = `
      ${T.Vis.playerCard(p, g.club, T.overall())}

      <div class="card row between">
        <div class="row" style="gap:8px"><div class="crest-inline">${T.Vis.crest(g.club.name, 28)}</div>
          <div><div class="muted" style="font-size:11px">${T.divisionName()}</div><b>${g.club.name}</b></div></div>
        <div class="center"><div class="muted" style="font-size:11px">Season</div><b>#${g.season}</b></div>
      </div>

      <div class="card">
        <div class="row between" style="margin-bottom:4px">
          <b>Attributes</b>
          <span class="muted" style="font-size:12px">${p.trainingPoints} training pts</span>
        </div>
        <div class="radar-wrap">${T.Vis.radar(p.stats, keys, 240)}</div>
      </div>

      <div class="card ring-row">
        ${T.Vis.ring(p.fitness, 100, "Fitness", 84)}
        ${T.Vis.ring(p.morale, 100, "Morale", 84)}
        <div class="center">
          <div class="pill ${p.form >= 0 ? 'gold' : ''}">Form ${(p.form >= 0 ? "+" : "") + p.form}</div>
          <div class="muted" style="font-size:12px;margin-top:8px">Level ${p.level}</div>
        </div>
      </div>

      ${p.perks.length ? `<div class="card"><b>Perks</b><div class="row" style="flex-wrap:wrap;margin-top:8px">
        ${p.perks.map(id => `<span class="pill gold">${T.PERKS[id].name}</span>`).join("")}
      </div></div>` : ``}

      <button class="btn ${p.trainingPoints > 0 ? "" : "ghost"}" id="train">
        Train${p.trainingPoints > 0 ? ` · ${p.trainingPoints} pts` : ""}
      </button>
      <button class="btn primary" id="play">Play Season #${g.season}</button>
      <div class="btn-row">
        <button class="btn ghost" id="help">How to Play</button>
        <button class="btn ghost" id="retire">Retire</button>
        <button class="btn ghost" id="menu">Menu</button>
      </div>
    `;

    wrap.querySelector("#train").onclick = () => UI.show("train");
    wrap.querySelector("#play").onclick = () => UI.playSeason();
    wrap.querySelector("#help").onclick = () => UI.show("glossary");
    wrap.querySelector("#retire").onclick = () => { g.careerOver = true; T.save(); UI.show("retirement"); };
    wrap.querySelector("#menu").onclick = () => { T.save(); UI.show("title"); };
    return wrap;
  };

  // ---- Train screen: spend points; live radar + projected output ------
  UI.screens.train = function () {
    const g = T.game, p = g.player;
    const keys = T.POSITIONS[p.position].stats;
    const wrap = el(`<div class="col"></div>`);

    // working copy of stats; `spent` tracks points used this visit
    const base = Object.assign({}, p.stats);
    const draft = Object.assign({}, p.stats);
    let pool = p.trainingPoints;

    wrap.innerHTML = `
      <div class="row between">
        <h2 style="margin:0">Training</h2>
        <span class="pill gold" id="pts">${pool} pts</span>
      </div>
      <div class="muted" style="font-size:13px" id="ageNote"></div>

      <div class="card"><div class="radar-wrap" id="radar"></div></div>

      <div class="card">
        <div class="row between" style="margin-bottom:8px">
          <b>Projected season</b><span class="muted" style="font-size:12px">if you play now</span>
        </div>
        <div class="row between" id="proj"></div>
      </div>

      <div class="card" id="alloc"></div>

      <button class="btn primary" id="confirm">Confirm & Save</button>
      <button class="btn ghost" id="back">Back (discard)</button>
    `;

    // age context
    const prime = T.POSITIONS[p.position].prime;
    wrap.querySelector("#ageNote").textContent =
      p.age < prime ? `Age ${p.age}: still developing toward your prime (${prime}). Points go far now.`
      : p.age <= prime + 1 ? `Age ${p.age}: at your peak — make these points count.`
      : `Age ${p.age}: past your prime — training fights the natural decline.`;

    const baseProj = T.Engine.projectSeason(base);

    const renderProj = () => {
      const proj = T.Engine.projectSeason(draft);
      const d = (now, was) => now > was ? ` <span class="up">▲${now - was}</span>` : "";
      wrap.querySelector("#proj").innerHTML = `
        ${projChip("OVR", proj.ovr, d(proj.ovr, baseProj.ovr))}
        ${projChip("Goals", proj.goals, d(proj.goals, baseProj.goals))}
        ${projChip("Assists", proj.assists, d(proj.assists, baseProj.assists))}
        ${projChip("Rating", proj.rating, d(proj.rating, baseProj.rating))}`;
    };
    const renderRadar = () => { wrap.querySelector("#radar").innerHTML = T.Vis.radar(draft, keys, 240); };
    const renderPts = () => { wrap.querySelector("#pts").textContent = pool + " pts"; };

    const renderAlloc = () => {
      wrap.querySelector("#alloc").innerHTML = keys.map(k => {
        const added = draft[k] - base[k];
        return `<div class="alloc-row">
          <div class="grow">
            <div class="row between"><span>${lbl(k)}</span>
              <span class="val">${draft[k]}${added ? ` <span class="up">(+${added})</span>` : ""}</span></div>
            <div class="bar"><span style="width:${draft[k]}%"></span></div>
          </div>
          <button class="btn step" data-k="${k}" data-dir="-1" ${draft[k] <= base[k] ? "disabled" : ""}>−</button>
          <button class="btn step" data-k="${k}" data-dir="1" ${(pool <= 0 || draft[k] >= 99) ? "disabled" : ""}>+</button>
        </div>`;
      }).join("");
      wrap.querySelectorAll("#alloc .step").forEach(b => {
        b.onclick = () => {
          const k = b.dataset.k, dir = +b.dataset.dir;
          if (dir > 0 && pool > 0 && draft[k] < 99) { draft[k]++; pool--; }
          else if (dir < 0 && draft[k] > base[k]) { draft[k]--; pool++; }
          refresh();
        };
      });
    };

    const refresh = () => { renderPts(); renderRadar(); renderProj(); renderAlloc(); };
    refresh();

    wrap.querySelector("#confirm").onclick = () => {
      p.stats = draft;
      p.trainingPoints = pool;
      T.save();
      UI.show("hub");
    };
    wrap.querySelector("#back").onclick = () => UI.show("hub");
    return wrap;
  };

  // ---- Perk pick screen (level-up reward) ----------------------------
  UI.showPerkPick = function (remaining, afterAll) {
    if (remaining <= 0) { afterAll(); return; }
    const offered = T.Prog.offerPerks(3);
    if (!offered.length) { afterAll(); return; }

    const wrap = el(`<div class="col"></div>`);
    wrap.innerHTML = `
      <div class="center">
        <div class="pill gold pop-in">LEVEL UP</div>
        <h2 style="margin-top:8px">Choose a perk</h2>
        <div class="muted" style="font-size:13px">Perks shape your identity and change how the game plays.</div>
      </div>
      <div class="col" id="perks"></div>
    `;
    const list = wrap.querySelector("#perks");
    offered.forEach(id => {
      const perk = T.PERKS[id];
      const b = el(`<button class="btn perk-pick"><b class="gold">${perk.name}</b>
        <span class="muted" style="font-weight:400">${perk.desc}</span></button>`);
      b.onclick = () => {
        T.game.player.perks.push(id);
        T.save();
        UI.showPerkPick(remaining - 1, afterAll);
      };
      list.appendChild(b);
    });
    const root = app(); root.innerHTML = ""; wrap.classList.add("screen"); root.appendChild(wrap);
  };

  // ---- Season entry: show a one-off season-opening event, then the hub ----
  // Idempotent per season (game.eventShownFor), so resuming a save won't re-roll.
  UI.enterSeason = function () {
    const g = T.game;
    if (g && g.eventShownFor !== g.season) {
      g.eventShownFor = g.season;
      const ev = T.Prog.rollSeasonEvent();
      T.save();
      if (ev) { UI.showSpin(ev); return; }
    }
    UI.show("hub");
  };

  // The "spin": a narrative season-opening choice (UI.screens-style helper).
  UI.showSpin = function (ev) {
    const wrap = el(`<div class="col"></div>`);
    wrap.innerHTML = `
      <div style="height:3vh"></div>
      <div class="center"><div class="pill gold pop-in" style="align-self:center">SEASON ${T.game.season} · PRE-SEASON</div></div>
      <div class="card center pop-in">
        <div style="font-size:38px;line-height:1">${ev.icon || "📰"}</div>
        <h2 style="margin:6px 0 4px">${ev.title}</h2>
        <p style="margin:0;color:var(--text)">${ev.text}</p>
      </div>
      <div class="col" id="opts"></div>
      <div class="muted center" style="font-size:12px">How you respond shapes your season start.</div>
    `;
    const opts = wrap.querySelector("#opts");
    ev.options.forEach(option => {
      const b = el(`<button class="btn perk-pick"><b>${option.label}</b>
        <span class="muted" style="font-weight:400">${option.desc}</span></button>`);
      b.onclick = () => {
        const res = T.Prog.applyEvent(option);
        T.save();
        UI.showSpinResult(res);
      };
      opts.appendChild(b);
    });
    const root = app(); root.innerHTML = ""; wrap.classList.add("screen"); root.appendChild(wrap);
  };

  UI.showSpinResult = function (res) {
    const chips = res.fx.map(f =>
      `<span class="fx-chip ${f.delta >= 0 ? "good" : "bad"}">${f.label} ${f.delta >= 0 ? "+" : ""}${f.delta}</span>`).join("");
    const wrap = el(`<div class="col"></div>`);
    wrap.innerHTML = `
      <div style="height:6vh"></div>
      <div class="card center pop-in"><p style="font-size:18px;margin:0">${res.text}</p></div>
      <div class="fx-chips">${chips}</div>
      <button class="btn primary" id="go">Into the season</button>
    `;
    wrap.querySelector("#go").onclick = () => UI.show("hub");
    const root = app(); root.innerHTML = ""; wrap.classList.add("screen"); root.appendChild(wrap);
  };

  // After results + perk pick: show the transfer window if there are offers.
  UI.afterResults = function () {
    const offers = T.game.pendingOffers || [];
    if (offers.length) UI.showTransferWindow(offers, () => UI.enterSeason());
    else UI.enterSeason();
  };

  // ---- Transfer window: accept a move to a new club, or stay loyal --------
  UI.showTransferWindow = function (offers, done) {
    const finish = () => { T.game.pendingOffers = []; T.save(); };
    const wrap = el(`<div class="col"></div>`);
    wrap.innerHTML = `
      <div class="center"><div class="pill gold pop-in" style="align-self:center">📣 TRANSFER WINDOW</div></div>
      <div class="card center"><p style="margin:0">Your form has turned heads. ${offers.length === 1 ? "An offer is" : "Offers are"} on the table — move on, or stay and build your story here.</p></div>
      <div class="col" id="offers"></div>
      <button class="btn ghost" id="stay">Stay at ${T.game.club.name}</button>
    `;
    const box = wrap.querySelector("#offers");
    offers.forEach(offer => {
      const c = T.CLUB_DB[offer.cid];
      const divName = T.DIVISIONS[offer.division] ? T.DIVISIONS[offer.division].name : "";
      const card = el(`<button class="btn offer-btn">
        <span class="crest-inline">${T.Vis.crest(c.name, 38)}</span>
        <span class="grow" style="text-align:left">
          <b>${c.name}</b>
          <span class="offer-sub">${divName}${c.nick ? " · " + c.nick : ""}${offer.type === "step-up" ? " · step up ⬆" : ""}</span>
          <span class="offer-blurb">${offer.blurb}</span>
        </span></button>`);
      card.onclick = () => {
        T.Prog.acceptTransfer(offer);
        finish();
        UI.showTransferResult(done);
      };
      box.appendChild(card);
    });
    wrap.querySelector("#stay").onclick = () => { finish(); done(); };
    const root = app(); root.innerHTML = ""; wrap.classList.add("screen"); root.appendChild(wrap);
  };

  UI.showTransferResult = function (done) {
    const g = T.game;
    const wrap = el(`<div class="col"></div>`);
    wrap.innerHTML = `
      <div style="height:5vh"></div>
      <div class="center"><div class="brand pop-in" style="font-size:26px">WELCOME</div></div>
      <div class="card center pop-in">
        <div class="crest-inline" style="justify-content:center">${T.Vis.crest(g.club.name, 64)}</div>
        <h2 style="margin:8px 0 2px">${g.club.name}</h2>
        <div class="muted">${T.divisionName()} · your new home</div>
      </div>
      <button class="btn primary" id="go">Report for duty</button>
    `;
    wrap.querySelector("#go").onclick = done;
    UI.confetti(90);
    const root = app(); root.innerHTML = ""; wrap.classList.add("screen"); root.appendChild(wrap);
  };

  // ---- Season flow: simulate the league, play key matches, results ----
  // runSeason() builds & sims the whole 20-team league game-by-game and
  // marks a few rounds as key matches. We play those interactively (each
  // tied to its real fixture & scoreline), then finalize into a record.
  UI.playSeason = function () {
    const g = T.game;
    T.Prog.rollForm();
    const season = T.Engine.runSeason();
    g._season = season;

    // Attach each league key moment to its real fixture (opponent + live scoreline).
    const moments = T.Moments.pickSeason(season.keyRounds.length);
    moments.forEach((mo, i) => {
      const rd = season.keyRounds[i];
      const pm = season.pmeta[rd];
      const m = T.Engine.playerMatchAt(season, rd);
      mo._rd = rd;
      mo._match = {
        rd: rd + 1, oppName: season.teams[pm.oppId].name, home: pm.home,
        gh: pm.home ? m.gh : m.ga, ga: pm.home ? m.ga : m.gh,
      };
    });
    // Special moments (domestic cup run + international/World Cup) play after the
    // league moments and award silverware into season.extra* on a winning final.
    season.extraTrophies = [];
    season.extraAwards = [];
    const seq = moments.concat(T.Moments.pickSpecials(g, season));

    let idx = 0;
    const next = () => {
      if (idx < seq.length) {
        UI.renderMoment(seq[idx], season, () => { idx++; next(); });
      } else {
        const record = T.Engine.finalizeSeason(season);
        record.proRel = T.Prog.runPromRel(season); // promotion/relegation across the pyramid
        T.Prog.rollInjury();
        const ended = T.Prog.rollCareerEndInjury();
        g.pendingOffers = ended ? [] : T.Prog.generateOffers(record); // transfer interest
        const adv = T.Prog.advanceSeason(record);
        if (ended) g.careerOver = true;
        g.pendingPerks = ended ? 0 : (adv.levelsGained || 0);
        T.save();
        UI.renderResults(record, ended);
      }
    };
    next();
  };

  // Step 1: show match context + scene + prompt + action choices.
  UI.renderMoment = function (moment, season, done) {
    const ctx = T.Moments.context(moment);
    // International games are played for your nation, not your club.
    const myName = moment.track === "intl" ? T.game.player.nation : T.game.club.name;
    const banner = moment.tournament ? moment.tournament : "KEY MOMENT";
    const wrap = el(`<div class="col"></div>`);
    wrap.innerHTML = `
      <div class="pill gold center" style="align-self:center">${banner}</div>
      ${T.Vis.matchHeader(myName, ctx)}
      <div class="scene-wrap">${T.Minigames.scene(moment.scene)}</div>
      <div class="card"><p style="font-size:18px;font-weight:700;margin:0">${moment.prompt}</p></div>
      <div class="muted center" style="font-size:12px">Pick your move — each one tests a different attribute.</div>
      <div class="col" id="choices"></div>
    `;
    const choices = wrap.querySelector("#choices");
    moment.choices.forEach(choice => {
      const sv = T.game.player.stats[choice.stat];
      const b = el(`<button class="btn choice-btn">
        <span class="grow" style="text-align:left">${choice.label}
          <span class="choice-impact">${choice.impact}</span></span>
        <span class="choice-stat">${lbl(choice.stat)} ${sv != null ? sv : ""}</span></button>`);
      b.onclick = () => UI.playMomentGame(moment, choice, season, done);
      choices.appendChild(b);
    });
    const root = app(); root.innerHTML = ""; wrap.classList.add("screen"); root.appendChild(wrap);
  };

  // Step 2: play the skill-game for the chosen action, then resolve.
  UI.playMomentGame = function (moment, choice, season, done) {
    const p = T.game.player;
    const wrap = el(`<div class="col"></div>`);
    wrap.innerHTML = `
      <div class="pill gold center" style="align-self:center">${choice.label.toUpperCase()}</div>
      <div class="scene-wrap">${T.Minigames.scene(moment.scene)}</div>
      <div id="mghost"></div>
    `;
    const root = app(); root.innerHTML = ""; wrap.classList.add("screen"); root.appendChild(wrap);

    const host = wrap.querySelector("#mghost");
    const game = choice.game || { type: "timingBar" };
    T.Minigames.run(host, {
      type: game.type,
      action: game.action,
      statVal: p.stats[choice.stat] != null ? p.stats[choice.stat] : 50,
    }, (gameResult) => {
      const res = T.Moments.resolve(choice, gameResult.skill, moment);
      res.gameText = gameResult.text;
      p.form = T.clamp(p.form + res.deltas.form, -10, 10);
      p.morale = T.clamp(p.morale + res.deltas.morale, 0, 100);

      const isLeague = moment._rd != null;
      if (isLeague) {
        // A successful scoring/assisting choice changes the actual league match.
        if (res.success && res.effect && res.effect !== "none") {
          T.Engine.applyMoment(season, moment._rd, res.effect);
        }
        const m = T.Engine.playerMatchAt(season, moment._rd);
        const pm = season.pmeta[moment._rd];
        res.matchAfter = {
          opp: moment._match.oppName, home: pm.home,
          my: pm.home ? m.gh : m.ga, op: pm.home ? m.ga : m.gh,
        };
      } else {
        // Special cup / international moment: a winning final earns silverware.
        res.tournament = moment.tournament;
        if (res.success && moment.grant) {
          if (moment.grant.trophy) season.extraTrophies.push(moment.grant.trophy);
          if (moment.grant.award) season.extraAwards.push(moment.grant.award);
          res.wonTitle = moment.grant.trophy || (moment.grant.award && T.AWARDS[moment.grant.award] && T.AWARDS[moment.grant.award].name);
        }
      }
      res.desc = T.Moments.describeResult(res, moment, game.type);
      T.game.momentsLog.push({ season: T.game.season, text: res.text, success: res.success });
      setTimeout(() => UI.renderMomentResult(res, done), 320);
    });
  };

  UI.renderMomentResult = function (res, done) {
    const desc = res.desc || { outcome: res.success ? "goal" : "miss", headline: res.success ? "GOAL!" : "MISSED", consequences: [], insight: "", big: false };
    const kind = desc.outcome; // goal | assist | saved | miss
    // Keeper reacts: beaten the wrong way on a goal, dives onto a save.
    const keeperCls = kind === "saved" ? "dive-l" : kind === "goal" ? "dive-r" : "";
    const chips = desc.consequences.map(c => `<span class="fx-chip ${c.tone}">${c.text}</span>`).join("");

    const wrap = el(`<div class="col"></div>`);
    wrap.innerHTML = `
      <div class="outcome oc-${kind} ${desc.big ? "big" : ""}">
        <div class="oc-goal ${kind === "goal" ? "shake" : ""}"></div>
        <div class="oc-keeper ${keeperCls}"></div>
        <div class="oc-teammate"></div>
        <div class="oc-ring"></div>
        <div class="oc-ball ${kind}"></div>
        <div class="oc-stamp ${res.success ? "good" : "bad"} show">${desc.headline}</div>
      </div>
      ${res.gameText ? `<div class="center muted" style="margin-top:-2px">${res.gameText}</div>` : ``}
      <div class="card center"><p style="font-size:18px;margin:0">${res.text}</p></div>
      ${chips ? `<div class="fx-chips">${chips}</div>` : ``}
      ${desc.insight ? `<div class="card insight"><span class="ins-icon">💡</span><p>${desc.insight}</p></div>` : ``}
      ${res.matchAfter ? `<div class="card center">
        <div class="muted" style="font-size:12px">Match score</div>
        <b style="font-size:20px">${res.matchAfter.home
          ? `${T.game.club.name} ${res.matchAfter.my}–${res.matchAfter.op} ${res.matchAfter.opp}`
          : `${res.matchAfter.opp} ${res.matchAfter.op}–${res.matchAfter.my} ${T.game.club.name}`}</b>
      </div>` : ``}
      ${res.tournament ? `<div class="card center">
        <div class="muted" style="font-size:12px">${res.tournament}</div>
        ${res.wonTitle ? `<b class="gold pop-in" style="font-size:20px">🏆 ${res.wonTitle} won!</b>`
          : `<b style="font-size:16px">${res.success ? "Through to the next round" : "Knocked out"}</b>`}
      </div>` : ``}
      <div class="card center muted" style="font-size:13px">${res.impact || ""}</div>
      <button class="btn primary" id="cont">Continue</button>
    `;
    wrap.querySelector("#cont").onclick = done;
    const root = app(); root.innerHTML = ""; wrap.classList.add("screen"); root.appendChild(wrap);
    // Celebration scales with the stakes: a routine goal pops; a trophy erupts.
    if (res.success) {
      const burst = res.wonTitle ? 220 : desc.big ? 150 : 80;
      setTimeout(() => UI.confetti(burst), 520);              // sync with the stamp pop
      if (res.wonTitle) setTimeout(() => UI.confetti(180), 1000);
    }
  };

  UI.renderResults = function (record, careerEnded) {
    const wrap = el(`<div class="col"></div>`);
    const trophyHtml = record.trophies.length
      ? `<div class="card center pop-in"><div class="cabinet" style="justify-content:center">
          ${record.trophies.map(tn => `<div class="trophy-item">${T.Vis.trophy("cup")}<span>${tn}</span></div>`).join("")}
        </div></div>`
      : ``;
    const awardsHtml = (record.awards && record.awards.length)
      ? `<div class="card pop-in">
          <div class="muted" style="font-size:12px;margin-bottom:8px">🏅 Individual honours</div>
          <div class="cabinet" style="justify-content:center">
            ${record.awards.map(id => {
              const a = T.AWARDS[id] || { icon: "🏅", name: id };
              return `<div class="trophy-item"><div style="font-size:30px;line-height:1">${a.icon}</div><span>${a.name}</span></div>`;
            }).join("")}
          </div>
          ${T.game.player.caps ? `<div class="muted center" style="font-size:12px;margin-top:6px">${T.game.player.caps} international caps</div>` : ``}
        </div>`
      : ``;
    const proRelHtml = record.proRel
      ? `<div class="card center pop-in" style="border-color:${record.proRel.moved === "up" ? "var(--good)" : "var(--bad)"}">
          <b style="color:${record.proRel.moved === "up" ? "var(--good)" : "var(--bad)"};font-size:18px">
            ${record.proRel.moved === "up" ? "⬆ PROMOTED" : "⬇ RELEGATED"}</b>
          <div class="muted" style="font-size:13px">${record.proRel.fromName} → <b>${record.proRel.toName}</b> for next season</div>
        </div>`
      : ``;
    wrap.innerHTML = `
      <div class="row" style="gap:10px;align-items:center">
        <div class="crest-inline">${T.Vis.crest(record.club, 40)}</div>
        <div><h2 style="margin:0">Season #${record.season}</h2>
          <div class="muted">${record.club}${record.divisionName ? " · " + record.divisionName : ""} · age ${record.age}</div></div>
      </div>

      ${proRelHtml}

      <div class="card ring-row">
        ${T.Vis.ring(record.rating, 10, "Avg rating", 96)}
        <div class="col center" style="gap:2px">
          <div class="row" style="gap:14px">
            ${chip("Apps", record.apps)}${chip("Goals", record.goals)}${chip("Assists", record.assists)}
          </div>
        </div>
      </div>

      ${trophyHtml}
      ${awardsHtml}

      <div class="card">
        <div class="muted" style="font-size:12px;margin-bottom:4px">Season form (per match rating)</div>
        ${T.Vis.sparkline(record.matchRatings)}
      </div>

      ${record.finish ? `<div class="card">${T.Vis.leaguePos(record.finish, 20)}</div>` : ``}

      ${record.table ? `<div class="card">
        <div class="row between" style="margin-bottom:6px">
          <b>${record.divisionName || "Final"} table</b>
          <button class="btn ghost" id="fullTable" style="width:auto;min-height:34px;padding:0 12px;font-size:12px">Full table</button>
        </div>
        ${T.Vis.leagueTable(tableWindow(record.table), 0)}
      </div>` : ``}

      ${record.matches ? `<div class="card">
        <div class="row between" style="margin-bottom:4px">
          <b>Every game (${record.matches.length})</b>
          <button class="btn ghost" id="toggleGames" style="width:auto;min-height:34px;padding:0 12px;font-size:12px">Show all</button>
        </div>
        <div id="gamesBox">${T.Vis.matchList(record.matches.slice(0, 6))}</div>
      </div>` : ``}

      ${(!careerEnded && T.game.pendingPerks) ? `<div class="card center pop-in">
        <b class="gold">⬆ LEVEL UP ×${T.game.pendingPerks}</b>
        <div class="muted" style="font-size:13px">Pick a perk, then spend new training points.</div></div>` : ``}
      ${careerEnded ? `<div class="card center"><b class="gold">A serious injury has ended your career.</b></div>` : ``}
      <button class="btn primary" id="cont">${careerEnded ? "See Legacy" : "Continue"}</button>
    `;
    wrap.querySelector("#cont").onclick = () => {
      if (T.game.careerOver) { UI.show("retirement"); return; }
      const picks = T.game.pendingPerks || 0;
      T.game.pendingPerks = 0;
      UI.showPerkPick(picks, () => UI.afterResults());
    };
    const ftBtn = wrap.querySelector("#fullTable");
    if (ftBtn) {
      let full = false;
      ftBtn.onclick = () => {
        full = !full;
        ftBtn.previousElementSibling; // no-op for clarity
        const card = ftBtn.closest(".card");
        const tbl = card.querySelector(".ltable");
        tbl.outerHTML = T.Vis.leagueTable(full ? record.table : tableWindow(record.table), 0);
        ftBtn.textContent = full ? "Compact" : "Full table";
      };
    }
    const tgBtn = wrap.querySelector("#toggleGames");
    if (tgBtn) {
      let all = false;
      tgBtn.onclick = () => {
        all = !all;
        wrap.querySelector("#gamesBox").innerHTML =
          T.Vis.matchList(all ? record.matches : record.matches.slice(0, 6));
        tgBtn.textContent = all ? "Show less" : "Show all";
      };
    }
    const root = app(); root.innerHTML = ""; wrap.classList.add("screen"); root.appendChild(wrap);
    if (record.trophies.length || (record.awards && record.awards.length)) UI.confetti();
  };

  // Compact league view: top 5 + a window around the player.
  function tableWindow(table) {
    const meIdx = table.findIndex(r => r.isPlayer);
    const set = new Set([0, 1, 2, 3, 4, meIdx - 1, meIdx, meIdx + 1, table.length - 1]);
    return table.filter((_, i) => set.has(i) && i >= 0 && i < table.length);
  }

  // ---- Retirement / legacy summary -----------------------------------
  UI.screens.retirement = function () {
    const g = T.game, t = g.totals;
    const L = T.Legacy.compute();

    // Build a Hall-of-Fame entry and save it once per career.
    const entry = {
      name: g.player.name, nation: g.player.nation, club: g.club.name,
      tier: L.tier, score: L.score, goals: t.goals, assists: t.assists,
      trophies: t.trophies, seasons: g.history.length, startTier: L.breakdown.startTier,
      daily: g.daily || null, when: Date.now(),
    };
    let rank = null;
    if (!g._hofSaved) {
      rank = T.addToHOF(entry).rank;
      g._hofSaved = true;
      T.save();
    }

    const wrap = el(`<div class="col"></div>`);
    // Build the trophy cabinet from history.
    const cabinet = [];
    g.history.forEach(h => (h.trophies || []).forEach(tn => cabinet.push(tn)));
    const cabinetHtml = cabinet.length
      ? cabinet.map(tn => `<div class="trophy-item">${T.Vis.trophy("cup")}<span>${tn}</span></div>`).join("")
      : `<span class="muted">No silverware — but a story all the same.</span>`;

    // Tally individual honours (awards) across the whole career.
    const awardTally = {};
    g.history.forEach(h => (h.awards || []).forEach(id => { awardTally[id] = (awardTally[id] || 0) + 1; }));
    const honoursHtml = Object.keys(awardTally).length
      ? Object.entries(awardTally).map(([id, n]) => {
          const a = T.AWARDS[id] || { icon: "🏅", name: id };
          return `<div class="trophy-item"><div style="font-size:26px;line-height:1">${a.icon}</div><span>${a.name}${n > 1 ? ` ×${n}` : ""}</span></div>`;
        }).join("")
      : `<span class="muted">No individual awards — a team player to the last.</span>`;

    wrap.innerHTML = `
      <div class="center">
        <div class="muted">FINAL TIER</div>
        <div class="brand pop-in" style="font-size:30px">${L.tier.toUpperCase()}</div>
      </div>
      <div class="card ring-row">
        ${T.Vis.ring(Math.min(L.score, 9999), 4000, "Legacy", 120)}
        <div class="center">
          <div class="pill gold" style="font-size:18px">${L.score.toLocaleString()}</div>
          <div class="muted" style="font-size:12px;margin-top:6px">difficulty ×${L.breakdown.diffMult}</div>
          ${rank ? `<div class="muted" style="font-size:12px;margin-top:4px">Hall of Fame: <b class="gold">#${rank}</b></div>` : ``}
          ${g.daily ? `<div class="pill" style="margin-top:6px">⚡ Daily ${g.daily}</div>` : ``}
        </div>
      </div>

      ${T.Vis.playerCard(g.player, g.club, t.peakRating ? Math.round(t.peakRating * 10) : T.overall())}
      <div class="muted center" style="font-size:12px">${g.history.length} seasons · retired at ${g.player.age}</div>

      <div class="card row between">
        ${chip("Apps", t.apps)}${chip("Goals", t.goals)}${chip("Assists", t.assists)}
        ${chip("Trophies", t.trophies)}${chip("Awards", t.awards)}${chip("Caps", g.player.caps || 0)}${chip("Peak", t.peakRating)}
      </div>

      <div class="card">
        <b>Trophy cabinet</b>
        <div class="cabinet" style="margin-top:10px">${cabinetHtml}</div>
      </div>

      <div class="card">
        <b>Individual honours</b>
        <div class="cabinet" style="margin-top:10px">${honoursHtml}</div>
      </div>

      <div class="card">
        <b>Career timeline</b>
        <div class="col" style="margin-top:8px">
          ${g.history.map(h => `<div class="tl-row">
            <div class="crest-inline">${T.Vis.crest(h.club, 22)}</div>
            <span>S${h.season} · ${h.club}</span>
            <span class="tl-meta">${h.goals}G ${h.assists}A · ${h.rating}${(h.trophies && h.trophies.length) ? " 🏆" : ""}</span>
          </div>`).join("") || `<span class="muted">No seasons played.</span>`}
        </div>
      </div>

      <div class="card">
        <b>Challenge a friend</b>
        <div class="muted" style="font-size:13px;margin:4px 0 8px">Share your result, or your career code to compare directly.</div>
        <div class="btn-row">
          <button class="btn" id="shareText">Copy result</button>
          <button class="btn ghost" id="shareCode">Copy code</button>
        </div>
        <div class="muted center" id="shareMsg" style="font-size:12px;margin-top:8px"></div>
      </div>

      <button class="btn primary" id="again">New Career</button>
      <div class="btn-row">
        <button class="btn ghost" id="hof">Hall of Fame</button>
        <button class="btn ghost" id="title">Main Menu</button>
      </div>
    `;
    const flash = (msg) => { wrap.querySelector("#shareMsg").textContent = msg; };
    const copy = (text, msg) => {
      try {
        if (navigator.clipboard) navigator.clipboard.writeText(text);
        flash(msg);
      } catch (e) { flash("Copy not available — here it is:\n" + text); }
    };
    wrap.querySelector("#shareText").onclick = () => copy(T.shareText(entry), "Result copied — paste it to a friend!");
    wrap.querySelector("#shareCode").onclick = () => copy(T.encodeCareer(entry), "Career code copied!");
    wrap.querySelector("#again").onclick = () => { T.clearSave(); UI.show("create"); };
    wrap.querySelector("#hof").onclick = () => UI.show("halloffame");
    wrap.querySelector("#title").onclick = () => UI.show("title");
    UI.confetti(120);
    return wrap;
  };

  // ---- Hall of Fame (local leaderboard + import friends' codes) -------
  UI.screens.halloffame = function () {
    const list = T.loadHOF();
    const wrap = el(`<div class="col"></div>`);
    const rowHtml = (e, i) => `
      <div class="hof-row ${i === 0 ? "top1" : ""}">
        <div class="rank">${i + 1}</div>
        <div class="who">
          <b>${e.name}${e.rival ? ' <span class="muted" style="font-size:11px">(friend)</span>' : ""}</b>
          <span class="tier">${e.tier} · ${e.goals}G ${e.assists}A · ${e.trophies}🏆 · ${e.seasons} seasons${e.daily ? " · ⚡" : ""}</span>
        </div>
        <div class="score">${(e.score || 0).toLocaleString()}</div>
      </div>`;
    wrap.innerHTML = `
      <div class="row between"><h2 style="margin:0">🏅 Hall of Fame</h2>
        <span class="pill">${list.length} careers</span></div>
      <div class="muted" style="font-size:13px">Your best careers, ranked by Legacy Score. Highest score wins.</div>
      <div class="card">${list.length ? list.map(rowHtml).join("") : `<span class="muted">No careers yet — go make history.</span>`}</div>

      <div class="card">
        <b>Add a friend's score</b>
        <div class="muted" style="font-size:13px;margin:4px 0 8px">Paste a career code they shared to rank against them.</div>
        <input id="codeIn" type="text" placeholder="Paste career code…" />
        <button class="btn" id="addCode" style="margin-top:8px">Add to board</button>
        <div class="muted center" id="addMsg" style="font-size:12px;margin-top:8px"></div>
      </div>

      <button class="btn primary" id="back">Back</button>
    `;
    wrap.querySelector("#addCode").onclick = () => {
      const code = wrap.querySelector("#codeIn").value.trim();
      const e = T.decodeCareer(code);
      if (!e || typeof e.score !== "number") { wrap.querySelector("#addMsg").textContent = "Couldn't read that code."; return; }
      e.rival = true;
      T.addToHOF(e);
      UI.show("halloffame");
    };
    wrap.querySelector("#back").onclick = () => UI.show(T.game ? (T.game.careerOver ? "retirement" : "hub") : "title");
    return wrap;
  };

  // ---- Glossary / How to Play ----------------------------------------
  UI.screens.glossary = function (data) {
    const wrap = el(`<div class="col"></div>`);
    wrap.innerHTML = `
      <h2>How to Play</h2>
      <div class="muted" style="font-size:13px">Every mechanic in TALISMAN, in plain language.</div>
      <div class="card">
        ${T.GLOSSARY.map(g => `<div class="glos-item"><b>${g.term}</b><p>${g.text}</p></div>`).join("")}
      </div>
      <button class="btn primary" id="back">Back</button>
    `;
    wrap.querySelector("#back").onclick = () => {
      if (data && data.from === "title") UI.show("title");
      else UI.show(T.game ? "hub" : "title");
    };
    return wrap;
  };

  // ---- Small render helpers ------------------------------------------
  function chip(label, val) {
    return `<div class="center"><div class="muted" style="font-size:11px">${label}</div><b>${val}</b></div>`;
  }
  function projChip(label, val, delta) {
    return `<div class="center"><div class="muted" style="font-size:11px">${label}</div><b>${val}${delta || ""}</b></div>`;
  }

  // ---- Juice: lightweight confetti -----------------------------------
  UI.confetti = function (count) {
    const cv = document.getElementById("fx");
    if (!cv) return;
    const ctx = cv.getContext("2d");
    cv.width = innerWidth; cv.height = innerHeight;
    const N = count || 80;
    const cols = ["#f5c451", "#5ad1ff", "#4ade80", "#ffffff"];
    const parts = Array.from({ length: N }, () => ({
      x: innerWidth / 2, y: innerHeight / 3,
      vx: T.rand(-6, 6), vy: T.rand(-12, -4),
      g: 0.4, s: T.rand(4, 9), c: T.pick(cols), life: 60 + T.rand(0, 40),
    }));
    let frame = 0;
    (function tick() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      let alive = false;
      parts.forEach(p => {
        if (p.life <= 0) return;
        alive = true;
        p.vy += p.g; p.x += p.vx; p.y += p.vy; p.life--;
        ctx.fillStyle = p.c;
        ctx.fillRect(p.x, p.y, p.s, p.s);
      });
      frame++;
      if (alive && frame < 160) requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, cv.width, cv.height);
    })();
  };
})();
