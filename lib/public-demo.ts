import {approve, createWorkspace, policy, request, UNIT, type Workspace} from './engine.ts';

export const exampleRules = {daily: '100', perPayment: '100', approvalAbove: '25', recipients: ['compute.testnet'], ttlMinutes: 30};
export const examples = [
  {id: 'allowed', label: 'Within budget', amount: '12', recipient: 'compute.testnet'},
  {id: 'recipient', label: 'Wrong recipient', amount: '12', recipient: 'unknown.testnet'},
  {id: 'approval', label: 'Needs approval', amount: '30', recipient: 'compute.testnet'},
  {id: 'replay', label: 'Same invoice twice', amount: '12', recipient: 'compute.testnet'},
] as const;
export type ExampleId = typeof examples[number]['id'];

export async function runExample(id: ExampleId) {
  const selected = examples.find(example => example.id === id)!;
  const state = await createWorkspace();
  await policy(state, exampleRules);
  const input = {agent: 'procurement', amount: selected.amount, recipient: selected.recipient, reference: 'compute-208', memo: 'Compute credits'};
  let result = await request(state, input, 'procurement');
  if (id === 'replay') result = await request(state, input, 'procurement');
  return {state, result};
}

export async function approveExample(state: Workspace, id: string, fingerprint: string) {
  const next = structuredClone(state);
  const payment = await approve(next, id, fingerprint, true, 'owner');
  return {state: next, result: {payment, replay: false, conflict: false}};
}

export const exampleDollars = (value: number) => (value / UNIT).toFixed(2);
