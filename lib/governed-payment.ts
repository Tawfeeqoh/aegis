import {audit, hash, request, type Workspace} from './engine.ts';
import {mutate, read} from './store.ts';
import {reviewRisk, unavailableRisk, type RiskReview} from './near-ai.ts';

// Provider calls run outside CAS retries. A persisted lease bounds paid inference
// and prevents the same request from triggering a call on every database retry.
export async function governedPayment(workspace: string, input: any, actor: string) {
  const {state} = await read(workspace);
  const now = Date.now();
  const probe = await request(structuredClone(state), input, actor, now);
  if (!state.riskRequired || probe.payment.status === 'blocked' || probe.replay) return mutate(workspace, s => request(s, input, actor));
  const key = await hash({agent: input.agent, recipient: input.recipient, amount: input.amount, reference: input.reference, memo: input.memo ?? ''});
  const lease = await mutate(workspace, async s => {
    s.riskReviews ??= [];
    const prior = s.riskReviews.find(r => r.key === key);
    if (prior) return {run: false, review: prior.review};
    if (s.riskReviews.filter(r => r.created > now - 3_600_000).length >= 12) return {run: false, review: unavailableRisk('Hourly risk-review limit reached. Owner review is required.')};
    s.riskReviews.push({key, created: now});
    await audit(s, actor, 'risk.requested', 'Context review requested from NEAR AI Cloud.', now);
    return {run: true, review: undefined};
  });
  let review: RiskReview = lease.result.review ?? unavailableRisk('A review for this request is in progress. Owner review is required.');
  if (lease.result.run) {
    const agent = state.agents.find(a => a.id === input.agent)!;
    review = await reviewRisk({agent: agent.name, responsibility: agent.role, recipient: input.recipient, amount: input.amount, memo: String(input.memo ?? '').slice(0, 500), recentPayments: state.payments.filter(p => p.agent === input.agent && p.created > now - 3_600_000).length});
    await mutate(workspace, async s => {const row = s.riskReviews?.find(r => r.key === key); if (row) row.review = review; return null;});
  }
  return mutate(workspace, s => request(s, input, actor, Date.now(), review));
}
