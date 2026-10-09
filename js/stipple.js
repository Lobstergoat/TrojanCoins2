/* TrojanCoins — the stipple horse.
   The horse is rendered once from a fixed side view into a shading buffer,
   then redrawn as ring-dots whose density follows the light. */
(function (root) {
  'use strict';
  var cv, ctx, dots = [], W = 0, H = 0, dpr = 1, mouse = null, t0 = 0, built = false, visible = true;
  var reduced = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function hash(x, y) { var h = Math.imul(x * 374761393 + y * 668265263, 1274126177); h = (h ^ (h >>> 13)) >>> 0; return (Math.imul(h, 1103515245) >>> 8) / 16777216; }

  /* ---- the drawing: a hand-built silhouette, lit like a relief, sampled as dots ---- */
  var U = 5, BW = 620, BH = 600; // 5 buffer px per drawing unit (124 x 120 units)

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
    // legs (far pair first, dimmer)
    part(function (c) { poly(c, [[55, 58], [66, 58], [65, 78], [67, 83], [53, 83], [55, 78]]); }, .62);
    part(function (c) { poly(c, [[36, 58], [47, 58], [46, 78], [48, 83], [34, 83], [36, 78]]); }, .62);
    part(function (c) { poly(c, [[64, 58], [75, 58], [74, 78], [76, 83], [62, 83], [64, 78]]); }, 1);
    part(function (c) { poly(c, [[23, 58], [34, 58], [33, 78], [35, 83], [21, 83], [23, 78]]); }, 1);
    // tail
    part(function (c) { smooth(c, [[20, 38], [12, 42], [7, 56], [9, 67], [14, 65], [14, 55], [21, 47]]); }, .9);
    // body
    part(function (c) { smooth(c, [[22, 36], [30, 30], [50, 28], [68, 30], [78, 34], [82, 44], [80, 54], [72, 60], [50, 62], [30, 60], [22, 54], [18, 44]]); }, 1);
    // mane
    for (var i = 0; i < 6; i++) {
      var t = i / 5, bx = 82 - t * 12, by = 9 + t * 25;
      part(function (c) { poly(c, [[bx + 3, by - 3], [bx - 9, by - 5], [bx - 1, by + 5]]); }, .85);
    }
    // neck, head, ears
    part(function (c) { smooth(c, [[68, 36], [74, 20], [82, 8], [90, 5], [95, 10], [92, 24], [88, 38], [82, 50], [70, 50]]); }, 1);
    part(function (c) { poly(c, [[96, 4], [99, -5], [103, 5]]); }, .6);
    part(function (c) { smooth(c, [[84, 12], [90, 3], [99, 4], [108, 12], [117, 22], [119, 29], [113, 32], [104, 29], [97, 27], [92, 26], [88, 22]]); }, 1);
    part(function (c) { poly(c, [[90, 5], [92, -5], [97, 4]]); }, 1);
    // cart
    part(function (c) { poly(c, [[3, 83], [99, 83], [101, 89], [1, 89]]); }, .9);

    // flat details: wheels, spokes, door frame
    flat.strokeStyle = '#fff'; flat.fillStyle = '#fff';
    [[22, 97], [78, 97]].forEach(function (w) {
      flat.lineWidth = 2.4; flat.beginPath(); flat.arc(w[0], w[1], 8, 0, 6.2832); flat.stroke();
      flat.lineWidth = 1.1;
      for (var k = 0; k < 4; k++) { var a = k * Math.PI / 4; flat.beginPath(); flat.moveTo(w[0] + Math.cos(a) * 7, w[1] + Math.sin(a) * 7); flat.lineTo(w[0] - Math.cos(a) * 7, w[1] - Math.sin(a) * 7); flat.stroke(); }
      flat.beginPath(); flat.arc(w[0], w[1], 2, 0, 6.2832); flat.fill();
    });
    flat.lineWidth = 1.4; flat.strokeRect(40, 40, 18, 17);
    flat.beginPath(); flat.arc(55, 48.5, 1.3, 0, 6.2832); flat.fill();

    // cuts: wooden plank seams, a shaded door
    cut.strokeStyle = '#fff'; cut.lineWidth = .8;
    for (var y = 34; y < 62; y += 5.5) { cut.beginPath(); cut.moveTo(18, y); cut.lineTo(83, y); cut.stroke(); }
    cut.lineWidth = .7; for (var y2 = 64; y2 < 78; y2 += 5) { cut.beginPath(); cut.moveTo(20, y2); cut.lineTo(78, y2); cut.stroke(); }
    cut.globalAlpha = .4; cut.fillStyle = '#fff'; cut.fillRect(40, 40, 18, 17);
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
    var ar = BW / BH, dw = Math.min(W * 0.92, H * 0.78 * ar), dh = dw / ar, ox = W - dw - W * 0.07, oy = (H - dh) / 2 - H * 0.02;
    var scale = dw / BW, rad = scale * 1.75;
    var mx = mouse ? mouse.x : -999, my = mouse ? mouse.y : -999, R = 90;
    ctx.lineWidth = 0.9;
    var cols = ['#7a3a1c', '#a84e22', '#d9622b', '#f08a4b'];
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
      ctx.globalAlpha = g === 3 ? 1 : 0.55 + g * 0.15;
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
