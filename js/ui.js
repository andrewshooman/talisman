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
      <div style="height:8vh"></div>
      <div class="brand pop-in">TALISMAN</div>
      <div class="tagline">Live a striker's whole career.</div>
      <div style="height:4vh"></div>
      <div class="col">
        <button class="btn primary" id="new">New Career</button>
        ${T.hasSave() ? `<button class="btn" id="continue">Continue</button>` : ``}
      </div>
      <div class="spacer"></div>
      <div class="center muted" style="font-size:12px">v${T.VERSION} · fictional clubs & players · no real branding</div>
    `;
    wrap.querySelector("#new").onclick = () => UI.show("create");
    const cont = wrap.querySelector("#continue");
    if (cont) cont.onclick = () => { if (T.load()) UI.show(T.game.careerOver ? "retirement" : "hub"); };
    return wrap;
  };

  // ---- Player creation (FWD) -----------------------------------------
  UI.screens.create = function () {
    const draft = { name: "", nation: T.NATIONS[0], position: "FWD", clubTier: 2 };
    const wrap = el(`<div class="col"></div>`);

    wrap.innerHTML = `
      <h2>Create your striker</h2>
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

    const setTierLabel = () => {
      const v = T.CLUB_TIERS[draft.clubTier];
      wrap.querySelector("#tierLabel").textContent =
        `${v.label} · legacy ×${v.legacyMult}`;
    };
    setTierLabel();

    wrap.querySelector("#pos").querySelectorAll(".opt").forEach(opt => {
      opt.onclick = () => {
        if (T.POSITIONS[opt.dataset.k].locked) return;
        wrap.querySelectorAll("#pos .opt").forEach(o => o.classList.remove("active"));
        opt.classList.add("active");
        draft.position = opt.dataset.k;
      };
    });
    wrap.querySelector("#tier").querySelectorAll(".opt").forEach(opt => {
      opt.onclick = () => {
        wrap.querySelectorAll("#tier .opt").forEach(o => o.classList.remove("active"));
        opt.classList.add("active");
        draft.clubTier = +opt.dataset.k;
        setTierLabel();
      };
    });

    wrap.querySelector("#back").onclick = () => UI.show("title");
    wrap.querySelector("#start").onclick = () => {
      draft.name = wrap.querySelector("#name").value.trim();
      draft.nation = wrap.querySelector("#nation").value;
      T.newGame(draft);
      T.save();
      UI.show("hub");
    };
    return wrap;
  };

  // ---- Season hub (dashboard) ----------------------------------------
  UI.screens.hub = function () {
    const g = T.game, p = g.player;
    const wrap = el(`<div class="col"></div>`);

    wrap.innerHTML = `
      <div class="row between">
        <div>
          <h2>${p.name}</h2>
          <div class="muted">${T.POSITIONS[p.position].label} · ${p.nation} · age ${p.age}</div>
        </div>
        <div class="pill gold">OVR ${T.overall()}</div>
      </div>

      <div class="card row between">
        <div><div class="muted" style="font-size:12px">Club</div><b>${g.club.name}</b></div>
        <div class="pill">Tier ${g.club.tier}</div>
        <div><div class="muted" style="font-size:12px">Season</div><b>#${g.season}</b></div>
      </div>

      <div class="card">
        <div class="row between" style="margin-bottom:8px">
          <b>Attributes</b>
          <span class="muted" style="font-size:12px">${p.trainingPoints} training pts</span>
        </div>
        ${T.POSITIONS[p.position].stats.map(k => statBar(k, p.stats[k])).join("")}
      </div>

      <div class="card row between">
        ${chip("Form", (p.form >= 0 ? "+" : "") + p.form)}
        ${chip("Morale", p.morale)}
        ${chip("Fitness", p.fitness)}
        ${chip("Level", p.level)}
      </div>

      ${p.perks.length ? `<div class="card"><b>Perks</b><div class="row" style="flex-wrap:wrap;margin-top:8px">
        ${p.perks.map(id => `<span class="pill gold">${T.PERKS[id].name}</span>`).join("")}
      </div></div>` : ``}

      <button class="btn primary" id="play">Play Season #${g.season}</button>
      <div class="btn-row">
        <button class="btn ghost" id="retire">Retire</button>
        <button class="btn ghost" id="menu">Menu</button>
      </div>
    `;

    wrap.querySelector("#play").onclick = () => UI.playSeason();
    wrap.querySelector("#retire").onclick = () => { g.careerOver = true; T.save(); UI.show("retirement"); };
    wrap.querySelector("#menu").onclick = () => { T.save(); UI.show("title"); };
    return wrap;
  };

  // ---- Season flow: key moments then results -------------------------
  // Runs the sim, plays through key moments interactively, then results.
  UI.playSeason = function () {
    const g = T.game, p = g.player;
    T.Prog.rollForm();
    const record = T.Engine.simSeason();
    const moments = T.Moments.pickSeason();
    let idx = 0;

    const next = () => {
      if (idx < moments.length) {
        UI.renderMoment(moments[idx], record, () => { idx++; next(); });
      } else {
        // injuries & end-of-season processing
        T.Prog.rollInjury();
        const ended = T.Prog.rollCareerEndInjury();
        T.Prog.advanceSeason(record);
        if (ended) g.careerOver = true;
        T.save();
        UI.renderResults(record, ended);
      }
    };
    next();
  };

  // Step 1: show the scene + prompt + action choices.
  UI.renderMoment = function (moment, record, done) {
    const wrap = el(`<div class="col"></div>`);
    wrap.innerHTML = `
      <div class="pill gold">KEY MOMENT</div>
      <div class="scene-wrap">${T.Minigames.scene(moment.scene)}</div>
      <div class="card"><p style="font-size:18px;font-weight:700;margin:0">${moment.prompt}</p></div>
      <div class="muted center" style="font-size:12px">Pick your move — then nail the skill challenge.</div>
      <div class="col" id="choices"></div>
    `;
    const choices = wrap.querySelector("#choices");
    moment.choices.forEach(choice => {
      const b = el(`<button class="btn">${choice.label}
        <span class="muted" style="font-weight:400;margin-left:6px">(${lbl(choice.stat)})</span></button>`);
      b.onclick = () => UI.playMomentGame(moment, choice, record, done);
      choices.appendChild(b);
    });
    const root = app(); root.innerHTML = ""; wrap.classList.add("screen"); root.appendChild(wrap);
  };

  // Step 2: play the skill-game for the chosen action, then resolve.
  UI.playMomentGame = function (moment, choice, record, done) {
    const p = T.game.player;
    const wrap = el(`<div class="col"></div>`);
    wrap.innerHTML = `
      <div class="pill gold">${choice.label.toUpperCase()}</div>
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
      const res = T.Moments.resolve(choice, gameResult.skill);
      res.gameText = gameResult.text;
      // apply deltas
      p.form = T.clamp(p.form + res.deltas.form, -10, 10);
      p.morale = T.clamp(p.morale + res.deltas.morale, 0, 100);
      record.goals += res.deltas.goals;
      record.rating = +T.clamp(record.rating + res.deltas.rating, 4, 9.9).toFixed(2);
      record.keyMoments.push({ id: moment.id, success: res.success });
      T.game.momentsLog.push({ season: T.game.season, text: res.text, success: res.success });
      setTimeout(() => UI.renderMomentResult(res, done), 350);
    });
  };

  UI.renderMomentResult = function (res, done) {
    const wrap = el(`<div class="col"></div>`);
    wrap.innerHTML = `
      <div style="height:6vh"></div>
      <div class="brand pop-in" style="font-size:28px;color:${res.success ? 'var(--good)' : 'var(--bad)'}">
        ${res.success ? "⚽ SUCCESS" : "✖ MISS"}
      </div>
      ${res.gameText ? `<div class="center muted">${res.gameText}</div>` : ``}
      <div class="card center"><p style="font-size:18px;margin:0">${res.text}</p></div>
      <button class="btn primary" id="cont">Continue</button>
    `;
    wrap.querySelector("#cont").onclick = done;
    const root = app(); root.innerHTML = ""; wrap.classList.add("screen"); root.appendChild(wrap);
    if (res.success) UI.confetti();
  };

  UI.renderResults = function (record, careerEnded) {
    const wrap = el(`<div class="col"></div>`);
    const trophyHtml = record.trophies.length
      ? `<div class="card center pop-in"><b class="gold" style="font-size:18px">🏆 ${record.trophies.join(" · ")}</b></div>`
      : ``;
    wrap.innerHTML = `
      <h2>Season #${record.season} · age ${record.age}</h2>
      <div class="muted">${record.club} · finished ${ordinal(record.finish)}</div>
      ${trophyHtml}
      <div class="card row between">
        ${chip("Apps", record.apps)}
        ${chip("Goals", record.goals)}
        ${chip("Assists", record.assists)}
        ${chip("Avg", record.rating)}
      </div>
      ${careerEnded ? `<div class="card center"><b class="gold">A serious injury has ended your career.</b></div>` : ``}
      <button class="btn primary" id="cont">${careerEnded ? "See Legacy" : "Continue"}</button>
    `;
    wrap.querySelector("#cont").onclick = () => UI.show(T.game.careerOver ? "retirement" : "hub");
    const root = app(); root.innerHTML = ""; wrap.classList.add("screen"); root.appendChild(wrap);
    if (record.trophies.length) UI.confetti();
  };

  // ---- Retirement / legacy summary -----------------------------------
  UI.screens.retirement = function () {
    const g = T.game, t = g.totals;
    const L = T.Legacy.compute();
    const wrap = el(`<div class="col"></div>`);
    wrap.innerHTML = `
      <div class="center">
        <div class="muted">FINAL TIER</div>
        <div class="brand pop-in" style="font-size:30px">${L.tier.toUpperCase()}</div>
        <div class="pill gold" style="font-size:16px">Legacy ${L.score.toLocaleString()}</div>
      </div>

      <div class="card">
        <b>${g.player.name}</b> · ${T.POSITIONS[g.player.position].label} · ${g.player.nation}
        <div class="muted" style="margin-top:4px">${g.history.length} seasons · retired at ${g.player.age}</div>
      </div>

      <div class="card row between">
        ${chip("Apps", t.apps)}
        ${chip("Goals", t.goals)}
        ${chip("Assists", t.assists)}
      </div>
      <div class="card row between">
        ${chip("Trophies", t.trophies)}
        ${chip("Awards", t.awards)}
        ${chip("Peak", t.peakRating)}
      </div>

      <div class="card">
        <b>Career timeline</b>
        <div class="col" style="margin-top:8px">
          ${g.history.map(h => `<div class="row between" style="font-size:14px">
            <span>S${h.season} · ${h.club}</span>
            <span class="muted">${h.goals}G ${h.assists}A · ${h.rating}</span>
          </div>`).join("") || `<span class="muted">No seasons played.</span>`}
        </div>
      </div>

      <button class="btn primary" id="again">New Career</button>
      <button class="btn ghost" id="title">Main Menu</button>
    `;
    wrap.querySelector("#again").onclick = () => { T.clearSave(); UI.show("create"); };
    wrap.querySelector("#title").onclick = () => UI.show("title");
    UI.confetti(120);
    return wrap;
  };

  // ---- Small render helpers ------------------------------------------
  function statBar(k, v) {
    return `<div class="stat">
      <div class="top"><span>${lbl(k)}</span><span class="val">${v}</span></div>
      <div class="bar"><span style="width:${v}%"></span></div>
    </div>`;
  }
  function chip(label, val) {
    return `<div class="center"><div class="muted" style="font-size:11px">${label}</div><b>${val}</b></div>`;
  }
  function ordinal(n) {
    const s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
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
