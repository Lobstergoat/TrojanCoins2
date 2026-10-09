/* TrojanCoins — the rearing horse.
   data/horse.json is an ASCII conversion of img/horse.png (see tools/make-horse-ascii.py).
   It is painted in orange on a canvas behind the hero, fades in, and glows near the cursor. */
(function (root) {
  'use strict';
  var RAMP = ' .,:;-=+*#%@';
  var COLS = ['#6e3719', '#a8532a', '#e2753a', '#ffa566'];
  var cv, ctx, art = null, W = 0, H = 0, cw = 7, ch = 12.5, ox = 0, oy = 0, mouse = null, t0 = 0, visible = true;
  var reduced = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cells = [];

  function hash(x, y) { var h = Math.imul(x * 374761393 + y * 668265263, 1274126177); h = (h ^ (h >>> 13)) >>> 0; return (Math.imul(h, 1103515245) >>> 8) / 16777216; }

  function layout() {
    if (!art) return;
    // fit the art to the hero height, anchored right, never wider than the viewport
    ch = (H * 0.97) / art.rows; cw = ch * 0.56;
    if (cw * art.cols > W * 1.02) { cw = W * 1.02 / art.cols; ch = cw / 0.56; }
    ox = W - cw * art.cols + W * 0.015; oy = (H - ch * art.rows) / 2;
    cells = [];
    for (var r = 0; r < art.rows; r++) {
      var line = art.lines[r] || '';
      for (var c = 0; c < line.length; c++) {
        var idx = RAMP.indexOf(line.charAt(c));
        if (idx < 1) continue;
        cells.push({ x: ox + (c + .5) * cw, y: oy + (r + .82) * ch, ch: line.charAt(c), l: idx < 4 ? 0 : idx < 7 ? 1 : idx < 10 ? 2 : 3, d: (art.cols - c) / art.cols * 0.9 + hash(c, r) * 0.5 });
      }
    }
  }

  function resize() {
    var rect = cv.getBoundingClientRect(), dpr = Math.min(root.devicePixelRatio || 1, 2);
    W = rect.width; H = rect.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    layout();
  }

  function frame(now) {
    root.requestAnimationFrame(frame);
    if (!art || !visible) return;
    var t = (now - t0) / 1000;
    ctx.clearRect(0, 0, W, H);
    ctx.font = (cw / 0.6) + 'px "JetBrains Mono", ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    var mx = mouse ? mouse.x : -999, my = mouse ? mouse.y : -999, groups = [[], [], [], []];
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i], a = reduced ? 1 : Math.min(1, Math.max(0, (t - 0.15 - c.d) / 0.7));
      if (a <= 0) continue;
      var l = c.l;
      if (!reduced) { var dd = Math.hypot(c.x - mx, (c.y - my) * 0.8); if (dd < 120) l = Math.min(3, l + (dd < 60 ? 2 : 1)); }
      c.a = a; groups[l].push(c);
    }
    for (var g = 0; g < 4; g++) {
      ctx.fillStyle = COLS[g];
      for (var k = 0; k < groups[g].length; k++) { var q = groups[g][k]; ctx.globalAlpha = q.a; ctx.fillText(q.ch, q.x, q.y); }
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
    fetch('data/horse.json?v=20261009', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) {
      art = d; layout(); t0 = performance.now(); root.requestAnimationFrame(frame);
    }).catch(function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window);
