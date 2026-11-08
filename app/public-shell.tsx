import Link from 'next/link';
import {ArrowUpRight} from 'lucide-react';

export function PublicMark() {
  return <svg viewBox="0 0 36 42" width="30" height="35" fill="none" aria-hidden="true"><path d="M18 2 33 8v12c0 8-8 15-15 19C11 35 3 28 3 20V8L18 2Z" stroke="currentColor" strokeWidth="1.6"/><path d="m10 27 8-17 8 17m-12-6h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

export function PublicHeader({docs = false}: {docs?: boolean}) {
  return <header className="public-header">
    <Link href="/" className="public-brand" aria-label="AEGIS home"><PublicMark/><span>AEGIS</span></Link>
    <nav aria-label="Website navigation">
      <Link href="/#how-it-works" className="public-nav-detail">How it works</Link>
      <Link href="/#near" className="public-nav-detail">NEAR</Link>
      <Link href="/docs" aria-current={docs ? 'page' : undefined}><span className="docs-long">Documentation</span><span className="docs-short">Docs</span></Link>
      <Link href="/app" className="public-button compact">Get started<ArrowUpRight size={15}/></Link>
    </nav>
  </header>;
}

export function PublicFooter() {
  return <footer className="public-footer">
    <Link href="/" className="public-brand" aria-label="AEGIS home"><PublicMark/><span>AEGIS</span></Link>
    <span>Built by HACK1.0</span>
    <nav aria-label="Footer navigation"><Link href="/docs">Documentation</Link><Link href="/app">Workspace</Link><a href="https://github.com/Tawfeeqoh/aegis" target="_blank" rel="noreferrer">GitHub<ArrowUpRight size={13}/></a></nav>
  </footer>;
}
