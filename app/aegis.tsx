"use client";
import {useCallback, useEffect, useRef, useState} from 'react';
import {Dialog} from '@base-ui/react/dialog';
import {Command} from 'cmdk';
import {Toaster, toast} from 'sonner';
import {ArrowUpRight, ChevronRight, Code2, Fingerprint, FileCheck2, FlaskConical, LayoutDashboard, LockKeyhole, Menu, MoreHorizontal, Pause, Play, Plus, RefreshCw, Search, Settings2, ShieldAlert, ShieldCheck, Plug, X} from 'lucide-react';
import type {Agent, Payment, Workspace} from '@/lib/engine';
import {money, paymentStatus, timeOnly} from '@/lib/presentation';
import {Mark, Modal, Skeleton} from './ui-kit';
import {AgentForm, Credential, PaymentDetail, PaymentForm, PolicyForm, type Action} from './forms';
import Overview from './overview';
import Connections from './connections';
import {Agents, Payments, AttackLab, AuditLog, Developer} from './views';
import {fixtureWorkspace} from './qa-fixtures';

export type View = 'Overview' | 'Agents' | 'Payments' | 'Policies' | 'Attack lab' | 'Audit log' | 'Developer' | 'Connections';
const nav = [['Overview', LayoutDashboard], ['Agents', Fingerprint], ['Payments', ArrowUpRight], ['Policies', Settings2], ['Attack lab', FlaskConical], ['Audit log', FileCheck2], ['Developer', Code2], ['Connections', Plug]] as const;
const descriptions: Record<View, string> = {Overview: 'Agent spending, approvals, and the budget left to use.', Agents: 'Set a budget. Give each agent only the access it needs.', Payments: 'Review requests and the rules behind each decision.', Policies: 'Set the limits every agent must follow.', 'Attack lab': 'Test the rules with requests designed to break them.', 'Audit log': 'A record of each request, decision, and policy change.', Developer: 'Connect your agent or inspect the NEAR testnet contract.', Connections: 'Risk review, NEAR Intents and Chain Signatures.'};
const fromHash = () => nav.find(([name]) => name.toLowerCase().replaceAll(' ', '-') === location.hash.slice(1))?.[0] ?? 'Overview';

