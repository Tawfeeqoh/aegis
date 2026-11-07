import {UNIT, type Workspace, type Payment} from '@/lib/engine';

// Visual stress fixtures only. Server routing excludes these from production.
export function fixtureWorkspace(kind: string, now: number): Workspace {
  const worst = kind === 'worst' || kind === '1000';
  const count = kind === 'empty' ? 0 : kind === 'one' ? 1 : kind === '1000' ? 1000 : 36;
  const agents = [{id: 'procurement', name: worst ? 'Infrastructure procurement and vendor verification operations' : 'Procurement', role: worst ? 'Buys computing services across approved vendors; reviews invoices, renewals, and time-sensitive infrastructure requests for the whole team.' : 'Purchases compute and services', active: true, daily: 9_999_999 * UNIT}, {id: 'research', name: 'Research · Ìwádìí', role: 'Research and data subscriptions', active: false, daily: 50 * UNIT}, {id: 'operations', name: 'Operations', role: 'Recurring infrastructure', active: true, daily: 100 * UNIT}].slice(0, kind === 'empty' ? 0 : kind === 'one' ? 1 : 3);
  const payments: Payment[] = Array.from({length: count}, (_, i) => ({
    id: `fixture-${i}`, agent: agents[i % agents.length].id,
    recipient: i % 3 === 0 ? 'a'.repeat(56) + '.testnet' : 'compute.testnet',
    amount: i === count - 1 && worst ? 9_999_999 * UNIT + 999999 : i % 5 === 0 ? 1 : (i % 17 + 1) * UNIT,
    reference: i === count - 1 ? 'invoice-'.repeat(12) + '0001' : `invoice-${i + 1}`,
    memo: i === count - 1 && worst ? 'Emergency infrastructure renewal / ' + 'regional-compute-capacity-'.repeat(15) : `Compute credits ${i + 1}`,
    created: now - (count - i) * 600_000, expires: now + 1_800_000,
    settled: now - (count - i) * 600_000,
    policyVersion: 1, fingerprint: 'a9'.repeat(32),
    status: ['settled', 'blocked', 'approval', 'expired', 'rejected'][i % 5],
    reason: 'Fictional fixture for interface testing. No financial action has occurred.',
  }));
  const balance = worst ? 9_999_999 * UNIT + 999999 : 500 * UNIT - payments.filter(p => p.status === 'settled').reduce((n, p) => n + p.amount, 0);
  return {name: 'UI review fixture', balance, initial: balance + payments.filter(p => p.status === 'settled').reduce((n, p) => n + p.amount, 0), agents, payments, paused: false, policy: {version: 1, daily: 9_999_999 * UNIT, perPayment: 9_999_999 * UNIT, approvalAbove: 25 * UNIT, ttlMinutes: 30, recipients: ['compute.testnet', 'research.testnet', 'storage.testnet']}, audit: Array.from({length: count ? 38 : 0}, (_, i) => ({id: `audit-${i}`, time: now - i * 60_000, actor: 'procurement', action: 'payment.settled', detail: worst ? 'Unbroken-reference-'.repeat(20) : 'Fictional sandbox payment recorded for visual testing.', request: payments[i % payments.length].id, previous: 'fixture', hash: 'b7'.repeat(32)})), lab: null, nearContract: 'treasury.aegis-hack10-261106.testnet', nearOwner: 'aegis-hack10-261106.testnet'};
}
