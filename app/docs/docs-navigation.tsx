"use client";
import {useEffect, useState} from 'react';
import {ArrowDown, Search, X} from 'lucide-react';

const sections = [
  {id: 'quickstart', title: 'Start here', terms: 'quickstart first payment demo treasury 500 USD'},
  {id: 'policies', title: 'Spending policies', terms: 'budget daily allowlist recipients cap TTL expiry rules limits'},
  {id: 'approvals', title: 'Approvals and retries', terms: 'owner fingerprint idempotency reference duplicate rejected pause revoke'},
  {id: 'agent-api', title: 'Connect an agent', terms: 'API curl token credential bearer authentication request JSON response'},
  {id: 'near-treasury', title: 'Native NEAR treasury', terms: 'wallet testnet contract callback transfer settlement'},
  {id: 'chain-signatures', title: 'Chain Signatures', terms: 'MPC Sepolia gas nonce signing derived address ETH'},
  {id: 'intents', title: 'NEAR Intents', terms: 'cross-chain USDC quote swap Base Ethereum mainnet refund deposit slippage'},
  {id: 'risk-review', title: 'Context review', terms: 'AI NEAR Cloud API key model credits inference risk attestation'},
  {id: 'verification', title: 'Run and verify', terms: 'local setup install Node npm Supabase environment audit attack tests source security'},
];

export default function DocsNavigation() {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState('quickstart');
  const results = sections.filter(section => `${section.title} ${section.terms}`.toLowerCase().includes(query.trim().toLowerCase()));

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) setActive(entry.target.id);
    }, {rootMargin: '-110px 0px -65% 0px'});
    sections.forEach(section => {const element = document.getElementById(section.id); if (element) observer.observe(element);});
    return () => observer.disconnect();
  }, []);

  const links = () => <>{results.map(section => <a href={`#${section.id}`} key={section.id} aria-current={active === section.id ? 'location' : undefined} onClick={() => setActive(section.id)}>{section.title}</a>)}{!results.length && <p className="docs-no-results">No matching section. Try “budget”, “token” or “wallet”.</p>}</>;

  return <aside className="docs-sidebar" aria-label="Guide navigation">
    <div className="docs-search"><Search size={17}/><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a section…" aria-label="Search documentation" onKeyDown={event => {if (event.key === 'Enter' && results[0]) {event.preventDefault(); window.location.hash = results[0].id;}}}/>{query && <button aria-label="Clear documentation search" onClick={() => setQuery('')}><X size={16}/></button>}</div>
    <nav className="docs-desktop-toc" aria-label="Guide sections">{links()}</nav>
    {query ? <nav className="docs-mobile-results" aria-label="Matching guide sections">{links()}</nav> : <details className="docs-mobile-toc"><summary>On this page<ArrowDown size={15}/></summary><nav aria-label="Mobile guide sections">{links()}</nav></details>}
    <a className="docs-open-workspace" href="/app">Open the workspace<ArrowDown size={15}/></a>
  </aside>;
}