export default function Aegis({fixture}:{fixture?:string}) {
  const [s, setS] = useState<Workspace | null>(null);
  const [view, setView] = useState<View>('Overview');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [updated, setUpdated] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [menu, setMenu] = useState(false);
  const [command, setCommand] = useState(false);
  const [modal, setModal] = useState<'payment' | 'agent' | 'token' | null>(null);
  const [selected, setSelected] = useState<Payment | null>(null);
  const [token, setToken] = useState('');
  const [filter, setFilter] = useState('all');
  const generation = useRef(0), working = useRef(false), first = useRef(true);
  const pageTitle = useRef<HTMLHeadingElement>(null);

  const load = useCallback(async () => {
    if (fixture) {setS(fixtureWorkspace(fixture,Date.now()));setLoaded(true);setUpdated(Date.now());return;}
    if (working.current) return;
    const ticket = ++generation.current;
    setRefreshing(true);
    try {
      const response = await fetch('/api/aegis', {cache: 'no-store'});
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not load the treasury.');
      if (ticket !== generation.current) return;
      setS(data.state); setError(''); setUpdated(Date.now()); setNow(Date.now());
    } catch (e) {if (ticket === generation.current) setError(e instanceof Error ? e.message : 'Could not load the treasury.');}
    finally {if (ticket === generation.current) {setLoaded(true); setRefreshing(false);}}
  }, [fixture]);
  useEffect(() => {
    load(); setView(fromHash());
    const sync = () => setView(fromHash());
    const onFocus = () => {if (document.visibilityState === 'visible') load();};
    const onKey = (e: KeyboardEvent) => {
      document.documentElement.dataset.input = 'keyboard';
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {e.preventDefault(); setCommand(value => !value);}
    };
    const onPointer = () => {document.documentElement.dataset.input = 'pointer';};
    const interval = setInterval(() => {setNow(Date.now()); if (document.visibilityState === 'visible') load();}, 30_000);
    window.addEventListener('hashchange', sync); window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus); document.addEventListener('keydown', onKey); document.addEventListener('pointerdown', onPointer);
    return () => {clearInterval(interval); window.removeEventListener('hashchange', sync); window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus); document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onPointer);};
  }, [load]);
  useEffect(() => {if (first.current) {first.current = false; return;} pageTitle.current?.focus({preventScroll: true});}, [view]);
  function go(next: View, nextFilter = 'all') {
    setView(next); setMenu(false); setCommand(false); setFilter(nextFilter);
    history.pushState(null, '', `#${next.toLowerCase().replaceAll(' ', '-')}`);
    window.scrollTo({top: 0});
  }
  const close = () => {setModal(null); setSelected(null); setToken(''); setError('');};
  const act: Action = async (action, data = {}, message) => {
    if (fixture) {toast('Visual fixture. Payment writes are disabled.');return null;}
    if (working.current) return null;
    working.current = true; generation.current++; setRefreshing(false); setBusy(action); setError('');
    try {
      const response = await fetch('/api/aegis', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({action, ...data})});
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'The request could not be completed.');
      setS(result.state); setUpdated(Date.now()); setNow(Date.now());
      if (message) toast.success(message);
      return result;
    } catch (e) {setError(e instanceof Error ? e.message : 'The request could not be completed.'); return null;}
    finally {working.current = false; setBusy('');}
  };
  async function lab() {const result = await act('lab', {}, 'Security checks completed. Treasury funds were unchanged.'); if (result) go('Attack lab');}
  async function issue(agent: Agent) {const result = await act('credential', {agent: agent.id}); if (result) {setToken(result.token); setModal('token');}}
  const pending = s?.payments.filter(p => paymentStatus(p, now) === 'approval').length ?? 0;
  const navigation = (mobile = false) => <><div className="brand-row"><button className="brand" aria-label="AEGIS overview" onClick={() => go('Overview')}><Mark/><span>AEGIS<small>Agent financial control</small></span></button>{mobile && <Dialog.Close className="icon-btn" aria-label="Close navigation"><X size={20}/></Dialog.Close>}</div><div className="workspace-info"><span className="workspace-initial">H1</span><span>HACK1.0<small>Session workspace</small></span><LockKeyhole size={14}/></div><nav aria-label={mobile ? 'Mobile navigation' : 'Main navigation'}><span className="nav-caption">Treasury</span>{nav.map(([name, Icon], i) => <button key={name} className={`${view === name ? 'selected' : ''} ${i === 4 ? 'nav-divider' : ''}`} aria-current={view === name ? 'page' : undefined} onClick={() => go(name)}><Icon size={19}/><span>{name}</span>{name === 'Payments' && pending > 0 && <span className="nav-count">{pending}</span>}{name === 'Developer' && <span className="nav-shortcut">API</span>}</button>)}</nav><div className="sidebar-bottom"><div className="sandbox-card"><span className="dot"/><div><strong>Sandbox</strong><small>Demo funds · NEAR testnet</small></div></div><div className="owner-line"><span className="avatar">H1</span><div><strong>Treasury owner</strong><small>This browser session</small></div><ShieldCheck size={17}/></div></div></>;
  return <div className="app-shell"><a className="skip-link" href="#main-content">Skip to content</a><div className="ambient" aria-hidden="true"><div className="ambient-halo"/><div className="ambient-orbit orbit-one"/><div className="ambient-orbit orbit-two"/></div><aside className="sidebar glass">{navigation()}</aside>
    <Dialog.Root open={menu} onOpenChange={setMenu}><Dialog.Portal><Dialog.Backdrop className="nav-backdrop"/><Dialog.Popup className="mobile-drawer" aria-label="Navigation">{navigation(true)}</Dialog.Popup></Dialog.Portal></Dialog.Root>
    <div className="work-area"><header className="topbar"><button className="icon-btn mobile-menu" aria-label="Open navigation" onClick={() => setMenu(true)}><Menu size={21}/></button><div className="breadcrumb"><span>Workspace</span><ChevronRight size={13}/><span>{view}</span></div><div className="topbar-right"><button className="search-trigger" onClick={() => setCommand(true)} aria-label="Search AEGIS"><Search size={16}/><span>Search anything</span><kbd>⌘ K</kbd></button><span className="network-label"><i className="dot"/>Sandbox</span><button className={`icon-btn ${refreshing ? 'is-refreshing' : ''}`} aria-label="Refresh treasury" disabled={refreshing || !!busy} onClick={load}><RefreshCw size={17}/></button><span className="tiny-avatar">H1</span></div></header>
      <main className="sheet" id="main-content"><div className="page-header"><div><span className="page-context">HACK1.0 treasury</span><h1 ref={pageTitle} tabIndex={-1}>{view === 'Overview' ? 'Treasury overview' : view}</h1><p>{descriptions[view]}</p></div><div className="header-actions">{s && <button className={`btn pause-control ${s.paused ? 'is-paused' : ''}`} disabled={!!busy} onClick={() => act('pause', {paused: !s.paused}, s.paused ? 'Treasury resumed.' : 'Treasury paused. New payments are blocked.')} aria-label={s.paused ? 'Resume treasury' : 'Pause treasury'}>{s.paused ? <Play size={15}/> : <Pause size={15}/>}<span>{s.paused ? 'Resume treasury' : 'Pause treasury'}</span></button>}<button className="btn primary" disabled={!s || !!busy} onClick={() => setModal(view === 'Agents' ? 'agent' : 'payment')}><Plus size={17}/>{view === 'Agents' ? 'Register agent' : 'New payment'}</button></div></div>
        <div className="workspace-status"><span><i className={`dot ${s?.paused ? 'amber' : ''}`}/>{fixture ? 'Read-only visual fixture' : s ? s.paused ? 'Execution paused' : `Policy v${s.policy.version} active` : 'Connecting to treasury'}</span><span>{updated ? `Updated ${timeOnly(updated)} WAT` : 'Loading workspace'}<span className="status-separator">/</span>Demo ledger</span></div>
        {error && !modal && !selected && <div className="error-banner" role="alert"><ShieldAlert size={18}/><span>{error}</span><button className="text-btn" onClick={load}>Retry</button><button className="icon-btn" aria-label="Dismiss error" onClick={() => setError('')}><X size={17}/></button></div>}
        {!loaded && <Skeleton/>}
        {loaded && !s && <div className="glass connection-error"><ShieldAlert size={28}/><h2>Your treasury couldn’t be loaded.</h2><p>Try connecting again. No payment was submitted.</p><button className="btn" onClick={load}>Retry connection<RefreshCw size={15}/></button></div>}
        {s && <><div className="view-body" key={view}>{s.paused && <div className="notice warning"><Pause size={17}/>New payments and pending approvals cannot execute while the treasury is paused.</div>}
          {view === 'Overview' && <Overview s={s} now={now} select={setSelected} go={go} create={() => setModal('payment')} runLab={lab} busy={!!busy}/>}
          {view === 'Agents' && <Agents s={s} now={now} busy={!!busy} issue={issue} act={act}/>}
          {view === 'Payments' && <Payments s={s} now={now} filter={filter} setFilter={setFilter} select={setSelected} create={() => setModal('payment')}/>}
          {view === 'Policies' && <PolicyForm key={s.policy.version} s={s} busy={!!busy} save={p => act('policy', {policy: p}, 'Policy saved. Previous pending approvals were invalidated.')}/>}
          {view === 'Attack lab' && <AttackLab s={s} busy={busy} run={lab}/>}
          {view === 'Audit log' && <AuditLog s={s} busy={!!busy} act={act} select={setSelected}/>}
          {view === 'Connections' && <Connections s={s} act={act} onState={setS}/>}
          {view === 'Developer' && <Developer s={s} act={act} busy={!!busy}/>}
        </div><footer className="page-footer"><span><Mark/>AEGIS<span>Built by HACK1.0</span></span><span>Sandbox ledger · no real funds</span></footer></>}
      </main>
    </div>
    <nav className="mobile-bottom-nav" aria-label="Quick navigation">{nav.slice(0, 3).map(([name, Icon]) => <button key={name} aria-current={view === name ? 'page' : undefined} className={view === name ? 'selected' : ''} onClick={() => go(name)}><span><Icon size={21}/>{name === 'Payments' && pending > 0 && <i>{pending}</i>}</span>{name}</button>)}<button className={!['Overview', 'Agents', 'Payments'].includes(view) ? 'selected' : ''} onClick={() => setMenu(true)} aria-label="More navigation"><MoreHorizontal size={22}/>More</button></nav>
    <Modal open={!!modal || !!selected} close={close} title={selected ? selected.memo || 'Payment details' : modal === 'payment' ? 'New payment' : modal === 'agent' ? 'Register an agent' : 'Agent credential'} description={selected ? 'Request details and the policy decision.' : modal === 'payment' ? 'Submit a request to the sandbox policy engine.' : modal === 'agent' ? 'Assign a responsibility and a separate spending limit.' : 'Keep this credential in your agent’s environment.'}>
      {error && <div className="error-banner" role="alert"><ShieldAlert size={17}/><span>{error}</span></div>}
      {modal === 'payment' && s && <PaymentForm s={s} now={now} busy={!!busy} submit={async payment => {const result = await act('payment', {payment}); if (result) {setModal(null); setSelected(result.result.payment); toast(result.result.conflict ? 'Changed retry blocked.' : result.result.replay ? 'Original result returned. No second debit.' : 'Payment evaluated.');}}}/>}
      {modal === 'agent' && <AgentForm busy={!!busy} submit={async data => {if (await act('agent-create', data, 'Agent registered.')) close();}}/>}
      {modal === 'token' && <Credential token={token} notify={text => toast(text)}/>}
      {selected && s && <PaymentDetail p={s.payments.find(p => p.id === selected.id) ?? selected} s={s} now={now} busy={!!busy} act={act}/>}
    </Modal>
    <Modal open={command} close={() => setCommand(false)} title="Search AEGIS" className="command-modal"><Command label="Search AEGIS" loop><div className="command-input-wrap"><Search size={20}/><Command.Input placeholder="Find a page, payment, or action…"/><kbd>esc</kbd></div><Command.List><Command.Empty>No results. Try a page name or payment reference.</Command.Empty><Command.Group heading="Actions"><Command.Item onSelect={() => {setCommand(false); setModal('payment');}} disabled={!s}><Plus size={17}/>New payment<kbd>↵</kbd></Command.Item><Command.Item onSelect={() => {setCommand(false); setModal('agent');}} disabled={!s}><Fingerprint size={17}/>Register an agent</Command.Item></Command.Group><Command.Group heading="Workspace">{nav.map(([name, Icon]) => <Command.Item key={name} onSelect={() => go(name)}><Icon size={17}/>{name}<ArrowUpRight size={14}/></Command.Item>)}</Command.Group>{s && s.payments.length > 0 && <Command.Group heading="Recent payments">{[...s.payments].reverse().slice(0, 20).map(p => <Command.Item key={p.id} value={`${p.memo} ${p.reference} ${p.recipient}`} onSelect={() => {setCommand(false); setSelected(p);}}><ArrowUpRight size={17}/><span>{p.memo || p.reference}<small>{p.reference}</small></span><span className="command-amount">{money(p.amount)} USD</span></Command.Item>)}</Command.Group>}</Command.List><div className="command-footer"><span><kbd>↑</kbd><kbd>↓</kbd>navigate</span><span><kbd>↵</kbd>open</span></div></Command></Modal>
    <Toaster theme="dark" position="bottom-right" closeButton visibleToasts={3} toastOptions={{className: 'aegis-toast'}}/>
  </div>;
}

