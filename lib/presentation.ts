import {DAY, UNIT, amount, usage, type Workspace, type Payment} from './engine.ts';

export const money = (value: number) => (value / UNIT).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 6});
export const clock = (value: number) => new Date(value).toLocaleString('en-GB', {timeZone: 'Africa/Lagos', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'});
export const timeOnly = (value: number) => new Date(value).toLocaleTimeString('en-GB', {timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit'});
export const paymentStatus = (payment: Payment, now: number) => payment.status === 'approval' && payment.expires <= now ? 'expired' : payment.status;

export function spendingBins(payments: Payment[], days: 1 | 7, now: number) {
  const count = days === 1 ? 6 : 7;
  const span = days * DAY / count;
  const start = now - days * DAY;
  const bins = Array.from({length: count}, (_, i) => ({
    start: start + i * span,
    end: start + (i + 1) * span,
    amount: 0,
    count: 0,
  }));
  for (const payment of payments) {
    const at = payment.settled ?? payment.created;
    if (payment.status !== 'settled' || at < start || at > now) continue;
    const index = Math.min(count - 1, Math.floor((at - start) / span));
    bins[index].amount += payment.amount;
    bins[index].count++;
  }
  return bins;
}

export function paymentPreview(s: Workspace, input: {agent: string; recipient: string; amount: string; reference?: string}, now: number) {
  if (input.reference && s.payments.some(p => p.agent === input.agent && p.reference === input.reference)) return {status: 'draft', title: 'This reference has been used', detail: 'Unchanged details return the original decision. Changed details will be refused.'};
  let value: number;
  try { value = amount(input.amount); } catch { return {status: 'draft', title: 'Enter an amount', detail: 'Use a positive amount, with up to six decimal places.'}; }
  const agent = s.agents.find(a => a.id === input.agent);
  const reserved = s.payments.filter(p => paymentStatus(p, now) === 'approval').reduce((n, p) => n + p.amount, 0);
  const reason = s.paused ? 'The treasury is paused.'
    : !agent?.active ? 'This agent has no active authorization.'
    : !s.policy.recipients.includes(input.recipient) ? 'This recipient is not on your allowlist.'
    : value > s.policy.perPayment ? 'This exceeds the hard payment cap.'
    : usage(s, now) + value > s.policy.daily ? 'This exceeds the shared 24-hour budget.'
    : usage(s, now, agent.id) + value > agent.daily ? 'This exceeds the agent’s 24-hour budget.'
    : value + reserved > s.balance ? 'There are not enough unreserved funds.' : '';
  return reason ? {status: 'blocked', title: 'Will be blocked', detail: reason}
    : value > s.policy.approvalAbove ? {status: 'approval', title: 'Your approval is required', detail: `${money(value)} demo USD will be reserved for this request.`}
    : s.riskRequired ? {status: 'draft', title: 'Context review comes next', detail: 'A warning or unavailable review requires your approval before the ledger can be debited.'}
    : {status: 'settled', title: 'Within the current rules', detail: 'Can settle automatically in the demo ledger.'};
}

export function downloadJson(data: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'}));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
