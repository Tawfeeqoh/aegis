"use client";
import {useMemo, useState} from 'react';
import NumberFlow from '@number-flow/react';
import {ArrowRight, ArrowUpRight, Check, ChevronRight, Fingerprint, FlaskConical, LockKeyhole, ShieldCheck} from 'lucide-react';
import {DAY, UNIT, usage, type Payment, type Workspace} from '@/lib/engine';
import {clock, money, spendingBins, timeOnly} from '@/lib/presentation';
import {Badge, Mark, PaymentList, SectionHead} from './ui-kit';

type Destination = 'Overview' | 'Agents' | 'Payments' | 'Policies' | 'Attack lab' | 'Audit log' | 'Developer';
export default function Overview({s, now, select, go, create, runLab, busy}: {s: Workspace; now: number; select: (p: Payment) => void; go: (v: Destination, filter?: string) => void; create: () => void; runLab: () => void; busy: boolean}) {
  const pending = s.payments.filter(p => p.status === 'approval' && p.expires > now);
  const reserved = pending.reduce((n, p) => n + p.amount, 0);
  const used = usage(s, now);
  const settled24 = s.payments.filter(p => p.status === 'settled' && (p.settled ?? p.created) > now - DAY).reduce((n, p) => n + p.amount, 0);
  const metrics = [
    {title: 'Active agents', value: s.agents.filter(a => a.active).length, note: `of ${s.agents.length} registered`, view: 'Agents' as const},
    {title: 'Awaiting approval', value: pending.length, note: `${money(reserved)} USD reserved`, view: 'Payments' as const, filter: 'approval'},
    {title: 'Settled payments', value: s.payments.filter(p => p.status === 'settled').length, note: 'in this workspace', view: 'Payments' as const, filter: 'settled'},
    {title: 'Blocked requests', value: s.payments.filter(p => p.status === 'blocked').length, note: 'stopped by your rules', view: 'Payments' as const, filter: 'blocked'},
  ];
  return <>
    <div className="overview-grid">
      <section className="glass balance-panel">
        <div className="panel-top"><span>Treasury balance</span><span className="quiet-tag">Demo USD</span></div>
        <div className="balance-figure" data-long={money(s.balance).length > 12}><NumberFlow value={s.balance / UNIT} locales="en-US" format={{minimumFractionDigits: 2, maximumFractionDigits: 6}} transformTiming={{duration: 280, easing: 'cubic-bezier(.23,1,.32,1)'}}/><span>USD</span></div>
        <div className="balance-context"><span className="dot"/>{money(s.balance - reserved)} available to spend</div>
        <div className="balance-facts" data-long={money(settled24).length > 10 || money(reserved).length > 10}><div><span>Reserved</span><strong>{money(reserved)}<small>USD</small></strong></div><div><span>Spent in 24h</span><strong>{money(settled24)}<small>USD</small></strong></div></div>
        <div className="budget-block"><div className="budget-caption"><span>Shared 24-hour budget</span><span>{money(used)} <small>/ {money(s.policy.daily)}</small></span></div><div className="budget-track" role="meter" aria-label="Shared 24-hour budget used" aria-valuemin={0} aria-valuemax={s.policy.daily / UNIT} aria-valuenow={used / UNIT} aria-valuetext={`${money(used)} of ${money(s.policy.daily)} demo USD`}><span style={{transform: `scaleX(${Math.min(1, used / s.policy.daily)})`}}/></div><div className="budget-footer"><span>{money(Math.max(0, s.policy.daily - used))} USD left</span><button className="text-btn" onClick={() => go('Policies')}>Edit limits<ChevronRight size={13}/></button></div></div>
      </section>
      <SpendingChart payments={s.payments} now={now}/>
    </div>
    <div className="summary-strip glass">{metrics.map(metric => <button key={metric.title} onClick={() => go(metric.view, metric.filter)}><span className="metric-label">{metric.title}<ArrowUpRight size={14}/></span><strong>{metric.value}</strong><small>{metric.note}</small></button>)}</div>
    {pending.length > 0 && <div className="approval-strip"><LockKeyhole size={20}/><div><strong>{pending.length} {pending.length === 1 ? 'payment needs' : 'payments need'} your approval</strong><p>{money(reserved)} demo USD is reserved until you decide or the requests expire.</p></div><button className="btn" onClick={() => go('Payments', 'approval')}>Review<ArrowRight size={15}/></button></div>}
    <div className="lower-grid">
      <section className="glass recent-panel"><SectionHead title="Recent payments" sub="The latest requests from your agents." action={<button className="text-btn" onClick={() => go('Payments')}>View all<ArrowUpRight size={15}/></button>}/><PaymentList rows={[...s.payments].reverse().slice(0, 4)} state={s} now={now} select={select} create={create}/></section>
      <Authority s={s} go={go}/>
    </div>
    <div className="bottom-grid">
      <section className="glass agents-preview"><SectionHead title="Agent budgets" sub="Each agent has its own limit." action={<button className="icon-btn" aria-label="Manage agents" onClick={() => go('Agents')}><ArrowUpRight size={18}/></button>}/><div className="agent-preview-list">{!s.agents.length && <p className="fine-print">No agents registered. Open Agents to assign the first budget.</p>}{s.agents.slice(0, 3).map(a => <button className="agent-preview" key={a.id} onClick={() => go('Agents')}><span className="agent-monogram">{a.name.slice(0, 2).toUpperCase()}</span><span className="agent-preview-name"><strong>{a.name}</strong><span className="mini-track"><i style={{transform: `scaleX(${Math.min(1, usage(s, now, a.id) / a.daily)})`}}/></span></span><span className="agent-preview-amount">{money(usage(s, now, a.id))}<small> / {money(a.daily)} USD</small></span>{!a.active && <Badge status="revoked"/>}<ChevronRight size={14}/></button>)}</div></section>
      <section className="glass lab-prompt"><div className="lab-art" aria-hidden="true"><div/><div/><Mark/></div><div className="lab-prompt-copy"><span className="lab-label"><FlaskConical size={15}/>Attack lab</span><h2>Try to break your rules.</h2><p>Duplicate requests. Swapped recipients. Competing agents. See what gets through.</p><button className="btn" disabled={busy} onClick={runLab}>{busy ? <span className="spinner"/> : <FlaskConical size={15}/>}Run security checks<ArrowUpRight size={15}/></button><small>{s.lab ? `${s.lab.results.filter(r => r.passed).length}/${s.lab.results.length} passed · ${clock(s.lab.time)} WAT` : '13 isolated checks · no funds moved'}</small></div></section>
    </div>
  </>;
}

