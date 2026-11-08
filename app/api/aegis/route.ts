import {workspaceId,mutate,read,rpc} from '@/lib/store';
import {AegisError,amount,request,approve,policy,audit,expire,lab,verify,hash} from '@/lib/engine';
import {randomBytes} from 'node:crypto';
import {governedPayment} from '@/lib/governed-payment';
export const dynamic='force-dynamic';export const maxDuration=60;
const json=(x:unknown,status=200)=>Response.json(x,{status,headers:{'Cache-Control':'no-store'}});
const fail=(e:unknown)=>json({error:e instanceof AegisError?e.code:'invalid_request',message:e instanceof AegisError?e.message:e instanceof SyntaxError?'Invalid request body.':'The operation could not be completed. Please retry.'},e instanceof AegisError?e.status:400);
export async function GET(){try{return json(await mutate(await workspaceId(),async s=>{await expire(s);return null;}));}catch(e){return fail(e);}}
export async function POST(req:Request){try{
 const origin=req.headers.get('origin');if(origin&&new URL(origin).host!==req.headers.get('host'))throw new AegisError('origin','This action must originate from your workspace.',403);
 const text=await req.text();if(text.length>16000)throw new AegisError('too_large','Request is too large.',413);const data=JSON.parse(text),id=await workspaceId(),now=Date.now();
 if(data.action==='lab'){
  const results=await lab(now),testId=`lab:${randomBytes(24).toString('hex')}`;
  try{await mutate(testId,async s=>{s.agents.forEach(a=>a.daily=100_000_000);return null;});const runs=await Promise.all(['procurement','research'].map(agent=>mutate(testId,s=>request(s,{agent,recipient:'compute.testnet',amount:'60',reference:`race-${agent}`},agent,now))));const states=runs.map(r=>r.result.payment.status);results.push({id:'race',title:'Concurrent database requests',passed:states.filter(x=>x==='approval').length===1&&states.filter(x=>x==='blocked').length===1,expected:'One 60 USD reservation against a shared cap of 100',observed:states.join(' + ')});}finally{await rpc('lab_cleanup',{p_workspace:testId});}
  return json(await mutate(id,async s=>{s.lab={time:now,results};await audit(s,'owner','lab.completed',`${results.filter(x=>x.passed).length}/${results.length} isolated checks passed, including concurrent database writes.`,now);return s.lab;}));
 }
 if(data.action==='credential'){const {state}=await read(id);if(!state.agents.some(a=>a.id===data.agent&&a.active))throw new AegisError('agent','Choose an active agent.');const token=`aegis_${randomBytes(32).toString('hex')}`,expires=now+7*86_400_000;await rpc('credential_create',{p_workspace:id,p_digest:await hash(token),p_agent:data.agent,p_expires:expires});const result=await mutate(id,async s=>audit(s,'owner','credential.issued',`Seven-day scoped credential issued for ${data.agent}.`,now));return json({...result,token,expires});}
 if(data.action==='payment')return json(await governedPayment(id,data.payment,'owner'));
 return json(await mutate(id,async s=>{switch(data.action){
  case 'risk-mode':{s.riskRequired=data.required===true;await audit(s,'owner','risk.mode_changed',s.riskRequired?'Context reviews enabled; warnings and unavailable reviews require owner approval.':'Context reviews disabled. Deterministic financial rules still apply.',now);return null;}
  case 'approval':return approve(s,data.id,data.fingerprint,data.approve===true,'owner',now);
  case 'policy':await policy(s,data.policy,now);return null;
  case 'pause':s.paused=data.paused===true;await audit(s,'owner',s.paused?'treasury.paused':'treasury.resumed',s.paused?'New execution blocked. Completed transfers cannot be reversed.':'Treasury resumed.',now);return null;
  case 'agent-toggle':{const a=s.agents.find(a=>a.id===data.id);if(!a)throw new AegisError('agent','Agent not found.');a.active=!a.active;await audit(s,'owner',a.active?'agent.resumed':'agent.revoked',`${a.name} authorization ${a.active?'restored':'revoked'}.`,now);return null;}
  case 'agent-create':{if(s.agents.length>=20)throw new AegisError('capacity','This prototype supports up to 20 agents.');if(typeof data.name!=='string'||!data.name.trim()||data.name.length>60)throw new AegisError('name','Enter a name of up to 60 characters.');s.agents.push({id:crypto.randomUUID(),name:data.name.trim(),role:String(data.role??'Custom agent').slice(0,140),active:true,daily:amount(data.daily)});await audit(s,'owner','agent.created',`${data.name.trim()} registered.`,now);return null;}
  case 'verify':return verify(s.audit);
  case 'near-config':{const valid=(x:unknown)=>typeof x==='string'&&/^[a-z0-9][a-z0-9._-]{1,62}[a-z0-9]$/.test(x)&&x.endsWith('.testnet');if(!valid(data.contract)||!valid(data.owner))throw new AegisError('account','Use named accounts ending in .testnet.');s.nearContract=data.contract;s.nearOwner=data.owner;await audit(s,'owner','near.configured',`Testnet contract configured: ${data.contract}. Read it to verify live state.`,now);return null;}
  default:throw new AegisError('action','Unknown action.');
 }}));
 }catch(e){return fail(e);}}

