import {decodeEventLog, parseAbiItem} from 'viem';
import {AegisError} from './engine.ts';
import type {IntentRequest} from './intents.ts';

export async function nearRead(account: string, method: string, args: unknown = {}) {
  const r = await fetch('https://rpc.testnet.near.org', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({jsonrpc:'2.0',id:'aegis',method:'query',params:{request_type:'call_function',finality:'final',account_id:account,method_name:method,args_base64:Buffer.from(JSON.stringify(args)).toString('base64')}}), cache: 'no-store', signal: AbortSignal.timeout(15_000)});
  const d = await r.json(); if (!r.ok || d.error || !d.result?.result) throw new AegisError('near_rpc', 'The testnet contract could not be read.', 502);
  return {value: JSON.parse(Buffer.from(d.result.result).toString()), blockHeight: d.result.block_height};
}
export async function evmRpc(network: 'sepolia'|'base'|'eth', method: string, params: unknown[]) {
  const url = {sepolia:'https://ethereum-sepolia-rpc.publicnode.com',base:'https://mainnet.base.org',eth:'https://ethereum-rpc.publicnode.com'}[network];
  const r = await fetch(url, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),cache:'no-store',signal:AbortSignal.timeout(15_000)});
  const d = await r.json(); if (!r.ok || d.error) throw new AegisError('evm_rpc', 'The destination network could not complete this request.', 502); return d.result;
}
export async function verifyOrigin(row: IntentRequest, txHash: string) {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(txHash)) throw new AegisError('transaction','Use a NEAR transaction hash.');
  const r = await fetch('https://rpc.mainnet.near.org', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tx',params:{tx_hash:txHash,sender_account_id:row.refundTo,wait_until:'FINAL'}}),cache:'no-store',signal:AbortSignal.timeout(15_000)});
  const d = await r.json(), out = d.result;
  const actions = out?.transaction?.actions;
  if (!r.ok || d.error || out.final_execution_status !== 'FINAL' || !out.status || !('SuccessValue' in out.status) || out.transaction.signer_id !== row.refundTo || out.transaction.receiver_id !== row.depositAddress || !Array.isArray(actions) || actions.length !== 1 || actions[0].Transfer?.deposit !== row.amount || out.receipts_outcome?.some((x:any) => x.outcome?.status?.Failure)) throw new AegisError('origin_unverified', 'The final NEAR transfer does not match the authorised deposit.', 409);
  return true;
}
const transfer = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)');
export function receivedUSDC(row: IntentRequest, receipts: any[], minimum: string) {
  const token = row.network === 'base' ? '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913' : '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
  let received=0n;
  for (const receipt of receipts) {
    if (receipt?.status !== '0x1') return false;
    for (const log of receipt.logs ?? []) {
      if (String(log.address).toLowerCase() !== token) continue;
      try {const event=decodeEventLog({abi:[transfer],data:log.data,topics:log.topics});if (event.args.to.toLowerCase()===row.recipient) received+=event.args.value;} catch {/* unrelated log */}
    }
  }
  return received >= BigInt(minimum);
}
export async function verifyDestination(row: IntentRequest, hashes: string[], minimum: string) {
  const unique=[...new Set(hashes)];
  if (!unique.length || unique.length>5 || unique.some(x=>!/^0x[0-9a-fA-F]{64}$/.test(x))) return false;
  const receipts=await Promise.all(unique.map(x=>evmRpc(row.network,'eth_getTransactionReceipt',[x])));
  if (!receivedUSDC(row,receipts,minimum)) return false;
  const head=BigInt(await evmRpc(row.network,'eth_blockNumber',[]));
  return receipts.every(x=>head-BigInt(x.blockNumber)>= (row.network==='base'?20n:12n));
}
