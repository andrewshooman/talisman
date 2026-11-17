/* ============================================================
   SET PIECE — core.js
   Pure game logic: seeded daily shots, ball physics, wall / keeper /
   woodwork resolution, scoring and share text. No DOM. Runs in the
   browser (window.SP) and under Node (module.exports) for tests.

   World units are metres. Goal line is z = 0, the pitch is z > 0,
   x is lateral (goal centre 0), y is up.
   ============================================================ */
(function (root) {
  "use strict";
  const SP = {};
  SP.VERSION = "0.1.0";

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
    let u = 0, v = 0;
    while (u === 0) u = r();
    v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  // ---- the daily ------------------------------------------------------
  // Day number from the player's local calendar date (Daily #1 = 17 Nov 2026).
  SP.dayNumber = function (date) {
    const d = date || new Date();
    const utc = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.floor((utc - SP.EPOCH) / 86400000) + 1;
  };

  // One free kick. `level` 0..4 raises distance, angle, wall size and keeper.
  SP.makeShot = function (r, level) {
    const lv = clamp(level, 0, 4);
    const side = r() < 0.5 ? -1 : 1;
    const bz = 17 + lv * 1.6 + r() * 4;                 // 17 .. 27.4 m out
    const bx = side * (0.5 + r() * (3 + lv * 1.5));     // up to ~9.5 m wide
    const dist = Math.hypot(bx, bz);
    const n = 3 + (lv >= 2 ? 1 : 0) + ((lv >= 4 || r() < 0.3) ? 1 : 0);
    // The wall guards the near-post side; the keeper takes the other side.
    const nearSide = Math.abs(bx) < 1 ? (r() < 0.5 ? -1 : 1) : Math.sign(bx);
    const wallAimX = nearSide * (1.1 + r() * 1.0);
    const ux = (wallAimX - bx), uz = (0 - bz);
    const ul = Math.hypot(ux, uz);
    const dirx = ux / ul, dirz = uz / ul;
    const heights = [];
    for (let i = 0; i < n; i++) heights.push(1.74 + r() * 0.16);
    const wind = lv >= 2 ? (r() * 2 - 1) * (0.6 + lv * 0.35) : 0;
    return {
      level: lv, bx, bz, dist,
      wall: {
        cx: bx + dirx * SP.WALL_DIST, cz: bz + dirz * SP.WALL_DIST,
        px: -dirz, pz: dirx,              // unit vector along the wall
        nx: dirx, nz: dirz,               // unit vector ball -> goal
        n, spacing: 0.52, heights,
      },
      keeper: { x0: -nearSide * 0.8, speed: 5.0 + lv * 0.3, react: 0.36 - lv * 0.02 },
      wind,
    };
  };

  SP.dailyShots = function (dayNum) {
    const r = SP.makeRng(dayNum * 7919 + 13);
    const shots = [];
    for (let i = 0; i < SP.SHOTS_PER_DAY; i++) shots.push(SP.makeShot(r, i));
    return shots;
  };

  // ---- ball flight ----------------------------------------------------
  // Acceleration on the ball: gravity, drag, sidespin (Magnus) and wind.
  function accel(b, wind) {
    const sp = Math.hypot(b.vx, b.vy, b.vz);
    const vh = Math.hypot(b.vx, b.vz) || 1e-6;
    const m = SP.MAGNUS * b.spin * sp;
    return {
      ax: -SP.DRAG * sp * b.vx + m * (-b.vz / vh) + wind,
      ay: -SP.G - SP.DRAG * sp * b.vy,
      az: -SP.DRAG * sp * b.vz + m * (b.vx / vh),
    };
  }
  function integrate(b, wind, dt) {
    const a = accel(b, wind);
    b.vx += a.ax * dt; b.vy += a.ay * dt; b.vz += a.az * dt;
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
  }

  SP.velocity = function (speed, yaw, elev, spin) {
    const vh = speed * Math.cos(elev);
    return { vx: vh * Math.sin(yaw), vy: speed * Math.sin(elev), vz: -vh * Math.cos(yaw), spin };
  };

  // Unobstructed flight to the goal plane: where and when the ball arrives.
  SP.simFree = function (shot, v) {
    const b = { x: shot.bx, y: SP.BALL_R, z: shot.bz, vx: v.vx, vy: v.vy, vz: v.vz, spin: v.spin };
    let t = 0;
    while (b.z > 0 && t < 6) { integrate(b, shot.wind, SP.DT); t += SP.DT; }
    return { x: b.x, y: b.y, t, speed: Math.hypot(b.vx, b.vy, b.vz) };
  };

  // Turn a swipe (target on the goal plane, power 0..1, curl -1..1) into a
  // launch velocity. The solve makes a clean strike arrive at the target even
  // with curl, so the swipe literally draws the ball's path. `rng` adds strike
  // error that grows with power and curl (pass null for a perfect strike).
  SP.launch = function (shot, target, power, curl, rng) {
    const p = clamp(power, 0, 1), c = clamp(curl, -1, 1);
    const speed = 20 + 12 * p;
    let yaw = Math.atan2(target.x - shot.bx, shot.bz);
    let elev = 0.22;
    for (let i = 0; i < 22; i++) {
      const e = SP.simFree(shot, SP.velocity(speed, yaw, elev, c));
      const ex = target.x - e.x, ey = target.y - e.y;
      if (Math.abs(ex) < 0.01 && Math.abs(ey) < 0.01) break;
      yaw = clamp(yaw + Math.atan2(ex, shot.dist) * 0.7, -1.2, 1.2);
      elev = clamp(elev + Math.atan2(ey, shot.dist) * 0.7, -0.03, 0.85);
    }
    if (rng) {
      const sigma = 0.003 + 0.016 * p * p + 0.008 * Math.abs(c);
      yaw += gauss(rng) * sigma;
      elev += gauss(rng) * sigma * 0.7;
    }
    const v = SP.velocity(speed, yaw, elev, c);
    v.speed = speed; v.power = p; v.curl = c;
    return v;
  };

  // ---- full shot simulation (stepped by the game loop) ----------------
  SP.wallJump = function (t) {
    const tau = (t - 0.12) / 0.55;
    return tau > 0 && tau < 1 ? 4 * 0.38 * tau * (1 - tau) : 0;
  };

  SP.newSim = function (shot, v, rng) {
    return {
      shot, rng: rng || Math.random, t: 0,
      ball: { x: shot.bx, y: SP.BALL_R, z: shot.bz, vx: v.vx, vy: v.vy, vz: v.vz, spin: v.spin },
      launch: v,
      keeper: { x: shot.keeper.x0, vx: 0, y: 0, targetX: null, targetY: 1, dive: 0, dir: 0, reacted: false },
      wood: false, result: null, after: 0, done: false, events: ["kick"],
      inNet: false, entry: null,
    };
  };

  function finish(s, type, extra) {
    if (s.result) return;
    s.result = Object.assign({ type, wood: s.wood }, extra || {});
  }

  SP.step = function (s, dt) {
    if (s.done) return s;
    const shot = s.shot, b = s.ball, k = s.keeper;
    const px = b.x, py = b.y, pz = b.z;
    s.t += dt;

    // -- keeper: react, read the shot, move / dive
    if (s.react == null) {
      // A strike that starts behind the wall is seen late; an open one early.
      const w0 = shot.wall, vh = Math.hypot(b.vx, b.vz) || 1e-6;
      const tw = SP.WALL_DIST / ((b.vx * w0.nx + b.vz * w0.nz) || 1e-6);
      const ax = (b.x + b.vx * tw - w0.cx) * w0.px + (b.z + b.vz * tw - w0.cz) * w0.pz;
      const screened = tw > 0 && Math.abs(ax) < w0.n * w0.spacing / 2 + 0.25 && vh > 0;
      s.screened = screened;
      s.react = shot.keeper.react + (screened ? 0.12 : 0);
    }
    if (!k.reacted && s.t >= s.react) {
      k.reacted = true;
      const pred = SP.simFree(shot, s.launch);
      const err = (s.rng() * 2 - 1) * 0.35;
      const wide = Math.abs(pred.x) > SP.GOAL_HALF + 1.2 || pred.y > SP.GOAL_H + 1.0;
      k.targetX = wide ? k.x + Math.sign(pred.x - k.x) * 0.5 : clamp(pred.x + err, -3.3, 3.3);
      k.targetY = clamp(pred.y, 0.2, 2.6);
      k.dir = Math.sign(k.targetX - k.x) || 1;
    }
    if (k.reacted && !(s.result && s.result.type === "saved")) {
      const dx = k.targetX - k.x;
      if (Math.abs(dx) > 0.03) {
        k.vx += Math.sign(dx) * 11 * dt;
        k.vx = clamp(k.vx, -shot.keeper.speed, shot.keeper.speed);
        const stepX = k.vx * dt;
        k.x += Math.abs(stepX) > Math.abs(dx) ? dx : stepX;
      } else { k.vx *= 0.8; if (k.arrivedAt == null) k.arrivedAt = s.t; }
      const travel = Math.abs(k.x - shot.keeper.x0);
      k.dive = clamp((travel - 0.6) / 1.6, 0, 1);
      k.y = k.dive * clamp(k.targetY - 1.0, 0, 1.0) * 0.8;
    }

    // -- ball
    if (s.inNet) {
      // Caught by the net: kill the pace quickly and let it drop.
      b.vx *= 0.9; b.vz *= 0.86; b.vy -= SP.G * dt;
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      b.z = Math.max(b.z, -1.55); b.x = clamp(b.x, -SP.GOAL_HALF + 0.12, SP.GOAL_HALF - 0.12);
      b.y = Math.min(b.y, SP.GOAL_H - 0.15);
    } else {
      integrate(b, shot.wind, dt);
      b.spin *= 1 - 0.25 * dt;
    }
    if (b.y < SP.BALL_R) {
      b.y = SP.BALL_R;
      if (b.vy < -1.2) s.events.push("bounce");
      b.vy = -b.vy * 0.5; b.vx *= 0.8; b.vz *= 0.8;
      if (Math.abs(b.vy) < 0.6) b.vy = 0;
    }

    // -- wall: did the ball cross the wall line this step?
    const w = shot.wall;
    if (!s.result && !s.passedWall) {
      const d0 = (px - w.cx) * w.nx + (pz - w.cz) * w.nz;
      const d1 = (b.x - w.cx) * w.nx + (b.z - w.cz) * w.nz;
      if (d0 < 0 && d1 >= 0) {
        s.passedWall = true;
        const f = d0 / (d0 - d1);
        const hx = px + (b.x - px) * f, hz = pz + (b.z - pz) * f, hy = py + (b.y - py) * f;
        const along = (hx - w.cx) * w.px + (hz - w.cz) * w.pz;
        const half = w.n * w.spacing / 2;
        if (Math.abs(along) <= half + 0.06) {
          const idx = clamp(Math.floor((along + half) / w.spacing), 0, w.n - 1);
          const top = w.heights[idx] + SP.wallJump(s.t);
          if (hy - SP.BALL_R * 0.6 < top) {
            const dot = b.vx * w.nx + b.vz * w.nz;
            b.vx = (b.vx - 2 * dot * w.nx) * 0.28 + (s.rng() - 0.5) * 3;
            b.vz = (b.vz - 2 * dot * w.nz) * 0.28;
            b.vy = Math.abs(b.vy) * 0.4 + 2 + s.rng() * 2;
            b.x = hx - w.nx * 0.15; b.z = hz - w.nz * 0.15; b.spin = 0;
            s.events.push("wall");
            finish(s, "wall", { blocker: idx });
          }
        }
      }
    }

    // -- keeper save: checked as the ball reaches the keeper's plane
    if (!s.result && pz > SP.KEEPER_Z && b.z <= SP.KEEPER_Z) {
      const f = (pz - SP.KEEPER_Z) / (pz - b.z);
      const hx = px + (b.x - px) * f, hy = py + (b.y - py) * f;
      const dx = hx - k.x;
      const reachX = 0.85 + 0.25 * k.dive;
      // Rushed dives cannot reach the top corner; a keeper who got there early can.
      const travel = Math.abs(k.x - shot.keeper.x0);
      const spare = k.arrivedAt != null ? clamp((s.t - k.arrivedAt) / 0.3, 0, 1) : 0;
      const reachTop = 2.55 - 0.45 * clamp(travel / 1.5, 0, 1) * (1 - spare);
      if (Math.abs(dx) <= reachX && hy <= reachTop) {
        const edge = Math.abs(dx) / reachX;
        const sp = Math.hypot(b.vx, b.vy, b.vz);
        if (edge > 0.72) {           // fingertips: pushed away, maybe onto the frame
          b.vx = Math.sign(dx || 1) * (4 + s.rng() * 4);
          b.vy = 2 + s.rng() * 4; b.vz = -sp * 0.25;
        } else {                     // parried back out
          b.vx = (s.rng() - 0.5) * 5; b.vy = 1 + s.rng() * 3; b.vz = sp * 0.22;
        }
        b.spin = 0; b.x = hx; b.y = hy; b.z = SP.KEEPER_Z;
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
      if (inside) {
        s.inNet = true;
        s.entry = { x: gx, y: gy, t: s.t };
        const sp = Math.hypot(b.vx, b.vy, b.vz);
        if (!s.result || s.result.type === "saved") {
          // A parried ball that still squirms in is a goal.
          s.result = { type: "goal", wood: s.wood, x: gx, y: gy, speed: sp,
            top: Math.abs(gx) > 2.5 && gy > 1.55 };
          s.events.push("goal");
        }
      } else if (!s.result) {
        finish(s, s.wood ? "woodwork" : "miss",
          { sub: Math.abs(gx) < SP.GOAL_HALF ? "over" : "wide", x: gx, y: gy });
      }
    }

    // -- a ball that comes back out off the frame, or dies short
    if (!s.result) {
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

  // Run a whole shot (used by tests and balance checks).
  SP.resolve = function (shot, target, power, curl, rng) {
    const r = rng || Math.random;
    const s = SP.newSim(shot, SP.launch(shot, target, power, curl, r), r);
    let guard = 0;
    while (!s.done && guard++ < 2000) SP.step(s, SP.DT);
    return s.result || { type: "miss", sub: "short", wood: false };
  };

  // ---- scoring & sharing ----------------------------------------------
  SP.score = function (res) {
    if (!res) return { points: 0, emoji: "❌", label: "MISSED" };
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
      case "saved": return { points: 20, emoji: "🧤", label: res.tipped ? "TIPPED AWAY" : "SAVED" };
      case "woodwork": return { points: 30, emoji: "🪵", label: "WOODWORK!" };
      case "wall": return { points: 0, emoji: "🧱", label: "INTO THE WALL" };
      default: return { points: 0, emoji: "❌",
        label: res.sub === "over" ? "OVER THE BAR" : res.sub === "short" ? "TOO SOFT" : "WIDE" };
    }
  };

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
