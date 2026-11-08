"use client";

import {useState} from 'react';
import {ArrowDown, Check, RotateCcw, ShieldCheck, X} from 'lucide-react';
import {approveExample, exampleDollars, exampleRules, examples, runExample, type ExampleId} from '@/lib/public-demo';

type ExampleResult = Awaited<ReturnType<typeof runExample>>;

export default function PolicyExample() {
  const [selected, setSelected] = useState<ExampleId>('allowed');
  const [evaluation, setEvaluation] = useState<ExampleResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const proposal = examples.find(example => example.id === selected)!;
  const payment = evaluation?.result.payment;
  const replay = evaluation?.result.replay;
  const title = !payment ? 'Ready to check' : replay ? 'Same invoice. One debit.' : payment.status === 'blocked' ? 'Recipient blocked' : payment.status === 'approval' ? 'Your approval is needed' : 'Payment allowed';

  async function evaluate() {
    setBusy(true); setError('');
    try {setEvaluation(await runExample(selected));}
    catch {setError('This example could not run. Try it in the workspace.');}
    finally {setBusy(false);}
  }

  async function approve() {
    if (!evaluation || !payment) return;
    setBusy(true); setError('');
    try {setEvaluation(await approveExample(evaluation.state, payment.id, payment.fingerprint));}
    catch {setError('The approval could not be completed. Run the example again.');}
    finally {setBusy(false);}
  }

  return <div className="policy-example glass" data-ui>
    <div className="example-heading"><span><ShieldCheck size={19}/>Try the rules</span><span>Fictional USD</span></div>
    <div className="example-options" role="group" aria-label="Payment scenario">{examples.map(example => <button key={example.id} type="button" aria-pressed={selected === example.id} disabled={busy} onClick={() => {setSelected(example.id); setEvaluation(null); setError('');}}>{example.label}</button>)}</div>
    <div className="example-request" key={selected}>
      <div><span>Procurement agent</span><strong>{proposal.amount}<small>demo USD</small></strong></div>
      <dl><div><dt>Pay</dt><dd>{proposal.recipient}</dd></div><div><dt>For</dt><dd>Compute credits</dd></div><div><dt>Invoice</dt><dd>compute-208</dd></div></dl>
    </div>
    <div className="example-guard"><ArrowDown size={16}/><span>{exampleRules.daily} USD / day<span>Approval above {exampleRules.approvalAbove} USD</span></span><ShieldCheck size={17}/></div>
    <button className="public-button example-submit" disabled={busy} onClick={evaluate}>{busy ? 'Checking…' : evaluation ? 'Run this example again' : 'Check request'}<ArrowDown size={16}/></button>
    <div className={`example-result ${payment?.status ?? 'ready'}`} aria-live="polite" aria-atomic="true">
      <span className="example-result-symbol">{payment?.status === 'blocked' ? <X size={19}/> : replay ? <RotateCcw size={18}/> : <Check size={18}/>}</span>
      <div><strong>{title}</strong><p>{!payment ? 'Choose a request and see what the policy allows.' : replay ? 'The original result was returned. The ledger was debited once.' : payment.status === 'blocked' ? 'This recipient is not on the approved list. No debit.' : payment.status === 'approval' ? '30 USD is reserved for this exact request.' : 'The request passed the rules. The demo ledger was debited.'}</p>
        {payment?.status === 'approval' && <button className="example-approve" disabled={busy} onClick={approve}>Approve this example<Check size={14}/></button>}
      </div>
    </div>
    {evaluation && <div className="example-balance"><span>Example balance</span><strong>{exampleDollars(evaluation.state.balance)} USD</strong></div>}
    {error && <p role="alert" className="example-error">{error}</p>}
    <p className="example-caption">Runs the same policy engine as the workspace. Each scenario starts with a fresh example ledger.</p>
  </div>;
}
