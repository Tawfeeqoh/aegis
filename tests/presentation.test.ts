import test from 'node:test';
import assert from 'node:assert/strict';
import {UNIT,DAY,createWorkspace,request} from '../lib/engine.ts';
import {money,paymentPreview,spendingBins} from '../lib/presentation.ts';
const now=1_800_000_000_000;
test('spending chart reconciles exact amounts and excludes pending, blocked, future and old requests',async()=>{
  const s=await createWorkspace(now);
  const base={agent:'procurement',recipient:'compute.testnet',amount:'12',reference:'first'};
  await request(s,base,'owner',now-DAY);
  await request(s,{...base,reference:'second',amount:'0.000001'},'owner',now-1);
  await request(s,{...base,reference:'pending',amount:'30'},'owner',now);
  await request(s,{...base,reference:'blocked',recipient:'attacker.testnet'},'owner',now);
  const bins=spendingBins(s.payments,1,now);
  assert.equal(bins.length,6);assert.equal(bins[0].amount,12*UNIT);assert.equal(bins[5].amount,1);
  assert.equal(bins.reduce((n,b)=>n+b.amount,0),12*UNIT+1);
  assert.equal(spendingBins(s.payments,1,now+DAY+1).reduce((n,b)=>n+b.amount,0),0);
});
test('money display preserves sub-cent and six-decimal amounts',()=>{
  assert.equal(money(1),'0.000001');assert.equal(money(12*UNIT+1),'12.000001');assert.equal(money(12*UNIT),'12.00');
});
test('live preview follows the authority boundary without changing balances',async()=>{
  const s=await createWorkspace(now),base={agent:'procurement',recipient:'compute.testnet',amount:'12'};
  assert.equal(paymentPreview(s,base,now).status,'settled');
  assert.equal(paymentPreview(s,{...base,amount:'30'},now).status,'approval');
  assert.equal(paymentPreview(s,{...base,recipient:'attacker.testnet'},now).status,'blocked');
  await request(s,{...base,amount:'60',reference:'reserved'},'owner',now);
  assert.equal(paymentPreview(s,{...base,amount:'41'},now).status,'blocked');
  assert.equal(paymentPreview(s,{...base,reference:'reserved'},now).title,'This reference has been used');
  assert.equal(s.balance,500*UNIT);
});
