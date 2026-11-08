"use client";
import {useState} from 'react';
import {Check, Copy, Fingerprint, KeyRound, LockKeyhole, Plus, ShieldCheck} from 'lucide-react';
import {decimal, type Workspace, type Payment} from '@/lib/engine';
import {clock, money, paymentPreview, paymentStatus} from '@/lib/presentation';
import {Badge} from './ui-kit';

export type Action = (action: string, data?: Record<string, unknown>, message?: string) => Promise<any>;

export function PaymentForm({s, now, busy, submit}: {s: Workspace; now: number; busy: boolean; submit: (payment: Record<string, FormDataEntryValue>) => void}) {
  const [input, setInput] = useState({agent: s.agents[0]?.id ?? '', recipient: s.policy.recipients[0] ?? '', amount: '12.00', reference: `invoice-${Date.now().toString(36)}`});
  const preview = paymentPreview(s, input, now);
  return <form className="stack-form" onSubmit={e => {e.preventDefault(); submit(Object.fromEntries(new FormData(e.currentTarget)));}}>
    <label>Requesting agent<select name="agent" value={input.agent} onChange={e => setInput({...input, agent: e.target.value})}>{s.agents.map(a => <option value={a.id} key={a.id}>{a.name}{a.active ? '' : ' (revoked)'}</option>)}</select></label>
    <div className="form-row"><label>Amount · demo USD<input name="amount" inputMode="decimal" value={input.amount} onChange={e => setInput({...input, amount: e.target.value})} required autoComplete="off"/></label><label>Recipient<input name="recipient" value={input.recipient} onChange={e => setInput({...input, recipient: e.target.value})} required maxLength={64} autoCapitalize="none" spellCheck={false} autoComplete="off" list="approved-recipients"/></label></div>
    <datalist id="approved-recipients">{s.policy.recipients.map(r => <option key={r} value={r}/>)}</datalist>
    <label>Purpose<input name="memo" defaultValue="Compute credits" maxLength={500} placeholder="What is this payment for?"/></label>
    <label>Request reference<input name="reference" value={input.reference} onChange={e => setInput({...input, reference: e.target.value})} maxLength={100} required autoCapitalize="none" spellCheck={false} autoComplete="off"/><small>Retry with the same reference and details to avoid another debit.</small></label>
    <div className={`payment-preview ${preview.status}`} aria-live="polite"><ShieldCheck size={20}/><div><strong>{preview.title}</strong><p>{preview.detail}</p><small>Preview only. Rules are checked again on submission.</small></div></div>
    <button className="btn primary wide" disabled={busy}>{busy ? <span className="spinner"/> : <ShieldCheck size={16}/>}Evaluate payment</button>
  </form>;
}

export function AgentForm({busy, submit}: {busy: boolean; submit: (data: Record<string, FormDataEntryValue>) => void}) {
  return <form className="stack-form" onSubmit={e => {e.preventDefault(); submit(Object.fromEntries(new FormData(e.currentTarget)));}}><label>Agent name<input name="name" required maxLength={60} placeholder="e.g. Vendor research"/></label><label>Responsibility<input name="role" required maxLength={140} placeholder="What should this agent handle?"/></label><label>24-hour budget · demo USD<input type="number" inputMode="decimal" name="daily" min="0.01" step="0.01" defaultValue="50" required/></label><button className="btn primary wide" disabled={busy}>{busy ? <span className="spinner"/> : <Plus size={16}/>}Register agent</button></form>;
}

