import Link from 'next/link';
import {ArrowRight, ArrowUpRight, Check, Fingerprint, ShieldCheck} from 'lucide-react';
import {PublicFooter, PublicHeader, PublicMark} from './public-shell';
import PolicyExample from './policy-example';
import LegacyWorkspace from './legacy-workspace';
import PublicMotion from './public-motion';
import './public.css';

export default function HomePage() {
  return <div className="public-site">
    <LegacyWorkspace/><PublicMotion/>
    <a className="skip-link" href="#main">Skip to content</a>
    <PublicHeader/>
    <main id="main">
      <section className="public-hero public-container">
        <div className="hero-copy"><h1>Money needs rules.</h1><p className="hero-description">Financial control for AI agents. Set a budget, choose recipients and decide which payments need your approval.</p><div className="hero-actions"><Link className="public-button" href="/app">Get started<ArrowUpRight size={18}/></Link><Link className="public-text-link" href="/docs">Read the docs<ArrowRight size={17}/></Link></div><p className="hero-note">Start with a demo treasury. No wallet needed.</p><div className="hero-authority"><ShieldCheck size={19}/><p>The agent makes the request.<br/> Your rules decide what happens next.</p></div></div>
        <div className="hero-example"><span className="hero-shield"><PublicMark/></span><PolicyExample/></div>
      </section>

      <section className="public-flow public-container" id="how-it-works">
        <div className="public-section-heading" data-reveal><h2>Permission comes first.</h2><p>A payment request passes through controls the agent cannot change.</p></div>
        <div className="flow-list">
          <article data-reveal><div><Fingerprint size={21}/><h3>Give each agent its allowance.</h3></div><p>Register the agent, set its limit and choose its recipients. A shared budget keeps the whole treasury within bounds.</p><Link href="/docs#policies">Set the policy<ArrowUpRight size={16}/></Link></article>
          <article data-reveal><div><ShieldCheck size={21}/><h3>Check the exact request.</h3></div><p>Amounts, recipients, references and permissions are checked before a debit. A sensitive payment waits for your approval.</p><Link href="/docs#approvals">How approvals work<ArrowUpRight size={16}/></Link></article>
          <article data-reveal><div><Check size={21}/><h3>Keep a record you can inspect.</h3></div><p>See the request, the rule and the decision together. An unchanged retry returns the original result without another payment.</p><Link href="/app#audit-log">Open the audit log<ArrowUpRight size={16}/></Link></article>
        </div>
        <div className="public-lab-callout"><p>Try a duplicate invoice, a substituted recipient or two agents competing for the same budget.</p><Link className="public-text-link" href="/app#attack-lab">Run the attack lab<ArrowRight size={17}/></Link></div>
      </section>

      <section className="public-near public-container" id="near">
        <div className="public-section-heading" data-reveal><h2>NEAR, with a clear job.</h2><p>Native payments, cross-chain signing and risk review have separate roles. Their current status is shown here.</p></div>
        <div className="public-integration-list">
          <article data-reveal><div><h3>NEAR treasury</h3><span className="public-state live">Testnet</span></div><p>A deployed contract enforces spending limits and confirms native test NEAR transfers through settlement callbacks.</p><Link href="/docs#near-treasury">Contract and evidence<ArrowUpRight size={16}/></Link></article>
          <article data-reveal><div><h3>Chain Signatures</h3><span className="public-state live">Signature verified</span></div><p>A separate contract requests MPC signatures for approved Sepolia transfers. Destination settlement still needs test funds.</p><Link href="/docs#chain-signatures">Signing flow<ArrowUpRight size={16}/></Link></article>
          <article data-reveal><div><h3>NEAR Intents</h3><span className="public-state">Live quotes</span></div><p>Get NEAR-to-USDC quotes for Base or Ethereum. Mainnet funding stays disabled until the funded flow has been verified.</p><Link href="/docs#intents">Quote and deposit flow<ArrowUpRight size={16}/></Link></article>
          <article data-reveal><div><h3>NEAR AI Cloud</h3><span className="public-state">Optional review</span></div><p>Review the purpose of a sandbox payment before it proceeds. Warnings and unavailable reviews require owner approval.</p><Link href="/docs#risk-review">Review behaviour<ArrowUpRight size={16}/></Link></article>
        </div>
        <p className="public-scope-note">The workspace uses fictional demo USD. Native test NEAR and mainnet funds are separate. AEGIS is a hackathon prototype.</p>
      </section>

      <section className="public-start public-container"><div><h2>Open a treasury.</h2><p>Make a request, change the recipient and inspect the decision. Start with fictional funds.</p></div><Link className="public-button" href="/app">Get started<ArrowUpRight size={19}/></Link></section>
    </main>
    <PublicFooter/>
  </div>;
}
