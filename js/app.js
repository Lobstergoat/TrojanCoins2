/* TrojanCoins — site behaviour: horse, navigation, board, characters. */
(function (root) {
  'use strict';
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return [].slice.call((c || document).querySelectorAll(s)); };
  var reduced = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var TC = root.TC = {};

  /* ---------- helpers ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { var s = seed || 1; return function () { s = Math.imul(s ^ (s >>> 15), 1 | s); s ^= s + Math.imul(s ^ (s >>> 7), 61 | s); return ((s ^ (s >>> 14)) >>> 0) / 4294967296; }; }
  function money(n) { return n >= 1e6 ? '$' + (n / 1e6).toFixed(n % 1e6 ? 2 : 0).replace(/\.?0+$/, '') + 'M' : n >= 1e3 ? '$' + (n / 1e3).toFixed(n % 1e3 ? 1 : 0).replace(/\.0$/, '') + 'K' : '$' + Math.round(n); }
  var GLYPHS = '#%@*+=-:.,;ABCDEFGHJKLMNPRSTUVXYZ0123456789';
  function rnd(a) { return a[(Math.random() * a.length) | 0]; }

  /* pixel-idol avatar, symmetrical, seeded */
  TC.avatar = function (seed, size) {
    var r = rng(hash(String(seed))), n = 7, cell = 100 / n, out = '';
    var pal = ['#d9622b', '#efe4cf', '#a84e22', '#f09660'];
    var main = pal[(r() * pal.length) | 0], alt = pal[(r() * pal.length) | 0];
    for (var y = 0; y < n; y++) for (var x = 0; x < 4; x++) {
      var v = r();
      if (v > 0.5) {
        var c = v > 0.82 ? alt : main;
        out += '<rect x="' + (x * cell) + '" y="' + (y * cell) + '" width="' + cell + '" height="' + cell + '" fill="' + c + '"/>';
        if (x < 3) out += '<rect x="' + ((n - 1 - x) * cell) + '" y="' + (y * cell) + '" width="' + cell + '" height="' + cell + '" fill="' + c + '"/>';
      }
    }
    return '<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" width="' + (size || 64) + '" height="' + (size || 64) + '" aria-hidden="true" shape-rendering="crispEdges"><rect width="100" height="100" fill="#15110d"/>' + out + '</svg>';
  };

  /* ---------- toasts ---------- */
  TC.toast = function (msg) {
    var t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
    $('#toasts').appendChild(t);
    requestAnimationFrame(function () { t.classList.add('in'); });
    setTimeout(function () { t.classList.remove('in'); setTimeout(function () { t.remove(); }, 400); }, 3200);
  };

  /* ---------- scroll to ---------- */
  function go(sel) {
    var t = $(sel); if (!t) return;
    var y = t.getBoundingClientRect().top + root.scrollY - (sel === '#gate' ? 0 : 56);
    root.scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
    if (history.replaceState) history.replaceState(null, '', sel);
  }
  TC.go = go;
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-go], a[href^="#"]');
    if (!a) return;
    var sel = a.getAttribute('data-go') || a.getAttribute('href');
    if (!sel || sel === '#' || sel.charAt(0) !== '#') return;
    e.preventDefault(); go(sel);
  });

  /* ---------- reveal on scroll ---------- */
  function observeReveals() {
    var items = $$('.rv');
    if (!('IntersectionObserver' in root) || reduced) { items.forEach(function (i) { i.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    items.forEach(function (i, n) { i.style.setProperty('--d', (n % 4) * 70 + 'ms'); io.observe(i); });
  }

  /* ---------- horse ---------- */
  var QUIPS = ['Nothing to see here.', 'Definitely just a horse.', 'Please do not look in the belly.', 'Wheels are for decoration.', 'I have never met a Greek.', 'Strong wood. Weak secrets.', 'Gift horses are never inspected.'];
  var PART = { 0: { n: 'Body', to: '#how', say: 'Three acts. All of them happen inside me.', tip: 'How it works' }, 1: { n: 'Head', to: '#forge', say: 'Names, tickers, art. I do the talking.', tip: 'Launch a coin' }, 2: { n: 'Legs', to: '#gates', say: 'These wheels have seen a siege or two.', tip: 'The board' }, 3: { n: 'Tail', to: '#faq', say: 'The fine print is back here.', tip: 'Fine print' }, 4: { n: 'Belly', to: '#reveals', say: 'Careful. Something is knocking.', tip: 'Reveals' } };
  var view, bubbleEl, bubbleTxt, tipEl, bubbleTimer, quipI = 0, headClicks = 0;

  function say(t, hold) {
    if (!bubbleTxt) return;
    bubbleEl.classList.remove('pop'); void bubbleEl.offsetWidth; bubbleEl.classList.add('pop');
    bubbleTxt.textContent = t;
    clearTimeout(bubbleTimer);
    if (!hold) bubbleTimer = setTimeout(idleQuip, 6500);
  }
  function idleQuip() { quipI = (quipI + 1) % QUIPS.length; say(QUIPS[quipI]); }

  function initHorse() {
    var cv = $('#horse'); if (!cv || !root.TCHorse) return;
    bubbleEl = $('#bubble'); bubbleTxt = $('#bubble-text'); tipEl = $('#tip');
    var wrap = cv.parentNode;
    view = new TCHorse.View(cv, {
      onpart: function (p) {
        var info = PART[p];
        cv.style.cursor = info ? 'pointer' : 'grab';
        $$('#parts button').forEach(function (b) { b.classList.toggle('on', info && +b.dataset.part === p); });
        if (info) { say(info.say, true); tipEl.textContent = info.n + ' → ' + info.tip; tipEl.classList.add('on'); }
        else { tipEl.classList.remove('on'); bubbleTimer = setTimeout(idleQuip, 2500); }
      },
      onclickpart: function (p) {
        if (p === 4) { openHatch(true); return; }
        var info = PART[p]; if (!info) return;
        if (p === 1) {
          headClicks++;
          if (headClicks >= 7) { headClicks = 0; say('NEIGH.', true); cv.classList.add('shake'); setTimeout(function () { cv.classList.remove('shake'); }, 600); return; }
        }
        go(info.to);
      }
    });
    TC.view = view;
    cv.addEventListener('pointermove', function (e) {
      var r = wrap.getBoundingClientRect();
      tipEl.style.transform = 'translate(' + (e.clientX - r.left + 14) + 'px,' + (e.clientY - r.top + 14) + 'px)';
    });
    // anatomy chips mirror the hover state
    $$('#parts button').forEach(function (b) {
      var p = +b.dataset.part;
      b.addEventListener('mouseenter', function () { view.forced = p; say(PART[p].say, true); });
      b.addEventListener('focus', function () { view.forced = p; });
      b.addEventListener('mouseleave', function () { view.forced = 255; bubbleTimer = setTimeout(idleQuip, 2000); });
      b.addEventListener('blur', function () { view.forced = 255; });
      b.addEventListener('click', function (e) { if (p === 4) { e.preventDefault(); e.stopPropagation(); openHatch(true); } });
    });
    bubbleTimer = setTimeout(idleQuip, 5200);
  }

  function openHatch(thenGo) {
    if (!view || view.open) return;
    view.open = true;
    say('...', true);
    var n = 0, iv = setInterval(function () { bubbleTxt.textContent = '$' + Array.apply(null, Array(5)).map(function () { return rnd(GLYPHS); }).join('') + ' is stepping out'; if (++n > 9) clearInterval(iv); }, 90);
    setTimeout(function () { if (thenGo) go('#reveals'); }, 900);
    setTimeout(function () { view.open = false; say('Nothing happened. Move along.'); }, 3400);
  }

  /* ---------- siege track (scroll nav) ---------- */
  var secs = [], trackEls = {};
  var ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI'];
  function initTrack() {
    secs = $$('main > section[data-label]');
    trackEls.rail = $('#rail'); trackEls.fill = $('#rail-fill'); trackEls.cart = $('#cart'); trackEls.ticks = $('#ticks'); trackEls.arch = $('#arch');
    trackEls.ticks.innerHTML = secs.map(function (s) {
      return '<button type="button" class="tick" data-id="' + s.id + '"><i></i><span><b>' + esc(s.dataset.num) + '</b> ' + esc(s.dataset.label) + '</span></button>';
    }).join('');
    trackEls.ticks.addEventListener('click', function (e) { var b = e.target.closest('.tick'); if (b) { e.stopPropagation(); go('#' + b.dataset.id); } });
    trackEls.rail.addEventListener('click', function (e) {
      if (e.target.closest('.tick')) return;
      var r = trackEls.rail.getBoundingClientRect();
      var f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      root.scrollTo({ top: f * (document.documentElement.scrollHeight - innerHeight), behavior: reduced ? 'auto' : 'smooth' });
    });
    layoutTicks(); onScroll();
    root.addEventListener('scroll', onScroll, { passive: true });
    root.addEventListener('resize', function () { layoutTicks(); onScroll(); });
    if (root.ResizeObserver) new ResizeObserver(function () { layoutTicks(); onScroll(); }).observe(document.body);
  }
  function maxScroll() { return Math.max(1, document.documentElement.scrollHeight - innerHeight); }
  function layoutTicks() {
    var m = maxScroll();
    $$('.tick', trackEls.ticks).forEach(function (t, i) {
      var y = secs[i].getBoundingClientRect().top + root.scrollY - 56;
      t.style.left = Math.min(0.97, Math.max(0.02, y / m)) * 100 + '%';
      if (i === 0) t.style.left = '2%';
    });
  }
  var ticking = false;
  function onScroll() {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      var f = Math.min(1, Math.max(0, root.scrollY / maxScroll()));
      trackEls.fill.style.width = f * 100 + '%';
      trackEls.cart.style.left = (2 + f * 94) + '%';
      trackEls.cart.style.setProperty('--rot', (root.scrollY * 0.35) + 'deg');
      trackEls.arch.classList.toggle('open', f > 0.985);
      var cur = 0, line = innerHeight * 0.4;
      secs.forEach(function (s, i) { if (s.getBoundingClientRect().top < line) cur = i; });
      $$('.tick', trackEls.ticks).forEach(function (t, i) { t.classList.toggle('on', i === cur); });
    });
  }

  /* ---------- command palette ---------- */
  var palItems = [
    { t: 'Home — the gate', k: 'home hero top', fn: function () { go('#gate'); } },
    { t: 'How it works', k: 'how act steps', fn: function () { go('#how'); } },
    { t: 'Launch a coin', k: 'launch forge create new coin', fn: function () { go('#forge'); setTimeout(function () { var n = $('#f-name'); n && n.focus({ preventScroll: true }); }, 700); } },
    { t: 'The board — waiting at the gates', k: 'board gates sealed list', fn: function () { go('#gates'); } },
    { t: 'Reveals — what came out', k: 'reveals opened hall belly', fn: function () { go('#reveals'); } },
    { t: 'Meet the crew', k: 'crew soldiers characters', fn: function () { go('#crew'); } },
    { t: 'Fine print', k: 'faq questions help', fn: function () { go('#faq'); } },
    { t: 'Connect / disconnect Phantom', k: 'wallet phantom connect', fn: function () { var w = root.TCWallet.get(); w.address ? root.TCWallet.disconnect() : root.TCWallet.connect(); } },
    { t: 'Open pump.fun', k: 'pump fun trade', fn: function () { root.open('https://pump.fun', '_blank', 'noopener'); } },
    { t: 'Open the belly', k: 'hatch secret', fn: function () { go('#gate'); setTimeout(function () { openHatch(false); }, 600); } }
  ];
  var pal, palQ, palList, palSel = 0, palShown = [], palPrev;
  function palRender() {
    var q = palQ.value.trim().toLowerCase();
    palShown = palItems.filter(function (i) { return !q || (i.t + ' ' + i.k).toLowerCase().indexOf(q) > -1; });
    palSel = Math.min(palSel, Math.max(0, palShown.length - 1));
    palList.innerHTML = palShown.length ? palShown.map(function (i, n) {
      return '<li role="option" data-i="' + n + '" aria-selected="' + (n === palSel) + '">' + esc(i.t) + '</li>';
    }).join('') : '<li class="none">Nothing matches that.</li>';
  }
  function palOpen() { palPrev = document.activeElement; pal.hidden = false; palQ.value = ''; palSel = 0; palRender(); palQ.focus(); document.body.classList.add('noscroll'); }
  function palClose() { pal.hidden = true; document.body.classList.remove('noscroll'); palPrev && palPrev.focus && palPrev.focus(); }
  function palRun(n) { var it = palShown[n]; if (!it) return; palClose(); setTimeout(it.fn, 60); }
  function initPalette() {
    pal = $('#pal'); palQ = $('#pal-q'); palList = $('#pal-list');
    $('#jump').addEventListener('click', palOpen);
    pal.addEventListener('mousedown', function (e) { if (e.target === pal) palClose(); });
    palQ.addEventListener('input', function () { palSel = 0; palRender(); });
    palList.addEventListener('click', function (e) { var li = e.target.closest('li[data-i]'); if (li) palRun(+li.dataset.i); });
    palList.addEventListener('mousemove', function (e) { var li = e.target.closest('li[data-i]'); if (li && +li.dataset.i !== palSel) { palSel = +li.dataset.i; palRender(); } });
    document.addEventListener('keydown', function (e) {
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '');
      if (pal.hidden) {
        if ((e.key === '/' && !typing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) { e.preventDefault(); palOpen(); }
        return;
      }
      if (e.key === 'Escape') { e.preventDefault(); palClose(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); palSel = (palSel + 1) % Math.max(1, palShown.length); palRender(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); palSel = (palSel - 1 + palShown.length) % Math.max(1, palShown.length); palRender(); }
      else if (e.key === 'Enter') { e.preventDefault(); palRun(palSel); }
    });
  }

  /* ---------- act visualisations ---------- */
  function pad(s, n) { s = String(s); return s + new Array(Math.max(0, n - s.length + 1)).join(' '); }
  var VIZ = {
    type: function (el) {
      var names = [['Sir Barksalot', 'BARK'], ['Moon Toast', 'TOAST'], ['Gigachad Duck', 'QUACK'], ['Wizard Cat', 'MEOWZ']];
      var i = 0, c = 0, W = 26;
      function draw(nm, sy) {
        var cur = '▌';
        el.textContent =
          '┌─ DISGUISE ' + new Array(W - 10).join('─') + '┐\n' +
          '│ ' + pad('name    ' + nm + (c < nm.length + 2 ? cur : ''), W) + '│\n' +
          '│ ' + pad('ticker  $' + sy, W) + '│\n' +
          '│ ' + pad('image   [▒▒▒▒▒▒]', W) + '│\n' +
          '└' + new Array(W + 2).join('─') + '┘';
      }
      return function () {
        var pair = names[i], full = pair[0];
        var n = Math.min(c, full.length), s = Math.max(0, c - full.length - 2);
        draw(full.slice(0, n), pair[1].slice(0, s));
        if (++c > full.length + pair[1].length + 8) { c = 0; i = (i + 1) % names.length; }
      };
    },
    bar: function (el) {
      var p = 0, W = 24, hold = 0;
      return function () {
        if (hold > 0) hold--; else { p += 1.6; if (p >= 100) { p = 100; hold = 14; } }
        if (hold === 0 && p === 100 && !el._reset) el._reset = true;
        var open = p >= 100, fill = Math.round(W * p / 100);
        el.textContent =
          'gate  ' + (open ? '[▓▓ OPEN ▓▓]' : '[ sealed ]') + '\n\n' +
          '[' + new Array(fill + 1).join('█') + new Array(W - fill + 1).join('░') + '] ' + Math.round(p) + '%\n' +
          money(69000 * p / 100) + ' / $69K';
        if (open && hold === 1) { p = 0; el._reset = false; }
      };
    },
    scramble: function (el) {
      var list = [['BARK', 'Sir Barksalot'], ['TOAST', 'Moon Toast'], ['QUACK', 'Gigachad Duck']], to = ['FROGE', 'MOCHI', 'NYANO', 'PEPITO', 'BONKO'];
      var phase = 0, k = 0, i = 0, tgt = to[0];
      return function () {
        var from = list[i % list.length], settled = Math.min(5, Math.max(0, Math.floor((phase - 14) / 3)));
        var right = '';
        for (var n = 0; n < 5; n++) right += n < settled ? tgt[n] : (phase < 6 ? '?' : rnd(GLYPHS));
        el.textContent = 'before  $' + pad(from[0], 6) + '\n' + '   ↓\n' + 'after   $' + right + '\n\n' + (settled >= 5 ? 'a new meme steps out.' : 'the door is opening…');
        phase++;
        if (phase > 40) { phase = 0; i++; tgt = to[i % to.length]; }
      };
    }
  };
  function initViz() {
    $$('.viz').forEach(function (el) {
      var tick = VIZ[el.dataset.viz](el), live = false, iv;
      tick();
      if (reduced) return;
      var io = new IntersectionObserver(function (en) {
        live = en[0].isIntersecting;
        clearInterval(iv); if (live) iv = setInterval(tick, 110);
      }, { threshold: 0.2 });
      io.observe(el);
    });
  }

  /* ---------- sealed-face scramble ---------- */
  var sealIv;
  TC.sealScramble = function () {
    clearInterval(sealIv);
    var pre = $('#seal-pre'), nm = $('#seal-name'), sy = $('#seal-sym'), ds = $('#seal-desc');
    function frame() {
      if ($('#coin').dataset.face !== 'back') { clearInterval(sealIv); return; }
      var rows = [];
      for (var y = 0; y < 9; y++) { var s = ''; for (var x = 0; x < 24; x++) s += Math.random() < 0.55 ? rnd('#%@*+=-:.?') : ' '; rows.push(s); }
      pre.textContent = rows.join('\n');
      nm.textContent = Array.apply(null, Array(7)).map(function () { return rnd(GLYPHS); }).join('');
      sy.textContent = '$' + Array.apply(null, Array(4)).map(function () { return rnd(GLYPHS); }).join('');
      ds.textContent = Array.apply(null, Array(38)).map(function () { return Math.random() < 0.16 ? ' ' : rnd(GLYPHS); }).join('');
    }
    frame(); if (!reduced) sealIv = setInterval(frame, 90);
  };

  /* ---------- board + reveals ---------- */
  var coins = [], sortBy = 'near', query = '';
  function coinLink(c) { return c.mint ? root.TC_CONFIG.pump.coinUrl + c.mint : 'https://pump.fun'; }
  function cardSealed(c) {
    var pct = Math.min(100, (c.marketCap / c.revealCap) * 100), near = pct >= 85;
    return '<article class="cc' + (near ? ' near' : '') + '">' +
      '<div class="cc-art">' + TC.avatar(c.name + c.symbol, 72) + '<i class="seal" aria-hidden="true">▣</i></div>' +
      '<div class="cc-body"><div class="cc-nm"><b>' + esc(c.name) + '</b><span>$' + esc(c.symbol) + '</span></div>' +
      '<p>' + esc(c.description) + '</p>' +
      '<div class="bar"><i style="--w:' + pct.toFixed(1) + '%"></i></div>' +
      '<div class="cc-nums"><span>' + money(c.marketCap) + ' <small>now</small></span><span>' + (near ? '<em>almost open</em> · ' : '') + 'opens ' + money(c.revealCap) + '</span></div></div>' +
      '<a class="cc-go" href="' + esc(coinLink(c)) + '" target="_blank" rel="noopener" aria-label="Trade ' + esc(c.name) + ' on pump.fun">Trade ↗</a></article>';
  }
  function renderBoard() {
    var q = query.toLowerCase();
    var list = coins.filter(function (c) { return c.status !== 'opened' && (!q || (c.name + ' ' + c.symbol).toLowerCase().indexOf(q) > -1); });
    list.sort(function (a, b) { return sortBy === 'new' ? new Date(b.created) - new Date(a.created) : (b.marketCap / b.revealCap) - (a.marketCap / a.revealCap); });
    $('#board').innerHTML = list.length ? list.map(cardSealed).join('') :
      '<div class="empty"><pre aria-hidden="true">  .-----.\n  | ... |\n  \'-----\'</pre><p>' + (q ? 'No sealed coin matches that.' : 'The gates are quiet. Be the first to wheel one in.') + '</p><a class="btn btn-ghost" href="#forge">Launch a coin</a></div>';
    $$('#board .bar i').forEach(function (i) { requestAnimationFrame(function () { i.classList.add('go'); }); });
  }
  function renderHall() {
    var list = coins.filter(function (c) { return c.status === 'opened' && c.revealed; });
    $('#hall').innerHTML = list.length ? list.map(function (c) {
      var r = c.revealed;
      return '<button type="button" class="flip" aria-pressed="false" aria-label="Turn ' + esc(c.name) + ' card">' +
        '<span class="flip-in">' +
        '<span class="side a"><span class="tag">Disguise</span><span class="ph">' + TC.avatar(c.name + c.symbol, 96) + '</span><b>' + esc(c.name) + '</b><em>$' + esc(c.symbol) + '</em><small>opened at ' + money(c.revealCap) + '</small></span>' +
        '<span class="side b"><span class="tag hot">Revealed</span><span class="ph">' + TC.avatar(r.name + r.symbol, 96) + '</span><b>' + esc(r.name) + '</b><em>$' + esc(r.symbol) + '</em><small>' + esc(r.description) + '</small></span>' +
        '</span></button>';
    }).join('') : '<div class="empty"><pre aria-hidden="true">  .-----.\n  |  ?  |\n  \'-----\'</pre><p>No belly has opened yet. The first reveal will appear here.</p></div>';
  }
  function stats() {
    var s = coins.filter(function (c) { return c.status !== 'opened'; }).length, o = coins.length - s;
    var map = { sealed: s, opened: o, total: coins.length };
    $$('[data-stat]').forEach(function (d) {
      var to = map[d.dataset.stat], n = 0; if (reduced || to === 0) { d.textContent = to; return; }
      var iv = setInterval(function () { n = Math.min(to, n + Math.max(1, Math.ceil(to / 14))); d.textContent = n; if (n >= to) clearInterval(iv); }, 45);
    });
  }
  function initBoard() {
    root.TC_HOOKS.listCoins().then(function (d) { coins = d || []; }).catch(function () { coins = []; }).then(function () {
      renderBoard(); renderHall(); stats(); layoutTicks();
    });
    $('#board-q').addEventListener('input', function (e) { query = e.target.value.trim(); renderBoard(); });
    $$('[data-sort]').forEach(function (b) { b.addEventListener('click', function () {
      sortBy = b.dataset.sort; $$('[data-sort]').forEach(function (o) { o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); }); renderBoard();
    }); });
    $('#hall').addEventListener('click', function (e) {
      var f = e.target.closest('.flip'); if (!f) return;
      var on = f.getAttribute('aria-pressed') !== 'true'; f.setAttribute('aria-pressed', on);
    });
  }

  /* ---------- crew ---------- */
  function soldier(o, frame) {
    var crest = o.crest[frame], eyes = frame ? '-  -' : '.  .';
    var L = [
      '   ' + crest,
      '   .------.   ',
      '   | ' + eyes + ' |   ',
      '   |  ' + o.mouth + '  |   ',
      '   \'-.__.-\'   ',
      '  .-|####|-.  ',
      ' / |######| \\ ',
      ' | |######| | ',
      ' o  |_||_|  o ',
      '    |_||_|    '
    ].map(function (s) { return pad(s, 15); });
    var acc = o.acc[frame];
    return L.map(function (l, n) { return l + (acc[n] || ''); }).join('\n');
  }
  var CREW = [
    { name: 'Epeius', role: 'The builder', job: 'Carves the disguise', crest: ['^^^^^^^   ', '  ^^^^^^^ '], mouth: '<>',
      acc: [['', '', '', '  _', ' |_|=', '  ||', '  ||', '', '', ''], ['', '  _', ' |_|=', '  ||', '  ||', '', '', '', '', '']],
      say: ['Planks are cheap. Convincing is expensive.', 'Name, ticker, image. I carve all three.', 'It has to look like a gift.'] },
    { name: 'Sinon', role: 'The storyteller', job: 'Keeps the cover story', crest: ['~~~~~~~   ', '  ~~~~~~~ '], mouth: '~~',
      acc: [['', '', '', '', '  ||', '  ||', '', '', '', ''], ['', '', '', '', ' ||', ' ||', '', '', '', '']],
      say: ['It is a horse. It is a gift. Nothing more.', 'I have never lied. I simply edit.', 'Trust me. Everyone does.'] },
    { name: 'Odysseus', role: 'The watcher', job: 'Eyes on the market cap', crest: ['=======   ', '  ======= '], mouth: '==',
      acc: [['', '', '', '', '', ' _|', '/ |', '', '', ''], ['', '', '', '', '', '', ' _|', '/ |', '', '']],
      say: ['Patience. The number only has to move once.', 'I do not guess the moment. I wait for it.', 'Almost. Not yet.'] },
    { name: 'Neoptolemus', role: 'The opener', job: 'Drops the hatch', crest: ['vvvvvvv   ', '  vvvvvvv '], mouth: '[]',
      acc: [['', '  /\\', '  ||', '  ||', '  ||', '  ||', '  ||', '  ||', '', ''], ['', '', '  /\\', '  ||', '  ||', '  ||', '  ||', '  ||', '  ||', '']],
      say: ['On the signal. Not a heartbeat before.', 'Hatch is oiled. Spear is sharp.', 'Do you hear that? That is the gate.'] }
  ];
  function initCrew() {
    var grid = $('#crew-grid');
    grid.innerHTML = CREW.map(function (c, i) {
      return '<button type="button" class="soldier rv" data-i="' + i + '">' +
        '<span class="speech" aria-live="polite">' + esc(c.say[0]) + '</span>' +
        '<pre aria-hidden="true">' + esc(soldier(c, 0)) + '</pre>' +
        '<span class="who"><b>' + c.name + '</b><em>' + c.role + '</em></span><span class="job">' + c.job + '</span></button>';
    }).join('');
    $$('.soldier', grid).forEach(function (b) {
      var c = CREW[+b.dataset.i], pre = $('pre', b), sp = $('.speech', b), f = 0, iv, line = 0;
      function start() { if (reduced || iv) return; iv = setInterval(function () { f ^= 1; pre.textContent = soldier(c, f); }, 360); }
      function stop() { clearInterval(iv); iv = null; f = 0; pre.textContent = soldier(c, 0); }
      b.addEventListener('mouseenter', start); b.addEventListener('mouseleave', stop);
      b.addEventListener('focus', start); b.addEventListener('blur', stop);
      b.addEventListener('click', function () {
        line = (line + 1) % c.say.length; sp.textContent = c.say[line];
        b.classList.remove('talk'); void b.offsetWidth; b.classList.add('talk');
      });
    });
  }

  /* ---------- boot ---------- */
  function boot() {
    document.body.classList.add('ready');
    var go1 = function () { initHorse(); };
    if (document.fonts && document.fonts.load) {
      Promise.race([document.fonts.load('12px "JetBrains Mono"'), new Promise(function (r) { setTimeout(r, 1500); })]).then(go1, go1);
    } else go1();
    initCrew(); observeReveals(); initTrack(); initPalette(); initViz(); initBoard();
    if (location.hash && $(location.hash)) setTimeout(function () { go(location.hash); }, 400);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