export function PaymentDetail({p, s, now, busy, act}: {p: Payment; s: Workspace; now: number; busy: boolean; act: Action}) {
  const status = paymentStatus(p, now);
  const [copied, setCopied] = useState(false);
  return <><div className="payment-detail-lead"><div className="payment-amount">{money(p.amount)}<span>demo USD</span></div><Badge status={status}/></div><p className="decision-reason">{status === 'expired' && p.status === 'approval' ? 'The approval window has ended. Refresh the treasury to release the reservation.' : p.reason}</p><dl className="details">{[['Recipient', p.recipient], ['Agent', s.agents.find(a => a.id === p.agent)?.name ?? p.agent], ['Reference', p.reference], ['Policy', `Version ${p.policyVersion}`], ['Created', `${clock(p.created)} WAT`], ...(p.status === 'approval' ? [['Approval expires', `${clock(p.expires)} WAT`]] : [])].map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>{p.risk&&<div className="risk-review"><div className="section-head"><strong>Context review</strong><span className="badge">{p.risk.level}</span></div><p>{p.risk.summary}</p>{p.risk.signals.map((signal,i)=><small key={i}>{signal}</small>)}<small>NEAR AI Cloud · {p.risk.model}. Hardware attestation has not been verified.</small></div>}<div className="fingerprint"><div><span><Fingerprint size={14}/>Request fingerprint</span><button className="icon-btn" aria-label="Copy request fingerprint" onClick={async () => {try {await navigator.clipboard.writeText(p.fingerprint); setCopied(true); setTimeout(() => setCopied(false), 2000);} catch {setCopied(false);}}}>{copied ? <Check size={14}/> : <Copy size={14}/>}</button></div><code>{p.fingerprint}</code></div>{status === 'approval' && <div className="modal-actions"><button className="btn" disabled={busy} onClick={() => act('approval', {id: p.id, fingerprint: p.fingerprint, approve: false}, 'Request rejected. Reserved funds released.')}>Reject request</button><button className="btn primary" disabled={busy || s.paused} onClick={() => act('approval', {id: p.id, fingerprint: p.fingerprint, approve: true}, 'Request approved. Demo payment settled.')}><Check size={16}/>Approve this request</button></div>}<p className="fine-print"><LockKeyhole size={13}/>Demo ledger only. This does not transfer real money.</p></>;
}

export function Credential({token, notify}: {token: string; notify: (text: string) => void}) {
  return <><div className="notice"><KeyRound size={17}/>Shown once. Expires in seven days. Revoking the agent blocks this credential immediately.</div><pre className="token-value">{token}</pre><button className="btn primary wide" onClick={async () => {try {await navigator.clipboard.writeText(token); notify('Credential copied.');} catch {notify('Select and copy the credential above.');}}}><Copy size={15}/>Copy credential</button><p className="fine-print">Authorizes sandbox requests only. It cannot sign a blockchain transaction or change policy.</p></>;
}

export function PolicyForm({s, busy, save}: {s: Workspace; busy: boolean; save: (p: Record<string, unknown>) => void}) {
  const [dirty, setDirty] = useState(false);
  return <form className="policy-form" key={s.policy.version} onChange={() => setDirty(true)} onSubmit={e => {e.preventDefault(); const p = Object.fromEntries(new FormData(e.currentTarget)); save({...p, recipients: String(p.recipients).split('\n').map(x => x.trim()).filter(Boolean)});}}><div className="policy-version"><span className="status-text"><i/>Policy v{s.policy.version}</span><span><LockKeyhole size={13}/>Owner access</span></div>
    <section className="settings-section"><div><span className="settings-index">01</span><h2>Spending limits</h2><p>Shared and per-payment limits apply to every request, including those you approve.</p></div><div className="glass settings-fields"><label>Shared 24-hour budget · demo USD<input name="daily" type="number" inputMode="decimal" min="0.01" step="0.01" defaultValue={decimal(s.policy.daily)} required/></label><div className="form-row"><label>Hard payment cap<input name="perPayment" type="number" inputMode="decimal" min="0.01" step="0.01" defaultValue={decimal(s.policy.perPayment)} required/></label><label>Approval above<input name="approvalAbove" type="number" inputMode="decimal" min="0.01" step="0.01" defaultValue={decimal(s.policy.approvalAbove)} required/></label></div><div className="field-note"><ShieldCheck size={14}/>Pending approvals count toward these budgets.</div></div></section>
    <section className="settings-section"><div><span className="settings-index">02</span><h2>Approved recipients</h2><p>Only exact matches can receive a payment. Agents cannot change this list.</p></div><div className="glass settings-fields"><label>One account per line<textarea name="recipients" rows={5} defaultValue={s.policy.recipients.join('\n')} required spellCheck={false} autoCapitalize="none"/></label><small>{s.policy.recipients.length} {s.policy.recipients.length === 1 ? 'recipient' : 'recipients'} currently approved</small></div></section>
    <section className="settings-section"><div><span className="settings-index">03</span><h2>Approval window</h2><p>Requests expire automatically. Changing any rule invalidates pending approvals.</p></div><div className="glass settings-fields"><label>Expire after · minutes<input name="ttlMinutes" type="number" inputMode="numeric" min="1" max="1440" defaultValue={s.policy.ttlMinutes} required/></label><small>Between 1 minute and 24 hours.</small></div></section>
    <div className="settings-save"><span>{dirty ? 'You have unsaved changes.' : `Policy v${s.policy.version} is saved.`}</span><button className="btn primary" disabled={busy || !dirty}>{busy ? <span className="spinner"/> : <Check size={16}/>}Save policy</button></div>
  </form>;
}

