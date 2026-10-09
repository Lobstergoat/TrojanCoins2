/* TrojanCoins — the horse.
   A signed-distance-field horse is voxelised once into a surface point cloud,
   then rotated and splatted into an ASCII cell grid every frame. */
(function (root) {
  'use strict';

  var P = { NONE: 255, BODY: 0, HEAD: 1, LEGS: 2, TAIL: 3, HATCH: 4, EYE: 5 };
  var RAMP = ' .,:;-=+*#%@';

  /* ---------- SDF ---------- */
  var bestD = 0, bestP = 0;
  function U(d, p) { if (d < bestD) { bestD = d; bestP = p; } }
  function sdBox(px, py, pz, cx, cy, cz, hx, hy, hz, r) {
    var qx = Math.abs(px - cx) - hx + r, qy = Math.abs(py - cy) - hy + r, qz = Math.abs(pz - cz) - hz + r;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
  }
  function sdCone(px, py, pz, ax, ay, az, bx, by, bz, r1, r2) {
    var pax = px - ax, pay = py - ay, paz = pz - az, bax = bx - ax, bay = by - ay, baz = bz - az;
    var h = (pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz);
    h = h < 0 ? 0 : h > 1 ? 1 : h;
    return Math.hypot(pax - bax * h, pay - bay * h, paz - baz * h) - (r1 + (r2 - r1) * h);
  }
  function sdBall(px, py, pz, cx, cy, cz, r) { return Math.hypot(px - cx, py - cy, pz - cz) - r; }

  var MANE = [];
  (function () {
    for (var i = 0; i < 7; i++) {
      var t = i / 6;
      var bx = 0.52 + (0.94 - 0.52) * t, by = 0.9 + (1.84 - 0.9) * t;
      MANE.push([bx, by, bx - 0.3, by + 0.14 + 0.05 * (i % 2)]);
    }
  })();

  function wheel(x, y, az, cx, cy, cz) {
    var wx = x - cx, wy = y - cy, wz = az - cz, rd = Math.hypot(wx, wy);
    var ring = Math.max(Math.abs(rd - 0.27) - 0.055, Math.abs(wz) - 0.07);
    var spokes = Math.max(Math.min(Math.abs(wx) - 0.028, Math.abs(wy) - 0.028), Math.max(rd - 0.3, Math.abs(wz) - 0.05));
    var hub = Math.max(rd - 0.09, Math.abs(wz) - 0.1);
    return Math.min(ring, spokes, hub);
  }

  function scene(x, y, z) {
    var az = z < 0 ? -z : z;
    bestD = 1e9; bestP = P.NONE;
    // body
    U(sdBox(x, y, az, -0.05, 0.2, 0, 1.1, 0.58, 0.48, 0.3), P.BODY);
    U(sdBall(x, y, az, 0.78, 0.36, 0, 0.62), P.BODY);
    U(sdBall(x, y, az, -0.82, 0.3, 0, 0.58), P.BODY);
    // upright neck, long head: a chess-knight silhouette
    U(sdCone(x, y, az, 0.72, 0.6, 0, 1.02, 1.55, 0, 0.38, 0.2), P.HEAD);
    U(sdBall(x, y, az, 0.88, 1.0, 0, 0.25), P.HEAD);
    U(sdCone(x, y, az, 1.04, 1.64, 0, 2.5, 1.22, 0, 0.27, 0.14), P.HEAD);
    U(sdBall(x, y, az, 1.4, 1.5, 0, 0.28), P.HEAD);
    U(sdBall(x, y, az, 2.5, 1.22, 0, 0.17), P.HEAD);
    U(sdCone(x, y, az, 1.0, 1.9, 0.14, 0.92, 2.28, 0.1, 0.085, 0.022), P.HEAD);
    for (var i = 0; i < MANE.length; i++) {
      var m = MANE[i];
      U(sdCone(x, y, az, m[0], m[1], 0, m[2], m[3], 0, 0.1, 0.02), P.HEAD);
    }
    // legs: stiff and wooden
    U(sdBox(x, y, az, 0.78, -0.82, 0.27, 0.13, 0.6, 0.13, 0.05), P.LEGS);
    U(sdBox(x, y, az, -0.8, -0.82, 0.27, 0.13, 0.6, 0.13, 0.05), P.LEGS);
    U(sdBox(x, y, az, 0.78, -1.42, 0.27, 0.2, 0.08, 0.2, 0.03), P.LEGS);
    U(sdBox(x, y, az, -0.8, -1.42, 0.27, 0.2, 0.08, 0.2, 0.03), P.LEGS);
    // tail
    U(sdCone(x, y, az, -1.1, 0.45, 0, -1.7, -0.2, 0, 0.1, 0.05), P.TAIL);
    U(sdBall(x, y, az, -1.72, -0.24, 0, 0.12), P.TAIL);
    // cart
    U(sdBox(x, y, az, 0, -1.58, 0, 1.6, 0.07, 0.78, 0.03), P.LEGS);
    U(sdBox(x, y, az, 1.0, -1.72, 0, 0.04, 0.04, 0.86, 0), P.LEGS);
    U(sdBox(x, y, az, -1.0, -1.72, 0, 0.04, 0.04, 0.86, 0), P.LEGS);
    U(wheel(x, y, az, 1.0, -1.72, 0.86), P.LEGS);
    U(wheel(x, y, az, -1.0, -1.72, 0.86), P.LEGS);
    return bestD;
  }

  /* ---------- voxelise surface ---------- */
  var cloud = null;
  function build() {
    if (cloud) return cloud;
    var X0 = -2.0, X1 = 2.7, Y0 = -2.15, Y1 = 2.6, Z0 = -1.0, Z1 = 1.0;
    var cs = 0.12, sub = 4, fs = cs / sub;
    var xs = [], ys = [], zs = [], ps = [];
    for (var cx = X0; cx < X1; cx += cs) {
      for (var cy = Y0; cy < Y1; cy += cs) {
        for (var cz = Z0; cz < Z1; cz += cs) {
          var d = scene(cx + cs / 2, cy + cs / 2, cz + cs / 2);
          if (Math.abs(d) > cs * 0.95) continue;
          for (var i = 0; i < sub; i++) for (var j = 0; j < sub; j++) for (var k = 0; k < sub; k++) {
            var x = cx + (i + 0.5) * fs, y = cy + (j + 0.5) * fs, z = cz + (k + 0.5) * fs;
            var dd = scene(x, y, z);
            if (Math.abs(dd) < fs * 0.55) {
              var part = bestP;
              xs.push(x); ys.push(y); zs.push(z); ps.push(part);
            }
          }
        }
      }
    }
    var n = xs.length;
    var c = {
      n: n, x: new Float32Array(n), y: new Float32Array(n), z: new Float32Array(n),
      nx: new Float32Array(n), ny: new Float32Array(n), nz: new Float32Array(n),
      part: new Uint8Array(n), tex: new Float32Array(n)
    };
    var e = 0.012;
    for (var q = 0; q < n; q++) {
      var px = xs[q] - 0.3, py = ys[q] - 0.02, pz = zs[q];
      var ox = xs[q], oy = ys[q], oz = zs[q];
      var gx = scene(ox + e, oy, oz) - scene(ox - e, oy, oz);
      var gy = scene(ox, oy + e, oz) - scene(ox, oy - e, oz);
      var gz = scene(ox, oy, oz + e) - scene(ox, oy, oz - e);
      var gl = Math.hypot(gx, gy, gz) || 1;
      var part = ps[q];
      var az = Math.abs(oz);
      // hatch on both flanks, an eye on the head
      if (part === P.BODY && az > 0.42 && Math.abs(ox) < 0.4 && Math.abs(oy - 0.02) < 0.27) part = P.HATCH;
      if (part === P.HEAD && Math.hypot(ox - 1.62, oy - 1.52, az - 0.22) < 0.08) part = P.EYE;
      c.x[q] = px; c.y[q] = py; c.z[q] = pz;
      c.nx[q] = gx / gl; c.ny[q] = gy / gl; c.nz[q] = gz / gl;
      c.part[q] = part;
      // plank lines (wood grain) — horizontal bands on the body, vertical on the door
      var t = 1;
      if (part === P.BODY || part === P.HEAD) { var f = ((oy * 5.2) % 1 + 1) % 1; if (f < 0.1) t = 0.8; }
      if (part === P.HATCH) { var f2 = (((ox + 0.42) * 6.2) % 1 + 1) % 1; if (f2 < 0.12) t = 0.65; }
      if (part === P.LEGS) { var f3 = (((ox + oz) * 9) % 1 + 1) % 1; if (f3 < 0.08) t = 0.8; }
      c.tex[q] = t;
    }
    cloud = c;
    return c;
  }

  /* ---------- rasterise ---------- */
  var LX = -0.42, LY = 0.62, LZ = 0.66;
  (function () { var l = Math.hypot(LX, LY, LZ); LX /= l; LY /= l; LZ /= l; })();

  function Raster(cols, rows) {
    this.cols = cols; this.rows = rows;
    this.z = new Float32Array(cols * rows);
    this.b = new Float32Array(cols * rows);
    this.part = new Uint8Array(cols * rows);
    this.glow = new Float32Array(cols * rows);
  }
  var CELL_ASPECT = 0.54; // character width / height

  Raster.prototype.draw = function (yaw, pitch, hatchOpen, spanUnits) {
    var c = build(), cols = this.cols, rows = this.rows;
    var zb = this.z, bb = this.b, pb = this.part;
    zb.fill(-1e9); bb.fill(0); pb.fill(P.NONE);
    var cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    var s = cols / spanUnits, sr = s * CELL_ASPECT;
    var ox = cols / 2, oy = rows / 2;
    for (var i = 0; i < c.n; i++) {
      var part = c.part[i];
      if (part === P.HATCH && hatchOpen) continue;
      var x = c.x[i], y = c.y[i], z = c.z[i];
      var x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
      var y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
      var col = (ox + x1 * s) | 0, row = (oy - y2 * sr) | 0;
      if (col < 0 || col >= cols || row < 0 || row >= rows) continue;
      var idx = row * cols + col;
      if (z2 <= zb[idx]) continue;
      var nx = c.nx[i], ny = c.ny[i], nz = c.nz[i];
      var nx1 = nx * cy + nz * sy, nz1 = -nx * sy + nz * cy;
      var ny2 = ny * cp - nz1 * sp, nz2 = ny * sp + nz1 * cp;
      var lam = nx1 * LX + ny2 * LY + nz2 * LZ;
      var b = 0.16 + 0.84 * (lam > 0 ? lam : 0);
      b *= 0.78 + 0.22 * Math.min(1, Math.max(0, (y + 1.6) / 3.4));
      if (nz2 < -0.1) b *= 0.45; // seen from inside the open hatch
      else { var rim = 1 - Math.abs(nz2); b += rim * rim * rim * 0.55; }
      b *= c.tex[i];
      b = b > 0 ? Math.min(1, Math.pow(b, 0.82) * 1.08 + 0.04) : 0;
      if (part === P.EYE) b = 0;
      zb[idx] = z2; bb[idx] = b; pb[idx] = part;
    }
  };

  /* ---------- canvas view ---------- */
  var COLORS = (function () {
    var stops = [[26, 20, 15], [86, 40, 20], [168, 78, 34], [217, 98, 43], [240, 150, 90], [239, 228, 207]];
    var out = [];
    for (var i = 0; i < 24; i++) {
      var t = i / 23 * (stops.length - 1), a = Math.floor(t), f = t - a, A = stops[a], B = stops[Math.min(a + 1, stops.length - 1)];
      out.push('rgb(' + [0, 1, 2].map(function (k) { return Math.round(A[k] + (B[k] - A[k]) * f); }).join(',') + ')');
    }
    return out;
  })();

  function View(canvas, opts) {
    opts = opts || {};
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.yaw = 0.9; this.pitch = 0.16; this.vel = 0.0075; this.target = 0.0075;
    this.open = false; this.hover = P.NONE; this.forced = P.NONE;
    this.drag = null; this.moved = 0; this.mouse = null;
    this.t0 = performance.now(); this.visible = true;
    this.reduced = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (this.reduced) this.target = 0.0015;
    this.onpart = opts.onpart || function () {};
    this.onclickpart = opts.onclickpart || function () {};
    this.embers = [];
    for (var i = 0; i < 26; i++) this.embers.push(this.ember(true));
    this.resize();
    this.bind();
    var self = this;
    this.loop = function (now) { self.frame(now); root.requestAnimationFrame(self.loop); };
    root.requestAnimationFrame(this.loop);
  }
  View.prototype.ember = function (init) {
    return { x: Math.random(), y: init ? Math.random() : 1.02, v: 0.0012 + Math.random() * 0.0035, p: Math.random() * 6, c: Math.random() < 0.2 ? '*' : (Math.random() < 0.5 ? '.' : ',') };
  };
  View.prototype.resize = function () {
    var w = this.cv.clientWidth || 600;
    var narrow = w < 520;
    this.cols = narrow ? 72 : 108;
    this.rows = narrow ? 44 : 56;
    this.span = narrow ? 5.6 : 5.15;
    var cw = w / this.cols, ch = cw / CELL_ASPECT;
    var h = Math.round(ch * this.rows), dpr = Math.min(root.devicePixelRatio || 1, 2);
    this.cv.style.height = h + 'px';
    this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.cw = cw; this.ch = ch; this.W = w; this.H = h;
    this.fs = Math.max(6, ch * 0.92);
    this.r = new Raster(this.cols, this.rows);
  };
  View.prototype.bind = function () {
    var self = this, cv = this.cv;
    function cell(e) {
      var rect = cv.getBoundingClientRect();
      return { col: Math.floor((e.clientX - rect.left) / self.cw), row: Math.floor((e.clientY - rect.top) / self.ch), x: e.clientX, y: e.clientY };
    }
    cv.addEventListener('pointerdown', function (e) {
      cv.setPointerCapture(e.pointerId);
      self.drag = { x: e.clientX, y: e.clientY, yaw: self.yaw, pitch: self.pitch };
      self.moved = 0;
      cv.classList.add('grabbing');
    });
    cv.addEventListener('pointermove', function (e) {
      var c = cell(e); self.mouse = c;
      if (self.drag) {
        var dx = e.clientX - self.drag.x, dy = e.clientY - self.drag.y;
        self.moved = Math.max(self.moved, Math.abs(dx) + Math.abs(dy));
        var ny = self.drag.yaw + dx * 0.012;
        self.vel = (ny - self.yaw) * 0.6; self.yaw = ny;
        self.pitch = Math.max(-0.2, Math.min(0.5, self.drag.pitch + dy * 0.004));
      }
      self.pick(c);
    });
    function up(e) {
      if (!self.drag) return;
      cv.classList.remove('grabbing');
      var wasClick = self.moved < 6;
      self.drag = null;
      if (wasClick) { var p = self.pickAt(cell(e)); if (p !== P.NONE) self.onclickpart(p); }
    }
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', function () { self.drag = null; cv.classList.remove('grabbing'); });
    cv.addEventListener('pointerleave', function () { self.mouse = null; self.setHover(P.NONE); });
    if (root.IntersectionObserver) {
      new IntersectionObserver(function (en) { self.visible = en[0].isIntersecting; }).observe(cv);
    }
    root.addEventListener('resize', function () { self.resize(); });
  };
  View.prototype.pickAt = function (c) {
    var r = this.r, best = P.NONE;
    for (var d = 0; d <= 1 && best === P.NONE; d++) {
      for (var j = -d; j <= d; j++) for (var i = -d; i <= d; i++) {
        var cc = c.col + i, rr = c.row + j;
        if (cc < 0 || rr < 0 || cc >= r.cols || rr >= r.rows) continue;
        var p = r.part[rr * r.cols + cc];
        if (p !== P.NONE) { best = p; break; }
      }
    }
    return best === P.EYE ? P.HEAD : best;
  };
  View.prototype.pick = function (c) { this.setHover(this.pickAt(c)); this.tip = c; };
  View.prototype.setHover = function (p) {
    if (p === this.hover) return;
    this.hover = p;
    this.onpart(p, this.tip);
  };
  View.prototype.frame = function (now) {
    if (!this.visible) return;
    var t = (now - this.t0) / 1000;
    if (!this.drag) {
      var tgt = this.hover !== P.NONE ? this.target * 0.25 : this.target;
      this.vel += (tgt - this.vel) * 0.04;
      this.yaw += this.vel;
    }
    var bob = Math.sin(t * 1.3) * 0.015;
    var r = this.r;
    r.draw(this.yaw, this.pitch + bob, this.open, this.span);
    var ctx = this.ctx, cols = r.cols, rows = r.rows, cw = this.cw, ch = this.ch;
    ctx.clearRect(0, 0, this.W, this.H);
    ctx.font = this.fs + 'px "JetBrains Mono", ui-monospace, Menlo, monospace';
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center';
    var hov = this.forced !== P.NONE ? this.forced : this.hover;
    var mx = this.mouse ? this.mouse.col : -99, my = this.mouse ? this.mouse.row : -99;
    var buckets = [];
    for (var i = 0; i < COLORS.length; i++) buckets.push([]);
    var sweep = (t * 0.35) % 1.6 - 0.3;
    for (var row = 0; row < rows; row++) {
      for (var col = 0; col < cols; col++) {
        var idx = row * cols + col, p = r.part[idx];
        if (p === P.NONE) continue;
        var b = r.b[idx];
        if (p === P.EYE) { continue; }
        // cursor flashlight and a slow shimmer sweep across the wood
        var dd = Math.hypot((col - mx), (row - my) * CELL_ASPECT * 2.0);
        if (dd < 9) b += (1 - dd / 9) * 0.35;
        var sw = col / cols - sweep - row / rows * 0.25;
        if (sw > 0 && sw < 0.05) b += (1 - Math.abs(sw - 0.025) / 0.025) * 0.28;
        if (p === hov) b = b * 0.6 + 0.4;
        if (p === P.HATCH) b = b * 0.85 + 0.12;
        b = b < 0 ? 0 : b > 1 ? 1 : b;
        var ci = Math.min(RAMP.length - 1, Math.round(b * (RAMP.length - 1)));
        if (ci === 0) continue;
        var level = Math.min(COLORS.length - 1, Math.round(Math.pow(b, 0.9) * (COLORS.length - 1)));
        var chr = RAMP.charAt(ci);
        if (p === P.HATCH && ((col + row) & 1) === 0 && b < 0.55) chr = '=';
        buckets[level].push(chr, col, row);
      }
    }
    for (var L = 0; L < buckets.length; L++) {
      var arr = buckets[L]; if (!arr.length) continue;
      ctx.fillStyle = COLORS[L];
      for (var k = 0; k < arr.length; k += 3) ctx.fillText(arr[k], (arr[k + 1] + 0.5) * cw, (arr[k + 2] + 0.82) * ch);
    }
    // embers
    ctx.fillStyle = 'rgba(217,98,43,.75)';
    for (var e = 0; e < this.embers.length; e++) {
      var m = this.embers[e];
      m.y -= m.v; m.x += Math.sin(t * 0.8 + m.p) * 0.0006;
      if (m.y < -0.02) this.embers[e] = this.ember(false);
      ctx.globalAlpha = Math.max(0, Math.min(1, m.y * 1.4)) * 0.8;
      ctx.fillText(m.c, m.x * this.W, m.y * this.H);
    }
    ctx.globalAlpha = 1;
  };

  root.TCHorse = { View: View, Raster: Raster, build: build, P: P, RAMP: RAMP };
})(typeof window !== 'undefined' ? window : globalThis);
