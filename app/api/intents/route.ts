import {AegisError, audit, hash} from '@/lib/engine';
import {workspaceId, read, mutate} from '@/lib/store';
import {checkIntent, intentsPolicy, newIntent, intentsFetch, quotePayload, validateQuote} from '@/lib/intents';
import {verifyDestination, verifyOrigin} from '@/lib/settlement';
export const dynamic='force-dynamic'; export const maxDuration=60;
const json=(x:unknown,status=200)=>Response.json(x,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(){return json({executionEnabled:process.env.AEGIS_INTENTS_LIVE==='true',network:'mainnet',originAsset:'Native NEAR',destinationAsset:'USDC on Base or Ethereum'});}
export async function POST(req:Request){try{
 const origin=req.headers.get('origin');if(origin&&new URL(origin).host!==req.headers.get('host'))throw new AegisError('origin','Use your own workspace.',403);
 const text=await req.text();if(text.length>4000)throw new AegisError('size','Request too large.',413);const data=JSON.parse(text),id=await workspaceId();
 if(data.action==='policy')return json(await mutate(id,async s=>{s.intents??={policy:intentsPolicy(data.policy,1),requests:[]};s.intents.policy=intentsPolicy(data.policy,s.intents.policy.version+1);await audit(s,'owner','intents.policy_updated',`Mainnet NEAR policy v${s.intents.policy.version} saved. Sandbox USD are separate.`);return null;}));
 const {state}=await read(id);if(!state.intents)throw new AegisError('policy','Save an Intents policy first.');
 if(data.action==='quote'){
  const reserved=await mutate(id,async s=>{const t=s.intents!;const row=await newIntent(t,data);checkIntent(t,row,s.paused);if(s.audit.filter(x=>x.action==='intents.quote_requested'&&x.time>Date.now()-3_600_000).length>=20)throw new AegisError('rate_limit','Quote limit reached. Try again later.',429);await audit(s,'owner','intents.quote_requested','Intents quote requested.');if(!t.requests.some(x=>x.id===row.id)){if(t.requests.filter(x=>x.created>Date.now()-3_600_000).length>=20)throw new AegisError('rate_limit','Quote limit reached. Try again later.',429);t.requests.push(row);}return row;});
  if(reserved.result.status!=='preview')return json(reserved);
  const response=validateQuote(reserved.result,await intentsFetch('/quote',quotePayload(reserved.result,true)),true);
  return json(await mutate(id,async s=>{const row=s.intents!.requests.find(x=>x.id===reserved.result.id)!;if(row.status==='preview'){row.quote=response;row.previewExpires=Date.now()+120_000;row.approvalFingerprint=await hash({request:row.fingerprint,minimum:response.quote.minAmountOut,expires:row.previewExpires,quote:response.correlationId??response.timestamp});}await audit(s,'owner','intents.previewed',`Live quote received for ${row.reference}. No deposit requested.`,Date.now(),row.id);return row;}));
 }
 const row=state.intents.requests.find(x=>x.id===data.id);if(!row)throw new AegisError('request','Request not found.',404);
 if(data.action==='prepare'){
  if(process.env.AEGIS_INTENTS_LIVE!=='true')throw new AegisError('disabled','Mainnet execution is disabled. Live quotes do not move funds.',409);
  const reservation=await mutate(id,async s=>{const t=s.intents!,r=t.requests.find(x=>x.id===data.id)!;if(!r.quote||!r.approvalFingerprint||r.approvalFingerprint!==data.fingerprint||!r.previewExpires||r.previewExpires<Date.now())throw new AegisError('fingerprint','Approval changed.',409);if(r.status!=='preview')throw new AegisError('state','This request was already prepared. Refresh its status.',409);checkIntent(t,r,s.paused);r.status='preparing';await audit(s,'owner','intents.approved','Exact mainnet route approved; native NEAR budget reserved.',Date.now(),r.id);return r;});
  try {const q=validateQuote(reservation.result,await intentsFetch('/quote',quotePayload(reservation.result,false)),false);if(BigInt(q.quote.minAmountOut)<BigInt(reservation.result.quote.quote.minAmountOut))throw new AegisError('market_changed','The minimum output fell below your approved quote. Request a fresh preview.',409);return json(await mutate(id,async s=>{const r=s.intents!.requests.find(x=>x.id===data.id)!;r.quote=q;r.depositAddress=q.quote.depositAddress;r.expires=Date.parse(q.quote.deadline);r.status='awaiting_deposit';return r;}));}
  catch(e){await mutate(id,async s=>{const r=s.intents!.requests.find(x=>x.id===data.id)!;r.status='failed';r.error='No deposit instructions were issued.';return null;});throw e;}
 }
 if(data.action==='origin'){
  if(!row.depositAddress)throw new AegisError('state','No authorised deposit exists.',409);await verifyOrigin(row,data.txHash);
  return json(await mutate(id,async s=>{const r=s.intents!.requests.find(x=>x.id===data.id)!;r.originTx=data.txHash;if(r.status==='awaiting_deposit')r.status='processing';await audit(s,'owner','intents.deposit_verified','Final NEAR transfer matches the authorised recipient and amount.',Date.now(),r.id);return r;}));
 }
 if(data.action==='status'){
  if(!row.depositAddress)throw new AegisError('state','This is a quote preview. No swap has started.',409);
  const status=await intentsFetch(`/status?depositAddress=${encodeURIComponent(row.depositAddress)}`);
  validateQuote(row,status.quoteResponse,false,false);
  if(status.quoteResponse.quote.minAmountOut!==row.quote.quote.minAmountOut)throw new AegisError('status','The minimum output changed.',502);
  if(status.quoteResponse.quote.depositAddress!==row.depositAddress)throw new AegisError('status','Status belongs to another deposit.',502);
  let settled=false;
  if(status.status==='SUCCESS'&&row.originTx){await verifyOrigin(row,row.originTx);settled=await verifyDestination(row,(status.swapDetails?.destinationChainTxHashes??[]).map((x:any)=>x.hash),row.quote.quote.minAmountOut);}
  return json(await mutate(id,async s=>{const r=s.intents!.requests.find(x=>x.id===data.id)!;if(settled&&r.status!=='settled'){r.status='settled';r.resolvedAt=Date.now();await audit(s,'system','intents.settled','Origin deposit and confirmed destination USDC transfer verified.',Date.now(),r.id);}else if(!['settled','refunded'].includes(r.status)&&['PROCESSING','SUCCESS','KNOWN_DEPOSIT_TX'].includes(status.status))r.status='processing';return {...r,providerStatus:status.status,destinationVerified:settled};}));
 }
 throw new AegisError('action','Unknown Intents action.');
}catch(e){return json({error:e instanceof AegisError?e.code:'provider',message:e instanceof AegisError?e.message:'The Intents request could not be completed. Refresh before retrying.'},e instanceof AegisError?e.status:502);}}
