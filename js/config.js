/* TrojanCoins — configuration and backend hooks.
   Everything the backend needs to plug into lives in this file. */
window.TC_CONFIG = {
  // Solana
  rpc: 'https://api.mainnet-beta.solana.com',
  explorer: 'https://solscan.io',

  // pump.fun creation flow (metadata pin + unsigned create transaction)
  pump: {
    ipfs: 'https://pump.fun/api/ipfs',
    tradeLocal: 'https://pumpportal.fun/api/trade-local',
    slippage: 10,
    priorityFee: 0.0005,
    pool: 'pump',
    coinUrl: 'https://pump.fun/coin/'
  },

  // Backend. Leave `base` empty to read the board from /data/coins.json.
  api: {
    base: '',                 // e.g. 'https://api.trojancoins.xyz'
    coins: '/coins',          // GET → [{...coin}]
    register: '/coins'        // POST → called after a successful launch
  },

  limits: { minCap: 10000, maxCap: 10000000, maxImageMB: 5 }
};

/* Hooks — override or extend these from your backend integration.

   registerCoin receives everything needed to run the reveal later:
   {
     mint, signature, creator,            // on-chain identifiers
     name, symbol, description,           // the disguise
     image,                               // File
     revealCap,                           // USD market cap that opens the gate
     links: { twitter, telegram, website },
     reveal: {                            // what the coin turns into
       mode: 'random' | 'custom',         // random → pick from your archive at reveal time
       name, symbol, description, image   // only set when mode === 'custom' (image is a File)
     }
   }
*/
window.TC_HOOKS = {
  async registerCoin(payload) {
    var cfg = window.TC_CONFIG.api;
    if (!cfg.base) return null;
    // BACKEND: persist `payload` (minus the File) and schedule the reveal watcher.
    var res = await fetch(cfg.base + cfg.register, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        mint: payload.mint, signature: payload.signature, creator: payload.creator,
        name: payload.name, symbol: payload.symbol, description: payload.description,
        revealCap: payload.revealCap, links: payload.links,
        reveal: { mode: payload.reveal.mode, name: payload.reveal.name, symbol: payload.reveal.symbol, description: payload.reveal.description }
      })
    });
    return res.ok ? res.json() : null;
  },

  async listCoins() {
    var cfg = window.TC_CONFIG.api;
    var url = cfg.base ? cfg.base + cfg.coins : 'data/coins.json';
    var res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('coins ' + res.status);
    return res.json();
  }
};
