"use client";
import {Dialog} from '@base-ui/react/dialog';
import {ArrowUpRight, ChevronLeft, ChevronRight, Search, X} from 'lucide-react';
import type {ReactNode} from 'react';
import type {Payment, Workspace} from '@/lib/engine';
import {clock, money, paymentStatus} from '@/lib/presentation';

export function Mark() {
  return <svg viewBox="0 0 36 42" width="30" height="35" fill="none" aria-hidden="true"><path d="M18 2 33 8v12c0 8-8 15-15 19C11 35 3 28 3 20V8L18 2Z" stroke="currentColor" strokeWidth="1.6"/><path d="m10 27 8-17 8 17m-12-6h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
export function Badge({status}: {status: string}) {
  const label: Record<string, string> = {approval: 'Needs approval', settled: 'Settled', blocked: 'Blocked', rejected: 'Rejected', expired: 'Expired', active: 'Active', revoked: 'Revoked', Passed: 'Passed', Failed: 'Failed'};
  return <span className={`badge ${status}`}><i/>{label[status] ?? status}</span>;
}
export function SectionHead({title, sub, action}: {title: string; sub?: string; action?: ReactNode}) {
  return <div className="section-head"><div><h2>{title}</h2>{sub && <p>{sub}</p>}</div>{action}</div>;
}
export function Modal({open, close, title, description, className = '', children}: {open: boolean; close: () => void; title: string; description?: string; className?: string; children: ReactNode}) {
  return <Dialog.Root open={open} onOpenChange={next => {if (!next) close();}}><Dialog.Portal><Dialog.Backdrop className="modal-backdrop"/><Dialog.Viewport className="modal-viewport"><Dialog.Popup className={`modal ${className}`}>
    <div className="modal-heading"><Dialog.Title>{title}</Dialog.Title>{description && <Dialog.Description>{description}</Dialog.Description>}</div>
    {children}
    <Dialog.Close className="icon-btn modal-close" aria-label="Close dialog"><X size={20}/></Dialog.Close>
  </Dialog.Popup></Dialog.Viewport></Dialog.Portal></Dialog.Root>;
}
export function Pager({page, count, size, change}: {page: number; count: number; size: number; change: (page: number) => void}) {
  const pages = Math.ceil(count / size);
  if (pages <= 1) return null;
  return <div className="pagination"><span>{(page - 1) * size + 1}–{Math.min(page * size, count)} of {count}</span><div><button className="icon-btn" aria-label="Previous page" disabled={page <= 1} onClick={() => change(page - 1)}><ChevronLeft size={18}/></button><span>{page} / {pages}</span><button className="icon-btn" aria-label="Next page" disabled={page >= pages} onClick={() => change(page + 1)}><ChevronRight size={18}/></button></div></div>;
}
export function PaymentList({rows, state, now, select, filtered = false, create}: {rows: Payment[]; state: Workspace; now: number; select: (p: Payment) => void; filtered?: boolean; create?: () => void}) {
  if (!rows.length) return <div className="empty-state"><span className="empty-icon">{filtered ? <Search size={23}/> : <ArrowUpRight size={24}/>}</span><strong>{filtered ? 'No matching payments' : 'No payments yet'}</strong><p>{filtered ? 'Try another recipient, reference, or filter.' : 'Send a small demo request to see how your rules handle it.'}</p>{!filtered && create && <button className="text-btn" onClick={create}>Create a payment<ArrowUpRight size={15}/></button>}</div>;
  return <div className="payment-list"><div className="payment-list-heading" aria-hidden="true"><span>Payment / recipient</span><span>Agent</span><span>Decision</span><span>Demo USD</span><span/></div>{rows.map(p => <button key={p.id} className="payment-row" onClick={() => select(p)} aria-label={`View payment ${p.reference}`}>
    <span className="payment-identity"><span className={`payment-direction ${paymentStatus(p, now)}`}><ArrowUpRight size={17}/></span><span><strong>{p.memo || p.reference}</strong><small className="mono">{p.recipient}</small><small className="mobile-payment-meta">{state.agents.find(a => a.id === p.agent)?.name} · {clock(p.created)} WAT</small></span></span>
    <span className="payment-agent">{state.agents.find(a => a.id === p.agent)?.name ?? p.agent}</span>
    <span className="payment-status"><Badge status={paymentStatus(p, now)}/></span>
    <span className="payment-value" data-long={money(p.amount).length > 12}>{money(p.amount)}<small className="mobile-only">demo USD</small></span>
    <ChevronRight className="row-chevron" size={16}/>
  </button>)}</div>;
}
export function Skeleton() {
  return <div className="skeleton-layout" role="status" aria-label="Loading your treasury"><div className="skeleton-card"><span className="skeleton-line short"/><span className="skeleton-line amount"/><span className="skeleton-line"/><span className="skeleton-line"/></div><div className="skeleton-card"><span className="skeleton-line short"/><div className="skeleton-chart"/></div><span className="sr-only">Loading your treasury…</span></div>;
}
