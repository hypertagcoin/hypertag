// Cross-checks our JS signing against vectors produced by the official
// hyperliquid-python-sdk (test/vectors.json). Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { privateKeyToAccount } from 'viem/accounts';
import {
  actionHash, buildApproveAgent, orderAction, orderWire, recoverTypedDataSigner,
  signL1Action, splitSignature, typedDataDigest, updateLeverageAction,
} from '../src/lib/hyperliquid.js';
import { floatToWire, roundPrice, roundSize } from '../src/lib/math.js';

const V = JSON.parse(readFileSync(new URL('./vectors.json', import.meta.url), 'utf8'));
const big = (h) => BigInt(h);

const actions = {
  ioc: orderAction([orderWire({ asset: 4, isBuy: true, px: 1670.1, sz: 0.0147, orderType: { limit: { tif: 'Ioc' } } })]),
  tpsl: orderAction([
    orderWire({ asset: 0, isBuy: false, px: 81000, sz: 0.00123, orderType: { limit: { tif: 'Gtc' } } }),
    orderWire({ asset: 0, isBuy: true, px: 70200, sz: 0.00123, reduceOnly: true, orderType: { trigger: { isMarket: true, triggerPx: 78000, tpsl: 'tp' } } }),
    orderWire({ asset: 0, isBuy: true, px: 92950, sz: 0.00123, reduceOnly: true, orderType: { trigger: { isMarket: true, triggerPx: 84500.5, tpsl: 'sl' } } }),
  ], 'normalTpsl'),
  lev: updateLeverageAction({ asset: 159, isCross: false, leverage: 7 }),
};

for (const vec of V.l1) {
  test(`L1 ${vec.name} (${vec.mainnet ? 'mainnet' : 'testnet'})`, async () => {
    const action = actions[vec.name];
    assert.deepEqual(action, vec.action, 'wire format matches SDK');
    assert.equal(actionHash(action, null, vec.nonce), vec.hash);
    const sig = await signL1Action({ privateKey: V.agentKey, action, nonce: vec.nonce, isMainnet: vec.mainnet });
    assert.equal(big(sig.r), big(vec.r));
    assert.equal(big(sig.s), big(vec.s));
    assert.equal(sig.v, vec.v);
  });
}

test('approveAgent typed data matches SDK sign_agent', async () => {
  const a = V.approve;
  const { typedData, action } = buildApproveAgent({
    agentAddress: a.agent, agentName: 'XTrader', nonce: a.nonce, isMainnet: true, signatureChainId: '0x66eee',
  });
  // Sign the EIP-712 digest the way a browser wallet would for eth_signTypedData_v4.
  const wallet = privateKeyToAccount(V.userKey);
  const raw = await wallet.sign({ hash: typedDataDigest(typedData) });
  const sig = splitSignature(raw);
  assert.equal(big(sig.r), big(a.r));
  assert.equal(big(sig.s), big(a.s));
  assert.equal(sig.v, a.v);
  assert.equal(await recoverTypedDataSigner(typedData, raw), a.user);
  assert.equal(action.type, 'approveAgent');
  assert.equal(action.hyperliquidChain, 'Mainnet');
});

test('floatToWire matches SDK float_to_wire', () => {
  for (const [input, expected] of Object.entries(V.floats)) assert.equal(floatToWire(Number(input)), expected, input);
});

test('rounding helpers', () => {
  assert.equal(roundSize(0.0147, 4), 0.0147);
  assert.equal(roundSize(0.01479, 4), 0.0147);
  assert.equal(roundSize(12.5 / 81722.5, 5), 0.00015);
  assert.equal(roundPrice(81722.5 * 1.03, 5), 84174);
  assert.equal(roundPrice(0.0123456789, 0), 0.012346);
  assert.equal(roundPrice(1.23456789, 2), 1.2346);
  assert.equal(roundPrice(123456.7, 5), 123460);
});
