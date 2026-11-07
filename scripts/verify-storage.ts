import assert from 'node:assert/strict';import {mutate,read,rpc} from '../lib/store.ts';import {request,usage,UNIT} from '../lib/engine.ts';
const id=`lab:integration-${crypto.randomUUID()}`;
try{
 await assert.rejects(rpc('read',{p_auth:'invalid',p_workspace:id,p_state:{}}));
 console.log('PASS: invalid gateway authorization rejected');
 await mutate(id,async s=>{s.agents.forEach(a=>a.daily=100*UNIT);return null;});
 const results=await Promise.all(['procurement','research'].map(agent=>mutate(id,s=>request(s,{agent,recipient:'compute.testnet',amount:'60',reference:`concurrent-${agent}`},agent))));
 const statuses=results.map(x=>x.result.payment.status);assert.equal(statuses.filter(x=>x==='approval').length,1);assert.equal(statuses.filter(x=>x==='blocked').length,1);const {state}=await read(id);assert.equal(usage(state),60*UNIT);assert.equal(state.balance,500*UNIT);
 console.log('PASS: concurrent requests reserve only 60 against a shared cap of 100');
 const first=state.payments.find(p=>p.status==='approval')!;const replay=await mutate(id,s=>request(s,{agent:first.agent,recipient:first.recipient,amount:'60',reference:first.reference,memo:first.memo},first.agent));assert.equal(replay.result.replay,true);assert.equal(replay.state.balance,500*UNIT);
 console.log('PASS: persisted retry returns original result without another reservation');
}finally{await rpc('lab_cleanup',{p_workspace:id});}
