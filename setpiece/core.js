/* ============================================================
   SET PIECE — core.js
   Pure football-scene logic shared by the SET PIECE daily and the
   TALISMAN career: seeded scenes, ball physics, defenders, keeper,
   woodwork, passes, scoring and share text. No DOM. Runs in the
   browser (window.SP) and under Node (module.exports) for tests.

   World units are metres. Goal line is z = 0, the pitch is z > 0,
   x is lateral (goal centre 0), y is up.
   ============================================================ */
(function (root) {
  "use strict";
  const SP = {};
  SP.VERSION = "0.2.0";

  SP.GOAL_HALF = 3.66;   // half goal width
  SP.GOAL_H = 2.44;      // crossbar height
  SP.BALL_R = 0.11;
  SP.POST_R = 0.06;
  SP.G = 9.81;
  SP.DRAG = 0.013;       // quadratic air drag (1/m)
  SP.MAGNUS = 0.30;      // lateral accel per unit spin per m/s
  SP.DT = 1 / 120;
  SP.WALL_DIST = 9.15;
  SP.KEEPER_Z = 0.45;    // keeper stands just off the line
  SP.BLOCK_R = 0.30;     // how wide one defender blocks
  SP.SHOTS_PER_DAY = 5;
  SP.EPOCH = Date.UTC(2026, 10, 17); // Daily #1

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  SP.clamp = clamp;

  // ---- seeded RNG (mulberry32) ---------------------------------------
  SP.makeRng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  const gauss = (r) => {
    let u = 0;
    while (u === 0) u = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
  };

  // ---- scenes -----------------------------------------------------------
  // Every scene is the same shape; `kind` only changes how it is set up:
  //   bx,bz,by   ball start (by = height: on the ground, or in the air)
  //   blockers   defenders: { x, z, h, jump, rush } (rush = m/s towards the ball)
  //   keeper     { x0, z0, speed, react, rush, guess }
  //   clock      seconds you have before the chance is gone (null = set piece)
  //   runner     team-mate to find with a pass (pass scenes only)
  //   mods       stat effects: scatter, power, curl, dipMax
  const DEFAULT_MODS = { scatter: 1, power: 1, curl: 1, dipMax: 8 };

  function base(kind, lv, bx, bz, extra) {
    return Object.assign({
      kind, level: lv, bx, bz, by: SP.BALL_R, dist: Math.hypot(bx, bz),
      blockers: [], wall: null, wind: 0, clock: null, runner: null,
      keeper: { x0: 0, z0: SP.KEEPER_Z, speed: 5.0 + lv * 0.3, react: 0.36 - lv * 0.02, rush: 0, guess: 0, accel: 11 },
      mods: Object.assign({}, DEFAULT_MODS),
    }, extra || {});
  }

  // Day number from the player's local calendar date (Daily #1 = 17 Nov 2026).
  SP.dayNumber = function (date) {
    const d = date || new Date();
    const utc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.floor((utc - SP.EPOCH) / 86400000) + 1;
  };

  // A direct free kick. `level` 0..4 raises distance, angle, wall size and keeper.
  SP.makeShot = function (r, level) {
    const lv = clamp(level, 0, 4);
    const side = r() < 0.5 ? -1 : 1;
    const bz = 17 + lv * 1.6 + r() * 4;                 // 17 .. 27.4 m out
    const bx = side * (0.5 + r() * (3 + lv * 1.5));     // up to ~9.5 m wide
    const n = 3 + (lv >= 2 ? 1 : 0) + ((lv >= 4 || r() < 0.3) ? 1 : 0);
    // The wall guards the near-post side; the keeper takes the other side.
    const nearSide = Math.abs(bx) < 1 ? (r() < 0.5 ? -1 : 1) : Math.sign(bx);
    const wallAimX = nearSide * (1.1 + r() * 1.0);
    const ux = wallAimX - bx, uz = -bz, ul = Math.hypot(ux, uz);
    const dirx = ux / ul, dirz = uz / ul;
    const heights = [];
    for (let i = 0; i < n; i++) heights.push(1.74 + r() * 0.16);
    const wind = lv >= 2 ? (r() * 2 - 1) * (0.6 + lv * 0.35) : 0;
    const s = base("freekick", lv, bx, bz, { wind });
    s.wall = { cx: bx + dirx * SP.WALL_DIST, cz: bz + dirz * SP.WALL_DIST, px: -dirz, pz: dirx,
      nx: dirx, nz: dirz, n, spacing: 0.52, heights };
    for (let i = 0; i < n; i++) {
      const a = (i + 0.5) * 0.52 - n * 0.52 / 2;
      s.blockers.push({ x: s.wall.cx + s.wall.px * a, z: s.wall.cz + s.wall.pz * a, h: heights[i], jump: true, rush: 0 });
    }
    s.keeper.x0 = -nearSide * 0.8;
    return s;
  };

  SP.dailyShots = function (dayNum) {
    const r = SP.makeRng(dayNum * 7919 + 13);
    const shots = [];
    for (let i = 0; i < SP.SHOTS_PER_DAY; i++) shots.push(SP.makeShot(r, i));
    return shots;
  };

  // Career scenes. `kind` is one of SP.KINDS; `level` 0..4 is how hard the
  // opposition makes it.
  SP.KINDS = ["freekick", "penalty", "shot", "oneonone", "header", "volley", "pass"];
  SP.makeScene = function (kind, r, level) {
    const lv = clamp(level == null ? 2 : level, 0, 4);
    const side = r() < 0.5 ? -1 : 1;
    const def = (x, z, rush) => ({ x, z, h: 1.76 + r() * 0.12, jump: false, rush: rush || 0 });
    let s;
    switch (kind) {
      case "freekick": return SP.makeShot(r, lv);
      case "penalty":
        s = base(kind, lv, 0, 11);
        s.keeper.react = 0.02; s.keeper.speed = 7; s.keeper.accel = 16; s.keeper.guess = 0.42 + lv * 0.06;
        return s;
      case "oneonone": {
        s = base(kind, lv, side * r() * 3, 14 + r() * 4);
        s.keeper.z0 = 4; s.keeper.x0 = s.bx * 0.25; s.keeper.rush = 3.4 + lv * 0.3; s.keeper.react = 0.16;
        s.clock = 2.6 - lv * 0.15;
        return s;
      }
      case "header": {
        s = base(kind, lv, side * (0.5 + r() * 3), 5.5 + r() * 3, { by: 2.55, idealY: 1.85 });
        s.keeper.react = 0.16; s.keeper.x0 = -side * 0.3; s.keeper.speed = 6.5; s.keeper.accel = 15;
        s.blockers.push(def(s.bx - side * 0.9, s.bz - 1.2, 0));
        s.clock = 1.7 - lv * 0.08;
        return s;
      }
      case "volley": {
        s = base(kind, lv, side * (1 + r() * 5), 11 + r() * 6, { by: 1.35, idealY: 0.45 });
        s.blockers.push(def(s.bx * 0.6 + side * 0.4, s.bz - 3.5 - r() * 2, 0));
        s.keeper.x0 = -side * 0.5;
        s.clock = 1.5 - lv * 0.07;
        return s;
      }
      case "pass": {
        s = base(kind, lv, side * r() * 5, 25 + r() * 6);
        const rx = s.bx - side * (5 + r() * 4), rz = s.bz - 5 - r() * 3;        // runner starts ahead, to one side
        const tx = -side * (1 + r() * 2), tz = 8;                                // and runs for the box
        const dl = Math.hypot(tx - rx, tz - rz);
        s.runner = { x: rx, z: rz, dx: (tx - rx) / dl, dz: (tz - rz) / dl, speed: 6.2, catchR: 1.7 };
        // A back line across the lane, plus one man closing you down.
        for (let i = 0; i < 2 + (lv >= 3 ? 1 : 0); i++) s.blockers.push(def(s.bx - side * (0.5 + i * 3.2 + r()), s.bz - 9 - r() * 3, 0));
        s.blockers.push(def(s.bx + side * 6, s.bz - 2, 3.4 + lv * 0.3));
        s.clock = 3.4 - lv * 0.2;
        return s;
      }
      default: {  // "shot": open play at the edge of the box, with a man closing
        s = base("shot", lv, side * r() * 8, 13 + r() * 9);
        const ux = -s.bx / s.dist, uz = -s.bz / s.dist;
        s.blockers.push(def(s.bx + ux * 5 - uz * side * (0.8 + r() * 0.8), s.bz + uz * 5 + ux * side * (0.8 + r() * 0.8), 0));
        if (lv >= 2) s.blockers.push(def(s.bx + ux * 8 + uz * side * (1.2 + r()), s.bz + uz * 8 - ux * side * (1.2 + r()), 0));
        s.blockers.push(def(s.bx + side * 7, s.bz + 1.5, 3.2 + lv * 0.3));
        s.keeper.x0 = -Math.sign(s.bx || side) * 0.5;
        s.clock = 2.9 - lv * 0.18;
        return s;
      }
    }
  };

  // Stat effects (TALISMAN's 1..99 attributes) folded into a scene.
  // acc: steadier strike · power: harder shot · tech: more curl and dip ·
  // pace: more time before the chance closes · vision: easier to find the runner.
  SP.applyStats = function (scene, st) {
    const f = (v, lo, hi) => lo + (hi - lo) * clamp(((v == null ? 50 : v) - 30) / 60, 0, 1);
    const m = scene.mods;
    m.scatter = f(st.acc, 1.7, 0.6) * (scene.kind === "volley" ? 2.2 : scene.kind === "header" ? 2.6 : 1);
    m.power = f(st.power, 0.86, 1.1);
    m.curl = f(st.tech, 0.7, 1.15);
    m.dipMax = f(st.tech, 6, 11);
    if (scene.clock != null) scene.clock = +(scene.clock * f(st.pace, 0.8, 1.35)).toFixed(2);
    if (scene.runner) scene.runner.catchR = f(st.vision, 1.3, 2.3);
    return scene;
  };

  // Where things are after `t` seconds of waiting on the ball: defenders close,
  // the keeper comes out, a ball in the air drops. Returns a frozen copy of the
  // scene plus `lost` (why the chance has gone), if it has.
  SP.aimState = function (scene, t) {
    const s = Object.assign({}, scene);
    let lost = null;
    s.blockers = scene.blockers.map((b) => {
      if (!b.rush) return b;
      const dx = scene.bx - b.x, dz = scene.bz - b.z, d = Math.hypot(dx, dz);
      const go = Math.min(b.rush * t, Math.max(0, d - 1.0));
      if (d - go <= 1.01) lost = "tackled";
      return Object.assign({}, b, { x: b.x + dx / d * go, z: b.z + dz / d * go, rush: 0, moving: true });
    });
    s.keeper = Object.assign({}, scene.keeper);
    if (scene.keeper.rush) {
      const maxZ = scene.bz - 2.6;
      s.keeper.z0 = Math.min(maxZ, scene.keeper.z0 + scene.keeper.rush * t);
      s.keeper.x0 = scene.keeper.x0 + (scene.bx - scene.keeper.x0) * clamp((s.keeper.z0 - scene.keeper.z0) / (scene.bz - scene.keeper.z0), 0, 1);
      if (s.keeper.z0 >= maxZ) lost = "smothered";
    }
    if (scene.idealY != null) {
      // The ball drops through the ideal strike height at the sweet moment.
      // Meeting it early or late costs power and accuracy.
      const sweet = SP.sweetTime(scene);
      s.by = Math.max(0.2, scene.by - (scene.by - scene.idealY) * (t / sweet));
      const q = clamp(1 - Math.abs(t - sweet) / 0.3, 0, 1);
      s.timing = q;
      s.mods = Object.assign({}, scene.mods, { scatter: scene.mods.scatter * (1 + 2.4 * (1 - q)), power: scene.mods.power * (0.62 + 0.38 * q) });
    }
    if (scene.clock != null && t >= scene.clock && !lost) lost = scene.idealY != null ? "mistimed" : scene.keeper.rush ? "smothered" : "tackled";
    s.lost = lost;
    return s;
  };

  SP.sweetTime = (scene) => (scene.clock || 1.5) * 0.62;

  // ---- ball flight ----------------------------------------------------
  // Acceleration on the ball: gravity, drag, sidespin and dip (Magnus), wind.
  function accel(b, wind) {
    const sp = Math.hypot(b.vx, b.vy, b.vz);
    const vh = Math.hypot(b.vx, b.vz) || 1e-6;
    const m = SP.MAGNUS * b.spin * sp;
    return {
      ax: -SP.DRAG * sp * b.vx + m * (-b.vz / vh) + wind,
      ay: -SP.G - (b.dip || 0) - SP.DRAG * sp * b.vy,
      az: -SP.DRAG * sp * b.vz + m * (b.vx / vh),
    };
  }
  function integrate(b, wind, dt) {
    const a = accel(b, wind);
    b.vx += a.ax * dt; b.vy += a.ay * dt; b.vz += a.az * dt;
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
  }

  SP.velocity = function (speed, yaw, elev, spin, dip) {
    const vh = speed * Math.cos(elev);
    return { vx: vh * Math.sin(yaw), vy: speed * Math.sin(elev), vz: -vh * Math.cos(yaw), spin, dip: dip || 0 };
  };

  SP.blockerTop = function (b, t) { return b.h + (b.jump ? SP.wallJump(t) : 0); };

  // Unobstructed flight to the plane z = zt: where and when the ball arrives,
  // and whether a defender would have been in the way.
  SP.simFree = function (scene, v, zt) {
    const z1 = zt || 0;
    const b = { x: scene.bx, y: scene.by, z: scene.bz, vx: v.vx, vy: v.vy, vz: v.vz, spin: v.spin, dip: v.dip };
    let t = 0, blocked = false;
    const bl = scene.blockers;
    while (b.z > z1 && t < 6) {
      integrate(b, scene.wind, SP.DT); t += SP.DT;
      for (let i = 0; i < bl.length && !blocked; i++) {
        if (Math.hypot(b.x - bl[i].x, b.z - bl[i].z) < SP.BLOCK_R + 0.04 && b.y < SP.blockerTop(bl[i], t) + 0.15) blocked = true;
      }
    }
    return { x: b.x, y: b.y, t, speed: Math.hypot(b.vx, b.vy, b.vz), blocked };
  };

  SP.maxSpeed = function (scene) {
    const k = scene.kind;
    return k === "header" ? [12, 8] : k === "pass" ? [11, 13] : [20, 12];
  };

  // Turn a swipe (target point, power 0..1, curl -1..1) into a launch velocity.
  // The solve makes a clean strike arrive at the target even with curl, so the
  // swipe literally draws the ball's path. If a defender is in the way it adds
  // dip (up to the player's limit) to lift the ball over and bring it down.
  // `rng` adds strike error that grows with power and curl (null = perfect).
  SP.launch = function (scene, target, power, curl, rng) {
    const m = scene.mods || DEFAULT_MODS;
    const p = clamp(power, 0, 1), c = clamp(curl, -1, 1) * m.curl;
    const sp = SP.maxSpeed(scene);
    const speed = (sp[0] + sp[1] * p) * m.power;
    const zt = target.z || 0, reach = Math.max(4, Math.hypot(target.x - scene.bx, scene.bz - zt));
    const solve = (dip) => {
      let yaw = Math.atan2(target.x - scene.bx, scene.bz - zt), elev = 0.2;
      for (let i = 0; i < 22; i++) {
        const e = SP.simFree(scene, SP.velocity(speed, yaw, elev, c, dip), zt);
        const ex = target.x - e.x, ey = target.y - e.y;
        if (Math.abs(ex) < 0.01 && Math.abs(ey) < 0.01) break;
        yaw = clamp(yaw + Math.atan2(ex, reach) * 0.7, -1.4, 1.4);
        elev = clamp(elev + Math.atan2(ey, reach) * 0.7, -0.5, 0.95);
      }
      return { yaw, elev, dip };
    };
    let best = solve(scene.kind === "pass" ? 0 : 2);
    // Only a ball aimed up at the goal gets lifted; a low drive stays low.
    if (scene.kind !== "pass" && target.y > 0.9 && SP.simFree(scene, SP.velocity(speed, best.yaw, best.elev, c, best.dip), zt).blocked) {
      for (let dip = 4; dip <= m.dipMax + 0.01; dip += 2) {
        const s2 = solve(dip);
        if (!SP.simFree(scene, SP.velocity(speed, s2.yaw, s2.elev, c, dip), zt).blocked) { best = s2; break; }
      }
    }
    let yaw = best.yaw, elev = best.elev;
    if (rng) {
      const sigma = (0.003 + 0.016 * p * p + 0.008 * Math.abs(c)) * m.scatter;
      yaw += gauss(rng) * sigma;
      elev += gauss(rng) * sigma * 0.7;
    }
    const v = SP.velocity(speed, yaw, elev, c, best.dip);
    v.speed = speed; v.power = p; v.curl = c; v.zt = zt;
    return v;
  };

  // ---- full simulation (stepped by the game loop) ---------------------
  SP.wallJump = function (t) {
    const tau = (t - 0.12) / 0.55;
    return tau > 0 && tau < 1 ? 4 * 0.3 * tau * (1 - tau) : 0;
  };

  SP.newSim = function (scene, v, rng) {
    const r = scene.runner;
    return {
      shot: scene, rng: rng || Math.random, t: 0,
      ball: { x: scene.bx, y: scene.by, z: scene.bz, vx: v.vx, vy: v.vy, vz: v.vz, spin: v.spin, dip: v.dip },
      launch: v,
      keeper: { x: scene.keeper.x0, z: scene.keeper.z0, vx: 0, y: 0, targetX: null, targetY: 1, dive: 0, dir: 0, reacted: false },
      runner: r ? { x: r.x, z: r.z } : null,
      hit: scene.blockers.map(() => false),
      wood: false, result: null, after: 0, done: false, events: ["kick"], inNet: false, entry: null,
    };
  };

  function finish(s, type, extra) {
    if (s.result) return;
    s.result = Object.assign({ type, wood: s.wood, kind: s.shot.kind }, extra || {});
  }

  SP.step = function (s, dt) {
    if (s.done) return s;
    const scene = s.shot, b = s.ball, k = s.keeper, isPass = scene.kind === "pass";
    const px = b.x, py = b.y, pz = b.z;
    s.t += dt;

    // -- keeper: react, read the shot, move / dive
    if (s.react == null) {
      // A strike that starts behind a defender is seen late; an open one early.
      s.pred = SP.simFree(scene, s.launch, 0);
      s.screened = scene.blockers.some((d) => {
        const ux = b.vx, uz = b.vz, ul = Math.hypot(ux, uz) || 1e-6;
        const along = ((d.x - scene.bx) * ux + (d.z - scene.bz) * uz) / ul;
        const off = Math.abs((d.x - scene.bx) * uz - (d.z - scene.bz) * ux) / ul;
        return along > 0 && off < 0.8;
      });
      s.react = scene.keeper.react + (s.screened ? 0.12 : 0);
    }
    if (!k.reacted && s.t >= s.react && !isPass) {
      k.reacted = true;
      const pred = SP.simFree(scene, s.launch, k.z);
      const err = (s.rng() * 2 - 1) * 0.35;
      const wide = Math.abs(s.pred.x) > SP.GOAL_HALF + 1.2 || s.pred.y > SP.GOAL_H + 1.0;
      let tx = wide ? k.x + Math.sign(pred.x - k.x) * 0.5 : pred.x + err;
      if (scene.keeper.guess && s.rng() > scene.keeper.guess) {
        // Penalty guess gone wrong: he goes the other way, or stays put.
        tx = s.rng() < 0.7 ? -Math.sign(pred.x || 1) * 2.2 : k.x;
      }
      // Keep the dive inside the frame so he never ends up through a post.
      const lim = 2.35 * (1 - clamp(k.z / 12, 0, 0.7));
      k.targetX = clamp(tx, -lim, lim);
      k.targetY = clamp(pred.y, 0.2, 2.6);
      k.dir = Math.sign(k.targetX - k.x) || 1;
    }
    if (k.reacted && !(s.result && s.result.type === "saved")) {
      const dx = k.targetX - k.x;
      if (Math.abs(dx) > 0.03) {
        k.vx += Math.sign(dx) * (scene.keeper.accel || 11) * dt;
        k.vx = clamp(k.vx, -scene.keeper.speed, scene.keeper.speed);
        const stepX = k.vx * dt;
        k.x += Math.abs(stepX) > Math.abs(dx) ? dx : stepX;
      } else { k.vx *= 0.8; if (k.arrivedAt == null) k.arrivedAt = s.t; }
      const travel = Math.abs(k.x - scene.keeper.x0);
      k.dive = clamp((travel - 0.5) / 1.3, 0, 1);
      k.y = k.dive * clamp(k.targetY - 1.0, 0, 1.0) * 0.8;
    }

    // -- runner (pass scenes): makes his run from the moment the ball is played
    if (s.runner && !s.result) {
      s.runner.x += scene.runner.dx * scene.runner.speed * dt;
      s.runner.z += scene.runner.dz * scene.runner.speed * dt;
    }

    // -- ball
    if (s.inNet) {
      // Caught by the net: kill the pace quickly and let it drop.
      b.vx *= 0.9; b.vz *= 0.86; b.vy -= SP.G * dt;
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      b.z = Math.max(b.z, -1.55); b.x = clamp(b.x, -SP.GOAL_HALF + 0.12, SP.GOAL_HALF - 0.12);
      b.y = Math.min(b.y, SP.GOAL_H - 0.15);
    } else {
      integrate(b, scene.wind, dt);
      b.spin *= 1 - 0.25 * dt;
    }
    if (b.y < SP.BALL_R) {
      b.y = SP.BALL_R;
      if (b.vy < -1.2) s.events.push("bounce");
      b.vy = -b.vy * 0.5; b.vx *= isPass ? 0.92 : 0.8; b.vz *= isPass ? 0.92 : 0.8; b.dip = 0;
      if (Math.abs(b.vy) < 0.6) b.vy = 0;
    }

    // -- defenders: anyone the ball runs into below head height
    if (!s.result) {
      for (let i = 0; i < scene.blockers.length; i++) {
        const d = scene.blockers[i];
        if (s.hit[i]) continue;
        // Closest approach of this step's travel to the defender.
        const sx = b.x - px, sz = b.z - pz, l2 = sx * sx + sz * sz || 1e-9;
        const f = clamp(((d.x - px) * sx + (d.z - pz) * sz) / l2, 0, 1);
        const cx = px + sx * f, cz = pz + sz * f, cy = py + (b.y - py) * f;
        if (Math.hypot(cx - d.x, cz - d.z) < SP.BLOCK_R && cy - SP.BALL_R * 0.6 < SP.blockerTop(d, s.t)) {
          s.hit[i] = true;
          const sp = Math.hypot(b.vx, b.vz) || 1e-6, nx = -b.vx / sp, nz = -b.vz / sp;
          b.vx = nx * sp * 0.28 + (s.rng() - 0.5) * 3; b.vz = nz * sp * 0.28;
          b.vy = Math.abs(b.vy) * 0.4 + 2 + s.rng() * 2;
          b.x = cx + nx * 0.15; b.z = cz + nz * 0.15; b.spin = 0; b.dip = 0;
          s.events.push("wall");
          finish(s, isPass ? "intercepted" : "wall", { blocker: i });
          break;
        }
      }
    }

    // -- pass: does the runner get on the end of it?
    if (isPass && !s.result) {
      const r = s.runner, d = Math.hypot(b.x - r.x, b.z - r.z);
      const sp = Math.hypot(b.vx, b.vy, b.vz);
      if (d < scene.runner.catchR && b.y < 1.3 && s.t > 0.25) { s.events.push("control"); finish(s, "assist", { x: b.x, z: b.z }); }
      else if (b.z < r.z - 7 || b.z < 1) finish(s, "passmiss", { sub: "long" });
      else if (sp < 1.2 || s.t > 4.5) finish(s, "passmiss", { sub: b.z > r.z + 2 ? "short" : "astray" });
    }

    // -- keeper save: checked as the ball reaches the keeper's plane
    if (!s.result && !isPass && pz > k.z && b.z <= k.z) {
      const f = (pz - k.z) / (pz - b.z);
      const hx = px + (b.x - px) * f, hy = py + (b.y - py) * f;
      const dx = hx - k.x, out = k.z > 1.2;
      const reachX = out ? 1.2 : 0.85 + 0.45 * k.dive;
      // Rushed dives cannot reach the top corner; a keeper who got there early can.
      // A keeper who has come off his line is spread low and can be chipped.
      const travel = Math.abs(k.x - scene.keeper.x0);
      const spare = k.arrivedAt != null ? clamp((s.t - k.arrivedAt) / 0.3, 0, 1) : 0;
      const reachTop = out ? 2.3 : 2.55 - 0.45 * clamp(travel / 1.5, 0, 1) * (1 - spare);
      if (Math.abs(dx) <= reachX && hy <= reachTop) {
        const edge = Math.abs(dx) / reachX;
        const sp = Math.hypot(b.vx, b.vy, b.vz);
        if (edge > 0.72) {           // fingertips: pushed away, maybe onto the frame
          b.vx = Math.sign(dx || 1) * (4 + s.rng() * 4);
          b.vy = 2 + s.rng() * 4; b.vz = -sp * 0.25;
        } else {                     // parried back out
          b.vx = (s.rng() - 0.5) * 5; b.vy = 1 + s.rng() * 3; b.vz = sp * 0.22;
        }
        b.spin = 0; b.dip = 0; b.x = hx; b.y = hy; b.z = k.z;
        s.events.push("save");
        finish(s, "saved", { x: hx, y: hy, tipped: edge > 0.72 });
      }
    }

    // -- woodwork (posts are vertical cylinders, the bar a horizontal one)
    if (!s.inNet && Math.abs(b.z) < 0.4) {
      const rr = SP.BALL_R + SP.POST_R;
      let hit = false;
      for (const sx of [-SP.GOAL_HALF, SP.GOAL_HALF]) {
        const ox = b.x - sx, oz = b.z, d = Math.hypot(ox, oz);
        if (d < rr && b.y < SP.GOAL_H + SP.POST_R) {
          const nx = ox / (d || 1e-6), nz = oz / (d || 1e-6);
          const dot = b.vx * nx + b.vz * nz;
          if (dot < 0) { b.vx -= 1.55 * dot * nx; b.vz -= 1.55 * dot * nz; }
          b.x = sx + nx * rr; b.z = nz * rr; hit = true;
        }
      }
      if (Math.abs(b.x) <= SP.GOAL_HALF + SP.POST_R) {
        const oy = b.y - SP.GOAL_H, oz = b.z, d = Math.hypot(oy, oz);
        if (d < rr) {
          const ny = oy / (d || 1e-6), nz = oz / (d || 1e-6);
          const dot = b.vy * ny + b.vz * nz;
          if (dot < 0) { b.vy -= 1.55 * dot * ny; b.vz -= 1.55 * dot * nz; }
          b.y = SP.GOAL_H + ny * rr; b.z = nz * rr; hit = true;
        }
      }
      if (hit && !s.woodNow) { s.wood = true; s.events.push("post"); if (s.result) s.result.wood = true; }
      s.woodNow = hit;
    }

    // -- goal line
    if (!s.inNet && pz > 0 && b.z <= 0) {
      const f = pz / (pz - b.z);
      const gx = px + (b.x - px) * f, gy = py + (b.y - py) * f;
      const inside = Math.abs(gx) < SP.GOAL_HALF - SP.POST_R && gy < SP.GOAL_H - SP.POST_R;
      if (inside && !isPass) {
        s.inNet = true;
        s.entry = { x: gx, y: gy, t: s.t };
        const sp = Math.hypot(b.vx, b.vy, b.vz);
        if (!s.result || s.result.type === "saved") {
          // A parried ball that still squirms in is a goal.
          s.result = { type: "goal", kind: scene.kind, wood: s.wood, x: gx, y: gy, speed: sp,
            top: Math.abs(gx) > 2.5 && gy > 1.55 };
          s.events.push("goal");
        }
      } else if (!s.result) {
        finish(s, s.wood ? "woodwork" : "miss",
          { sub: Math.abs(gx) < SP.GOAL_HALF ? "over" : "wide", x: gx, y: gy });
      }
    }

    // -- a ball that comes back out off the frame, or dies short
    if (!s.result && !isPass) {
      const sp = Math.hypot(b.vx, b.vy, b.vz);
      if (s.wood && b.vz > 0 && b.z > 1) finish(s, "woodwork", { sub: "frame" });
      else if (s.t > 5 || (sp < 0.8 && b.z > 0)) finish(s, "miss", { sub: "short" });
    }

    if (s.result) {
      s.after += dt;
      if (s.after > (s.result.type === "goal" ? 1.7 : 1.15)) s.done = true;
    }
    return s;
  };

  // Run a whole strike (used by tests and balance checks).
  SP.resolve = function (scene, target, power, curl, rng) {
    const r = rng || Math.random;
    const s = SP.newSim(scene, SP.launch(scene, target, power, curl, r), r);
    let guard = 0;
    while (!s.done && guard++ < 2000) SP.step(s, SP.DT);
    return s.result || { type: "miss", sub: "short", wood: false, kind: scene.kind };
  };

  // ---- scoring & sharing ----------------------------------------------
  SP.score = function (res) {
    if (!res) return { points: 0, emoji: "❌", label: "MISSED" };
    const fk = !res.kind || res.kind === "freekick";
    switch (res.type) {
      case "goal": {
        let pts = 100;
        if (res.top) pts += 100;
        else if (Math.abs(res.x) > 2.6 || res.y > 1.9) pts += 40;
        if (res.wood) pts += 50;
        pts += Math.round(clamp(((res.speed || 0) - 14) * 2.5, 0, 30));
        return { points: pts, emoji: res.top ? "🎯" : "⚽",
          label: res.top ? "TOP BINS!" : res.wood ? "IN OFF THE FRAME!" : "GOAL!" };
      }
      case "assist": return { points: 100, emoji: "🅰️", label: "THROUGH BALL!" };
      case "saved": return { points: 20, emoji: "🧤", label: res.tipped ? "TIPPED AWAY" : "SAVED" };
      case "woodwork": return { points: 30, emoji: "🪵", label: "WOODWORK!" };
      case "wall": return { points: 0, emoji: "🧱", label: fk ? "INTO THE WALL" : "BLOCKED" };
      case "intercepted": return { points: 0, emoji: "🧱", label: "INTERCEPTED" };
      case "passmiss": return { points: 0, emoji: "❌", label: res.sub === "long" ? "OVERHIT" : res.sub === "short" ? "UNDERHIT" : "ASTRAY" };
      case "lost": return { points: 0, emoji: "⏱️",
        label: res.sub === "smothered" ? "SMOTHERED" : res.sub === "mistimed" ? "MISTIMED" : "TACKLED" };
      default: return { points: 0, emoji: "❌",
        label: res.sub === "over" ? "OVER THE BAR" : res.sub === "short" ? "TOO SOFT" : "WIDE" };
    }
  };

  // How well the moment was played, 0..1 (drives the career match rating).
  SP.quality = function (res) {
    if (!res) return 0.1;
    switch (res.type) {
      case "goal": return res.top ? 1 : res.wood ? 0.9 : 0.78;
      case "assist": return 0.8;
      case "woodwork": return 0.45;
      case "saved": return res.tipped ? 0.4 : 0.32;
      case "wall": case "intercepted": return 0.15;
      default: return 0.1;
    }
  };
  SP.isSuccess = (res) => !!res && (res.type === "goal" || res.type === "assist");

  SP.summarize = function (results) {
    let points = 0, goals = 0, row = "";
    results.forEach((r) => {
      const sc = SP.score(r);
      points += sc.points; row += sc.emoji;
      if (r && r.type === "goal") goals++;
    });
    return { points, goals, row };
  };

  SP.shareText = function (dayNum, results, streak, url) {
    const s = SP.summarize(results);
    const lines = [
      `SET PIECE #${dayNum}  ${s.goals}/${results.length}`,
      s.row,
      `${s.points} pts` + (streak > 1 ? ` · 🔥${streak}` : ""),
    ];
    if (url) lines.push(url);
    return lines.join("\n");
  };

  // Streak bookkeeping: `prev` is { last, count, best } or null.
  SP.nextStreak = function (prev, dayNum) {
    const p = prev || { last: 0, count: 0, best: 0 };
    if (p.last === dayNum) return p;
    const count = p.last === dayNum - 1 ? p.count + 1 : 1;
    return { last: dayNum, count, best: Math.max(p.best || 0, count) };
  };

  if (typeof module !== "undefined" && module.exports) module.exports = SP;
  else root.SP = SP;
})(typeof window !== "undefined" ? window : globalThis);
