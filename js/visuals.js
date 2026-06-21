/* ============================================================
   TALISMAN — visuals.js
   Procedural SVG art so every screen reads like a game, not a quiz:
   generated club crests, jersey kits, nation flags, a radar/pentagon
   stat chart, circular rating rings, trophies, and a FUT-style player
   card. All deterministic from a string seed (same club => same crest).

   Public API (all return SVG/HTML strings):
     T.Vis.palette(seed)            -> { primary, secondary, ink }
     T.Vis.crest(name, size?)
     T.Vis.kit(seed, number, size?)
     T.Vis.flag(nation, size?)
     T.Vis.radar(stats, keys, size?)
     T.Vis.ring(value, max, label, size?)
     T.Vis.trophy(kind, size?)
     T.Vis.playerCard(player, club, overall)
   ============================================================ */
(function () {
  const T = window.TALISMAN;
  const V = (T.Vis = {});

  // ---- seeded hashing & color ----------------------------------------
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < String(str).length; i++) {
      h ^= str.charCodeAt(i); h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function hsl(h, s, l) { return `hsl(${h % 360} ${s}% ${l}%)`; }

  // Deterministic two-color kit/crest palette from a seed string.
  V.palette = function (seed) {
    const h = hash(seed);
    const hue = h % 360;
    const comp = (hue + (60 + (h % 120))) % 360; // varied second hue
    return {
      primary: hsl(hue, 64, 48),
      primaryDark: hsl(hue, 60, 32),
      secondary: hsl(comp, 55, 52),
      ink: (h % 2) ? "#0a0a0f" : "#f5f5f7",
      hue,
    };
  };

  function initials(name) {
    const words = String(name).replace(/[^A-Za-z ]/g, "").split(/\s+/).filter(Boolean);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return (String(name).slice(0, 2)).toUpperCase();
  }

  // ---- Club crest (shield) -------------------------------------------
  V.crest = function (name, size) {
    const s = size || 64;
    const p = V.palette(name);
    const h = hash(name);
    const style = h % 3; // 0 split vertical, 1 chevron, 2 horizontal band
    let pattern = "";
    if (style === 0) {
      pattern = `<path d="M32 4 L32 60 Q32 60 8 46 L8 14 Z" fill="${p.primaryDark}"/>`;
    } else if (style === 1) {
      pattern = `<path d="M8 22 L32 34 L56 22 L56 30 L32 42 L8 30 Z" fill="${p.secondary}"/>`;
    } else {
      pattern = `<rect x="8" y="26" width="48" height="12" fill="${p.secondary}"/>`;
    }
    return `
    <svg viewBox="0 0 64 70" width="${s}" height="${s * 70 / 64}" class="vis-crest" aria-hidden="true">
      <path d="M8 6 H56 V40 Q56 56 32 66 Q8 56 8 40 Z" fill="${p.primary}" stroke="${p.ink}" stroke-width="2"/>
      ${pattern}
      <path d="M8 6 H56 V40 Q56 56 32 66 Q8 56 8 40 Z" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="2"/>
      <text x="32" y="34" text-anchor="middle" font-size="20" font-weight="800"
            fill="${p.ink}" font-family="system-ui, sans-serif">${initials(name)}</text>
      <circle cx="32" cy="12" r="2.4" fill="${p.ink}"/>
    </svg>`;
  };

  // ---- Jersey / kit ---------------------------------------------------
  V.kit = function (seed, number, size) {
    const s = size || 120;
    const p = V.palette(seed);
    const h = hash(seed + "kit");
    const motif = h % 3; // 0 plain, 1 vertical stripes, 2 sash
    let deco = "";
    if (motif === 1) {
      deco = [30, 50, 70].map(x => `<rect x="${x}" y="26" width="6" height="60" fill="${p.secondary}"/>`).join("");
    } else if (motif === 2) {
      deco = `<path d="M22 26 L80 86 L70 86 L22 40 Z" fill="${p.secondary}"/>`;
    }
    const num = number != null ? `<text x="50" y="66" text-anchor="middle" font-size="26" font-weight="800"
        fill="${p.ink}" font-family="system-ui">${number}</text>` : "";
    return `
    <svg viewBox="0 0 100 100" width="${s}" height="${s}" class="vis-kit" aria-hidden="true">
      <path d="M30 18 L42 14 Q50 20 58 14 L70 18 L86 30 L78 42 L72 38 V86 H28 V38 L22 42 L14 30 Z"
            fill="${p.primary}" stroke="${p.primaryDark}" stroke-width="2"/>
      ${deco}
      <path d="M42 14 Q50 22 58 14" fill="none" stroke="${p.secondary}" stroke-width="3"/>
      ${num}
    </svg>`;
  };

  // ---- Nation flag (fictional, deterministic) ------------------------
  V.flag = function (nation, size) {
    const w = size || 28, hgt = Math.round(w * 0.66);
    const h = hash(nation);
    const c1 = hsl(h % 360, 60, 45);
    const c2 = hsl((h >> 3) % 360, 60, 50);
    const c3 = hsl((h >> 6) % 360, 65, 55);
    const layout = h % 3;
    let body;
    if (layout === 0) { // vertical tri
      body = `<rect width="14" height="28" fill="${c1}"/><rect x="14" width="14" height="28" fill="${c2}"/><rect x="28" width="14" height="28" fill="${c3}"/>`;
    } else if (layout === 1) { // horizontal tri
      body = `<rect width="42" height="9.3" fill="${c1}"/><rect y="9.3" width="42" height="9.3" fill="${c2}"/><rect y="18.6" width="42" height="9.4" fill="${c3}"/>`;
    } else { // hoist + canton star
      body = `<rect width="42" height="28" fill="${c1}"/><rect width="16" height="28" fill="${c2}"/><circle cx="28" cy="14" r="5" fill="${c3}"/>`;
    }
    return `<svg viewBox="0 0 42 28" width="${w}" height="${hgt}" class="vis-flag" aria-hidden="true">
      ${body}<rect width="42" height="28" fill="none" stroke="rgba(0,0,0,.35)"/></svg>`;
  };

  // ---- Radar / pentagon stat chart -----------------------------------
  V.radar = function (stats, keys, size) {
    const s = size || 220;
    const cx = s / 2, cy = s / 2, r = s * 0.36;
    const n = keys.length;
    const ang = (i) => (-Math.PI / 2) + (i * 2 * Math.PI / n);
    const pt = (i, rad) => [cx + Math.cos(ang(i)) * rad, cy + Math.sin(ang(i)) * rad];

    // grid rings
    let grid = "";
    [0.25, 0.5, 0.75, 1].forEach(f => {
      const poly = keys.map((_, i) => pt(i, r * f).map(v => v.toFixed(1)).join(",")).join(" ");
      grid += `<polygon points="${poly}" fill="none" stroke="var(--line)" stroke-width="1"/>`;
    });
    // spokes + labels
    let spokes = "", labels = "";
    keys.forEach((k, i) => {
      const [x, y] = pt(i, r);
      spokes += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--line)"/>`;
      const [lx, ly] = pt(i, r + 16);
      const val = stats[k];
      labels += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" dominant-baseline="middle"
        font-size="9" fill="var(--muted)" font-family="system-ui">${(T.STAT_LABELS[k] || k).slice(0, 9)}</text>
        <text x="${lx.toFixed(1)}" y="${(ly + 10).toFixed(1)}" text-anchor="middle"
        font-size="10" font-weight="800" fill="var(--gold)" font-family="system-ui">${val}</text>`;
    });
    // value polygon
    const valPoly = keys.map((k, i) => pt(i, r * T.clamp(stats[k] / 99, 0.05, 1)).map(v => v.toFixed(1)).join(",")).join(" ");

    return `<svg viewBox="0 0 ${s} ${s}" width="100%" style="max-width:${s}px" class="vis-radar" aria-hidden="true">
      ${grid}${spokes}
      <polygon points="${valPoly}" fill="rgba(245,196,81,0.28)" stroke="var(--gold)" stroke-width="2"/>
      ${keys.map((k, i) => { const [x, y] = pt(i, r * T.clamp(stats[k] / 99, 0.05, 1)); return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6" fill="var(--gold)"/>`; }).join("")}
      ${labels}
    </svg>`;
  };

  // ---- Circular rating ring ------------------------------------------
  V.ring = function (value, max, label, size) {
    const s = size || 96;
    const r = s * 0.4, c = 2 * Math.PI * r, cx = s / 2;
    const frac = T.clamp(value / max, 0, 1);
    const col = frac > 0.72 ? "var(--good)" : frac > 0.45 ? "var(--gold)" : "var(--bad)";
    return `<svg viewBox="0 0 ${s} ${s}" width="${s}" height="${s}" class="vis-ring" aria-hidden="true">
      <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="var(--bg-3)" stroke-width="8"/>
      <circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${col}" stroke-width="8"
        stroke-linecap="round" stroke-dasharray="${(c * frac).toFixed(1)} ${c.toFixed(1)}"
        transform="rotate(-90 ${cx} ${cx})"/>
      <text x="${cx}" y="${cx - 2}" text-anchor="middle" font-size="${s * 0.26}" font-weight="800"
        fill="var(--text)" font-family="system-ui">${value}</text>
      <text x="${cx}" y="${cx + s * 0.18}" text-anchor="middle" font-size="${s * 0.12}"
        fill="var(--muted)" font-family="system-ui">${label || ""}</text>
    </svg>`;
  };

  // ---- Trophy / medal -------------------------------------------------
  V.trophy = function (kind, size) {
    const s = size || 40;
    const gold = "var(--gold)", dim = "var(--gold-dim)";
    if (kind === "award" || kind === "medal") {
      return `<svg viewBox="0 0 40 48" width="${s}" height="${s * 48 / 40}" aria-hidden="true">
        <path d="M14 4 L26 4 L30 16 L10 16 Z" fill="${dim}"/>
        <circle cx="20" cy="30" r="13" fill="${gold}" stroke="${dim}" stroke-width="2"/>
        <text x="20" y="35" text-anchor="middle" font-size="13" font-weight="800" fill="#1a1408">★</text>
      </svg>`;
    }
    // cup
    return `<svg viewBox="0 0 40 48" width="${s}" height="${s * 48 / 40}" aria-hidden="true">
      <path d="M10 6 H30 V16 Q30 28 20 30 Q10 28 10 16 Z" fill="${gold}" stroke="${dim}" stroke-width="2"/>
      <path d="M10 9 Q2 9 4 17 Q5 22 12 22" fill="none" stroke="${dim}" stroke-width="2"/>
      <path d="M30 9 Q38 9 36 17 Q35 22 28 22" fill="none" stroke="${dim}" stroke-width="2"/>
      <rect x="17" y="30" width="6" height="8" fill="${dim}"/>
      <rect x="11" y="38" width="18" height="5" rx="1.5" fill="${gold}"/>
    </svg>`;
  };

  // ---- FUT-style player card -----------------------------------------
  V.playerCard = function (player, club, overall) {
    const pos = player.position;
    const ovr = overall != null ? overall : T.overall(player);
    const num = player.number != null ? player.number : 9;
    return `
    <div class="player-card">
      <div class="pc-top">
        <div class="pc-ovr">
          <div class="pc-ovr-n">${ovr}</div>
          <div class="pc-ovr-pos">${pos}</div>
          <div class="pc-flag">${V.flag(player.nation, 30)}</div>
        </div>
        <div class="pc-kit">${V.kit(club.name, num, 130)}</div>
        <div class="pc-crest">${V.crest(club.name, 44)}</div>
      </div>
      <div class="pc-name">${player.name}</div>
      <div class="pc-sub">${player.nation} · ${club.name} · age ${player.age}</div>
    </div>`;
  };

  // ---- Season form sparkline -----------------------------------------
  V.sparkline = function (values, w, h) {
    const W = w || 320, H = h || 56;
    if (!values || !values.length) return "";
    const min = 4, max = 10;
    const stepX = W / Math.max(values.length - 1, 1);
    const y = (v) => H - ((v - min) / (max - min)) * (H - 8) - 4;
    const pts = values.map((v, i) => `${(i * stepX).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
    const area = `0,${H} ${pts} ${W},${H}`;
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="none" class="vis-spark" aria-hidden="true">
      <line x1="0" y1="${y(6).toFixed(1)}" x2="${W}" y2="${y(6).toFixed(1)}" stroke="var(--line)" stroke-dasharray="3 3"/>
      <polygon points="${area}" fill="rgba(245,196,81,0.10)"/>
      <polyline points="${pts}" fill="none" stroke="var(--gold)" stroke-width="2" stroke-linejoin="round"/>
    </svg>`;
  };

  // ---- League position ladder ----------------------------------------
  V.leaguePos = function (finish, teams) {
    const n = teams || 20;
    const cells = [];
    for (let i = 1; i <= n; i++) {
      const active = i === finish;
      const top = i <= 4, releg = i > n - 3;
      const col = active ? "var(--gold)" : top ? "rgba(74,222,128,.5)" : releg ? "rgba(248,113,113,.4)" : "var(--bg-3)";
      cells.push(`<div class="lp-cell" style="background:${col};${active ? "height:22px;" : ""}" title="${i}"></div>`);
    }
    return `<div class="league-pos">
      <div class="lp-bar">${cells.join("")}</div>
      <div class="row between" style="font-size:11px"><span class="muted">1st</span>
        <span class="gold" style="font-weight:800">Finished ${ordinal(finish)}</span>
        <span class="muted">${n}th</span></div>
    </div>`;
  };

  function ordinal(n) {
    const s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  // ---- Match context header (key moments) ----------------------------
  // ctx from Moments.context(): { compLabel, tone, opponent, stakes }
  V.matchHeader = function (myClubName, ctx) {
    const toneClass = ctx.tone === "gold" ? "gold" : "";
    const fixture = ctx.opponent
      ? `<div class="mh-fixture">
           <div class="mh-side">${V.crest(myClubName, 30)}</div>
           <div class="mh-vs">VS</div>
           <div class="mh-side">${V.crest(ctx.opponent, 30)}</div>
         </div>
         <div class="mh-names"><span>${myClubName}</span><span>${ctx.opponent}</span></div>`
      : `<div class="mh-fixture"><div class="mh-side">${V.crest(myClubName, 30)}</div>
           <div class="mh-vs">📣</div></div>`;
    const score = (ctx.gh != null)
      ? `<div class="mh-score">${ctx.round ? "Matchday " + ctx.round + " · " : ""}${ctx.minute ? ctx.minute + "' · " : ""}${ctx.home ? ctx.gh + "–" + ctx.ga : ctx.ga + "–" + ctx.gh}</div>`
      : ``;
    return `<div class="match-header">
      <span class="pill ${toneClass}">${ctx.compLabel}${ctx.home != null ? (ctx.home ? " · Home" : " · Away") : ""}</span>
      ${fixture}
      ${score}
      <div class="mh-stakes">${ctx.stakes}</div>
    </div>`;
  };

  // ---- League standings table ----------------------------------------
  // rows: [{ pos, name, P, W, D, L, GD, Pts, isPlayer }]
  V.leagueTable = function (rows, limit) {
    const show = limit ? rows.slice(0, limit) : rows;
    const body = show.map(r => `
      <tr class="${r.isPlayer ? "me" : ""}">
        <td class="pos">${r.pos}</td>
        <td>${r.name}</td>
        <td>${r.P}</td><td>${r.W}</td><td>${r.D}</td><td>${r.L}</td>
        <td>${r.GD > 0 ? "+" + r.GD : r.GD}</td><td><b>${r.Pts}</b></td>
      </tr>`).join("");
    return `<table class="ltable">
      <thead><tr><th>#</th><th>Club</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead>
      <tbody>${body}</tbody>
    </table>`;
  };

  // ---- Game-by-game match list ---------------------------------------
  // m: { rd, opp, home, my, op, res, pg, pa, missed, key }
  V.matchRow = function (m) {
    return `<div class="match-row ${m.missed ? "dnp" : ""} ${m.key ? "key" : ""}">
        <span class="md">R${m.rd}</span>
        <span>${m.home ? "vs " : "@ "}${m.opp}${m.key ? " ⭐" : ""}</span>
        <span class="score">${m.my}–${m.op}</span>
        <span class="ga">${m.missed ? "DNP" : ((m.pg ? m.pg + "G " : "") + (m.pa ? m.pa + "A" : "") || "·")}
          <span class="res-badge res-${m.res}">${m.res}</span></span>
      </div>`;
  };
  V.matchList = function (matches) {
    return `<div class="matchlist">` + matches.map(V.matchRow).join("") + `</div>`;
  };
})();
