// Runs in x.com's MAIN world (manifest "world": "MAIN") so it can reach
// injected EVM wallets. It only forwards three wallet methods; it never sees
// the trading key, which stays in the extension's service worker.
(() => {
  if (window.__ttWalletBridge) return;
  Object.defineProperty(window, '__ttWalletBridge', { value: true });

  const ALLOWED = new Set(['eth_requestAccounts', 'eth_chainId', 'eth_signTypedData_v4']);
  const providers = new Map(); // EIP-6963 uuid -> { info, provider }

  window.addEventListener('eip6963:announceProvider', (event) => {
    const { info, provider } = event.detail || {};
    if (info?.uuid && provider?.request) providers.set(info.uuid, { info, provider });
  });
  const discover = () => window.dispatchEvent(new Event('eip6963:requestProvider'));
  discover();

  function legacyName(eth) {
    if (eth.isRabby) return 'Rabby';
    if (eth.isPhantom) return 'Phantom';
    if (eth.isCoinbaseWallet) return 'Coinbase Wallet';
    if (eth.isOkxWallet || eth.isOKExWallet) return 'OKX Wallet';
    if (eth.isMetaMask) return 'MetaMask';
    return 'Browser wallet';
  }

  async function listWallets() {
    discover();
    await new Promise((r) => setTimeout(r, 300));
    const out = [...providers.values()].map(({ info }) => ({
      id: info.uuid, name: String(info.name || 'Wallet'), icon: typeof info.icon === 'string' && info.icon.startsWith('data:image/') ? info.icon : null,
    }));
    if (!out.length && window.ethereum?.request) out.push({ id: 'injected', name: legacyName(window.ethereum), icon: null });
    return out;
  }

  function providerFor(id) {
    if (id === 'injected') return window.ethereum;
    return providers.get(id)?.provider;
  }

  window.addEventListener('message', async (event) => {
    const d = event.data;
    if (event.source !== window || !d || d.__tt !== 'bridge:req') return;
    const reply = (payload) => window.postMessage({ __tt: 'bridge:res', id: d.id, ...payload }, window.location.origin);
    try {
      if (d.method === 'tt_listWallets') {
        reply({ result: await listWallets() });
        return;
      }
      if (!ALLOWED.has(d.method)) throw new Error('Method not allowed');
      const provider = providerFor(d.walletId);
      if (!provider) throw new Error('Wallet not found. Reload the page and try again.');
      reply({ result: await provider.request({ method: d.method, params: d.params }) });
    } catch (err) {
      reply({ error: { message: String(err?.message || err), code: err?.code ?? null } });
    }
  });
})();
