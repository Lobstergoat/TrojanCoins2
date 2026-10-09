/* TrojanCoins — the rearing horse.
   A hand-built silhouette is lit like a relief (blurred height field → normals),
   then converted to a grid of dense ASCII characters. */
(function (root) {
  'use strict';
  var cv, ctx, cells = [], W = 0, H = 0, mouse = null, t0 = 0, built = false, visible = true, cw = 7, ch = 13;
  var reduced = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var RAMP = ' .,:;-=+*#%@';
  var U = 5, BW = 670, BH = 650, OX = 10, OY = 8; // 5 buffer px per drawing unit

  function hash(x, y) { var h = Math.imul(x * 374761393 + y * 668265263, 1274126177); h = (h ^ (h >>> 13)) >>> 0; return (Math.imul(h, 1103515245) >>> 8) / 16777216; }

  function smooth(c, pts) {
    var n = pts.length;
    c.moveTo((pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2);
    for (var i = 0; i < n; i++) { var p = pts[i], q = pts[(i + 1) % n]; c.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
    c.closePath();
  }
  function poly(c, pts) { c.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); }
  function layer() { var k = document.createElement('canvas'); k.width = BW; k.height = BH; var c = k.getContext('2d'); c.scale(U, U); c.translate(OX, OY); return c; }

  function draw() {
    var lit = layer(), cut = layer();
    function part(fn, v) { lit.fillStyle = 'rgba(255,255,255,' + v + ')'; lit.beginPath(); fn(lit); lit.fill(); }
    // far limbs and tail first (dimmer)
    part(function (c) { smooth(c, [[10, 96], [22, 98], [22, 110], [20, 119], [12, 119], [11, 108]]); }, .55);
    part(function (c) { smooth(c, [[80, 66], [96, 64], [112, 60], [118, 64], [116, 70], [104, 72], [88, 76]]); }, .6);
    part(function (c) { smooth(c, [[108, 62], [116, 66], [116, 80], [119, 87], [110, 89], [108, 78]]); }, .6);
    part(function (c) { smooth(c, [[14, 82], [4, 84], [-6, 92], [-12, 106], [-8, 118], [-2, 108], [4, 98], [12, 92]]); }, .85);
    // flowing mane (behind the neck)
    part(function (c) { smooth(c, [[90, 4], [78, 2], [64, 8], [52, 22], [44, 40], [40, 56], [50, 46], [58, 36], [66, 30], [72, 36], [76, 28], [84, 16]]); }, .8);
    // torso, hind leg, neck, head, near foreleg
    part(function (c) { smooth(c, [[10, 94], [14, 82], [26, 70], [44, 58], [60, 50], [74, 50], [80, 60], [72, 70], [58, 80], [44, 92], [28, 100], [14, 102]]); }, 1);
    part(function (c) { smooth(c, [[18, 90], [34, 92], [38, 106], [40, 119], [30, 119], [28, 108], [20, 102]]); }, 1);
    part(function (c) { smooth(c, [[64, 54], [62, 38], [66, 22], [76, 10], [88, 6], [94, 14], [90, 26], [88, 40], [84, 56], [74, 62]]); }, 1);
    part(function (c) { smooth(c, [[84, 8], [92, 2], [102, 3], [110, 10], [118, 22], [119, 32], [114, 36], [108, 33], [103, 28], [96, 28], [92, 32], [88, 26], [84, 18]]); }, 1);
    part(function (c) { poly(c, [[90, 4], [88, -5], [97, 3]]); }, .9);
    part(function (c) { smooth(c, [[72, 60], [80, 56], [96, 56], [104, 62], [104, 70], [98, 74], [94, 68], [86, 68], [78, 72]]); }, 1);
    part(function (c) { smooth(c, [[96, 62], [104, 66], [106, 80], [109, 89], [100, 91], [98, 80], [94, 72]]); }, 1);

    // strand cuts: flowing hair in the mane and tail, muscle seams on the torso
    cut.strokeStyle = '#fff'; cut.lineCap = 'round';
    for (var i = 0; i < 34; i++) {
      var t = i / 33, sx = 90 - t * 24, sy = 6 + t * 24, ex = 46 - t * 4, ey = 28 + t * 30;
      cut.lineWidth = .5 + (i % 3) * .2; cut.globalAlpha = .75;
      cut.beginPath(); cut.moveTo(sx, sy); cut.quadraticCurveTo((sx + ex) / 2 - 8, (sy + ey) / 2 - 10 + (i % 4) * 2, ex, ey); cut.stroke();
    }
    for (var j = 0; j < 8; j++) { cut.lineWidth = .5; cut.globalAlpha = .7; cut.beginPath(); cut.moveTo(6 - j, 82 + j * 2); cut.quadraticCurveTo(-6, 100, 2 + j, 114); cut.stroke(); }
    cut.globalAlpha = .35; cut.lineWidth = .6;
    for (var k = 0; k < 5; k++) { cut.beginPath(); cut.moveTo(24 + k * 9, 100 - k * 8); cut.quadraticCurveTo(40 + k * 8, 86 - k * 7, 60 + k * 5, 76 - k * 5); cut.stroke(); }
    return [lit.canvas, cut.canvas].map(function (k) { return k.getContext('2d').getImageData(0, 0, BW, BH).data; });
  }

  function blur(src, r) {
    var n = BW * BH, tmp = new Float32Array(n), out = new Float32Array(n), x, y, acc;
    for (y = 0; y < BH; y++) { acc = 0; for (x = -r; x <= r; x++) acc += src[y * BW + Math.min(BW - 1, Math.max(0, x))];
      for (x = 0; x < BW; x++) { tmp[y * BW + x] = acc / (2 * r + 1); acc += src[y * BW + Math.min(BW - 1, x + r + 1)] - src[y * BW + Math.max(0, x - r)]; } }
    for (x = 0; x < BW; x++) { acc = 0; for (y = -r; y <= r; y++) acc += tmp[Math.min(BH - 1, Math.max(0, y)) * BW + x];
      for (y = 0; y < BH; y++) { out[y * BW + x] = acc / (2 * r + 1); acc += tmp[Math.min(BH - 1, y + r + 1) * BW + x] - tmp[Math.max(0, y - r) * BW + x]; } }
    return out;
  }

  // brightness field (0..1) for the whole drawing, computed once
  var field = null, mask = null;
  function lightField() {
    var L = draw(), lit = L[0], cut = L[1], n = BW * BH;
    var a = new Float32Array(n), v = new Float32Array(n);
    for (var i = 0; i < n; i++) { a[i] = lit[i * 4 + 3] / 255; v[i] = 1; }
    var h = blur(a, 10), h2 = blur(a, 3);
    var lx = -0.55, ly = -0.7, lz = 0.5, ll = Math.hypot(lx, ly, lz); lx /= ll; ly /= ll; lz /= ll;
    field = new Float32Array(n); mask = new Uint8Array(n);
    for (var y = 1; y < BH - 1; y++) for (var x = 1; x < BW - 1; x++) {
      var idx = y * BW + x;
      if (a[idx] < 0.3) continue;
      mask[idx] = 1;
      var gx = h[idx + 1] - h[idx - 1], gy = h[idx + BW] - h[idx - BW], gx2 = h2[idx + 1] - h2[idx - 1], gy2 = h2[idx + BW] - h2[idx - BW];
      var nx = -(gx * 16 + gx2 * 7), ny = -(gy * 16 + gy2 * 7), nl = Math.hypot(nx, ny, 1);
      var d = (nx * lx + ny * ly + lz) / nl;
      var b = (0.3 + 0.75 * Math.max(0, d)) * Math.min(1, a[idx] * 1.1);
      b *= 1 - 0.85 * (cut[idx * 4 + 3] / 255);
      field[idx] = b;
    }
  }

  function build() {
    if (!field) lightField();
    // grid of characters fitted to the drawing
    var dh = H * 0.98, u = dh / BH, dw = BW * u;
    var ox = W * 0.5 - dw * 0.42, oy = H * 0.01;
    cw = Math.max(5.2, Math.min(8, W / 170)); ch = cw / 0.56;
    cells = [];
    var cols = Math.ceil(W / cw), rows = Math.ceil(H / ch);
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
      var px0 = (c * cw - ox) / u, py0 = (r * ch - oy) / u, px1 = ((c + 1) * cw - ox) / u, py1 = ((r + 1) * ch - oy) / u;
      if (px1 < 0 || py1 < 0 || px0 >= BW || py0 >= BH) continue;
      var sum = 0, cnt = 0, hit = 0;
      for (var sy = 0; sy < 3; sy++) for (var sx = 0; sx < 3; sx++) {
        var ix = Math.floor(px0 + (px1 - px0) * (sx + .5) / 3), iy = Math.floor(py0 + (py1 - py0) * (sy + .5) / 3);
        if (ix < 0 || iy < 0 || ix >= BW || iy >= BH) continue;
        var id = iy * BW + ix; cnt++;
        if (mask[id]) { hit++; sum += field[id]; }
      }
      if (hit < 2) continue;
      var b = sum / hit + (hash(c, r) - .5) * 0.22;
      b = Math.min(1, Math.max(0, b));
      var ci = Math.round(Math.pow(b, 0.85) * (RAMP.length - 1));
      if (ci < 2) continue;
      cells.push({ x: (c + .5) * cw, y: (r + .82) * ch, ch: RAMP.charAt(ci), l: Math.min(3, (b * 4) | 0), d: c / cols * 1.2 + hash(r, c) * 0.4, b: b });
    }
    built = true;
  }

  function resize() {
    var rect = cv.getBoundingClientRect(), dpr = Math.min(root.devicePixelRatio || 1, 2);
    W = rect.width; H = rect.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (field) build();
  }

  var COLS = ['#5a2d17', '#8a4421', '#c4602b', '#ee8a4a'];
  function frame(now) {
    root.requestAnimationFrame(frame);
    if (!built || !visible) return;
    var t = (now - t0) / 1000;
    ctx.clearRect(0, 0, W, H);
    ctx.font = (cw / 0.6) + 'px "JetBrains Mono", ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    var mx = mouse ? mouse.x : -999, my = mouse ? mouse.y : -999;
    var groups = [[], [], [], []];
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i], a = Math.min(1, Math.max(0, (t - 0.2 - c.d) / 0.8));
      if (a <= 0) continue;
      var l = c.l;
      if (!reduced) { var dd = Math.hypot(c.x - mx, (c.y - my) * 0.8); if (dd < 110) l = Math.min(3, l + (dd < 55 ? 2 : 1)); }
      c.a = a; groups[l].push(c);
    }
    for (var g = 0; g < 4; g++) {
      ctx.fillStyle = COLS[g];
      var arr = groups[g];
      for (var k = 0; k < arr.length; k++) { var q = arr[k]; ctx.globalAlpha = q.a; ctx.fillText(q.ch, q.x, q.y); }
    }
    ctx.globalAlpha = 1;
  }

  function init() {
    cv = document.getElementById('horse'); if (!cv) return;
    ctx = cv.getContext('2d');
    resize();
    root.addEventListener('resize', resize);
    root.addEventListener('pointermove', function (e) { var r = cv.getBoundingClientRect(); mouse = { x: e.clientX - r.left, y: e.clientY - r.top }; });
    if (root.IntersectionObserver) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(cv);
    setTimeout(function () { build(); t0 = performance.now(); root.requestAnimationFrame(frame); }, 30);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window);