function SpendingChart({payments, now}: {payments: Payment[]; now: number}) {
  const [days, setDays] = useState<1 | 7>(1);
  const [selected, setSelected] = useState<number | null>(null);
  const bins = useMemo(() => spendingBins(payments, days, now), [payments, days, now]);
  const total = bins.reduce((n, b) => n + b.amount, 0);
  const count = bins.reduce((n, b) => n + b.count, 0);
  const max = Math.max(10, ...bins.map(b => b.amount / UNIT));
  const scale = Math.ceil(max / 10) * 10;
  const current = selected === null ? null : bins[selected];
  const label = (value: number) => days === 1 ? timeOnly(value) : new Date(value).toLocaleDateString('en-GB', {timeZone: 'Africa/Lagos', day: '2-digit', month: 'short'});
  const axis = (value:number) => value.toLocaleString('en-US',{notation:'compact',maximumFractionDigits:1});
  return <section className="glass spending-panel"><div className="panel-top"><span>Settled spending</span><div className="segmented" aria-label="Spending period">{([1, 7] as const).map(d => <button key={d} aria-pressed={days === d} onClick={() => {setDays(d); setSelected(null);}}>{d === 1 ? '24 hours' : '7 days'}</button>)}</div></div><div className="chart-headline" data-long={money(total).length > 12}><strong>{money(total)}<small>USD</small></strong><span>{count} {count === 1 ? 'payment' : 'payments'}</span></div>
    <div className="spending-chart"><div className="chart-scale" aria-hidden="true"><span>{axis(scale)}</span><span>{axis(scale / 2)}</span><span>0</span></div><div className="chart-plot"><div className="chart-grid" aria-hidden="true"><i/><i/><i/></div><div className="chart-columns">{bins.map((bin, i) => <button key={bin.start} aria-label={`${clock(bin.start)} to ${timeOnly(bin.end)} WAT: ${money(bin.amount)} demo USD, ${bin.count} ${bin.count === 1 ? 'payment' : 'payments'}`} aria-pressed={selected === i} onClick={() => setSelected(selected === i ? null : i)} className={selected === i ? 'selected' : ''}><span className="column-space"><i className="chart-bar" style={{transform: `scaleY(${bin.amount / UNIT / scale})`}}/><i className="column-hit"/></span><span className="column-label">{label(bin.start)}</span></button>)}</div></div></div>
    <div className="chart-insight" aria-live="polite">{current ? <><span>{label(current.start)}–{label(current.end)} WAT</span><strong>{money(current.amount)} USD · {current.count} {current.count === 1 ? 'payment' : 'payments'}</strong></> : <><span>{total === 0 ? 'No settled payments in this period.' : 'Select a column to inspect a period.'}</span><span>WAT · demo ledger</span></>}</div>
  </section>;
}

function Authority({s, go}: {s: Workspace; go: (v: Destination) => void}) {
  const [step, setStep] = useState(1);
  const steps = [{name: 'Agent', icon: Fingerprint, detail: `${s.agents.filter(a => a.active).length} active agents. Credentials can request payments; they cannot change your rules.`}, {name: 'Policy', icon: ShieldCheck, detail: `Up to ${money(s.policy.perPayment)} USD per payment. Above ${money(s.policy.approvalAbove)} USD needs your approval.`}, {name: 'Ledger', icon: Check, detail: 'Approved demo payments debit the ledger once. Every decision adds an audit entry.'}];
  return <section className="glass authority-panel"><div className="panel-top"><span>Payment route</span><span className={`status-text ${s.paused ? 'paused' : ''}`}><i/>{s.paused ? 'Paused' : 'Rules active'}</span></div><div className="route-diagram">{steps.map(({name, icon: Icon}, i) => <div key={name}><button aria-pressed={step === i} aria-label={`Inspect ${name.toLowerCase()} authority`} className={step === i ? 'active' : ''} onClick={() => setStep(i)}><Icon size={23}/><span>{name}</span></button>{i < 2 && <span className="route-wire" aria-hidden="true"><ChevronRight size={12}/></span>}</div>)}</div><div className="route-description" aria-live="polite"><span>0{step + 1} / {steps[step].name}</span><p>{steps[step].detail}</p></div><button className="text-btn" onClick={() => go(step === 0 ? 'Agents' : step === 1 ? 'Policies' : 'Audit log')}>Open {step === 0 ? 'agents' : step === 1 ? 'policies' : 'audit log'}<ArrowUpRight size={14}/></button></section>;
}
