/* backsplash-engine.js — generative hand-drawn ink backsplashes for clareaulab.com
   window.BS.mount(canvas, {style, page, seed, motion, inkWeight, washOpacity, density})

   Everything is drawn as jittered ink polylines built ONCE into a display list
   (so the hand-drawn wobble is stable, not shimmering) and re-rendered each
   frame with a gentle bob/drift transform. One shared ticker, viewport-gated. */
(function () {
  var TAU = Math.PI * 2;
  var THEMES = {
    light: {
      paperTop: '#f9fdff', paperBot: '#eaf3f9', ink: '#1a3850', card: '#ffffff',
      scrim: '249,253,255', water: '#2f6f96', cool: '#4aa8cf', grid: '#5d93b8',
      accents: { home: '#0091c7', team: '#2fa98c', news: '#d1892b', research: '#d9644f', pubs: '#3963af', contact: '#7268cf' }
    },
    dark: {
      paperTop: '#0b1728', paperBot: '#060e1c', ink: '#a9c9e2', card: '#122438',
      scrim: '8,17,30', water: '#4f9ec4', cool: '#4fd8ff', grid: '#3d6c8f',
      accents: { home: '#4fd8ff', team: '#45e6c4', news: '#f0b24f', research: '#ff8a70', pubs: '#7fb2ff', contact: '#a99cff' }
    }
  };
  var TH = THEMES.light;
  var INK = TH.ink;
  var PAPER_TOP = TH.paperTop, PAPER_BOT = TH.paperBot;
  function applyTheme(name) {
    TH = THEMES[name] || THEMES.light;
    INK = TH.ink; PAPER_TOP = TH.paperTop; PAPER_BOT = TH.paperBot;
  }

  function rngFrom(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function lerp(a, b, u) { return a + (b - a) * u; }

  // ---------------------------------------------------------------- geometry
  function blobPts(cx, cy, r, rng, n, wob) {
    n = n || 12; wob = wob == null ? 0.16 : wob;
    var p = [];
    for (var i = 0; i < n; i++) {
      var a = i / n * TAU, rr = r * (1 - wob / 2 + rng() * wob);
      p.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    return p;
  }
  function jitter(pts, rng, j) {
    return pts.map(function (p) { return [p[0] + (rng() - 0.5) * 2 * j, p[1] + (rng() - 0.5) * 2 * j]; });
  }
  function poly(ctx, pts, closed) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    if (closed) ctx.closePath();
  }
  function smooth(ctx, pts, closed) {
    var n = pts.length; if (n < 2) return;
    ctx.beginPath();
    if (closed) {
      var m = [(pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2];
      ctx.moveTo(m[0], m[1]);
      for (var i = 0; i < n; i++) {
        var c = pts[i], x = pts[(i + 1) % n];
        ctx.quadraticCurveTo(c[0], c[1], (c[0] + x[0]) / 2, (c[1] + x[1]) / 2);
      }
      ctx.closePath();
    } else {
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (var k = 1; k < n - 1; k++) {
        var cc = pts[k], nx = pts[k + 1];
        ctx.quadraticCurveTo(cc[0], cc[1], (cc[0] + nx[0]) / 2, (cc[1] + nx[1]) / 2);
      }
      ctx.lineTo(pts[n - 1][0], pts[n - 1][1]);
    }
  }

  // ------------------------------------------------------------------- items
  function S(pts, o) { o = o || {}; return { k: 's', pts: pts, closed: !!o.closed, sharp: !!o.sharp, w: o.w || 1.3, color: o.color || INK, alpha: o.alpha == null ? 0.97 : o.alpha, passes: o.passes || 2 }; }
  function F(pts, color, alpha, sharp) { return { k: 'f', pts: pts, color: color, alpha: alpha, sharp: !!sharp }; }
  function D(x, y, r, color, alpha) { return { k: 'd', x: x, y: y, r: r, color: color || INK, alpha: alpha == null ? 0.85 : alpha }; }
  function T(str, x, y, size, color, alpha, font) { return { k: 't', s: str, x: x, y: y, size: size, color: color, alpha: alpha, font: font || "'Space Mono', monospace" }; }

  // ------------------------------------------------------------------ motifs
  // Every motif returns a flat item list in absolute coords.
  var M = {};

  M.virus = function (x, y, r, g) {
    var rng = g.rng, it = [], spikes = 10 + (rng() * 3 | 0);
    it.push(F(blobPts(x + r * 0.12, y + r * 0.12, r * 1.04, rng, 11, 0.2), g.accent, g.washA));
    it.push(S(jitter(blobPts(x, y, r, rng, 13, 0.1), rng, r * 0.03), { w: g.w * 1.2 }));
    for (var i = 0; i < spikes; i++) {
      var a = i / spikes * TAU + rng() * 0.2, r2 = r + r * 0.36;
      it.push(S([[x + Math.cos(a) * r * 0.97, y + Math.sin(a) * r * 0.97], [x + Math.cos(a) * r2, y + Math.sin(a) * r2]], { w: g.w * 0.85, passes: 1 }));
      it.push(D(x + Math.cos(a) * r2, y + Math.sin(a) * r2, Math.max(1.3, r * 0.085), INK, 0.8));
    }
    it.push(S(jitter(blobPts(x - r * 0.08, y - r * 0.02, r * 0.4, rng, 9, 0.24), rng, r * 0.03), { w: g.w * 0.85, closed: true, alpha: 0.6 }));
    return it;
  };

  M.helix = function (x, y, len, g, amp) {
    var rng = g.rng, it = [], steps = Math.max(24, len / 6 | 0);
    amp = amp || len * 0.11;
    var a = [], b = [], ph = [];
    for (var i = 0; i <= steps; i++) {
      var u = i / steps, px = x + u * len, p = u * TAU * 2.1;
      ph.push(p);
      a.push([px, y + Math.sin(p) * amp]);
      b.push([px, y + Math.sin(p + Math.PI) * amp]);
    }
    // rungs first, so the front strand sits over them
    for (var k = 2; k < steps - 1; k += 3) {
      var acc = rng() < 0.34;
      it.push(S([a[k], b[k]], { w: g.w * 0.7, passes: 1, color: acc ? g.accent : INK, alpha: acc ? 0.85 : 0.5 }));
    }
    // screen y grows downward, so a strand rising to the right has cos(ph) < 0
    // — those runs are the near side of a right-handed helix.
    function runs(pts, front) {
      var out = [], cur = null;
      for (var i = 0; i <= steps; i++) {
        var isFront = Math.cos(ph[i]) < 0;
        if (isFront === front) { if (!cur) { cur = []; if (i > 0) cur.push(pts[i - 1]); } cur.push(pts[i]); }
        else if (cur) { cur.push(pts[i]); out.push(cur); cur = null; }
      }
      if (cur) out.push(cur);
      return out;
    }
    [a, b].forEach(function (strand) {
      runs(strand, false).forEach(function (r) { if (r.length > 1) it.push(S(jitter(r, rng, 0.6), { w: g.w * 1.05 })); });
    });
    [a, b].forEach(function (strand) {
      runs(strand, true).forEach(function (r) {
        if (r.length < 2) return;
        var j = jitter(r, rng, 0.6);
        it.push(S(j, { w: g.w * 3.4, color: PAPER_TOP, alpha: 1, passes: 1 }));
        it.push(S(j, { w: g.w * 1.05 }));
      });
    });
    return it;
  };

  M.foldChain = function (x, y, r, g, k, n) {
    var rng = g.rng, it = [], pts = [];
    n = n || 15;
    for (var i = 0; i < n; i++) {
      var u = i / (n - 1);
      var ex = x - r * 1.5 + u * r * 3, ey = y + Math.sin(u * 10.5) * r * 0.2;
      var an = u * TAU * 1.85, rr = r * (0.3 + 0.52 * u);
      var fx = x + Math.cos(an) * rr * 0.98, fy = y + Math.sin(an) * rr * 0.82;
      pts.push([ex + (fx - ex) * k, ey + (fy - ey) * k]);
    }
    if (k > 0.05) it.push(F(blobPts(x, y, r * (0.5 + k * 0.55), rng, 13, 0.36), g.accent, g.washA * k * 1.2));
    it.push(S(jitter(pts, rng, 0.7), { w: g.w * 1.35 }));
    for (var j = 0; j < n; j++) it.push(D(pts[j][0], pts[j][1], Math.max(1.5, r * 0.085), j === 0 || j === n - 1 ? g.accent : INK, j === 0 || j === n - 1 ? 0.9 : 0.55));
    return it;
  };

  // simplified tRNA cloverleaf: acceptor stem with 3' tail, D and T loops,
  // anticodon loop with its three bases
  M.trna = function (x, y, s, g) {
    var rng = g.rng, it = [];
    function stem(x1, y1, x2, y2, off) {
      var dx = x2 - x1, dy = y2 - y1, L = Math.sqrt(dx * dx + dy * dy) || 1, nx = -dy / L * off, ny = dx / L * off;
      it.push(S(jitter([[x1 + nx, y1 + ny], [x2 + nx, y2 + ny]], rng, 0.6), { w: g.w * 1.15 }));
      it.push(S(jitter([[x1 - nx, y1 - ny], [x2 - nx, y2 - ny]], rng, 0.6), { w: g.w * 1.15 }));
    }
    function loop(cx, cy, r, accent) {
      if (accent) it.push(F(blobPts(cx, cy, r * 1.02, rng, 11, 0.16), g.accent, g.washA * 1.6));
      it.push(S(jitter(blobPts(cx, cy, r, rng, 12, 0.12), rng, 0.6), { closed: true, w: g.w * 1.15 }));
    }
    var o = s * 0.11;
    stem(x, y - s * 0.18, x, y - s * 1.0, o);
    it.push(S(jitter([[x + o, y - s * 1.0], [x + s * 0.34, y - s * 1.22], [x + s * 0.6, y - s * 1.14]], rng, 0.7), { w: g.w * 1.1 }));
    it.push(D(x + s * 0.6, y - s * 1.14, Math.max(1.6, s * 0.08), g.accent, 0.9));
    stem(x - s * 0.14, y - s * 0.1, x - s * 0.72, y - s * 0.3, o);
    loop(x - s * 0.98, y - s * 0.38, s * 0.26, false);
    stem(x + s * 0.14, y - s * 0.1, x + s * 0.72, y - s * 0.3, o);
    loop(x + s * 0.98, y - s * 0.38, s * 0.26, false);
    stem(x, y + s * 0.12, x, y + s * 0.66, o);
    loop(x, y + s * 0.94, s * 0.3, true);
    for (var i = 0; i < 3; i++) it.push(D(x - s * 0.16 + i * s * 0.16, y + s * 1.26, Math.max(1.4, s * 0.07), INK, 0.7));
    return it;
  };

  M.protein = function (x, y, r, g) {
    var rng = g.rng, it = [], steps = 54, turns = 2.3, p = [];
    it.push(F(blobPts(x, y, r * 1.05, rng, 12, 0.3), g.accent, g.washA * 0.9));
    for (var i = 0; i <= steps; i++) {
      var u = i / steps, a = u * TAU * turns, rr = r * (0.28 + 0.72 * u);
      p.push([x + Math.cos(a) * rr * 1.1, y + Math.sin(a) * rr * 0.78]);
    }
    it.push(S(jitter(p, rng, 0.8), { w: g.w * 1.3 }));
    // two beta-sheet arrows tucked alongside the coil
    for (var s = 0; s < 2; s++) {
      var ax = x + r * (s ? 0.55 : -0.95), ay = y + r * (s ? -0.85 : 0.75), L = r * 0.85, dir = s ? 1 : -1;
      it.push(S([[ax, ay], [ax + L * dir, ay - L * 0.28 * dir]], { w: g.w * 1.5 }));
      it.push(S([[ax + L * dir, ay - L * 0.28 * dir], [ax + L * dir - r * 0.22 * dir, ay - L * 0.28 * dir - r * 0.2]], { w: g.w, passes: 1 }));
      it.push(S([[ax + L * dir, ay - L * 0.28 * dir], [ax + L * dir - r * 0.26 * dir, ay - L * 0.28 * dir + r * 0.14]], { w: g.w, passes: 1 }));
    }
    return it;
  };

  M.bars = function (x, y, w, h, g) {
    var rng = g.rng, it = [], n = 5 + (rng() * 3 | 0), bw = w / (n * 1.5);
    for (var i = 0; i < n; i++) {
      var bh = h * (0.3 + rng() * 0.7), bx = x + i * bw * 1.5;
      var box = [[bx, y], [bx + bw, y], [bx + bw, y - bh], [bx, y - bh]];
      if (rng() < 0.45) it.push(F(jitter(box, rng, 1), g.accent, g.washA * 1.3, true));
      it.push(S(jitter(box, rng, 0.9), { closed: true, sharp: true, w: g.w }));
    }
    it.push(S([[x - w * 0.06, y], [x + w * 0.98, y]], { w: g.w * 1.1 }));
    return it;
  };

  M.matrix = function (x, y, cell, cols, rows, g) {
    var rng = g.rng, it = [];
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
      var cx = x + c * cell, cy = y + r * cell, v = rng();
      var box = [[cx, cy], [cx + cell * 0.78, cy], [cx + cell * 0.78, cy + cell * 0.78], [cx, cy + cell * 0.78]];
      if (v < 0.3) it.push(F(box, g.accent, g.washA * 1.7, true));
      else if (v < 0.5) it.push(F(box, INK, g.washA * 0.55, true));
      it.push(S(jitter(box, rng, 0.55), { closed: true, sharp: true, w: g.w * 0.6, alpha: 0.5 }));
    }
    return it;
  };

  M.dots = function (x, y, r, n, g) {
    var rng = g.rng, it = [];
    for (var i = 0; i < n; i++) {
      var a = rng() * TAU, d = Math.pow(rng(), 0.6) * r;
      var acc = rng() < 0.3;
      it.push(D(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, 1.6 + rng() * 2.2, acc ? g.accent : INK, acc ? 0.8 : 0.4));
    }
    return it;
  };

  M.paper = function (x, y, w, h, g, tilt) {
    var rng = g.rng, it = [], t = tilt || 0;
    function rot(px, py) { var dx = px - x, dy = py - y; return [x + dx * Math.cos(t) - dy * Math.sin(t), y + dx * Math.sin(t) + dy * Math.cos(t)]; }
    var box = [rot(x, y), rot(x + w, y), rot(x + w, y + h), rot(x, y + h)];
    it.push(F(box.map(function (p) { return [p[0] + 4, p[1] + 5]; }), INK, 0.07, true));
    it.push(F(jitter(box, rng, 1.2), TH.card, 0.94, true));
    it.push(S(jitter(box, rng, 1.1), { closed: true, sharp: true, w: g.w * 1.15 }));
    it.push(S(jitter([rot(x + w * 0.12, y + h * 0.13), rot(x + w * 0.62, y + h * 0.13)], rng, 0.8), { w: g.w * 2.4, color: g.accent, alpha: 0.85, passes: 1 }));
    for (var i = 0; i < 7; i++) {
      var ly = y + h * (0.26 + i * 0.095), len = w * (0.5 + rng() * 0.38);
      it.push(S(jitter([rot(x + w * 0.12, ly), rot(x + w * 0.12 + len, ly)], rng, 0.6), { w: g.w * 0.7, alpha: 0.34, passes: 1 }));
    }
    return it;
  };

  M.tower = function (x, baseY, w, h, g, hue) {
    var rng = g.rng, it = [];
    var box = [[x, baseY], [x, baseY - h], [x + w, baseY - h], [x + w, baseY]];
    it.push(F(jitter(box, rng, 1.1), hue || g.accent, g.washA * 1.25, true));
    it.push(S(jitter(box, rng, 1.1), { closed: true, sharp: true, w: g.w * 1.1 }));
    var cols = Math.max(2, w / 13 | 0), rows = Math.max(2, h / 20 | 0);
    for (var c = 0; c < cols; c++) for (var r = 0; r < rows; r++) {
      if (rng() < 0.22) continue;
      var wx = x + w * (c + 0.72) / (cols + 0.45), wy = baseY - h + h * (r + 0.75) / (rows + 0.5), s = Math.min(5.5, w / cols * 0.38);
      it.push(S(jitter([[wx - s / 2, wy - s / 2], [wx + s / 2, wy - s / 2], [wx + s / 2, wy + s / 2], [wx - s / 2, wy + s / 2]], rng, 0.5), { closed: true, sharp: true, w: g.w * 0.55, alpha: 0.4 }));
    }
    return it;
  };

  M.cable = function (x1, x2, y, sag, g) {
    var rng = g.rng, it = [], steps = 26, p = [];
    for (var i = 0; i <= steps; i++) { var u = i / steps; p.push([lerp(x1, x2, u), y + Math.sin(u * Math.PI) * sag]); }
    it.push(S(jitter(p, rng, 0.8), { w: g.w * 1.25 }));
    for (var k = 2; k < steps; k += 3) it.push(S([p[k], [p[k][0], y - sag * 0.15]], { w: g.w * 0.55, passes: 1, alpha: 0.45 }));
    // pylon
    var px = lerp(x1, x2, 0.5);
    it.push(S(jitter([[px - 9, y + sag * 0.9], [px - 4, y - sag * 1.5], [px + 4, y - sag * 1.5], [px + 9, y + sag * 0.9]], rng, 1), { w: g.w * 1.15 }));
    it.push(S([[px - 6, y - sag * 0.4], [px + 6, y - sag * 0.4]], { w: g.w * 0.7, passes: 1 }));
    return it;
  };

  M.river = function (y, W, g, n) {
    var rng = g.rng, it = [];
    for (var i = 0; i < n; i++) {
      var ly = y + i * 9 + rng() * 4, lx = rng() * W * 0.9, len = 30 + rng() * 150;
      it.push(S(jitter([[lx, ly], [lx + len, ly]], rng, 0.7), { w: g.w * 0.7, alpha: 0.2 + rng() * 0.2, passes: 1, color: TH.water }));
    }
    return it;
  };

  M.cat = function (x, y, s, g) {
    var rng = g.rng, it = [];
    var o = [[-0.62, 0], [-0.56, -0.5], [-0.44, -0.98], [-0.48, -1.3], [-0.34, -1.66], [-0.14, -1.38],
             [0.14, -1.38], [0.34, -1.66], [0.48, -1.3], [0.44, -0.98], [0.56, -0.5], [0.64, 0]];
    var body = o.map(function (p) { return [x + p[0] * s, y + p[1] * s]; });
    var closed = body.concat([[x + 0.64 * s, y], [x - 0.62 * s, y]]);
    it.push(F(jitter(closed, rng, 1.2), g.accent, g.washA * 1.5));
    it.push(S(jitter(body, rng, 1.1), { w: g.w * 1.35 }));
    it.push(S(jitter([[x - 0.62 * s, y], [x + 0.64 * s, y]], rng, 0.8), { w: g.w * 1.2 }));
    it.push(D(x - 0.17 * s, y - 1.14 * s, Math.max(1.5, s * 0.075), INK, 0.95));
    it.push(D(x + 0.17 * s, y - 1.14 * s, Math.max(1.5, s * 0.075), INK, 0.95));
    it.push(S(jitter([[x - 0.05 * s, y - 0.98 * s], [x + 0.05 * s, y - 0.9 * s], [x + 0.15 * s, y - 0.98 * s]], rng, 0.5), { w: g.w * 0.8, alpha: 0.7 }));
    it.push(S(jitter([[x + 0.6 * s, y - 0.04 * s], [x + 1.05 * s, y - 0.1 * s], [x + 1.3 * s, y - 0.46 * s], [x + 1.16 * s, y - 0.82 * s]], rng, 1.1), { w: g.w * 1.35 }));
    return it;
  };

  M.sun = function (x, y, r, g) {
    var rng = g.rng, it = [], rays = 12;
    it.push(F(blobPts(x, y, r * 1.06, rng, 13, 0.14), g.accent, g.washA * 1.6));
    it.push(S(jitter(blobPts(x, y, r, rng, 14, 0.07), rng, r * 0.03), { closed: true, w: g.w * 1.4 }));
    for (var i = 0; i < rays; i++) {
      var a = i / rays * TAU + rng() * 0.12, r1 = r * 1.24, r2 = r * (1.5 + rng() * 0.24);
      it.push(S([[x + Math.cos(a) * r1, y + Math.sin(a) * r1], [x + Math.cos(a) * r2, y + Math.sin(a) * r2]], { w: g.w * 1.1, passes: 1 }));
    }
    for (var k = 0; k < 2; k++) {
      var rr = r * (1.78 + k * 0.3), ring = [];
      for (var j = 0; j <= 24; j++) { var aa = j / 24 * TAU; ring.push([x + Math.cos(aa) * rr, y + Math.sin(aa) * rr * 0.98]); }
      it.push(S(jitter(ring, rng, 1.4), { closed: true, w: g.w * 0.7, alpha: 0.3 - k * 0.12, passes: 1, color: g.accent }));
    }
    return it;
  };

  M.person = function (x, y, h, g, wave) {
    var rng = g.rng, it = [], hr = h * 0.15;
    var head = blobPts(x, y - h + hr, hr, rng, 11, 0.1);
    var torso = [[x - h * 0.17, y - h * 0.32], [x - h * 0.2, y - h * 0.72], [x + h * 0.2, y - h * 0.72], [x + h * 0.17, y - h * 0.32]];
    it.push(F(head, PAPER_TOP, 1));
    it.push(F(torso, PAPER_TOP, 1, true));
    it.push(S(jitter(head, rng, 0.7), { closed: true, w: g.w * 1.3 }));
    it.push(F(jitter(torso, rng, 1), g.accent, g.washA * 1.5, true));
    it.push(S(jitter(torso, rng, 1), { closed: true, sharp: true, w: g.w * 1.25 }));
    it.push(S(jitter([[x - h * 0.19, y - h * 0.66], [x - h * 0.34, y - h * (wave ? 0.94 : 0.4)]], rng, 0.9), { w: g.w * 1.15 }));
    it.push(S(jitter([[x + h * 0.19, y - h * 0.66], [x + h * 0.34, y - h * (wave ? 0.4 : 0.94)]], rng, 0.9), { w: g.w * 1.15 }));
    it.push(S(jitter([[x - h * 0.09, y - h * 0.32], [x - h * 0.11, y]], rng, 0.8), { w: g.w * 1.2 }));
    it.push(S(jitter([[x + h * 0.09, y - h * 0.32], [x + h * 0.11, y]], rng, 0.8), { w: g.w * 1.2 }));
    return it;
  };

  M.bird = function (x, y, s, g) {
    var rng = g.rng;
    return [S(jitter([[x - s, y], [x, y - s * 0.62], [x + s, y]], rng, 0.6), { w: g.w * 1.1, alpha: 0.6 })];
  };

  M.cloud = function (x, y, w, g) {
    var rng = g.rng, it = [], p = [];
    for (var i = 0; i <= 16; i++) { var a = i / 16 * TAU; p.push([x + Math.cos(a) * w, y + Math.sin(a) * w * 0.26]); }
    it.push(F(jitter(p, rng, 1.6), g.accent, g.washA * 1.1));
    it.push(S(jitter(p, rng, 1.4), { closed: true, w: g.w * 0.85, alpha: 0.45 }));
    return it;
  };

  M.flask = function (x, y, s, g) {
    var rng = g.rng, it = [];
    var body = [[x - s * 0.18, y - s], [x - s * 0.18, y - s * 0.52], [x - s * 0.62, y], [x + s * 0.62, y], [x + s * 0.18, y - s * 0.52], [x + s * 0.18, y - s]];
    it.push(F(jitter([[x - s * 0.44, y - s * 0.28], [x + s * 0.44, y - s * 0.28], [x + s * 0.62, y], [x - s * 0.62, y]], rng, 1), g.accent, g.washA * 1.7, true));
    it.push(S(jitter(body, rng, 1), { closed: true, sharp: true, w: g.w * 1.2 }));
    it.push(S(jitter([[x - s * 0.3, y - s * 1.04], [x + s * 0.3, y - s * 1.04]], rng, 0.7), { w: g.w * 1.3 }));
    it.push(D(x - s * 0.1, y - s * 0.14, 1.5, INK, 0.5));
    it.push(D(x + s * 0.2, y - s * 0.2, 2, INK, 0.4));
    return it;
  };

  M.mug = function (x, y, s, g) {
    var rng = g.rng, it = [];
    var box = [[x - s * 0.5, y - s * 0.8], [x + s * 0.44, y - s * 0.8], [x + s * 0.36, y], [x - s * 0.42, y]];
    it.push(F(jitter(box, rng, 1), g.accent, g.washA * 1.5, true));
    it.push(S(jitter(box, rng, 1), { closed: true, sharp: true, w: g.w * 1.2 }));
    it.push(S(jitter([[x + s * 0.46, y - s * 0.66], [x + s * 0.82, y - s * 0.56], [x + s * 0.72, y - s * 0.2], [x + s * 0.4, y - s * 0.2]], rng, 0.9), { w: g.w * 1.05 }));
    it.push(S(jitter([[x - s * 0.2, y - s * 1.0], [x - s * 0.06, y - s * 1.24], [x - s * 0.2, y - s * 1.44]], rng, 0.8), { w: g.w * 0.8, alpha: 0.45 }));
    return it;
  };

  M.ticks = function (x, y, w, g) {
    var rng = g.rng, it = [], n = 9;
    it.push(S(jitter([[x, y], [x + w, y]], rng, 0.7), { w: g.w * 1.1 }));
    for (var i = 0; i < n; i++) {
      var tx = x + w * (i + 0.5) / n, big = i % 3 === 0;
      it.push(S([[tx, y], [tx, y - (big ? 12 : 6)]], { w: g.w * (big ? 1.1 : 0.7), passes: 1, color: big ? g.accent : INK, alpha: big ? 0.85 : 0.45 }));
    }
    return it;
  };

  M.speck = function (x0, x1, y0, y1, n, g, alpha) {
    var rng = g.rng, it = [];
    for (var i = 0; i < n; i++) {
      var u = rng();
      it.push(D(lerp(x0, x1, u), lerp(y0, y1, rng()), 0.8 + rng() * 1.8, rng() < 0.25 ? g.accent : INK, (alpha == null ? 0.3 : alpha) * (1 - u * 0.6)));
    }
    return it;
  };

  M.letters = function (x, y, size, g, set) {
    var rng = g.rng, it = [], pool = set || ['A', 'C', 'G', 'T'];
    var n = 5 + (rng() * 3 | 0), out = [];
    for (var i = 0; i < n; i++) out.push(pool[(rng() * pool.length) | 0]);
    // guarantee at least three distinct characters in the run
    var need = Math.min(3, pool.length), guard = 0;
    while (new Set(out).size < need && guard++ < 40) {
      var missing = pool.filter(function (c) { return out.indexOf(c) < 0; });
      out[(rng() * out.length) | 0] = missing.length ? missing[(rng() * missing.length) | 0] : pool[(rng() * pool.length) | 0];
    }
    for (var j = 0; j < out.length; j++) it.push(T(out[j], x + j * size * 0.95, y, size, rng() < 0.45 ? g.accent : INK, 0.5));
    return it;
  };

  // ------------------------------------------------------------------- pages
  var PAGES = {
    home: { accent: '#0091c7', tag: 'thread + cascade' },
    team: { accent: '#2fa98c', tag: 'thread + bench' },
    news: { accent: '#d1892b', tag: 'thread + timeline' },
    research: { accent: '#d9644f', tag: 'thread + specimens' },
    pubs: { accent: '#3963af', tag: 'thread + pages' },
    contact: { accent: '#7268cf', tag: 'thread + city' }
  };
  var PHASE = { home: 0, team: 0.9, news: 1.7, research: 2.6, pubs: 3.4, contact: 4.2 };

  // The recurring thread: one continuous hand-drawn strand crossing every
  // banner at the same band, with node beads. Its phase shifts per page so no
  // two banners read identically.
  function threadPts(W, H, page, style, rng, band) {
    var y0 = H * (band == null ? 0.62 : band), ph = PHASE[page] || 0, p = [], steps = 40;
    for (var i = 0; i <= steps; i++) {
      var u = i / steps;
      var y = y0 + Math.sin(u * 3.1 + ph) * H * 0.15 + Math.sin(u * 7.3 + ph * 2) * H * 0.045;
      p.push([-10 + u * (W + 20), y]);
    }
    return jitter(p, rng, 1.1);
  }

  function threadUnits(W, H, page, g, opt) {
    opt = opt || {};
    var rng = g.rng, u = [], p = threadPts(W, H, page, g.style, rng, opt.band);
    u.push({ items: [S(p, { w: g.w * (opt.weight || 1.6), alpha: opt.alpha == null ? 0.75 : opt.alpha })], bob: { a: 2.2, f: 0.11, ph: 1 } });
    var beads = [];
    for (var i = 3; i < p.length - 2; i += 5) {
      var acc = ((i / 5) | 0) % 3 === 0;
      beads.push(D(p[i][0], p[i][1], acc ? 4.2 : 2.6, acc ? g.accent : INK, acc ? 0.9 : 0.5));
      if (acc) beads.push(S(jitter(blobPts(p[i][0], p[i][1], 8, rng, 10, 0.2), rng, 0.6), { closed: true, w: g.w * 0.6, alpha: 0.35 }));
    }
    u.push({ items: beads, bob: { a: 2.2, f: 0.11, ph: 1 } });
    return { units: u, pts: p };
  }

  function ptAt(p, u) {
    var i = Math.min(p.length - 1, Math.max(0, Math.floor(u * (p.length - 1))));
    return p[i];
  }

  // ------------------------------------------------------------------ styles
  function compose(style, page, W, H, seed, opts) {
    applyTheme(opts.theme);
    var rng = rngFrom(seed);
    var pg = PAGES[page] || PAGES.home;
    var accent = TH.accents[page] || TH.accents.home;
    var g = { rng: rng, accent: accent, washA: opts.washOpacity, w: opts.inkWeight, style: style };
    var dens = opts.density;
    var units = [], bg = [], over = [];

    // paper + left scrim are painted by render(); style-specific ground here.
    if (style === 'plot') {
      g.washA = 0;
      var grid = [], step = 30;
      for (var gx = step; gx < W; gx += step) grid.push(S([[gx, 0], [gx, H]], { w: 1, alpha: (gx / step) % 4 === 0 ? 0.5 : 0.26, passes: 1, sharp: true, color: TH.grid }));
      for (var gy = step; gy < H; gy += step) grid.push(S([[0, gy], [W, gy]], { w: 1, alpha: (gy / step) % 4 === 0 ? 0.34 : 0.17, passes: 1, sharp: true, color: TH.grid }));
      over.push({ items: grid });
    }
    if (style === 'city' || page === 'contact') {
      // skyline ground shared by the city style (all pages) and Contact
      var sky = [], base = H * 0.985, hues = [accent, TH.accents.pubs, TH.accents.team, TH.accents.contact, TH.accents.news];
      var x = -14;
      while (x < W + 20) {
        var tw = 26 + rng() * 44, th = H * (0.12 + rng() * 0.26);
        sky = sky.concat(M.tower(x, base, tw, th, g, hues[(rng() * hues.length) | 0]));
        x += tw + 4 + rng() * 12;
      }
      sky = sky.concat(M.river(base + 4, W, g, Math.round(H * 0.055 / 9) + 3));
      sky.push(S(jitter([[-10, base], [W + 10, base]], rng, 0.9), { w: g.w * 1.2 }));
      bg.push({ items: sky, bob: { a: 0, f: 0, ph: 0 } });
    }

    var th = threadUnits(W, H, page, g, style === 'city' || page === 'contact' ? { band: 0.34, weight: 1.3 } : page === 'team' ? { band: 0.28, weight: 1.3 } : style === 'plot' ? { weight: 1.2 } : {});
    var tp = th.pts;

    // ---- per-page subject motifs, hung off the thread
    function at(u, dy) { var p = ptAt(tp, u); return [p[0], p[1] + (dy || 0)]; }
    function add(items, bobA, phase) { units.push({ items: items, bob: { a: bobA == null ? 3 : bobA, f: 0.09 + rng() * 0.06, ph: phase == null ? rng() * TAU : phase } }); }

    var s = Math.min(W, H * 1.9);
    var subj = {
      home: function () {
        add(M.helix(W * 0.33, H * 0.2, s * 0.26, g, H * 0.062), 2.8);
        add(M.virus(W * 0.76, H * 0.26, s * 0.052, g), 3.4);
        for (var i = 0; i < 3; i++) {
          add(M.foldChain(W * (0.52 + i * 0.17), H * 0.72, s * 0.05, g, i / 2), 2.6);
          if (i < 2) add([S([[W * (0.52 + i * 0.17) + s * 0.075, H * 0.72], [W * (0.52 + i * 0.17) + s * 0.115, H * 0.72]], { w: g.w, alpha: 0.4 }), S([[W * (0.52 + i * 0.17) + s * 0.1, H * 0.72 - s * 0.012], [W * (0.52 + i * 0.17) + s * 0.115, H * 0.72], [W * (0.52 + i * 0.17) + s * 0.1, H * 0.72 + s * 0.012]], { w: g.w * 0.8, alpha: 0.4 })], 0, 0);
        }
        add(M.letters(W * 0.42, H * 0.9, s * 0.027, g), 2.4);
        add([S([[W * 0.6, H * 0.895], [W * 0.64, H * 0.895]], { w: g.w, alpha: 0.4 }), S([[W * 0.628, H * 0.883], [W * 0.64, H * 0.895], [W * 0.628, H * 0.907]], { w: g.w * 0.8, alpha: 0.4 })], 0, 0);
        add(M.letters(W * 0.68, H * 0.9, s * 0.026, g, ['0', '1']), 2.4);
      },
      team: function () {
        add([S([[W * 0.34, H * 0.905], [W * 1.02, H * 0.905]], { w: g.w * 0.9, alpha: 0.26 })], 0, 0);
        add(M.person(W * 0.5, H * 0.9, H * 0.42, g, true), 2.2);
        add(M.person(W * 0.615, H * 0.9, H * 0.35, g, false), 2.4);
        add(M.person(W * 0.73, H * 0.9, H * 0.46, g, true), 2);
        add(M.person(W * 0.845, H * 0.9, H * 0.37, g, false), 2.4);
        add(M.cat(W * 0.94, H * 0.9, s * 0.048, g), 2.6);
        add(M.cat(W * 0.4, H * 0.9, s * 0.042, g), 2.8);
        add(M.mug(W * 0.46, H * 0.9, s * 0.05, g), 2.2);
        add(M.flask(W * 0.675, H * 0.9, s * 0.05, g), 2.4);
      },
      news: function () {
        add(M.sun(W * 0.72, H * 0.34, s * 0.062, g), 2.2);
        add(M.ticks(W * 0.42, H * 0.94, W * 0.5, g), 1.4);
        add(M.paper(W * 0.48, H * 0.62, s * 0.1, s * 0.13, g, -0.1), 2.6);
        add(M.paper(W * 0.9, H * 0.68, s * 0.1, s * 0.13, g, 0.08), 2.4);
        add(M.cloud(W * 0.5, H * 0.22, s * 0.075, g), 3.4);
        add(M.bird(W * 0.86, H * 0.14, s * 0.016, g), 3.6);
        add(M.bird(W * 0.9, H * 0.19, s * 0.013, g), 3.4);
      },
      research: function () {
        add(M.speck(W * 0.42, W * 0.99, H * 0.1, H * 0.92, Math.round(150 * dens), g, 0.4), 1.4);
        add(M.helix(W * 0.44, H * 0.2, s * 0.19, g, H * 0.05), 2.6);
        add(M.trna(W * 0.72, H * 0.24, s * 0.055, g), 3);
        add(M.virus(W * 0.92, H * 0.22, s * 0.046, g), 3.4);
        for (var i = 0; i < 4; i++) {
          var u = i / 3, cx = W * (0.48 + u * 0.4), cy = H * 0.72, cr = s * 0.052;
          var gd = { rng: rng, accent: accent, washA: g.washA, w: g.w * (0.72 + u * 0.42), style: style };
          var mm = M.foldChain(cx, cy, cr, gd, u);
          mm.forEach(function (it) { it.alpha = (it.alpha == null ? 0.92 : it.alpha) * (0.42 + u * 0.58); });
          if (u < 0.99) mm = mm.concat(M.speck(cx - cr * 2, cx + cr * 2, cy - cr * 2, cy + cr * 2, Math.round(40 * (1 - u)), gd, 0.5));
          add(mm, 2.6);
        }
      },
      pubs: function () {
        add(M.paper(W * 0.5, H * 0.26, s * 0.14, s * 0.19, g, -0.13), 2.4);
        add(M.paper(W * 0.65, H * 0.4, s * 0.14, s * 0.19, g, 0.05), 2.6);
        add(M.paper(W * 0.81, H * 0.2, s * 0.14, s * 0.19, g, -0.06), 2.2);
        add(M.helix(W * 0.46, H * 0.86, s * 0.2, g, H * 0.042), 2.8);
        add(M.letters(W * 0.75, H * 0.9, s * 0.028, g), 2.4);
      },
      contact: function () {
        add(M.cable(W * 0.22, W * 0.8, H * 0.3, H * 0.11, g), 1.2);
        add(M.sun(W * 0.87, H * 0.2, s * 0.036, g), 2);
        add(M.cloud(W * 0.55, H * 0.16, s * 0.085, g), 3.4);
        add(M.cloud(W * 0.76, H * 0.42, s * 0.06, g), 3);
        add(M.bird(W * 0.44, H * 0.2, s * 0.016, g), 3.6);
        add(M.bird(W * 0.49, H * 0.26, s * 0.013, g), 3.4);
        add(M.bird(W * 0.66, H * 0.11, s * 0.015, g), 3.5);
      }
    };
    (subj[page] || subj.home)();
    if (style === 'city') {
      var dyLift = -H * 0.1;
      units.forEach(function (u) {
        u.items.forEach(function (i) {
          if (i.pts) i.pts = i.pts.map(function (p) { return [p[0], p[1] + dyLift]; });
          else if (i.y != null) i.y += dyLift;
        });
      });
    }

    // ---- style-specific field treatment layered behind the subject
    if (style === 'field') {
      var field = [], cols = Math.round(13 * dens), rows = Math.round(5 * dens);
      for (var c = 0; c < cols; c++) for (var r = 0; r < rows; r++) {
        var fx = (c + 0.5 + (rng() - 0.5) * 0.7) / cols * W;
        var fy = (r + 0.5 + (rng() - 0.5) * 0.8) / rows * H;
        var ramp = Math.pow(fx / W, 1.5);
        var fr = s * (0.016 + rng() * 0.014);
        var gg = { rng: rng, accent: accent, washA: g.washA * ramp * 1.6, w: g.w * 0.8, style: style };
        var pickN = rng();
        var m = pickN < 0.45 ? M.virus(fx, fy, fr, gg) : pickN < 0.8 ? M.protein(fx, fy, fr * 0.9, gg) : M.helix(fx - fr * 2, fy, fr * 4, gg, fr * 0.7);
        var al = 0.1 + ramp * 0.7;
        m.forEach(function (i) { i.alpha = (i.alpha == null ? 0.8 : i.alpha) * al; });
        field.push({ items: m, bob: { a: 1.6 + rng() * 1.6, f: 0.06 + rng() * 0.07, ph: rng() * TAU } });
      }
      bg = bg.concat(field);
    }
    if (style === 'diffusion') {
      var dif = [];
      dif.push({ items: M.speck(W * 0.2, W * 0.8, 0, H, Math.round(320 * dens), g, 0.6), bob: { a: 1.2, f: 0.05, ph: 0.4 } });
      // one motif resolving in four steps, left to right
      for (var st = 0; st < 4; st++) {
        var u2 = st / 3, dx = W * (0.34 + u2 * 0.54), dy = H * 0.5, dr = s * (0.028 + u2 * 0.034);
        var gd = { rng: rng, accent: accent, washA: g.washA * u2, w: g.w * (0.55 + u2 * 0.65), style: style };
        var mm = page === 'pubs' ? M.paper(dx - dr, dy - dr, dr * 2, dr * 2.6, gd, -0.06) : page === 'contact' ? M.tower(dx - dr * 0.7, dy + dr * 1.4, dr * 1.4, dr * 2.6, gd) : page === 'news' ? M.cat(dx, dy + dr, dr * 0.9, gd) : page === 'team' ? M.flask(dx, dy + dr, dr * 1.1, gd) : page === 'home' ? M.helix(dx - dr * 1.6, dy, dr * 3.2, gd, dr * 0.7) : st % 2 ? M.protein(dx, dy, dr, gd) : M.virus(dx, dy, dr, gd);
        mm.forEach(function (i) { i.alpha = (i.alpha == null ? 0.85 : i.alpha) * (0.1 + u2 * 0.9); });
        if (u2 < 0.99) mm = mm.concat(M.speck(dx - dr * 1.7, dx + dr * 1.7, dy - dr * 1.7, dy + dr * 1.7, Math.round(60 * (1 - u2)), gd, 0.6));
        dif.push({ items: mm, bob: { a: 2 + (1 - u2) * 3, f: 0.08, ph: st * 1.3 } });
      }
      bg = bg.concat(dif);
    }
    if (style === 'wash') {
      var w2 = [];
      w2.push({ items: [F(blobPts(W * 0.76, H * 0.5, Math.min(W, H * 2) * 0.34, rng, 16, 0.5), g.accent, g.washA * 0.4)], bob: { a: 4, f: 0.03, ph: 0.7 } });
      w2.push({ items: [F(blobPts(W * 0.5, H * 0.78, Math.min(W, H * 2) * 0.2, rng, 14, 0.55), TH.cool, g.washA * 0.3)], bob: { a: 3.5, f: 0.037, ph: 2.3 } });
      bg = w2.concat(bg);
    }

    return { bg: bg, thread: th.units, units: units, over: over, accent: accent, theme: opts.theme, W: W, H: H, style: style, page: page };
  }

  // ------------------------------------------------------------------ render
  function drawItems(ctx, items) {
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.k === 's') {
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = it.color;
        for (var p = 0; p < it.passes; p++) {
          ctx.globalAlpha = it.alpha * (p === 0 ? 1 : 0.42);
          ctx.lineWidth = it.w * (p === 0 ? 1 : 0.7);
          ctx.save();
          if (p) ctx.translate(0.7, 0.5);
          (it.sharp ? poly : smooth)(ctx, it.pts, it.closed); ctx.stroke();
          ctx.restore();
        }
      } else if (it.k === 'f') {
        ctx.globalAlpha = it.alpha; ctx.fillStyle = it.color;
        (it.sharp ? poly : smooth)(ctx, it.pts, true); ctx.fill();
      } else if (it.k === 'd') {
        ctx.globalAlpha = it.alpha; ctx.fillStyle = it.color;
        ctx.beginPath(); ctx.arc(it.x, it.y, it.r, 0, TAU); ctx.fill();
      } else if (it.k === 't') {
        ctx.globalAlpha = it.alpha; ctx.fillStyle = it.color;
        ctx.font = '700 ' + it.size + "px " + it.font;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(it.s, it.x, it.y);
      }
    }
    ctx.globalAlpha = 1;
  }

  function render(ctx, scene, t, motion) {
    applyTheme(scene.theme);
    var W = scene.W, H = scene.H;
    var pg = ctx.createLinearGradient(0, 0, 0, H);
    pg.addColorStop(0, PAPER_TOP); pg.addColorStop(1, PAPER_BOT);
    ctx.fillStyle = pg; ctx.fillRect(0, 0, W, H);

    function pass(list) {
      for (var i = 0; i < list.length; i++) {
        var u = list[i], b = u.bob, dy = 0, dx = 0;
        if (motion && b && b.a) { dy = Math.sin(t * b.f + b.ph) * b.a; dx = Math.cos(t * b.f * 0.7 + b.ph) * b.a * 0.45; }
        ctx.save(); ctx.translate(dx, dy); drawItems(ctx, u.items); ctx.restore();
      }
    }
    pass(scene.bg);
    pass(scene.thread);
    pass(scene.units);

    // a slow "read head" travelling the thread — the one bit of overt motion
    if (motion && scene.thread.length) {
      var tp = scene.thread[0].items[0].pts;
      var PASS = 170, RUNS = 5, PAUSE = 2600, CYCLE = RUNS * PASS + PAUSE;
      var c = t % CYCLE;
      var u2 = c < RUNS * PASS ? (c % PASS) / PASS * 1.34 - 0.17 : -1;
      if (u2 >= 0 && u2 <= 1) {
        var p = ptAt(tp, u2);
        var rg = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], 34);
        rg.addColorStop(0, scene.accent + '55'); rg.addColorStop(1, scene.accent + '00');
        ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(p[0], p[1], 34, 0, TAU); ctx.fill();
        ctx.globalAlpha = 0.9; ctx.fillStyle = scene.accent;
        ctx.beginPath(); ctx.arc(p[0], p[1], 3.4, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
      }
    }

    // readability scrim, left-weighted, in the paper colour
    var sc = ctx.createLinearGradient(0, 0, W, 0);
    sc.addColorStop(0, 'rgba(' + TH.scrim + ',.93)');
    sc.addColorStop(0.34, 'rgba(' + TH.scrim + ',.6)');
    sc.addColorStop(0.68, 'rgba(' + TH.scrim + ',.12)');
    sc.addColorStop(1, 'rgba(' + TH.scrim + ',0)');
    ctx.fillStyle = sc; ctx.fillRect(0, 0, W, H);
    if (scene.over && scene.over.length) pass(scene.over);
  }

  // ------------------------------------------------------------------ ticker
  var mounted = [], running = false, t = 0;
  function loop() {
    if (!running) return;
    t += 1;
    for (var i = 0; i < mounted.length; i++) {
      var m = mounted[i];
      if (!m.visible || !m.scene) continue;
      if (!m.opts.motion && m.painted) continue;
      render(m.ctx, m.scene, t, m.opts.motion);
      m.painted = true;
    }
    setTimeout(function () { requestAnimationFrame(loop); }, 42);
  }

  var io = null;
  function observer() {
    if (io) return io;
    io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var rec = mounted.filter(function (m) { return m.cv === e.target; })[0];
        if (rec) { rec.visible = e.isIntersecting; if (e.isIntersecting) rec.painted = false; }
      });
    }, { rootMargin: '160px' });
    return io;
  }

  function mount(cv, o) {
    if (!cv) return null;
    var opts = {
      style: o.style, page: o.page, seed: o.seed == null ? hash(o.style + o.page) : o.seed,
      motion: o.motion !== false, inkWeight: o.inkWeight || 1.45,
      washOpacity: o.washOpacity == null ? 0.28 : o.washOpacity, density: o.density || 1, maxDpr: o.maxDpr || 1.5,
      theme: o.theme === 'dark' ? 'dark' : 'light'
    };
    var rec = mounted.filter(function (m) { return m.cv === cv; })[0];
    if (!rec) { rec = { cv: cv, ctx: cv.getContext('2d'), visible: true, painted: false }; mounted.push(rec); observer().observe(cv); }
    rec.opts = opts;

    var build = function () {
      var W = cv.clientWidth, H = cv.clientHeight;
      if (!W || !H) return;
      var dpr = Math.min(opts.maxDpr, window.devicePixelRatio || 1);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      rec.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      rec.scene = compose(opts.style, opts.page, W, H, opts.seed, opts);
      rec.painted = false;
      render(rec.ctx, rec.scene, t, false);
    };
    rec.rebuild = build;
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(build); else build();
    build();
    if (!running) { running = true; requestAnimationFrame(loop); }
    return rec;
  }

  function unmount(cv) {
    mounted = mounted.filter(function (m) {
      if (m.cv !== cv) return true;
      if (io) io.unobserve(cv);
      return false;
    });
  }

  // ---- auto-mount: any <canvas data-backsplash="team"> on the page picks
  // itself up, survives React re-renders, and rebuilds on resize.
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function docTheme() { return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; }
  function retheme() {
    var th = docTheme();
    mounted.forEach(function (m) {
      if (!m.opts) return;
      m.opts.theme = th;
      m.painted = false;
      if (m.rebuild) m.rebuild();
    });
  }
  function scan() {
    mounted = mounted.filter(function (m) {
      if (document.contains(m.cv)) return true;
      if (io) io.unobserve(m.cv);
      return false;
    });
    var list = document.querySelectorAll('canvas[data-backsplash]');
    for (var i = 0; i < list.length; i++) {
      var cv = list[i];
      if (cv.__bsMounted) continue;
      cv.__bsMounted = true;
      mount(cv, {
        page: cv.getAttribute('data-backsplash'),
        style: cv.getAttribute('data-backsplash-style') || 'wash',
        theme: docTheme(),
        motion: !reduce
      });
    }
  }
  function auto() {
    scan();
    // the engine owns this: whoever flips data-theme on <html>, the banners
    // follow, regardless of script load order.
    new MutationObserver(retheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan);
    new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () { mounted.forEach(function (m) { if (m.rebuild) m.rebuild(); }); }, 180);
    });
  }
  auto();

  window.BS = { mount: mount, unmount: unmount, scan: scan, retheme: retheme, THEMES: THEMES, PAGES: PAGES, hash: hash };
})();
