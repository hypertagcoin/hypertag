// Persistent state. Agent private keys live only here (chrome.storage.local),
// are only ever read by the service worker, and never reach x.com pages.

export const DEFAULT_SETTINGS = {
  network: 'mainnet',
  defaultUsd: 50,
  defaultLeverage: 5,
  slippage: 0.03,
  showChips: true,
  showSidebar: true,
};

export async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...settings };
}

export async function updateSettings(patch) {
  const next = { ...(await getSettings()) };
  if (patch.network === 'mainnet' || patch.network === 'testnet') next.network = patch.network;
  if (Number(patch.defaultUsd) > 0) next.defaultUsd = Math.round(Number(patch.defaultUsd) * 100) / 100;
  if (Number(patch.defaultLeverage) >= 1) next.defaultLeverage = Math.min(100, Math.round(Number(patch.defaultLeverage)));
  if (Number(patch.slippage) > 0 && Number(patch.slippage) <= 0.2) next.slippage = Number(patch.slippage);
  if (typeof patch.showChips === 'boolean') next.showChips = patch.showChips;
  if (typeof patch.showSidebar === 'boolean') next.showSidebar = patch.showSidebar;
  await chrome.storage.local.set({ settings: next });
  return next;
}

async function getConnections() {
  const { connections } = await chrome.storage.local.get('connections');
  return connections || {};
}

export async function getConnection(network) {
  return (await getConnections())[network] || null;
}

export async function saveConnection(network, conn) {
  const connections = await getConnections();
  connections[network] = conn;
  await chrome.storage.local.set({ connections });
}

export async function removeConnection(network) {
  const connections = await getConnections();
  delete connections[network];
  await chrome.storage.local.set({ connections });
}

export async function connectedNetworks() {
  const c = await getConnections();
  return { mainnet: !!c.mainnet, testnet: !!c.testnet };
}

// Pending wallet approval survives a service-worker restart while the user
// is looking at their wallet popup. storage.session is not readable by content scripts.
export async function setPending(pending) {
  await chrome.storage.session.set({ pendingApproval: pending });
}

export async function takePending() {
  const { pendingApproval } = await chrome.storage.session.get('pendingApproval');
  await chrome.storage.session.remove('pendingApproval');
  return pendingApproval || null;
}
