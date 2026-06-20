/* ============================================================
   TALISMAN — minigames.js
   Small interactive skill-games attached to key moments, plus SVG
   stadium scenes for visual flavor. Each game returns a `skill` in
   0..1 that moments.resolve() blends into the stat roll, so BOTH your
   attributes and your execution matter.

   Public API:
     T.Minigames.run(host, opts, onDone)
        host   : DOM element to render the game into
        opts   : { type, statVal, action, label }
        onDone : fn({ skill: 0..1, text }) called when the player finishes
     T.Minigames.scene(kind) -> SVG string (goal/pitch backdrop)

   Game types: "timingBar" | "aimTarget" | "reactionTap"

   TODO (future): add more types (1v1 dribble dodge, header timing),
   difficulty scaling per opponent, haptics, sound.
   ============================================================ */
(function () {
  const T = window.TALISMAN;
  const MG = (T.Minigames = {});

  // Track the active rAF so screen swaps can't leak loops.
  let _raf = null;
  function stopLoop() { if (_raf) cancelAnimationFrame(_raf); _raf = null; }

  MG.run = function (host, opts, onDone) {
    stopLoop();
    const type = opts.type || "timingBar";
    (MG._games[type] || MG._games.timingBar)(host, opts, (result) => {
      stopLoop();
      onDone(result);
    });
  };

  MG._games = {};

  // ---------------------------------------------------------------
  // 1) TIMING BAR — a marker sweeps across a track; tap to stop it in
  //    the sweet zone. Higher stat => wider sweet zone & slower sweep.
  //    Good for: power strikes, volleys, composure.
  // ---------------------------------------------------------------
  MG._games.timingBar = function (host, opts, onDone) {
    const stat = opts.statVal || 50;
    const zoneW = 14 + (stat / 99) * 22;                 // 14%..36%
    const left = T.clamp(50 - zoneW / 2 + T.rand(-16, 16), 3, 97 - zoneW);
    const center = left + zoneW / 2;
    const perfectW = zoneW * 0.32;                        // inner "perfect" band
    const speed = 1.45 - (stat / 99) * 0.5;              // %/frame, slower if skilled

    host.innerHTML = `
      <div class="mg">
        <div class="mg-hint">Tap <b>${opts.action || "STRIKE"}</b> as the marker hits the gold zone</div>
        <div class="mg-track">
          <div class="mg-zone" style="left:${left}%;width:${zoneW}%"></div>
          <div class="mg-zone perfect" style="left:${center - perfectW / 2}%;width:${perfectW}%"></div>
          <div class="mg-marker" id="mk"></div>
        </div>
        <button class="btn primary" id="hit">${opts.action || "STRIKE"}</button>
      </div>`;

    const mk = host.querySelector("#mk");
    let pos = 0, dir = 1, done = false;
    (function loop() {
      pos += dir * speed;
      if (pos >= 100) { pos = 100; dir = -1; }
      if (pos <= 0) { pos = 0; dir = 1; }
      mk.style.left = pos + "%";
      _raf = requestAnimationFrame(loop);
    })();

    host.querySelector("#hit").onclick = () => {
      if (done) return; done = true;
      stopLoop();
      const dist = Math.abs(pos - center);
      const half = zoneW / 2;
      let skill, text;
      if (dist <= perfectW / 2) { skill = T.rand(0.92, 1); text = "Perfectly struck!"; }
      else if (dist <= half) { skill = T.clamp(0.85 - (dist / half) * 0.35, 0.5, 0.85); text = "Clean contact."; }
      else { skill = T.clamp(0.45 - (dist - half) / 40, 0, 0.45); text = "Mistimed it."; }
      flash(mk, skill);
      onDone({ skill, text });
    };
  };

  // ---------------------------------------------------------------
  // 2) AIM TARGET — two-tap aim into a goal. Tap once to lock the
  //    horizontal, again to lock the vertical. Land near the gold
  //    target corner = great; land on the keeper = saved.
  //    Good for: penalties, placed finishes.
  // ---------------------------------------------------------------
  MG._games.aimTarget = function (host, opts, onDone) {
    const stat = opts.statVal || 50;
    // Target corner (top-left/right). Keeper guards centre band.
    const tx = T.rng() < 0.5 ? 14 : 86;
    const ty = 22;
    const sweep = 1.3 - (stat / 99) * 0.45; // line speed; slower if skilled

    host.innerHTML = `
      <div class="mg">
        <div class="mg-hint">Tap to lock <b>aim →</b> then <b>height ↑</b>. Hit the gold target, avoid the keeper.</div>
        <div class="goal" id="goal">
          <div class="goal-net"></div>
          <div class="keeper" id="keeper"></div>
          <div class="target" style="left:${tx}%;top:${ty}%"></div>
          <div class="aim-x" id="ax"></div>
          <div class="aim-y" id="ay" style="display:none"></div>
          <div class="ball" id="ball" style="display:none"></div>
        </div>
        <button class="btn primary" id="lock">LOCK AIM</button>
      </div>`;

    const ax = host.querySelector("#ax");
    const ay = host.querySelector("#ay");
    const ball = host.querySelector("#ball");
    const keeper = host.querySelector("#keeper");
    const lockBtn = host.querySelector("#lock");

    let phase = 0;          // 0 = pick x, 1 = pick y, 2 = done
    let xp = 0, xd = 1, yp = 0, yd = 1;
    let lockedX = 50, lockedY = 50;

    (function loop() {
      if (phase === 0) {
        xp += xd * sweep; if (xp >= 100) { xp = 100; xd = -1; } if (xp <= 0) { xp = 0; xd = 1; }
        ax.style.left = xp + "%";
      } else if (phase === 1) {
        yp += yd * (sweep * 0.9); if (yp >= 100) { yp = 100; yd = -1; } if (yp <= 0) { yp = 0; yd = 1; }
        ay.style.top = yp + "%";
      }
      _raf = requestAnimationFrame(loop);
    })();

    lockBtn.onclick = () => {
      if (phase === 0) {
        lockedX = xp; phase = 1;
        ax.style.left = lockedX + "%"; ax.classList.add("locked");
        ay.style.display = "block";
        lockBtn.textContent = "LOCK HEIGHT";
      } else if (phase === 1) {
        lockedY = yp; phase = 2; stopLoop();
        ay.style.top = lockedY + "%"; ay.classList.add("locked");

        // Keeper guards a centre band; reveal dive.
        const keeperX = 50 + T.rand(-18, 18);
        keeper.style.left = keeperX + "%";

        ball.style.display = "block";
        ball.style.left = lockedX + "%";
        ball.style.top = lockedY + "%";

        // skill: closeness to gold target, penalised if near keeper.
        const dTarget = Math.hypot(lockedX - tx, lockedY - ty);
        const dKeeper = Math.hypot(lockedX - keeperX, lockedY - 55);
        let skill = T.clamp(1 - dTarget / 70, 0, 1);
        let text;
        if (dKeeper < 16) { skill *= 0.25; text = "The keeper got a glove to it!"; }
        else if (skill > 0.8) text = "Bottom corner — unstoppable.";
        else if (skill > 0.5) text = "Good placement.";
        else text = "Telegraphed and tame.";
        flash(ball, skill);
        setTimeout(() => onDone({ skill, text }), 250);
      }
    };
  };

  // ---------------------------------------------------------------
  // 3) REACTION TAP — wait for the cue, then tap. Faster = better.
  //    Tap too early = fail. Higher stat widens the "good" window.
  //    Good for: pace bursts, rounding the keeper, timing a run.
  // ---------------------------------------------------------------
  MG._games.reactionTap = function (host, opts, onDone) {
    const stat = opts.statVal || 50;
    host.innerHTML = `
      <div class="mg">
        <div class="mg-hint">Wait for the green cue — then tap <b>NOW</b>. Don't jump early.</div>
        <button class="btn react wait" id="cue">WAIT…</button>
      </div>`;
    const cue = host.querySelector("#cue");
    let state = "wait", t0 = 0, done = false;

    const delay = T.rand(900, 2200);
    const timer = setTimeout(() => {
      if (done) return;
      state = "go"; t0 = performance.now();
      cue.classList.remove("wait"); cue.classList.add("go");
      cue.textContent = "NOW!";
    }, delay);

    cue.onclick = () => {
      if (done) return;
      if (state === "wait") {
        done = true; clearTimeout(timer);
        cue.classList.add("bad"); cue.textContent = "Too early!";
        flash(cue, 0);
        setTimeout(() => onDone({ skill: 0, text: "Jumped too soon — offside / lost it." }), 250);
        return;
      }
      // reacted
      done = true; clearTimeout(timer);
      const ms = performance.now() - t0;
      // map: fast (180ms) -> ~1, slow (520ms) -> ~0; stat widens leniency.
      const ceil = 520 + (stat / 99) * 120;
      let skill = T.clamp((ceil - ms) / (ceil - 170), 0, 1);
      let text = skill > 0.8 ? "Lightning quick!" : skill > 0.5 ? "Sharp." : "A beat slow.";
      cue.textContent = Math.round(ms) + " ms";
      flash(cue, skill);
      setTimeout(() => onDone({ skill, text }), 250);
    };
  };

  // ---------------------------------------------------------------
  // SVG stadium scenes (visual backdrop above the game).
  // ---------------------------------------------------------------
  MG.scene = function (kind) {
    // A simple floodlit goal + pitch, themed with CSS vars via inline colors.
    return `
    <svg class="scene" viewBox="0 0 360 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#12121a"/><stop offset="1" stop-color="#0a0a0f"/>
        </linearGradient>
        <radialGradient id="flood" cx="0.5" cy="0" r="1">
          <stop offset="0" stop-color="rgba(245,196,81,0.18)"/>
          <stop offset="1" stop-color="rgba(245,196,81,0)"/>
        </radialGradient>
      </defs>
      <rect width="360" height="150" fill="url(#sky)"/>
      <rect width="360" height="150" fill="url(#flood)"/>
      <!-- crowd dots -->
      ${crowd()}
      <!-- pitch -->
      <polygon points="0,150 360,150 300,86 60,86" fill="#0f1f12"/>
      <polygon points="60,86 300,86 300,88 60,88" fill="#16301c"/>
      <!-- goal -->
      <g stroke="#e9e9f2" stroke-width="2" fill="none" opacity="0.85">
        <rect x="135" y="58" width="90" height="34"/>
        <line x1="135" y1="58" x2="120" y2="50"/>
        <line x1="225" y1="58" x2="240" y2="50"/>
        <line x1="120" y1="50" x2="240" y2="50"/>
      </g>
      <!-- net hint -->
      <g stroke="rgba(233,233,242,0.18)" stroke-width="0.6">
        ${net()}
      </g>
      <!-- ball -->
      <circle cx="180" cy="128" r="5" fill="#f5f5f7" stroke="#0a0a0f" stroke-width="0.6"/>
    </svg>`;
  };

  function crowd() {
    let s = "";
    for (let i = 0; i < 90; i++) {
      const x = (i * 4.1) % 360;
      const y = 10 + ((i * 7) % 40);
      const c = ["#2a2a3a", "#33334a", "#222230"][i % 3];
      s += `<circle cx="${x.toFixed(0)}" cy="${y}" r="1.4" fill="${c}"/>`;
    }
    return s;
  }
  function net() {
    let s = "";
    for (let x = 138; x < 225; x += 8) s += `<line x1="${x}" y1="58" x2="${x}" y2="92"/>`;
    for (let y = 62; y < 92; y += 7) s += `<line x1="135" y1="${y}" x2="225" y2="${y}"/>`;
    return s;
  }

  // brief color flash on the active element to sell success/failure
  function flash(node, skill) {
    if (!node) return;
    const col = skill > 0.6 ? "var(--good)" : skill > 0.3 ? "var(--gold)" : "var(--bad)";
    node.style.boxShadow = `0 0 0 3px ${col}, 0 0 24px ${col}`;
    node.style.background = col;
  }
})();
