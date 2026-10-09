/* TrojanCoins — Phantom wallet connection. */
(function (root) {
  'use strict';
  var btn, lbl, state = { provider: null, address: null, sol: null };

  function provider() {
    var p = root.phantom && root.phantom.solana;
    if (p && p.isPhantom) return p;
    if (root.solana && root.solana.isPhantom) return root.solana;
    return null;
  }
  function short(a) { return a.slice(0, 4) + '…' + a.slice(-4); }

  function emit() { root.dispatchEvent(new CustomEvent('tc:wallet', { detail: { address: state.address, provider: state.provider } })); }

  function paint() {
    if (!btn) return;
    btn.classList.toggle('on', !!state.address);
    lbl.textContent = state.address
      ? short(state.address) + (state.sol != null ? ' · ' + state.sol.toFixed(2) + ' SOL' : '')
      : 'Connect Phantom';
    btn.title = state.address ? 'Click to disconnect' : '';
  }

  async function balance() {
    try {
      var res = await fetch(root.TC_CONFIG.rpc, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [state.address] })
      });
      var j = await res.json();
      state.sol = j.result ? j.result.value / 1e9 : null;
    } catch (e) { state.sol = null; }
    paint();
  }

  function set(p, pubkey) {
    state.provider = p; state.address = pubkey ? pubkey.toString() : null; state.sol = null;
    paint(); emit();
    if (state.address) balance();
  }

  async function connect() {
    var p = provider();
    if (!p) {
      root.TC.toast('Phantom was not detected. Opening the install page.');
      root.open('https://phantom.app/download', '_blank', 'noopener');
      return;
    }
    try {
      var r = await p.connect();
      set(p, r.publicKey);
      root.TC.toast('Connected ' + short(state.address));
    } catch (e) {
      if (e && e.code === 4001) root.TC.toast('Connection request was declined.');
      else root.TC.toast('Could not connect to Phantom.');
    }
  }

  async function disconnect() {
    try { if (state.provider) await state.provider.disconnect(); } catch (e) {}
    set(null, null);
    root.TC.toast('Wallet disconnected.');
  }

  function init() {
    btn = document.getElementById('wallet-btn');
    lbl = btn.querySelector('.lbl');
    btn.addEventListener('click', function () { state.address ? disconnect() : connect(); });
    var p = provider();
    if (p) {
      p.on && p.on('accountChanged', function (pk) { pk ? set(p, pk) : set(null, null); });
      p.on && p.on('disconnect', function () { set(null, null); });
      p.connect({ onlyIfTrusted: true }).then(function (r) { set(p, r.publicKey); }).catch(function () {});
    }
    paint();
  }

  root.TCWallet = { connect: connect, disconnect: disconnect, get: function () { return state; }, provider: provider };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window);
