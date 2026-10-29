// Request/response wrapper around chrome.runtime messaging to the service worker.

export const STALE_MESSAGE = 'Hypertag was updated. Refresh the page to keep trading.';

export function extensionAlive() {
  try {
    return !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

export async function rpc(type, payload) {
  if (!extensionAlive()) throw new Error(STALE_MESSAGE);
  let res;
  try {
    res = await chrome.runtime.sendMessage({ type, payload });
  } catch (err) {
    if (/context invalidated|receiving end does not exist/i.test(err?.message || '')) throw new Error(STALE_MESSAGE);
    throw err;
  }
  if (!res) throw new Error('No response from the extension');
  if (!res.ok) throw new Error(res.error || 'Something went wrong');
  return res.result;
}
