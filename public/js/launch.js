/* TrojanCoins — launch form, live preview and the pump.fun creation flow. */
(function (root) {
  'use strict';
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var cfg = root.TC_CONFIG, el = {}, image = null, imageURL = null, busy = false;
  var revMode = 'random', revImage = null, revImageURL = null;

  function fmtUSD(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function short(n) { return n >= 1e6 ? '$' + (n / 1e6).toFixed(n % 1e6 ? 1 : 0) + 'M' : '$' + Math.round(n / 1000) + 'K'; }
  // slider (0–1000) → market cap on a log scale between min and max, rounded to 2 significant figures
  function sliderToCap(v) {
    var lo = Math.log10(cfg.limits.minCap), hi = Math.log10(cfg.limits.maxCap);
    var raw = Math.pow(10, lo + (v / 1000) * (hi - lo));
    var mag = Math.pow(10, Math.floor(Math.log10(raw)) - 1);
    return Math.round(raw / mag) * mag;
  }
  function capToSlider(c) {
    var lo = Math.log10(cfg.limits.minCap), hi = Math.log10(cfg.limits.maxCap);
    return Math.round((Math.log10(c) - lo) / (hi - lo) * 1000);
  }

  var cap = 69000;
  function setCap(c, fromSlider) {
    cap = c;
    if (!fromSlider) el.cap.value = capToSlider(c);
    el.capOut.textContent = fmtUSD(c);
    el.pvCap.textContent = '$0 / ' + short(c);
    el.pvCap2.textContent = fmtUSD(c);
    var pct = (el.cap.value / 10);
    el.cap.style.setProperty('--p', pct + '%');
    [].forEach.call(el.chips.children, function (b) { b.classList.toggle('on', +b.dataset.cap === c); });
  }

  function paintPreview() {
    var name = el.name.value.trim(), sym = el.ticker.value.trim().toUpperCase();
    el.pvName.textContent = name || 'Your coin';
    el.pvSym.textContent = '$' + (sym || 'TICKER');
    el.pvDesc.textContent = el.desc.value.trim() || 'Your description appears here as you type.';
    el.descCount.textContent = el.desc.value.length + ' / 280';
    if (imageURL) el.pvArt.innerHTML = '<img alt="" src="' + imageURL + '">';
    else el.pvArt.innerHTML = root.TC.avatar(name + sym || 'trojan', 160);
  }

  function setImage(file) {
    if (!file) return;
    if (!/^image\//.test(file.type)) return root.TC.toast('That file is not an image.');
    if (file.size > cfg.limits.maxImageMB * 1048576) return root.TC.toast('Image is over ' + cfg.limits.maxImageMB + ' MB.');
    image = file;
    if (imageURL) URL.revokeObjectURL(imageURL);
    imageURL = URL.createObjectURL(file);
    el.dropName.textContent = file.name;
    el.drop.classList.add('has');
    paintPreview();
  }

  function setRevImage(file) {
    if (!file) return;
    if (!/^image\//.test(file.type)) return root.TC.toast('That file is not an image.');
    if (file.size > cfg.limits.maxImageMB * 1048576) return root.TC.toast('Image is over ' + cfg.limits.maxImageMB + ' MB.');
    revImage = file;
    if (revImageURL) URL.revokeObjectURL(revImageURL);
    revImageURL = URL.createObjectURL(file);
    el.rDropName.textContent = file.name;
    el.rDrop.classList.add('has');
    paintBack();
  }

  // back of the preview card: your chosen reveal, or the sealed scramble
  function paintBack() {
    var custom = revMode === 'custom';
    root.TC.revealCustom = custom;
    var pv = document.getElementById('pv-note');
    if (!custom) {
      pv.textContent = 'Whatever sits behind the seal is drawn at the moment of reveal. Not even you know what walks out.';
      if ($('#coin').dataset.face === 'back') root.TC.sealScramble();
      return;
    }
    var name = el.rName.value.trim(), sym = el.rTicker.value.trim().toUpperCase();
    $('#seal-name').textContent = name || 'Reveal name';
    $('#seal-sym').textContent = '$' + (sym || 'TICKER');
    $('#seal-desc').textContent = el.rDesc.value.trim() || 'Your reveal description appears here.';
    $('.seal-art').innerHTML = revImageURL ? '<img alt="" src="' + revImageURL + '">' : root.TC.avatar(name + sym + 'reveal', 160);
    pv.textContent = 'This is what your coin becomes when the gate opens at ' + fmtUSD(cap) + '.';
  }

  function setMode(mode) {
    revMode = mode;
    [].forEach.call(el.revMode.children, function (b) { b.setAttribute('aria-pressed', b.dataset.mode === mode ? 'true' : 'false'); });
    el.revCustom.hidden = mode !== 'custom';
    $('#rev-help').textContent = mode === 'custom'
      ? 'The coin becomes exactly the name, ticker, image and description you set below when the gate opens.'
      : 'A random meme is drawn from the TrojanCoins archive when the gate opens. Nobody knows which until it happens.';
    if (mode === 'random') { $('.seal-art').innerHTML = '<pre id="seal-pre"></pre>'; }
    else if (!$('.seal-art img') && !$('.seal-art svg')) { $('.seal-art').innerHTML = ''; }
    paintBack();
  }

  function btnState() {
    var w = root.TCWallet.get();
    el.lbl.textContent = busy ? 'Launching…' : (w.address ? 'Launch on pump.fun' : 'Connect Phantom to launch');
    el.btn.disabled = busy;
  }

  function fail(msg) {
    el.err.textContent = msg; el.err.hidden = false;
    el.err.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function step(name, status) {
    var li = el.steps.querySelector('[data-s="' + name + '"]');
    if (!li) return;
    li.className = status || '';
  }

  /* ----- pump.fun creation ----- */
  async function pinMetadata(p) {
    var fd = new FormData();
    fd.append('file', image);
    fd.append('name', p.name); fd.append('symbol', p.symbol); fd.append('description', p.description);
    fd.append('twitter', p.links.twitter || ''); fd.append('telegram', p.links.telegram || ''); fd.append('website', p.links.website || '');
    fd.append('showName', 'true');
    var res = await fetch(cfg.pump.ipfs, { method: 'POST', body: fd });
    if (!res.ok) throw new Error('Could not pin the image and metadata (' + res.status + ').');
    var j = await res.json();
    if (!j.metadataUri) throw new Error('Metadata service returned no URI.');
    return j.metadataUri;
  }

  async function buildCreateTx(p, uri, mintKeypair) {
    var body = {
      publicKey: p.creator,
      action: 'create',
      tokenMetadata: { name: p.name, symbol: p.symbol, uri: uri },
      mint: mintKeypair.publicKey.toBase58(),
      denominatedInSol: 'true',
      amount: p.devBuy || 0,
      slippage: cfg.pump.slippage,
      priorityFee: cfg.pump.priorityFee,
      pool: cfg.pump.pool
    };
    var res = await fetch(cfg.pump.tradeLocal, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error('Could not prepare the transaction (' + res.status + ').');
    var web3 = root.solanaWeb3;
    var tx = web3.VersionedTransaction.deserialize(new Uint8Array(await res.arrayBuffer()));
    tx.sign([mintKeypair]);
    return tx;
  }

  async function launch(e) {
    e.preventDefault();
    if (busy) return;
    el.err.hidden = true;
    var w = root.TCWallet.get();
    if (!w.address) return root.TCWallet.connect();

    var name = el.name.value.trim(), sym = el.ticker.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (name.length < 2) return fail('Give your coin a name.');
    if (sym.length < 2) return fail('Ticker needs 2 to 10 letters or numbers.');
    if (!el.desc.value.trim()) return fail('Add a short description.');
    if (!image) return fail('Add an image for the disguise.');
    var rev = { mode: revMode };
    if (revMode === 'custom') {
      rev.name = el.rName.value.trim(); rev.symbol = el.rTicker.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, ''); rev.description = el.rDesc.value.trim(); rev.image = revImage;
      if (rev.name.length < 2) return fail('Give the reveal a name.');
      if (rev.symbol.length < 2) return fail('The reveal ticker needs 2 to 10 letters or numbers.');
      if (!rev.description) return fail('Add a reveal description.');
      if (!rev.image) return fail('Add an image for the reveal.');
      if (rev.symbol === sym) return fail('The reveal ticker must differ from the disguise ticker.');
    }
    if (!root.solanaWeb3) return fail('The Solana library did not load. Check your connection and reload.');

    var payload = {
      creator: w.address, name: name, symbol: sym, description: el.desc.value.trim(), image: image,
      reveal: rev, revealCap: cap, devBuy: parseFloat(el.dev.value) || 0,
      links: { twitter: el.x.value.trim(), telegram: el.tg.value.trim(), website: el.web.value.trim() }
    };

    busy = true; btnState();
    el.steps.hidden = false;
    ['pin', 'mint', 'sign', 'done'].forEach(function (s) { step(s, ''); });
    try {
      step('pin', 'on');
      var uri = await pinMetadata(payload);
      step('pin', 'ok'); step('mint', 'on');
      var mint = root.solanaWeb3.Keypair.generate();
      var tx = await buildCreateTx(payload, uri, mint);
      step('mint', 'ok'); step('sign', 'on');
      var sent = await w.provider.signAndSendTransaction(tx);
      var signature = sent.signature || sent;
      step('sign', 'ok'); step('done', 'ok');

      payload.mint = mint.publicKey.toBase58();
      payload.signature = signature;
      try { await root.TC_HOOKS.registerCoin(payload); } catch (err) { console.error('registerCoin failed', err); }
      success(payload);
    } catch (err) {
      console.error(err);
      var declined = err && (err.code === 4001 || /reject|declin|denied/i.test(err.message || ''));
      fail(declined ? 'Signature declined. Nothing was launched.' : (err.message || 'Launch failed. Please try again.'));
      ['pin', 'mint', 'sign'].forEach(function (s) { var li = el.steps.querySelector('[data-s="' + s + '"]'); if (li.className === 'on') li.className = 'bad'; });
    } finally {
      busy = false; btnState();
    }
  }

  function success(p) {
    $('#done-cap').textContent = fmtUSD(p.revealCap);
    $('#done-into').textContent = p.reveal.mode === 'custom' ? 'into ' + p.reveal.name + ' ($' + p.reveal.symbol + ')' : 'into a random meme';
    $('#done-mint').textContent = p.mint;
    var tx = $('#done-tx'); tx.href = cfg.explorer + '/tx/' + p.signature;
    $('#done-pump').href = cfg.pump.coinUrl + p.mint;
    el.form.closest('.forge').classList.add('is-done');
    $('#done').hidden = false;
    $('#done').scrollIntoView({ behavior: 'smooth', block: 'center' });
    root.TC.toast('Launched. Your horse is at the gates.');
  }

  function reset() {
    $('#done').hidden = true;
    el.form.closest('.forge').classList.remove('is-done');
    el.form.reset(); image = null; if (imageURL) URL.revokeObjectURL(imageURL); imageURL = null;
    el.drop.classList.remove('has'); el.dropName.textContent = '';
    revImage = null; if (revImageURL) URL.revokeObjectURL(revImageURL); revImageURL = null; el.rDrop.classList.remove('has'); el.rDropName.textContent = '';
    el.steps.hidden = true; setCap(69000); paintPreview(); setMode('random');
    el.form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function init() {
    el.form = $('#launch-form');
    ['name', 'ticker', 'desc', 'dev', 'x', 'tg', 'web'].forEach(function (k) { el[k] = $('#f-' + ({ x: 'x', tg: 'tg', web: 'web' }[k] || k)); });
    el.cap = $('#f-cap'); el.capOut = $('#cap-out'); el.chips = $('#cap-chips');
    el.pvCap = $('#pv-cap'); el.pvCap2 = $('#pv-cap2'); el.pvName = $('#pv-name'); el.pvSym = $('#pv-sym'); el.pvDesc = $('#pv-desc'); el.pvArt = $('#pv-art');
    el.descCount = $('#desc-count'); el.drop = $('#drop'); el.dropName = $('#drop-name');
    el.btn = $('#launch-btn'); el.lbl = $('#launch-lbl'); el.err = $('#form-error'); el.steps = $('#steps');

    el.cap.addEventListener('input', function () { setCap(sliderToCap(+el.cap.value), true); });
    el.chips.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) setCap(+b.dataset.cap); });
    ['name', 'ticker', 'desc'].forEach(function (k) { el[k].addEventListener('input', paintPreview); });
    el.ticker.addEventListener('input', function () { el.ticker.value = el.ticker.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase(); });

    var file = $('#f-image');
    file.addEventListener('change', function () { setImage(file.files[0]); });
    el.drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } });
    ['dragenter', 'dragover'].forEach(function (t) { el.drop.addEventListener(t, function (e) { e.preventDefault(); el.drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (t) { el.drop.addEventListener(t, function (e) { e.preventDefault(); el.drop.classList.remove('over'); }); });
    el.drop.addEventListener('drop', function (e) { setImage(e.dataTransfer.files[0]); });

    // preview faces
    var coin = $('#coin');
    [].forEach.call(document.querySelectorAll('.preview .seg button'), function (b) {
      b.addEventListener('click', function () {
        coin.dataset.face = b.dataset.face;
        [].forEach.call(b.parentNode.children, function (o) { o.setAttribute('aria-selected', o === b ? 'true' : 'false'); });
        if (b.dataset.face === 'back') { revMode === 'custom' ? paintBack() : root.TC.sealScramble(); }
      });
    });

    el.revMode = $('#rev-mode'); el.revCustom = $('#rev-custom'); el.rName = $('#r-name'); el.rTicker = $('#r-ticker'); el.rDesc = $('#r-desc');
    el.rDrop = $('#r-drop'); el.rDropName = $('#r-drop-name');
    el.revMode.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) setMode(b.dataset.mode); });
    ['rName', 'rTicker', 'rDesc'].forEach(function (k) { el[k].addEventListener('input', function () { $('#rdesc-count').textContent = el.rDesc.value.length + ' / 280'; paintBack(); }); });
    el.rTicker.addEventListener('input', function () { el.rTicker.value = el.rTicker.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase(); });
    var rFile = $('#r-image');
    rFile.addEventListener('change', function () { setRevImage(rFile.files[0]); });
    el.rDrop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); rFile.click(); } });
    ['dragenter', 'dragover'].forEach(function (t) { el.rDrop.addEventListener(t, function (e) { e.preventDefault(); el.rDrop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (t) { el.rDrop.addEventListener(t, function (e) { e.preventDefault(); el.rDrop.classList.remove('over'); }); });
    el.rDrop.addEventListener('drop', function (e) { setRevImage(e.dataTransfer.files[0]); });

    el.form.addEventListener('submit', launch);
    $('#copy-mint').addEventListener('click', function () {
      navigator.clipboard && navigator.clipboard.writeText($('#done-mint').textContent).then(function () { root.TC.toast('Mint address copied.'); });
    });
    $('#done-again').addEventListener('click', reset);
    root.addEventListener('tc:wallet', btnState);

    setCap(69000); paintPreview(); btnState();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window);
