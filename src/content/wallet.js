// Isolated-world side of the wallet bridge. Browser wallets live in the page's
// main world, so requests hop through window.postMessage to bridge.js.
// Only public data crosses this channel: addresses, typed data, signatures.

const TIMEOUTS = { tt_listWallets: 4000, eth_chainId: 15000 };

export function walletCall(method, params = [], walletId = null) {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    const timer = setTimeout(() => {
      window.removeEventListener('message', onMessage);
      reject(new Error('Your wallet did not respond. Unlock it and try again.'));
    }, TIMEOUTS[method] || 5 * 60 * 1000);
    function onMessage(event) {
      const d = event.data;
      if (event.source !== window || !d || d.__tt !== 'bridge:res' || d.id !== id) return;
      window.removeEventListener('message', onMessage);
      clearTimeout(timer);
      if (d.error) {
        const err = new Error(d.error.code === 4001 ? 'Request rejected in your wallet.' : d.error.message || 'Wallet error');
        err.code = d.error.code;
        reject(err);
      } else {
        resolve(d.result);
      }
    }
    window.addEventListener('message', onMessage);
    window.postMessage({ __tt: 'bridge:req', id, method, params, walletId }, window.location.origin);
  });
}

export const listWallets = () => walletCall('tt_listWallets');
