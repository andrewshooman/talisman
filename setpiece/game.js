/* ============================================================
   SET PIECE — game.js
   Canvas rendering, swipe input, sound, screens and storage.
   All rules and physics live in core.js (window.SP).
   ============================================================ */
(function () {
  "use strict";
  const SP = window.SP;
  const $ = (id) => document.getElementById(id);
  const cv = $("cv"), ctx = cv.getContext("2d");
  const clamp = SP.clamp;

  const SITE_URL = "https://andrewshooman.github.io/talisman/setpiece/";
  const CAM_BACK = 5.5, CAM_H = 3.2;

  let W = 0, H = 0, DPR = 1, F = 1, CY = 0;

  // ---- storage (never throws) -----------------------------------------
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };

  // ---- anonymous play counters ------------------------------------------
  // Plain counters only (no cookies, no ids). Skipped on localhost / file://.
  const TRACK = { base: "https://abacus.jasoncameron.dev/hit/", ns: "setpiece-k7q2" };
  const ymd = (d) => { const x = d || new Date(); return x.getFullYear() * 10000 + (x.getMonth() + 1) * 100 + x.getDate(); };
  function track(key) {
    try {
      if (!/^https?:$/.test(location.protocol) || /^(localhost|127\.|\[::1\])/.test(location.hostname)) return;
      [key, key + "_" + ymd()].forEach((k) => {
        fetch(TRACK.base + TRACK.ns + "/" + k, { keepalive: true, mode: "cors" }).catch(() => {});
      });
    } catch (e) {}
  }
  function trackVisit() {
    const today = ymd(), first = store.get("sp.first", null), last = store.get("sp.lastVisit", null);
    if (last === today) return;
    store.set("sp.lastVisit", today);
    track("visit");
    if (!first) { store.set("sp.first", today); store.set("sp.firstDay", SP.dayNumber()); track("new_player"); }
    else if (SP.dayNumber() - store.get("sp.firstDay", SP.dayNumber()) === 1) track("return_d1");
    else track("return_later");
  }

  // ---- game state ---------------------------------------------------------
  const G = {
    mode: "menu",            // menu | aim | flight | between | done
    daily: true, dayNum: SP.dayNumber(), shots: [], idx: 0, results: [], points: 0,
    shot: null, sim: null, cam: null, swipe: null, evIdx: 0, excite: 0.15,
    fx: { shake: 0, flash: 0, parts: [], net: null, trail: [], spinAng: 0 },
    practice: { goals: 0, taken: 0 }, t: 0, betweenT: 0, kitHue: 0, tut: !store.get("sp.tut", false),
  };

  // ---- camera ---------------------------------------------------------------
  function makeCam(shot) {
    const bl = Math.hypot(shot.bx, shot.bz), ux = shot.bx / bl, uz = shot.bz / bl;
    const C = { x: shot.bx + ux * CAM_BACK, y: CAM_H, z: shot.bz + uz * CAM_BACK };
    let fx = 0 - C.x, fy = 1.1 - C.y, fz = 0 - C.z;
    const fl = Math.hypot(fx, fy, fz); fx /= fl; fy /= fl; fz /= fl;
    let rx = -fz, rz = fx; const rl = Math.hypot(rx, rz); rx /= rl; rz /= rl;      // right = f x up
    const ux2 = -rz * fy, uy2 = rz * fx - rx * fz, uz2 = rx * fy;                 // up = right x f
    return { C, f: { x: fx, y: fy, z: fz }, r: { x: rx, y: 0, z: rz }, u: { x: ux2, y: uy2, z: uz2 } };
  }
  function proj(x, y, z) {
    const c = G.cam, dx = x - c.C.x, dy = y - c.C.y, dz = z - c.C.z;
    const zc = dx * c.f.x + dy * c.f.y + dz * c.f.z;
    if (zc < 0.2) return null;
    const xc = dx * c.r.x + dz * c.r.z, yc = dx * c.u.x + dy * c.u.y + dz * c.u.z;
    const sh = G.fx.shake;
    return { x: W / 2 + F * xc / zc + (sh ? (Math.random() - 0.5) * sh : 0),
             y: CY - F * yc / zc + (sh ? (Math.random() - 0.5) * sh : 0), s: F / zc, z: zc };
  }
  // Screen point -> point on the goal plane (z = 0).
  function toGoalPlane(sx, sy) {
    const c = G.cam, a = (sx - W / 2) / F, b = (CY - sy) / F;
    const dx = c.f.x + c.r.x * a + c.u.x * b, dy = c.f.y + c.u.y * b, dz = c.f.z + c.r.z * a + c.u.z * b;
    if (dz > -0.05) return { x: sx < W / 2 ? -30 : 30, y: 12 };
    const t = -c.C.z / dz;
    return { x: c.C.x + dx * t, y: c.C.y + dy * t };
  }

  // ---- sound (all synthesised) -------------------------------------------
  let AC = null, master = null, crowdGain = null, muted = store.get("sp.mute", false);
  function audioInit() {
    if (AC || muted) return;
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain(); master.gain.value = 0.7; master.connect(AC.destination);
      const len = AC.sampleRate * 2, buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
      const src = AC.createBufferSource(); src.buffer = buf; src.loop = true;
      const lp = AC.createBiquadFilter(); lp.type = "bandpass"; lp.frequency.value = 700; lp.Q.value = 0.4;
      crowdGain = AC.createGain(); crowdGain.gain.value = 0.25;
      src.connect(lp); lp.connect(crowdGain); crowdGain.connect(master); src.start();
    } catch (e) { AC = null; }
  }
  function noise(dur, type, freq, gain, q) {
    if (!AC) return;
    const len = Math.floor(AC.sampleRate * dur), buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = AC.createBufferSource(); src.buffer = buf;
    const fl = AC.createBiquadFilter(); fl.type = type; fl.frequency.value = freq; fl.Q.value = q || 0.7;
    const g = AC.createGain(); g.gain.value = gain;
    src.connect(fl); fl.connect(g); g.connect(master); src.start();
  }
  function tone(f0, f1, dur, gain, type) {
    if (!AC) return;
    const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime;
    o.type = type || "sine"; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function swell(peak, hold, fall) {
    if (!AC || !crowdGain) return;
    const t = AC.currentTime, g = crowdGain.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(peak, t + 0.15); g.setValueAtTime(peak, t + 0.15 + hold);
    g.linearRampToValueAtTime(0.25, t + 0.15 + hold + fall);
  }
  const sfx = {
    kick() { tone(150, 45, 0.14, 0.9); noise(0.07, "lowpass", 900, 0.5); buzz(18); },
    wall() { tone(110, 60, 0.12, 0.6); noise(0.09, "lowpass", 500, 0.5); buzz(30); swell(0.4, 0.2, 0.8); },
    post() { tone(1250, 1180, 0.5, 0.35, "triangle"); tone(1900, 1820, 0.35, 0.2, "triangle"); buzz([20, 30, 40]); swell(0.7, 0.3, 1.2); },
    save() { noise(0.12, "lowpass", 700, 0.7); tone(200, 90, 0.1, 0.4); buzz(35); swell(0.45, 0.2, 1.0); },
    goal() { noise(0.35, "bandpass", 2600, 0.45, 0.6); swell(1.6, 1.0, 2.2); buzz([40, 40, 80]); },
    miss() { swell(0.5, 0.15, 0.9); },
    whistle() { tone(2850, 2900, 0.22, 0.12, "square"); },
    bounce() { tone(120, 70, 0.06, 0.2); },
  };
  function buzz(p) { try { if (navigator.vibrate && !muted) navigator.vibrate(p); } catch (e) {} }

  // ---- layout ---------------------------------------------------------------
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    F = Math.min(W * 2.6, H * 1.22);      // keeps the ball on screen in landscape too
    CY = H * 0.36;
  }
  window.addEventListener("resize", resize);

  // Pre-rendered crowd texture.
  const crowdTex = document.createElement("canvas");
  (function () {
    crowdTex.width = 256; crowdTex.height = 96;
    const c = crowdTex.getContext("2d"), r = SP.makeRng(99);
    c.fillStyle = "#10162e"; c.fillRect(0, 0, 256, 96);
    for (let i = 0; i < 2600; i++) {
      const x = r() * 256, y = r() * 96, v = r();
      c.fillStyle = v < 0.5 ? `hsl(${220 + r() * 40},25%,${18 + r() * 22}%)` : v < 0.8 ? `hsl(${r() * 360},45%,${35 + r() * 20}%)` : `hsl(30,40%,${55 + r() * 20}%)`;
      c.fillRect(x, y, 2.2, 2.6);
    }
  })();

  // ---- drawing helpers ------------------------------------------------------
  function quad(pts, fill) {
    const p = pts.map((q) => proj(q[0], q[1], q[2]));
    if (p.some((q) => !q)) return;
    ctx.beginPath(); ctx.moveTo(p[0].x, p[0].y);
    for (let i = 1; i < p.length; i++) ctx.lineTo(p[i].x, p[i].y);
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  }
  function line3(a, b) {
    const p = proj(a[0], a[1], a[2]), q = proj(b[0], b[1], b[2]);
    if (!p || !q) return;
    ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
  }
  function groundLine(x0, z0, x1, z1) {
    const zmax = G.cam.C.z - 1.5;
    if (z0 > zmax && z1 > zmax) return;
    if (z0 > zmax) { x0 = x1 + (x0 - x1) * (zmax - z1) / (z0 - z1); z0 = zmax; }
    if (z1 > zmax) { x1 = x0 + (x1 - x0) * (zmax - z0) / (z1 - z0); z1 = zmax; }
    line3([x0, 0, z0], [x1, 0, z1]);
  }

  function drawBackdrop() {
    const sky = ctx.createLinearGradient(0, 0, 0, CY + 40);
    sky.addColorStop(0, "#050816"); sky.addColorStop(1, "#1a2757");
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

    // Stand behind the goal.
    const base = proj(0, 0, -7), top = proj(0, 15, -24);
    if (base && top) {
      const y0 = top.y, y1 = base.y;
      ctx.save();
      ctx.beginPath(); ctx.rect(0, y0, W, y1 - y0); ctx.clip();
      const sc = (y1 - y0) / 96;
      const tw = 256 * sc, off = ((W / 2 - (proj(0, 0, -7).x)) % tw);
      for (let x = -tw - off; x < W + tw; x += tw) ctx.drawImage(crowdTex, x, y0, tw + 1, y1 - y0);
      // Camera flashes: more when the crowd is excited.
      const n = Math.floor(3 + G.excite * 40);
      ctx.fillStyle = "#fff";
      for (let i = 0; i < n; i++) {
        const fx = Math.random() * W, fy = y0 + Math.random() * (y1 - y0), r = 0.8 + Math.random() * 1.6;
        ctx.globalAlpha = 0.5 + Math.random() * 0.5;
        ctx.beginPath(); ctx.arc(fx, fy, r, 0, 6.3); ctx.fill();
      }
      ctx.globalAlpha = 1;
      const shade = ctx.createLinearGradient(0, y0, 0, y1);
      shade.addColorStop(0, "rgba(5,8,22,0.75)"); shade.addColorStop(0.5, "rgba(5,8,22,0.1)"); shade.addColorStop(1, "rgba(5,8,22,0.35)");
      ctx.fillStyle = shade; ctx.fillRect(0, y0, W, y1 - y0);
      ctx.restore();
      ctx.fillStyle = "#0a0f24"; ctx.fillRect(0, y0 - 14, W, 14);       // roof edge
      // Floodlights.
      [[0.12, y0 - 34], [0.88, y0 - 34]].forEach(([fxp, fyp]) => {
        const g = ctx.createRadialGradient(W * fxp, fyp, 2, W * fxp, fyp, W * 0.5);
        g.addColorStop(0, "rgba(255,255,235,0.95)"); g.addColorStop(0.06, "rgba(220,230,255,0.35)"); g.addColorStop(1, "rgba(200,220,255,0)");
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * 0.7);
      });
    }
  }

  function drawPitch() {
    const zmax = G.cam.C.z - 1.5;
    const horizon = proj(0, 0, -7);
    ctx.fillStyle = "#1c7a36"; ctx.fillRect(0, horizon ? horizon.y : CY, W, H);
    // Mowing stripes.
    for (let z = -7, i = 0; z < zmax; z += 5, i++) {
      const z1 = Math.min(z + 5, zmax);
      quad([[-60, 0, z], [60, 0, z], [60, 0, z1], [-60, 0, z1]], i % 2 ? "#1f8a3c" : "#197533");
    }
    // Advertising boards.
    const bl = proj(-40, 0, -6.5), br = proj(40, 0, -6.5), tl = proj(-40, 1, -6.5), tr = proj(40, 1, -6.5);
    if (bl && br && tl && tr) {
      ctx.beginPath(); ctx.moveTo(tl.x, tl.y); ctx.lineTo(tr.x, tr.y); ctx.lineTo(br.x, br.y); ctx.lineTo(bl.x, bl.y); ctx.closePath();
      ctx.fillStyle = "#0d1a4a"; ctx.fill();
      const hgt = Math.abs(bl.y - tl.y);
      ctx.fillStyle = "rgba(255,201,64,0.9)"; ctx.font = `800 ${Math.max(7, hgt * 0.62)}px sans-serif`; ctx.textBaseline = "middle";
      const label = "SET PIECE  ·  THE DAILY FREE KICK  ·  ";
      const mid = proj(0, 0.5, -6.5), step = Math.max(40, ctx.measureText(label).width);
      for (let x = (mid.x % step) - step; x < W + step; x += step) ctx.fillText(label, x, (tl.y + bl.y) / 2);
    }
    // Markings.
    ctx.strokeStyle = "rgba(255,255,255,0.75)"; ctx.lineWidth = Math.max(1.5, W / 260); ctx.lineCap = "round";
    ctx.beginPath();
    groundLine(-34, 0, 34, 0);
    groundLine(-9.16, 0, -9.16, 5.5); groundLine(9.16, 0, 9.16, 5.5); groundLine(-9.16, 5.5, 9.16, 5.5);
    groundLine(-20.16, 0, -20.16, 16.5); groundLine(20.16, 0, 20.16, 16.5); groundLine(-20.16, 16.5, 20.16, 16.5);
    for (let a = -0.92; a < 0.92; a += 0.115) {            // the "D"
      groundLine(Math.sin(a) * 9.15, 11 + Math.cos(a) * 9.15, Math.sin(a + 0.115) * 9.15, 11 + Math.cos(a + 0.115) * 9.15);
    }
    ctx.stroke();
    const spot = proj(0, 0, 11);
    if (spot) { ctx.fillStyle = "rgba(255,255,255,0.8)"; ctx.beginPath(); ctx.ellipse(spot.x, spot.y, 0.12 * spot.s, 0.05 * spot.s, 0, 0, 6.3); ctx.fill(); }
  }

  // Net depth behind the line at height y, plus the bulge where the ball hit.
  function netZ(x, y) {
    let z = -1.9 + 0.9 * (y / SP.GOAL_H);
    const n = G.fx.net;
    if (n) {
      const age = G.t - n.t0;
      const amp = 0.75 * Math.exp(-2.2 * age) * (0.55 + 0.45 * Math.cos(13 * age));
      z -= amp * Math.exp(-((x - n.x) * (x - n.x) + (y - n.y) * (y - n.y)) / 1.1);
    }
    return z;
  }
  function drawNet() {
    const gh = SP.GOAL_H, hw = SP.GOAL_HALF;
    ctx.strokeStyle = "rgba(235,240,255,0.33)"; ctx.lineWidth = 1; ctx.beginPath();
    for (let i = 0; i <= 12; i++) {                         // back net verticals
      const x = -hw + i * (2 * hw / 12);
      for (let j = 0; j < 6; j++) { const y0 = j * gh / 6, y1 = (j + 1) * gh / 6; line3([x, y0, netZ(x, y0)], [x, y1, netZ(x, y1)]); }
      line3([x, gh, 0], [x, gh, netZ(x, gh)]);              // roof
    }
    for (let j = 0; j <= 6; j++) {                          // back net horizontals + sides
      const y = j * gh / 6;
      for (let i = 0; i < 12; i++) { const x0 = -hw + i * (2 * hw / 12), x1 = x0 + 2 * hw / 12; line3([x0, y, netZ(x0, y)], [x1, y, netZ(x1, y)]); }
      line3([-hw, y, 0], [-hw, y, netZ(-hw, y)]); line3([hw, y, 0], [hw, y, netZ(hw, y)]);
    }
    for (let k = 1; k < 3; k++) { const zz = -0.33 * k; line3([-hw, gh, zz], [hw, gh, zz]); }
    ctx.stroke();
  }
  function drawFrame() {
    const gh = SP.GOAL_H, hw = SP.GOAL_HALF, c = proj(0, 1.2, 0);
    if (!c) return;
    ctx.strokeStyle = "#f4f6fb"; ctx.lineWidth = Math.max(3, 0.13 * c.s); ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); line3([-hw, 0, 0], [-hw, gh, 0]); line3([-hw, gh, 0], [hw, gh, 0]); line3([hw, gh, 0], [hw, 0, 0]); ctx.stroke();
  }

  // A simple stylised player drawn at a projected foot point.
  function drawFigure(p, o) {
    const s = p.s * (o.h || 1.8) / 1.8;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath(); ctx.ellipse(p.x, p.y, 0.34 * s, 0.09 * s, 0, 0, 6.3); ctx.fill();
    ctx.translate(p.x, p.y - (o.lift || 0) * p.s);
    if (o.rot) { ctx.translate(0, -0.95 * s); ctx.rotate(o.rot); ctx.translate(0, 0.95 * s); }
    const R = (x, y, w, h, r, col) => {
      ctx.fillStyle = col; ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x * s, -y * s - h * s, w * s, h * s, r * s); else ctx.rect(x * s, -y * s - h * s, w * s, h * s);
      ctx.fill();
    };
    const crouch = o.crouch || 0;
    R(-0.19, 0, 0.15, 0.36, 0.05, o.socks); R(0.04, 0, 0.15, 0.36, 0.05, o.socks);        // socks
    R(-0.19, 0.34, 0.15, 0.46 - crouch, 0.05, o.skin); R(0.04, 0.34, 0.15, 0.46 - crouch, 0.05, o.skin);
    R(-0.23, 0.74 - crouch, 0.46, 0.3, 0.07, o.shorts);
    R(-0.25, 0.98 - crouch, 0.5, 0.56, 0.12, o.kit);
    if (o.stripe) R(-0.05, 0.98 - crouch, 0.1, 0.56, 0, o.stripe);
    const sy = 1.46 - crouch;
    if (o.arms === "up") {              // keeper reaching
      R(-0.36, sy - 0.02, 0.13, 0.62, 0.06, o.kit); R(0.23, sy - 0.02, 0.13, 0.62, 0.06, o.kit);
      R(-0.38, sy + 0.56, 0.17, 0.17, 0.06, o.gloves); R(0.21, sy + 0.56, 0.17, 0.17, 0.06, o.gloves);
    } else if (o.arms === "ready") {    // keeper set
      R(-0.5, sy - 0.34, 0.28, 0.12, 0.06, o.kit); R(0.22, sy - 0.34, 0.28, 0.12, 0.06, o.kit);
      R(-0.58, sy - 0.38, 0.16, 0.17, 0.06, o.gloves); R(0.42, sy - 0.38, 0.16, 0.17, 0.06, o.gloves);
    } else {                            // wall: hands held in front
      R(-0.34, sy - 0.5, 0.12, 0.5, 0.06, o.kit); R(0.22, sy - 0.5, 0.12, 0.5, 0.06, o.kit);
      R(-0.12, 0.8 - crouch, 0.24, 0.13, 0.05, o.skin);
    }
    ctx.fillStyle = o.skin; ctx.beginPath(); ctx.arc(0, -(1.66 - crouch) * s, 0.125 * s, 0, 6.3); ctx.fill();
    ctx.fillStyle = o.hair; ctx.beginPath(); ctx.arc(0, -(1.69 - crouch) * s, 0.128 * s, Math.PI, 0); ctx.fill();
    ctx.restore();
  }

  function drawBall(b) {
    const p = proj(b.x, b.y, b.z), g = proj(b.x, 0, b.z);
    if (!p) return;
    const r = Math.max(2.5, SP.BALL_R * p.s);
    if (g && b.z > -0.2) {
      const a = clamp(0.4 - b.y * 0.08, 0.08, 0.4);
      ctx.fillStyle = `rgba(0,0,0,${a})`;
      ctx.beginPath(); ctx.ellipse(g.x, g.y, SP.BALL_R * g.s * 1.15, SP.BALL_R * g.s * 0.42, 0, 0, 6.3); ctx.fill();
    }
    const tr = G.fx.trail;
    for (let i = 1; i < tr.length; i++) {
      const a = i / tr.length;
      ctx.strokeStyle = `rgba(255,255,255,${a * 0.35})`; ctx.lineWidth = Math.max(1, tr[i].r * 1.5 * a); ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(tr[i - 1].x, tr[i - 1].y); ctx.lineTo(tr[i].x, tr[i].y); ctx.stroke();
    }
    const grad = ctx.createRadialGradient(p.x - r * 0.35, p.y - r * 0.4, r * 0.1, p.x, p.y, r);
    grad.addColorStop(0, "#ffffff"); grad.addColorStop(1, "#b9c0cf");
    ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.3); ctx.fill();
    if (r > 4) {
      ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.3); ctx.clip();
      ctx.fillStyle = "#1d2233";
      for (let i = 0; i < 3; i++) {
        const a = G.fx.spinAng + i * 2.094;
        ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * r * 0.55, p.y + Math.sin(a) * r * 0.55, r * 0.3, 0, 6.3); ctx.fill();
      }
      ctx.restore();
    }
  }

  function kitColors() {
    const h = G.kitHue;
    return { kit: `hsl(${h},70%,45%)`, stripe: `hsl(${h},70%,30%)`, shorts: "#f2f2f2", socks: `hsl(${h},70%,40%)` };
  }
  const keeperKit = () => (G.kitHue > 35 && G.kitHue < 130 ? "#ff5fa2" : "#c8f03c");
  const SKINS = ["#f1c9a5", "#d9a27a", "#a8724e", "#7a4f35", "#e6b58f"], HAIRS = ["#2a1d14", "#111", "#5a3a1e", "#c9a25a", "#222"];

  function drawWorld() {
    const shot = G.shot, s = G.sim;
    drawBackdrop(); drawPitch(); drawNet();
    const items = [];
    const fc = proj(0, 1.2, 0);
    if (fc) items.push({ z: fc.z, draw: drawFrame });
    // Keeper.
    const k = s ? s.keeper : { x: shot.keeper.x0, y: 0, dive: 0, dir: 0, reacted: false };
    const kp = proj(k.x, 0, SP.KEEPER_Z);
    if (kp) items.push({ z: kp.z, draw() {
      const sway = k.reacted ? 0 : Math.sin(G.t * 3) * 0.04;
      drawFigure({ x: kp.x + sway * kp.s, y: kp.y, s: kp.s }, {
        h: 1.9, kit: keeperKit(), stripe: null, shorts: "#1c2333", socks: keeperKit(), skin: "#e6b58f", hair: "#222", gloves: "#fff",
        arms: k.reacted ? "up" : "ready", crouch: k.reacted ? 0 : 0.1,
        rot: k.dir * k.dive * 1.25, lift: k.y + (k.reacted ? 0.12 * (1 - k.dive) : 0),
      });
    } });
    // Wall.
    const w = shot.wall, kc = kitColors(), jump = s ? SP.wallJump(s.t) : 0;
    for (let i = 0; i < w.n; i++) {
      const a = (i + 0.5) * w.spacing - w.n * w.spacing / 2;
      const p = proj(w.cx + w.px * a, 0, w.cz + w.pz * a);
      if (!p) continue;
      const hit = s && s.result && s.result.type === "wall" && s.result.blocker === i;
      items.push({ z: p.z, draw() {
        drawFigure(p, Object.assign({ h: w.heights[i], lift: jump, skin: SKINS[(i + G.dayNum) % 5], hair: HAIRS[(i * 2 + G.dayNum) % 5],
          rot: hit ? Math.sin(G.t * 30) * 0.08 : 0 }, kc));
      } });
    }
    // Ball.
    const b = s ? s.ball : { x: shot.bx, y: SP.BALL_R, z: shot.bz };
    const bp = proj(b.x, b.y, b.z);
    if (bp) items.push({ z: bp.z - 0.01, draw() { drawBall(b); } });
    items.sort((p, q) => q.z - p.z).forEach((it) => it.draw());
  }

  function drawAim() {
    const shot = G.shot, bp = proj(shot.bx, SP.BALL_R, shot.bz);
    if (!bp) return;
    // First-time hint: a dotted path round the wall into the far top corner.
    if (G.tut && !G.swipe && G.idx === 0) {
      const side = -Math.sign(shot.keeper.x0), end = proj(side * 3.0, 2.0, 0);
      if (end) {
        const mx = (bp.x + end.x) / 2 + side * W * 0.2, my = (bp.y + end.y) / 2;
        ctx.setLineDash([3, 9]); ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 3; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(bp.x, bp.y); ctx.quadraticCurveTo(mx, my, end.x, end.y); ctx.stroke(); ctx.setLineDash([]);
        const u = (G.t * 0.7) % 1, iu = 1 - u;
        const hx = iu * iu * bp.x + 2 * iu * u * mx + u * u * end.x, hy = iu * iu * bp.y + 2 * iu * u * my + u * u * end.y;
        ctx.fillStyle = "rgba(255,201,64,0.95)"; ctx.beginPath(); ctx.arc(hx, hy, 11, 0, 6.3); ctx.fill();
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
      }
    }
    const sw = G.swipe;
    if (sw && sw.pts.length > 1) {
      const ox = bp.x - sw.pts[0].x, oy = bp.y - sw.pts[0].y;
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(255,201,64,0.35)"; ctx.lineWidth = 12;
      ctx.beginPath(); sw.pts.forEach((p, i) => (i ? ctx.lineTo(p.x + ox, p.y + oy) : ctx.moveTo(p.x + ox, p.y + oy))); ctx.stroke();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.stroke();
      const e = sw.pts[sw.pts.length - 1];
      ctx.strokeStyle = "#ffc940"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(e.x + ox, e.y + oy, 12, 0, 6.3); ctx.stroke();
    }
  }

  function drawParticles(dt) {
    const ps = G.fx.parts;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; p.rot += p.vr * dt;
      if (p.life <= 0 || p.y > H + 20) { ps.splice(i, 1); continue; }
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = clamp(p.life, 0, 1);
      ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
    }
    if (G.fx.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${G.fx.flash * 0.5})`; ctx.fillRect(0, 0, W, H);
      G.fx.flash = Math.max(0, G.fx.flash - dt * 3);
    }
  }
  function confetti(n) {
    const cols = ["#ffc940", "#fff", "#ff5a5a", "#5ad1ff", "#7dff8a"];
    for (let i = 0; i < n; i++) {
      G.fx.parts.push({ x: W * (0.1 + Math.random() * 0.8), y: H * 0.1 + Math.random() * H * 0.15,
        vx: (Math.random() - 0.5) * 500, vy: -200 - Math.random() * 400, w: 5 + Math.random() * 6, h: 8 + Math.random() * 8,
        c: cols[i % cols.length], life: 1.6 + Math.random(), rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14 });
    }
  }

  // ---- HUD / screens ----------------------------------------------------------
  function show(id, on) { $(id).classList.toggle("hidden", !on); }
  function setHint(t) { $("hint").textContent = t || ""; show("hint", !!t); }
  function banner(main, sub, good) {
    const b = $("banner");
    if (!main) { b.classList.remove("on"); return; }
    $("bmain").textContent = main; $("bsub").textContent = sub || "";
    b.classList.toggle("good", !!good); b.classList.add("on");
  }
  function renderHud() {
    const pips = $("pips"); pips.innerHTML = "";
    if (G.daily) {
      for (let i = 0; i < SP.SHOTS_PER_DAY; i++) {
        const d = document.createElement("div");
        const res = G.results[i];
        d.className = "pip" + (res ? " done" : i === G.idx ? " now" : "");
        d.textContent = res ? SP.score(res).emoji : "";
        pips.appendChild(d);
      }
      $("score").textContent = G.points;
    } else {
      pips.textContent = "Practice";
      $("score").textContent = `${G.practice.goals}/${G.practice.taken}`;
    }
    const sh = G.shot;
    if (sh) {
      const wind = Math.abs(sh.wind) < 0.15 ? "" : ` · 💨 ${sh.wind > 0 ? "→" : "←"} ${Math.abs(sh.wind).toFixed(1)}`;
      $("info").textContent = `${Math.round(sh.dist)} m${wind}`;
    }
    $("mute").textContent = muted ? "🔇" : "🔊";
  }

  function loadShot() {
    G.shot = G.shots[G.idx];
    G.cam = makeCam(G.shot);
    G.sim = null; G.swipe = null; G.evIdx = 0;
    G.fx.trail = []; G.fx.net = null;
    G.mode = "aim";
    banner(null);
    setHint(G.tut ? "Swipe from the ball and draw its path. Faster swipe = harder shot." : "");
    renderHud();
    sfx.whistle();
  }

  function startDaily() {
    audioInit();
    G.daily = true; G.dayNum = SP.dayNumber(); G.shots = SP.dailyShots(G.dayNum);
    const saved = store.get("sp.daily", null);
    if (saved && saved.day === G.dayNum) { G.results = saved.results || []; } else { G.results = []; track("daily_start"); }
    G.points = SP.summarize(G.results).points; G.idx = G.results.length;
    G.kitHue = (G.dayNum * 47) % 360;
    show("menu", false); show("result", false); show("hud", true);
    if (G.idx >= SP.SHOTS_PER_DAY) { G.idx = SP.SHOTS_PER_DAY - 1; G.shot = G.shots[G.idx]; G.cam = makeCam(G.shot); finishDaily(true); }
    else loadShot();
  }
  function startPractice() {
    audioInit();
    G.daily = false; G.results = []; G.idx = 0; G.practice = { goals: 0, taken: 0 };
    G.kitHue = Math.floor(Math.random() * 360);
    nextPracticeShot();
    show("menu", false); show("result", false); show("hud", true);
    track("practice_start");
  }
  function nextPracticeShot() {
    G.shots = [SP.makeShot(Math.random, Math.floor(Math.random() * 5))]; G.idx = 0; loadShot();
  }
  function toMenu() {
    G.mode = "menu"; banner(null); setHint("");
    show("hud", false); show("result", false); show("menu", true);
    renderMenu();
  }
  function renderMenu() {
    const saved = store.get("sp.daily", null), st = store.get("sp.streak", null);
    const done = saved && saved.day === SP.dayNumber() && (saved.results || []).length >= SP.SHOTS_PER_DAY;
    const mid = saved && saved.day === SP.dayNumber() && !done && (saved.results || []).length > 0;
    $("playDaily").textContent = done ? "See today's result" : mid ? "Continue today's five" : "Play today's five";
    $("menuStreak").textContent = `Daily #${SP.dayNumber()}` + (st && st.count > 0 ? ` · 🔥 ${st.count} day streak` : "");
    if (!G.shot) {                                   // backdrop behind the menu
      G.shots = SP.dailyShots(SP.dayNumber()); G.shot = G.shots[0]; G.cam = makeCam(G.shot); G.kitHue = (SP.dayNumber() * 47) % 360;
    }
  }

  function finishDaily(replay) {
    G.mode = "done";
    const sum = SP.summarize(G.results);
    let st = store.get("sp.streak", null), best = store.get("sp.best", 0);
    if (!replay) {
      st = SP.nextStreak(st, G.dayNum); store.set("sp.streak", st);
      best = Math.max(best, sum.points); store.set("sp.best", best);
      track("daily_done"); track("daily_goals_" + sum.goals);
      if (sum.goals >= 3) confetti(90);
    }
    st = st || { count: 0, best: 0 };
    $("resTitle").textContent = `SET PIECE #${G.dayNum}`;
    $("resRow").textContent = sum.row;
    $("resLine").textContent = `${sum.goals}/${G.results.length} goals · ${sum.points} pts`;
    $("stStreak").textContent = st.count; $("stBest").textContent = st.best; $("stTop").textContent = Math.max(best, sum.points);
    $("shareMsg").textContent = "";
    banner(null); setHint(""); show("result", true); renderHud();
  }
  function shareResult() {
    const st = store.get("sp.streak", { count: 0 });
    const url = /^https?:$/.test(location.protocol) && !/^(localhost|127\.)/.test(location.hostname)
      ? location.origin + location.pathname : SITE_URL;
    const text = SP.shareText(G.dayNum, G.results, st.count, url);
    track("share");
    const copied = () => { $("shareMsg").textContent = "Copied. Paste it anywhere."; };
    const fallback = () => {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(copied, () => { $("shareMsg").textContent = text; });
      else $("shareMsg").textContent = text;
    };
    if (navigator.share) navigator.share({ text }).catch(fallback); else fallback();
  }
  function tickCountdown() {
    if (G.mode !== "done") return;
    const now = new Date(), next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const s = Math.max(0, Math.floor((next - now) / 1000)), p = (n) => String(n).padStart(2, "0");
    $("nextIn").textContent = `Next five in ${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}`;
  }
  setInterval(tickCountdown, 1000);

  // ---- swipe input ---------------------------------------------------------
  function swipeToShot(pts) {
    const a = pts[0], e = pts[pts.length - 1];
    const dx = e.x - a.x, dy = e.y - a.y, len = Math.hypot(dx, dy);
    if (len < Math.max(40, H * 0.07) || dy > -10) return null;         // too short, or not towards goal
    const bp = proj(G.shot.bx, SP.BALL_R, G.shot.bz);
    const target = toGoalPlane(bp.x + dx, bp.y + dy);
    target.y = Math.max(0.12, target.y);
    const dur = Math.max(0.04, (e.t - a.t) / 1000);
    const speed = (len / H) / dur;                                       // screen heights per second
    const power = clamp((speed - 0.5) / 2.6, 0, 1);
    let dev = 0;                                                         // signed bulge of the path
    for (const p of pts) {
      const d = (dx * (p.y - a.y) - dy * (p.x - a.x)) / len;
      if (Math.abs(d) > Math.abs(dev)) dev = d;
    }
    // A path that bulges right then comes back left curls right-to-left.
    const curl = clamp(-(dev / len) / 0.26, -1, 1);
    return { target, power, curl };
  }
  function shoot(target, power, curl) {
    G.sim = SP.newSim(G.shot, SP.launch(G.shot, target, power, curl, Math.random), Math.random);
    G.mode = "flight"; G.evIdx = 0; G.fx.trail = [];
    setHint("");
    if (G.tut) { G.tut = false; store.set("sp.tut", true); }
  }
  function ptr(ev) { const r = cv.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top, t: performance.now() }; }
  cv.addEventListener("pointerdown", (ev) => {
    audioInit();
    if (G.mode !== "aim") return;
    G.swipe = { pts: [ptr(ev)], id: ev.pointerId };
    try { cv.setPointerCapture(ev.pointerId); } catch (e) {}
  });
  cv.addEventListener("pointermove", (ev) => {
    if (G.mode !== "aim" || !G.swipe || ev.pointerId !== G.swipe.id) return;
    G.swipe.pts.push(ptr(ev));
    if (G.swipe.pts.length > 120) G.swipe.pts.splice(1, 1);
  });
  function endSwipe(ev) {
    if (G.mode !== "aim" || !G.swipe || ev.pointerId !== G.swipe.id) return;
    G.swipe.pts.push(ptr(ev));
    // Judge power on the last stretch of the stroke so a slow wind-up doesn't count.
    const pts = G.swipe.pts, s = swipeToShot(pts);
    G.swipe = null;
    if (s) shoot(s.target, s.power, s.curl);
  }
  cv.addEventListener("pointerup", endSwipe);
  cv.addEventListener("pointercancel", () => { G.swipe = null; });

  // ---- per-frame ---------------------------------------------------------------
  function onEvent(ev) {
    const s = G.sim;
    if (ev === "kick") sfx.kick();
    else if (ev === "bounce") sfx.bounce();
    else if (ev === "wall") { sfx.wall(); G.fx.shake = 6; }
    else if (ev === "post") { sfx.post(); G.fx.shake = 12; G.fx.flash = 0.25; }
    else if (ev === "save") { sfx.save(); G.fx.shake = 5; }
    else if (ev === "goal") {
      sfx.goal(); G.fx.shake = 16; G.fx.flash = 0.7; confetti(s.result.top ? 110 : 60);
      G.fx.net = { x: s.entry.x, y: s.entry.y, t0: G.t }; G.excite = 1;
    }
  }
  function onResult(res) {
    const sc = SP.score(res);
    const kmh = Math.round(G.sim.launch.speed * 3.6);
    banner(sc.label, (sc.points ? `+${sc.points} · ` : "") + `${kmh} km/h`, res.type === "goal");
    if (res.type === "miss") sfx.miss();
    if (res.type !== "goal") G.excite = Math.max(G.excite, 0.45);
  }
  function onShotDone() {
    const res = G.sim.result;
    if (G.daily) {
      G.results.push({ type: res.type, top: !!res.top, wood: !!res.wood, tipped: !!res.tipped, sub: res.sub || null,
        x: res.x == null ? null : +res.x.toFixed(2), y: res.y == null ? null : +res.y.toFixed(2), speed: res.speed ? +res.speed.toFixed(1) : null });
      G.points = SP.summarize(G.results).points;
      store.set("sp.daily", { day: G.dayNum, results: G.results });
      renderHud();
      if (G.results.length >= SP.SHOTS_PER_DAY) { G.mode = "between"; G.betweenT = 0.5; G.after = () => finishDaily(false); }
      else { G.mode = "between"; G.betweenT = 0.55; G.after = () => { G.idx++; loadShot(); }; }
    } else {
      G.practice.taken++; if (res.type === "goal") G.practice.goals++;
      renderHud();
      G.mode = "between"; G.betweenT = 0.55; G.after = nextPracticeShot;
    }
  }

  let lastT = 0, acc = 0, hadResult = false;
  function frame(ts) {
    const dt = Math.min(0.05, (ts - lastT) / 1000 || 0.016); lastT = ts; G.t += dt;
    if (G.mode === "flight" && G.sim) {
      const s = G.sim, b = s.ball;
      const slow = !s.result && b.z < 4 && b.z > -0.2 ? 0.45 : 1;       // a beat of slow motion at the goal
      acc += dt * slow;
      while (acc >= SP.DT) {
        SP.step(s, SP.DT); acc -= SP.DT;
        while (G.evIdx < s.events.length) onEvent(s.events[G.evIdx++]);
        if (s.result && !hadResult) { hadResult = true; onResult(s.result); }
        if (s.done) break;
      }
      const p = proj(b.x, b.y, b.z);
      if (p) { G.fx.trail.push({ x: p.x, y: p.y, r: Math.max(2, SP.BALL_R * p.s) }); if (G.fx.trail.length > 16) G.fx.trail.shift(); }
      G.fx.spinAng += dt * slow * (6 + Math.hypot(b.vx, b.vy, b.vz) * 0.6) * (s.launch.curl < 0 ? -1 : 1);
      if (s.done) { hadResult = false; acc = 0; onShotDone(); }
    } else if (G.mode === "between") {
      G.betweenT -= dt;
      if (G.betweenT <= 0) { const f = G.after; G.after = null; if (f) f(); }
    }
    G.excite = Math.max(0.12, G.excite - dt * 0.35);
    G.fx.shake = Math.max(0, G.fx.shake - dt * 40);

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (G.shot && G.cam) {
      drawWorld();
      if (G.mode === "aim") drawAim();
    } else { ctx.fillStyle = "#070b1a"; ctx.fillRect(0, 0, W, H); }
    drawParticles(dt);
    requestAnimationFrame(frame);
  }

  // ---- wiring ----------------------------------------------------------------
  $("playDaily").onclick = startDaily;
  $("playPractice").onclick = startPractice;
  $("resPractice").onclick = startPractice;
  $("share").onclick = shareResult;
  $("home").onclick = toMenu;
  $("mute").onclick = () => {
    muted = !muted; store.set("sp.mute", muted);
    if (muted && AC) { try { AC.close(); } catch (e) {} AC = null; } else audioInit();
    renderHud();
  };
  document.addEventListener("visibilitychange", () => { if (AC) { document.hidden ? AC.suspend() : AC.resume(); } });

  resize(); renderMenu(); trackVisit();
  requestAnimationFrame(frame);

  // Test / debug hooks (used by the automated browser checks).
  window.SPG = { G, shoot, startDaily, startPractice, proj, toGoalPlane, swipeToShot };
})();
