import {AegisError, hash} from './engine.ts';

export const INTENTS_URL = 'https://1click.chaindefuser.com/v0';
export const NEAR_ASSET = 'nep141:wrap.near';
export const DESTINATIONS = {
  base: {name: 'USDC on Base', asset: 'nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near'},
  eth: {name: 'USDC on Ethereum', asset: 'nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near'}
} as const;
export type IntentsPolicy = {version: number; daily: string; perPayment: string; recipient: string; network: keyof typeof DESTINATIONS; refundTo: string; slippageBps: number};
export type IntentRequest = {id: string; reference: string; amount: string; recipient: string; network: keyof typeof DESTINATIONS; refundTo: string; slippageBps: number; policyVersion: number; fingerprint: string; created: number; status: 'preview'|'preparing'|'awaiting_deposit'|'processing'|'settled'|'refunded'|'failed'; quote?: any; depositAddress?: string; expires?: number; originTx?: string; approvalFingerprint?: string; previewExpires?: number; resolvedAt?: number; error?: string};
export type IntentsState = {policy: IntentsPolicy; requests: IntentRequest[]};
export function nativeAmount(value: unknown) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,5})(\.\d{1,24})?$/.test(value)) throw new AegisError('amount', 'Use a positive NEAR amount with up to 24 decimal places.');
  const [a, b = ''] = value.split('.'); const n = BigInt(a + b.padEnd(24, '0'));
  if (n <= 0n) throw new AegisError('amount', 'Amount must be positive.'); return n.toString();
}
export const nativeDisplay = (n: string) => {const v = BigInt(n); return `${v / 10n ** 24n}.${String(v % 10n ** 24n).padStart(24, '0')}`.replace(/0+$/, '').replace(/\.$/, '');};
export function intentsPolicy(input: any, version: number): IntentsPolicy {
  if (!input || !Object.hasOwn(DESTINATIONS,input.network) || !/^0x[0-9a-fA-F]{40}$/.test(input.recipient) || /^0x0{40}$/i.test(input.recipient) || typeof input.refundTo !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,62}[a-z0-9]$/.test(input.refundTo) || input.refundTo.endsWith('.testnet')) throw new AegisError('policy', 'Use a recipient on Base or Ethereum and a NEAR mainnet refund account.');
  const daily = nativeAmount(input.daily), perPayment = nativeAmount(input.perPayment), slippageBps = Number(input.slippageBps);
  if (BigInt(perPayment) > BigInt(daily) || !Number.isInteger(slippageBps) || slippageBps < 1 || slippageBps > 100) throw new AegisError('policy', 'Payment cap must fit the budget. Maximum slippage is 1–100 basis points.');
  return {version, daily, perPayment, slippageBps, recipient: input.recipient.toLowerCase(), network: input.network, refundTo: input.refundTo};
}
export function intentsUsage(state: IntentsState, now = Date.now()) {
  return state.requests.filter(r => ['preparing','awaiting_deposit','processing'].includes(r.status) || (['settled','refunded'].includes(r.status) && (r.resolvedAt ?? r.created) > now - 86_400_000)).reduce((n, r) => n + BigInt(r.amount), 0n);
}
export function checkIntent(state: IntentsState, row: IntentRequest, paused: boolean, now = Date.now()) {
  const p = state.policy;
  if (paused) throw new AegisError('paused', 'The treasury is paused.', 409);
  if (row.policyVersion !== p.version || row.recipient !== p.recipient || row.network !== p.network || row.refundTo !== p.refundTo || row.slippageBps !== p.slippageBps) throw new AegisError('policy_changed', 'Policy changed. Request a new quote.', 409);
  if (BigInt(row.amount) > BigInt(p.perPayment) || intentsUsage(state, now) + BigInt(row.amount) > BigInt(p.daily)) throw new AegisError('budget', 'The mainnet NEAR budget would be exceeded.', 409);
}
export async function newIntent(state: IntentsState, input: any): Promise<IntentRequest> {
  if (typeof input.reference !== 'string' || !/^[a-zA-Z0-9._:-]{1,100}$/.test(input.reference)) throw new AegisError('reference', 'Use a unique payment reference.');
  const p = state.policy, amount = nativeAmount(input.amount);
  const payload = {reference: input.reference, amount, recipient: p.recipient, network: p.network, refundTo: p.refundTo, slippageBps: p.slippageBps, policyVersion: p.version};
  const fingerprint = await hash(payload), prior = state.requests.find(r => r.reference === input.reference);
  if (prior) {if (prior.fingerprint !== fingerprint) throw new AegisError('reference_conflict', 'The reference already belongs to a different request.', 409); return prior;}
  if (state.requests.length >= 100) throw new AegisError('capacity', 'This workspace supports 100 Intents requests.', 409);
  return {id: crypto.randomUUID(), ...payload, fingerprint, created: Date.now(), status: 'preview'};
}
export function quotePayload(row: IntentRequest, dry: boolean) {
  return {dry, swapType: 'EXACT_INPUT', slippageTolerance: row.slippageBps, originAsset: NEAR_ASSET, depositType: 'ORIGIN_CHAIN', destinationAsset: DESTINATIONS[row.network].asset, amount: row.amount, recipient: row.recipient, recipientType: 'DESTINATION_CHAIN', refundTo: row.refundTo, refundType: 'ORIGIN_CHAIN', deadline: new Date(Date.now() + 15 * 60_000).toISOString()};
}
export async function intentsFetch(path: string, body?: unknown, fetcher: typeof fetch = fetch) {
  const r = await fetcher(`${INTENTS_URL}${path}`, {method: body ? 'POST' : 'GET', headers: {'Content-Type': 'application/json', ...(process.env.NEAR_INTENTS_API_KEY ? {'X-API-Key': process.env.NEAR_INTENTS_API_KEY} : {})}, ...(body ? {body: JSON.stringify(body)} : {}), cache: 'no-store', signal: AbortSignal.timeout(20_000)});
  const text = await r.text(); if (text.length > 300_000) throw new AegisError('provider', 'The Intents response was too large.', 502);
  let value: any; try {value = JSON.parse(text);} catch {throw new AegisError('provider', 'NEAR Intents returned an unreadable response.', 502);}
  if (!r.ok) throw new AegisError('provider', typeof value.message === 'string' ? value.message.slice(0, 180) : 'NEAR Intents could not quote this request.', 502); return value;
}
export function validateQuote(row: IntentRequest, body: any, dry: boolean, requireFresh = true) {
  const q = body?.quote, request = body?.quoteRequest;
  if (!q || q.amountIn !== row.amount || !/^\d+$/.test(q.minAmountOut) || BigInt(q.minAmountOut) <= 0n) throw new AegisError('quote_mismatch', 'The provider quote does not match the payment.', 502);
  if (!request || request.recipient?.toLowerCase() !== row.recipient || request.refundTo !== row.refundTo || request.originAsset !== NEAR_ASSET || request.destinationAsset !== DESTINATIONS[row.network].asset || request.amount !== row.amount || request.slippageTolerance !== row.slippageBps || request.dry !== dry || request.depositType !== 'ORIGIN_CHAIN' || request.refundType !== 'ORIGIN_CHAIN' || request.recipientType !== 'DESTINATION_CHAIN') throw new AegisError('quote_mismatch', 'The provider changed the approved route.', 502);
  if (!dry && (typeof q.depositAddress !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,62}[a-z0-9]$/.test(q.depositAddress) || !Number.isFinite(Date.parse(q.deadline)) || (requireFresh && Date.parse(q.deadline) <= Date.now() + 30_000))) throw new AegisError('quote_mismatch', 'The deposit route is invalid or about to expire.', 502);
  return body;
}
