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

   Game types:
     "timingBar" | "aimTarget" | "reactionTap" | "dribbleDodge" |
     "oneOnOne" | "freeKick" | "oneTwo"

   TODO (future): difficulty scaling per opponent, haptics, sound.
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
  // 4) DRIBBLE DODGE — defenders rush up the pitch; tap LEFT/RIGHT to
  //    weave through the gaps. Each one you slip past adds skill; a
  //    collision ends the run. Higher stat = a touch more time to react.
  //    Good for: taking a man on, driving at the defence.
  // ---------------------------------------------------------------
  MG._games.dribbleDodge = function (host, opts, onDone) {
    const stat = opts.statVal || 50;
    const TOTAL = 6;                 // defenders to beat
    const speed = 0.85 + (stat / 99) * 0.5; // px/frame the runner climbs feels faster w/ skill? keep dribble flowing
    host.innerHTML = `
      <div class="mg">
        <div class="mg-hint">Weave through — tap <b>◀</b> / <b>▶</b> to dodge each defender</div>
        <div class="dribble" id="pitch">
          <div class="dd-lane"></div><div class="dd-lane"></div><div class="dd-lane"></div>
          <div class="dd-runner" id="run">●</div>
        </div>
        <div class="btn-row">
          <button class="btn step" id="left" style="flex:1;width:auto">◀</button>
          <button class="btn step" id="right" style="flex:1;width:auto">▶</button>
        </div>
        <div class="mg-hint" id="ddinfo">Beaten: 0 / ${TOTAL}</div>
      </div>`;

    const pitch = host.querySelector("#pitch");
    const runner = host.querySelector("#run");
    const info = host.querySelector("#ddinfo");
    const laneX = [16, 50, 84];      // % positions of 3 lanes
    let lane = 1;                    // runner starts centre
    let beaten = 0, done = false;
    let def = null;                  // current defender {el, lane, y}
    const place = () => { runner.style.left = laneX[lane] + "%"; };
    place();

    const spawn = () => {
      const dl = T.randInt(0, 2);
      const el2 = document.createElement("div");
      el2.className = "dd-def";
      el2.textContent = "▾";
      el2.style.left = laneX[dl] + "%";
      el2.style.top = "-12%";
      pitch.appendChild(el2);
      def = { el: el2, lane: dl, y: -12 };
    };
    spawn();

    const finish = () => {
      done = true; stopLoop();
      const skill = T.clamp(beaten / TOTAL, 0, 1);
      const text = skill >= 0.99 ? "Mazy run — beat them all!" : skill >= 0.6 ? "Skipped through midfield." : "Crowded out.";
      onDone({ skill, text });
    };

    (function loop() {
      if (def) {
        def.y += speed;
        def.el.style.top = def.y + "%";
        // collision zone around the runner's row (~78%)
        if (def.y >= 72 && def.y <= 86) {
          if (def.lane === lane) { flash(runner, 0); return finish(); }
        }
        if (def.y > 100) {
          pitch.removeChild(def.el);
          beaten++; info.textContent = `Beaten: ${beaten} / ${TOTAL}`;
          if (beaten >= TOTAL) { flash(runner, 1); return finish(); }
          def = null; spawn();
        }
      }
      _raf = requestAnimationFrame(loop);
    })();

    host.querySelector("#left").onclick = () => { if (!done) { lane = Math.max(0, lane - 1); place(); } };
    host.querySelector("#right").onclick = () => { if (!done) { lane = Math.min(2, lane + 1); place(); } };
  };

  // ---------------------------------------------------------------
  // 5) ONE-ON-ONE — the keeper rushes out, closing the angle. A green
  //    "shoot window" appears as he commits; tap SHOOT inside it. Too
  //    early and he blocks; too late and he smothers. Higher stat
  //    widens the window. Good for: rounding/beating the keeper.
  // ---------------------------------------------------------------
  MG._games.oneOnOne = function (host, opts, onDone) {
    const stat = opts.statVal || 50;
    const winW = 18 + (stat / 99) * 20;          // window width %
    const winStart = T.clamp(46 + T.rand(-8, 14), 30, 100 - winW - 4);
    const speed = 0.7;                            // keeper closing speed
    host.innerHTML = `
      <div class="mg">
        <div class="mg-hint">The keeper rushes out — tap <b>SHOOT</b> as the gold window opens</div>
        <div class="oo-track">
          <div class="oo-window" style="left:${winStart}%;width:${winW}%"></div>
          <div class="oo-keeper" id="kp">🧤</div>
        </div>
        <button class="btn primary" id="shoot">SHOOT</button>
      </div>`;
    const kp = host.querySelector("#kp");
    let pos = 0, done = false;
    (function loop() {
      pos += speed;
      kp.style.left = pos + "%";
      if (pos >= 100) {       // keeper closed you down
        if (!done) { done = true; stopLoop(); flash(kp, 0); onDone({ skill: 0.1, text: "Dithered — keeper smothered it." }); }
        return;
      }
      _raf = requestAnimationFrame(loop);
    })();
    host.querySelector("#shoot").onclick = () => {
      if (done) return; done = true; stopLoop();
      const center = winStart + winW / 2;
      const dist = Math.abs(pos - center);
      let skill, text;
      if (pos >= winStart && pos <= winStart + winW) {
        skill = T.clamp(1 - dist / (winW), 0.6, 1); text = "Perfect — slotted past him!";
      } else if (pos < winStart) {
        skill = T.clamp(0.4 - (winStart - pos) / 60, 0, 0.4); text = "Too early — he blocked it.";
      } else {
        skill = T.clamp(0.4 - (pos - winStart - winW) / 60, 0, 0.4); text = "Left it late — he got a touch.";
      }
      flash(kp, skill);
      onDone({ skill, text });
    };
  };

  // ---------------------------------------------------------------
  // 6) FREE KICK — curl it over the wall. First set POWER (a sweeping
  //    meter, land it in the gold band), then PLACEMENT (an aim line
  //    sweeps across goal — pick the corner, clear the wall). Skill
  //    blends both; a low shot into the wall is charged down.
  //    Good for: dead-ball specialists, set-piece moments.
  // ---------------------------------------------------------------
  MG._games.freeKick = function (host, opts, onDone) {
    const stat = opts.statVal || 50;
    const tx = T.rng() < 0.5 ? 13 : 87;                 // target corner
    const pzW = 16 + (stat / 99) * 22;                  // power gold band width
    const pzL = T.clamp(54 - pzW / 2 + T.rand(-10, 10), 24, 94 - pzW);
    const wallL = 36, wallR = 64;                        // wall blocks low centre
    const pSpeed = 1.5 - (stat / 99) * 0.5;
    const aSpeed = 1.3 - (stat / 99) * 0.45;

    host.innerHTML = `
      <div class="mg">
        <div class="mg-hint">Curl it over the wall — set <b>power</b>, then <b>placement</b></div>
        <div class="goal fk-goal">
          <div class="target" style="left:${tx}%;top:20%"></div>
          <div class="fk-wall"></div>
          <div class="aim-x" id="ax" style="display:none"></div>
          <div class="ball" id="ball" style="left:50%;top:90%"></div>
        </div>
        <div class="mg-track" id="ptrack">
          <div class="mg-zone" style="left:${pzL}%;width:${pzW}%"></div>
          <div class="mg-zone perfect" style="left:${pzL + pzW * 0.34}%;width:${pzW * 0.32}%"></div>
          <div class="mg-marker" id="pmk"></div>
        </div>
        <button class="btn primary" id="go">SET POWER</button>
      </div>`;

    const pmk = host.querySelector("#pmk");
    const ax = host.querySelector("#ax");
    const ball = host.querySelector("#ball");
    const goBtn = host.querySelector("#go");
    const pCenter = pzL + pzW / 2;

    let phase = 0, pos = 0, dir = 1, powerScore = 0, done = false;
    (function loop() {
      if (phase === 0) {
        pos += dir * pSpeed; if (pos >= 100) { pos = 100; dir = -1; } if (pos <= 0) { pos = 0; dir = 1; }
        pmk.style.left = pos + "%";
      } else if (phase === 1) {
        pos += dir * aSpeed; if (pos >= 100) { pos = 100; dir = -1; } if (pos <= 0) { pos = 0; dir = 1; }
        ax.style.left = pos + "%";
      }
      _raf = requestAnimationFrame(loop);
    })();

    goBtn.onclick = () => {
      if (done) return;
      if (phase === 0) {
        powerScore = T.clamp(1 - Math.abs(pos - pCenter) / (pzW * 0.9), 0, 1);
        pmk.style.left = pos + "%"; flash(pmk, powerScore);
        phase = 1; pos = 0; dir = 1;
        ax.style.display = "block";
        goBtn.textContent = "BEND IT";
      } else if (phase === 1) {
        done = true; stopLoop();
        const x = pos;
        ax.style.left = x + "%"; ax.classList.add("locked");
        ball.style.left = x + "%"; ball.style.top = "22%";
        const aimScore = T.clamp(1 - Math.abs(x - tx) / 62, 0, 1);
        const blocked = (x > wallL && x < wallR && powerScore < 0.5);
        let skill = T.clamp(powerScore * 0.45 + aimScore * 0.55, 0, 1);
        let text;
        if (blocked) { skill *= 0.3; text = "Smacked the wall."; }
        else if (skill > 0.82) text = "Whipped it into the top corner!";
        else if (skill > 0.5) text = "Good hit — keeper scrambling.";
        else text = "Dragged off target.";
        flash(ball, skill);
        setTimeout(() => onDone({ skill, text }), 280);
      }
    };
  };

  // ---------------------------------------------------------------
  // 7) ONE-TWO — a give-and-go rhythm. Three taps in sequence (PASS →
  //    RETURN → FINISH); each time a marker sweeps a track, stop it in
  //    the gold zone. Your combined timing is the skill. Higher stat =
  //    wider zones. Good for: link-up play, quick combinations.
  // ---------------------------------------------------------------
  MG._games.oneTwo = function (host, opts, onDone) {
    const stat = opts.statVal || 50;
    const steps = ["PASS", "RETURN", "FINISH"];
    const zoneW = 16 + (stat / 99) * 22;
    const speed = 1.4 - (stat / 99) * 0.45;

    host.innerHTML = `
      <div class="mg">
        <div class="mg-hint">Give &amp; go — stop each pass in the gold zone</div>
        <div class="ot-steps" id="steps">
          ${steps.map((s, i) => `<span class="ot-step" data-i="${i}">${s}</span>`).join("")}
        </div>
        <div class="mg-track">
          <div class="mg-zone" id="zone"></div>
          <div class="mg-marker" id="mk"></div>
        </div>
        <button class="btn primary" id="hit" data-step="0">PASS</button>
      </div>`;

    const mk = host.querySelector("#mk");
    const zone = host.querySelector("#zone");
    const hit = host.querySelector("#hit");
    const stepEls = host.querySelectorAll(".ot-step");
    let step = 0, pos = 0, dir = 1, done = false;
    const scores = [];

    const placeZone = () => {
      const left = T.clamp(T.rand(8, 92 - zoneW), 4, 92 - zoneW);
      zone.style.left = left + "%"; zone.style.width = zoneW + "%";
      zone.dataset.center = left + zoneW / 2;
    };
    placeZone();

    (function loop() {
      pos += dir * speed; if (pos >= 100) { pos = 100; dir = -1; } if (pos <= 0) { pos = 0; dir = 1; }
      mk.style.left = pos + "%";
      _raf = requestAnimationFrame(loop);
    })();

    hit.onclick = () => {
      if (done) return;
      const center = +zone.dataset.center;
      const s = T.clamp(1 - Math.abs(pos - center) / (zoneW * 0.95), 0, 1);
      scores.push(s);
      stepEls[step].classList.add(s > 0.5 ? "good" : "bad");
      flash(mk, s);
      step++;
      if (step >= steps.length) {
        done = true; stopLoop();
        const skill = T.clamp(scores.reduce((a, b) => a + b, 0) / scores.length, 0, 1);
        const text = skill > 0.8 ? "Slick one-two — and finished!" : skill > 0.5 ? "Worked the angle nicely." : "The move broke down.";
        setTimeout(() => onDone({ skill, text }), 260);
        return;
      }
      // next leg
      dir = 1; pos = 0; placeZone();
      hit.textContent = steps[step];
      hit.dataset.step = step;
    };
  };

  // ---------------------------------------------------------------
  // SVG stadium scenes (visual backdrop above the game).
  // ---------------------------------------------------------------
  MG.scene = function (kind) {
    const isPitch = kind === "pitch";       // open-play backdrop (dribble / one-two)
    const isWall = kind === "wall";         // free-kick: defensive wall in front of goal
    return `
    <svg class="scene" viewBox="0 0 360 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#15151f"/><stop offset="1" stop-color="#0a0a0f"/>
        </linearGradient>
        <radialGradient id="flood" cx="0.5" cy="0" r="1.1">
          <stop offset="0" stop-color="rgba(245,196,81,0.22)"/>
          <stop offset="1" stop-color="rgba(245,196,81,0)"/>
        </radialGradient>
        <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#16331d"/><stop offset="1" stop-color="#0c1f12"/>
        </linearGradient>
      </defs>
      <rect width="360" height="150" fill="url(#sky)"/>
      <!-- floodlight beams -->
      <polygon points="40,0 18,0 70,86 96,86" fill="rgba(245,196,81,0.05)"/>
      <polygon points="320,0 342,0 290,86 264,86" fill="rgba(90,209,255,0.05)"/>
      <rect width="360" height="150" fill="url(#flood)"/>
      <!-- stands + crowd -->
      <rect x="0" y="0" width="360" height="86" fill="#0d0d15"/>
      ${crowd()}
      <!-- floodlight pylons -->
      <g fill="#2a2a3a"><rect x="34" y="6" width="3" height="30"/><rect x="323" y="6" width="3" height="30"/>
        <circle cx="35" cy="6" r="4" fill="rgba(245,196,81,.5)"/><circle cx="325" cy="6" r="4" fill="rgba(245,196,81,.5)"/></g>
      <!-- pitch with mown stripes -->
      <polygon points="0,150 360,150 300,86 60,86" fill="url(#grass)"/>
      ${stripes()}
      <polygon points="60,86 300,86 300,88 60,88" fill="#1d3a25"/>
      ${isPitch ? `
        <!-- centre circle for open play -->
        <ellipse cx="180" cy="124" rx="46" ry="14" fill="none" stroke="rgba(233,233,242,.16)" stroke-width="1.2"/>
        <line x1="0" y1="118" x2="360" y2="118" stroke="rgba(233,233,242,.10)" stroke-width="1"/>
        <circle cx="180" cy="124" r="2.4" fill="rgba(233,233,242,.4)"/>
      ` : `
        <!-- goal -->
        <g stroke="#eef" stroke-width="2.4" fill="none" opacity="0.92">
          <rect x="132" y="54" width="96" height="38"/>
          <line x1="132" y1="54" x2="116" y2="46"/>
          <line x1="228" y1="54" x2="244" y2="46"/>
          <line x1="116" y1="46" x2="244" y2="46"/>
        </g>
        <g stroke="rgba(233,233,242,0.16)" stroke-width="0.6">${net()}</g>
        <!-- keeper -->
        <g transform="translate(180,74)"><circle cx="0" cy="-9" r="4" fill="#5ad1ff"/>
          <rect x="-6" y="-5" width="12" height="16" rx="3" fill="rgba(90,209,255,.7)"/></g>
        ${isWall ? `<!-- defensive wall -->
          <g fill="#202031" stroke="#11111a" stroke-width="0.5">
            ${[150, 162, 174, 186, 198].map(x => `<rect x="${x}" y="98" width="9" height="22" rx="2"/>`).join("")}
          </g>` : ``}
      `}
      <!-- ball -->
      <circle cx="180" cy="${isPitch ? 134 : 130}" r="5" fill="#f8f8fc" stroke="#0a0a0f" stroke-width="0.6"/>
      <ellipse cx="180" cy="${isPitch ? 139 : 135}" rx="6" ry="1.6" fill="rgba(0,0,0,.4)"/>
    </svg>`;
  };

  function crowd() {
    let s = "";
    for (let i = 0; i < 150; i++) {
      const x = (i * 2.41) % 360;
      const y = 8 + ((i * 11) % 70);
      const c = ["#2a2a3a", "#33334a", "#222230", "#3a3450"][i % 4];
      s += `<circle cx="${x.toFixed(0)}" cy="${y}" r="1.3" fill="${c}"/>`;
    }
    return s;
  }
  function stripes() {
    let s = "";
    // alternating mown bands receding toward the goal line
    for (let i = 0; i < 6; i += 2) {
      const y0 = 150 - i * 10.6, y1 = 150 - (i + 1) * 10.6;
      const xa = (i / 6) * 60, xb = ((i + 1) / 6) * 60;
      s += `<polygon points="${xa},${y0} ${360 - xa},${y0} ${360 - xb},${y1} ${xb},${y1}" fill="rgba(255,255,255,0.018)"/>`;
    }
    return s;
  }
  function net() {
    let s = "";
    for (let x = 135; x <= 228; x += 8) s += `<line x1="${x}" y1="54" x2="${x}" y2="92"/>`;
    for (let y = 58; y < 92; y += 7) s += `<line x1="132" y1="${y}" x2="228" y2="${y}"/>`;
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
