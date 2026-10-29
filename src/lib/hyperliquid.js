// Hyperliquid wire format + signing. Kept byte-for-byte compatible with
// hyperliquid-python-sdk (utils/signing.py) — see test/signing.test.mjs.
import { encode } from '@msgpack/msgpack';
import { concat, encodeAbiParameters, hexToBytes, keccak256, recoverAddress, stringToBytes } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { floatToWire } from './math.js';

export const API_URLS = {
  mainnet: 'https://api.hyperliquid.xyz',
  testnet: 'https://api.hyperliquid-testnet.xyz',
};
export const APP_URLS = {
  mainnet: 'https://app.hyperliquid.xyz',
  testnet: 'https://app.hyperliquid-testnet.xyz',
};

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const L1_DOMAIN = { name: 'Exchange', version: '1', chainId: 1337, verifyingContract: ZERO_ADDRESS };
const AGENT_TYPES = {
  Agent: [
    { name: 'source', type: 'string' },
    { name: 'connectionId', type: 'bytes32' },
  ],
};

const APPROVE_AGENT_PRIMARY = 'HyperliquidTransaction:ApproveAgent';
const APPROVE_AGENT_TYPES = [
  { name: 'hyperliquidChain', type: 'string' },
  { name: 'agentAddress', type: 'address' },
  { name: 'agentName', type: 'string' },
  { name: 'nonce', type: 'uint64' },
];
const EIP712_DOMAIN_TYPES = [
  { name: 'name', type: 'string' },
  { name: 'version', type: 'string' },
  { name: 'chainId', type: 'uint256' },
  { name: 'verifyingContract', type: 'address' },
];

function u64(n) {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, BigInt(n));
  return b;
}

export function actionHash(action, vaultAddress, nonce, expiresAfter) {
  const parts = [encode(action), u64(nonce)];
  if (vaultAddress) parts.push(Uint8Array.of(1), hexToBytes(vaultAddress));
  else parts.push(Uint8Array.of(0));
  if (expiresAfter != null) parts.push(Uint8Array.of(0), u64(expiresAfter));
  return keccak256(concat(parts));
}

export function splitSignature(sig) {
  const hex = sig.startsWith('0x') ? sig.slice(2) : sig;
  if (hex.length !== 130) throw new Error('Unexpected signature length');
  let v = parseInt(hex.slice(128, 130), 16);
  if (v < 27) v += 27;
  return { r: `0x${hex.slice(0, 64)}`, s: `0x${hex.slice(64, 128)}`, v };
}

/** Sign an L1 action (orders, leverage, cancels) with the agent key. */
export async function signL1Action({ privateKey, action, nonce, isMainnet, vaultAddress = null, expiresAfter = null }) {
  const account = privateKeyToAccount(privateKey);
  const connectionId = actionHash(action, vaultAddress, nonce, expiresAfter);
  const signature = await account.signTypedData({
    domain: L1_DOMAIN,
    types: AGENT_TYPES,
    primaryType: 'Agent',
    message: { source: isMainnet ? 'a' : 'b', connectionId },
  });
  return splitSignature(signature);
}

/**
 * Build the approveAgent action + the EIP-712 payload the user's wallet signs.
 * signatureChainId must be the wallet's active chain (MetaMask rejects mismatches).
 */
export function buildApproveAgent({ agentAddress, agentName, nonce, isMainnet, signatureChainId }) {
  const hyperliquidChain = isMainnet ? 'Mainnet' : 'Testnet';
  const message = { hyperliquidChain, agentAddress, agentName, nonce };
  const action = { type: 'approveAgent', signatureChainId, ...message };
  const typedData = {
    domain: {
      name: 'HyperliquidSignTransaction',
      version: '1',
      chainId: parseInt(signatureChainId, 16),
      verifyingContract: ZERO_ADDRESS,
    },
    types: { EIP712Domain: EIP712_DOMAIN_TYPES, [APPROVE_AGENT_PRIMARY]: APPROVE_AGENT_TYPES },
    primaryType: APPROVE_AGENT_PRIMARY,
    message,
  };
  return { action, typedData };
}

// Minimal EIP-712 for flat structs. viem refuses Hyperliquid's "Namespace:Type"
// struct names, so we hash those ourselves.
function hashStruct(primaryType, fields, message) {
  const typeString = `${primaryType}(${fields.map((f) => `${f.type} ${f.name}`).join(',')})`;
  const abiTypes = [{ type: 'bytes32' }];
  const values = [keccak256(stringToBytes(typeString))];
  for (const f of fields) {
    const v = message[f.name];
    if (f.type === 'string') {
      abiTypes.push({ type: 'bytes32' });
      values.push(keccak256(stringToBytes(v)));
    } else {
      abiTypes.push({ type: f.type });
      values.push(/^u?int/.test(f.type) ? BigInt(v) : v);
    }
  }
  return keccak256(encodeAbiParameters(abiTypes, values));
}

export function typedDataDigest({ domain, types, primaryType, message }) {
  const domainHash = hashStruct('EIP712Domain', types.EIP712Domain, domain);
  const structHash = hashStruct(primaryType, types[primaryType], message);
  return keccak256(concat(['0x1901', domainHash, structHash]));
}

export async function recoverTypedDataSigner(typedData, signature) {
  return recoverAddress({ hash: typedDataDigest(typedData), signature });
}

export function newAgentKey() {
  const privateKey = generatePrivateKey();
  return { privateKey, address: privateKeyToAccount(privateKey).address };
}

export function addressFromKey(privateKey) {
  return privateKeyToAccount(privateKey).address;
}

// ---- wire builders -------------------------------------------------------

function orderTypeWire(t) {
  if (t.limit) return { limit: { tif: t.limit.tif } };
  if (t.trigger) {
    return {
      trigger: {
        isMarket: t.trigger.isMarket,
        triggerPx: floatToWire(t.trigger.triggerPx),
        tpsl: t.trigger.tpsl,
      },
    };
  }
  throw new Error('Invalid order type');
}

export function orderWire({ asset, isBuy, px, sz, reduceOnly = false, orderType }) {
  return {
    a: asset,
    b: isBuy,
    p: floatToWire(px),
    s: floatToWire(sz),
    r: reduceOnly,
    t: orderTypeWire(orderType),
  };
}

export function orderAction(orders, grouping = 'na') {
  return { type: 'order', orders, grouping };
}

export function updateLeverageAction({ asset, isCross, leverage }) {
  return { type: 'updateLeverage', asset, isCross, leverage };
}
