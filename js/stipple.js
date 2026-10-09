/* TrojanCoins — the stipple horse.
   The horse is rendered once from a fixed side view into a shading buffer,
   then redrawn as ring-dots whose density follows the light. */
(function (root) {
  'use strict';
  var cv, ctx, dots = [], W = 0, H = 0, dpr = 1, mouse = null, t0 = 0, built = false, visible = true;
  var reduced = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function hash(x, y) { var h = Math.imul(x * 374761393 + y * 668265263, 1274126177); h = (h ^ (h >>> 13)) >>> 0; return (Math.imul(h, 1103515245) >>> 8) / 16777216; }

  /* ---- the drawing: a hand-built silhouette, lit like a relief, sampled as dots ---- */
  var U = 5, BW = 620, BH = 540; // 5 buffer px per drawing unit (124 x 120 units)

  function smooth(c, pts) {
    var n = pts.length, m0 = [(pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2];
    c.moveTo(m0[0], m0[1]);
    for (var i = 0; i < n; i++) {
      var p = pts[i], q = pts[(i + 1) % n];
      c.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    }
    c.closePath();
  }
  function poly(c, pts) { c.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); }
  function layer() { var k = document.createElement('canvas'); k.width = BW; k.height = BH; var c = k.getContext('2d'); c.scale(U, U); c.translate(2, 8); return c; }

  function draw() {
    var lit = layer(), flat = layer(), cut = layer();
    function part(fn, v) { lit.fillStyle = 'rgba(255,255,255,' + v + ')'; lit.beginPath(); fn(lit); lit.fill(); }
    // far legs first (dimmer), then near legs
    part(function (c) { smooth(c, [[62, 58], [70, 58], [68, 70], [58, 76], [54, 83], [50, 80], [55, 72], [62, 66]]); }, .6);
    part(function (c) { poly(c, [[44, 58], [53, 58], [53, 76], [53, 92], [48, 94], [47, 76]]); }, .6);
    part(function (c) { poly(c, [[72, 58], [81, 58], [79, 74], [80, 92], [75, 94], [73, 76]]); }, 1);
    part(function (c) { smooth(c, [[33, 56], [45, 58], [47, 72], [41, 80], [43, 92], [38, 94], [35, 82], [39, 72]]); }, 1);
    // flowing tail
    part(function (c) { smooth(c, [[31, 42], [22, 46], [12, 57], [7, 72], [11, 83], [15, 72], [20, 60], [28, 51]]); }, .9);
    // body
    part(function (c) { smooth(c, [[30, 40], [40, 34], [60, 33], [74, 36], [84, 40], [86, 50], [80, 58], [66, 61], [48, 60], [34, 58], [27, 50]]); }, 1);
    // mane, neck, head, ear
    part(function (c) { smooth(c, [[97, 6], [88, 9], [79, 20], [72, 37], [77, 39], [83, 25], [91, 14]]); }, .75);
    part(function (c) { smooth(c, [[76, 40], [82, 26], [90, 12], [98, 8], [102, 14], [98, 26], [94, 40], [88, 52], [78, 52]]); }, 1);
    part(function (c) { smooth(c, [[92, 13], [98, 4], [106, 6], [114, 16], [121, 27], [120, 32], [114, 32], [106, 27], [100, 25], [96, 24]]); }, 1);
    part(function (c) { poly(c, [[98, 6], [99, -3], [104, 6]]); }, .9);
    return [lit.canvas, flat.canvas, cut.canvas].map(function (k) { return k.getContext('2d').getImageData(0, 0, BW, BH).data; });
  }

  function blur(src, r) { // box blur on alpha
    var n = BW * BH, tmp = new Float32Array(n), out = new Float32Array(n), x, y, acc, k;
    for (y = 0; y < BH; y++) { acc = 0; for (x = -r; x <= r; x++) acc += src[y * BW + Math.min(BW - 1, Math.max(0, x))];
      for (x = 0; x < BW; x++) { tmp[y * BW + x] = acc / (2 * r + 1); acc += src[y * BW + Math.min(BW - 1, x + r + 1)] - src[y * BW + Math.max(0, x - r)]; } }
    for (x = 0; x < BW; x++) { acc = 0; for (y = -r; y <= r; y++) acc += tmp[Math.min(BH - 1, Math.max(0, y)) * BW + x];
      for (y = 0; y < BH; y++) { out[y * BW + x] = acc / (2 * r + 1); acc += tmp[Math.min(BH - 1, y + r + 1) * BW + x] - tmp[Math.max(0, y - r) * BW + x]; } }
    return out;
  }

  function build() {
    var L = draw(), lit = L[0], flat = L[1], cut = L[2], n = BW * BH;
    var a = new Float32Array(n), v = new Float32Array(n);
    for (var i = 0; i < n; i++) { a[i] = lit[i * 4 + 3] / 255; v[i] = lit[i * 4] / 255; }
    var h = blur(a, 9), h2 = blur(a, 3);
    var lx = -0.5, ly = -0.72, lz = 0.55, ll = Math.hypot(lx, ly, lz); lx /= ll; ly /= ll; lz /= ll;
    var step = 4.5, list = [];
    for (var y = 3; y < BH - 3; y += step) {
      for (var x = 3; x < BW - 3; x += step) {
        var jx = x + (hash(x | 0, y | 0) - .5) * step * 0.55, jy = y + (hash((y | 0) + 91, (x | 0) + 7) - .5) * step * 0.55;
        var ix = Math.min(BW - 2, Math.max(1, jx | 0)), iy = Math.min(BH - 2, Math.max(1, jy | 0)), idx = iy * BW + ix;
        var b, fl = flat[idx * 4 + 3] / 255;
        if (fl > 0.35) b = 1;
        else {
          if (a[idx] < 0.5) continue;
          var gx = (h[idx + 1] - h[idx - 1]), gy = (h[idx + BW] - h[idx - BW]), gx2 = (h2[idx + 1] - h2[idx - 1]), gy2 = (h2[idx + BW] - h2[idx - BW]);
          var nx = -(gx * 14 + gx2 * 6), ny = -(gy * 14 + gy2 * 6), nz = 1, nl = Math.hypot(nx, ny, nz);
          var d = (nx * lx + ny * ly + nz * lz) / nl;
          b = (0.2 + 0.8 * Math.max(0, d)) * v[idx];
          b *= 1.12 - 0.35 * (iy / BH);
          b *= 1 - 0.95 * (cut[idx * 4 + 3] / 255);
        }
        b = Math.min(1, Math.max(0, b));
        if (hash(ix + 5, iy + 11) > Math.pow(b, 1.25) * 1.15 - 0.02) continue;
        list.push({ x: jx / BW, y: jy / BH, b: b, r: 0.55 + b * 0.7 });
      }
    }
    list.sort(function (p, q) { return p.x - q.x; });
    dots = list.map(function (d, i) { d.ox = 0; d.oy = 0; d.vx = 0; d.vy = 0; d.delay = d.x * 1.4 + hash(i, 3) * 0.5; return d; });
    built = true;
  }

  function resize() {
    var rect = cv.getBoundingClientRect();
    dpr = Math.min(root.devicePixelRatio || 1, 2);
    W = rect.width; H = rect.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function frame(now) {
    root.requestAnimationFrame(frame);
    if (!built || !visible) return;
    var t = (now - t0) / 1000;
    ctx.clearRect(0, 0, W, H);
    // keep the drawing's aspect (560 x 460) fitted inside the canvas, anchored right
    var ar = BW / BH, dw = Math.min(W * 0.95, H * 0.98 * ar), dh = dw / ar, ox = (W - dw) / 2 + W * 0.08, oy = (H - dh) / 2;
    var scale = dw / BW, rad = scale * 1.9;
    var mx = mouse ? mouse.x : -999, my = mouse ? mouse.y : -999, R = 90;
    ctx.lineWidth = 0.9;
    var cols = ['#5a2d17', '#7d3d1d', '#a84e22', '#c8672f'];
    var groups = [[], [], [], []];
    for (var i = 0; i < dots.length; i++) {
      var d = dots[i];
      var a = Math.min(1, Math.max(0, (t - 0.2 - d.delay) / 0.9));
      if (a <= 0) continue;
      var hx = ox + d.x * dw, hy = oy + d.y * dh;
      if (!reduced) {
        var px = hx + d.ox, py = hy + d.oy, dx = px - mx, dy = py - my, dist = Math.hypot(dx, dy);
        if (dist < R) { var f = (1 - dist / R); d.vx += (dx / (dist || 1)) * f * 2.2; d.vy += (dy / (dist || 1)) * f * 2.2; }
        d.vx += -d.ox * 0.06; d.vy += -d.oy * 0.06; d.vx *= 0.82; d.vy *= 0.82; d.ox += d.vx; d.oy += d.vy;
        hx += d.ox; hy += d.oy + Math.sin(t * 0.9 + d.x * 6) * 0.35;
      }
      d.px = hx; d.py = hy; d.a = a;
      groups[Math.min(3, (d.b * 4) | 0)].push(d);
    }
    for (var g = 0; g < 4; g++) {
      ctx.strokeStyle = cols[g]; ctx.fillStyle = cols[g];
      ctx.beginPath();
      var arr = groups[g];
      for (var k = 0; k < arr.length; k++) {
        var q = arr[k], rr = rad * q.r * (0.6 + 0.4 * q.a);
        if (q.eye) continue;
        ctx.moveTo(q.px + rr, q.py); ctx.arc(q.px, q.py, rr, 0, 6.2832);
      }
      ctx.globalAlpha = 0.5 + g * 0.1;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function init() {
    cv = document.getElementById('horse'); if (!cv) return;
    ctx = cv.getContext('2d');
    resize();
    root.addEventListener('resize', resize);
    root.addEventListener('pointermove', function (e) { var r = cv.getBoundingClientRect(); mouse = { x: e.clientX - r.left, y: e.clientY - r.top }; });
    document.addEventListener('pointerleave', function () { mouse = null; });
    if (root.IntersectionObserver) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(cv);
    t0 = performance.now();
    setTimeout(function () { build(); t0 = performance.now(); root.requestAnimationFrame(frame); }, 30);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window);
