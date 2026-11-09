# AEGIS

Autonomous Financial Governance & Security Infrastructure.

An agent can ask to pay a vendor. It shouldn't be able to decide its own spending limit.

AEGIS puts the owner's rules between an agent and a payment. Set a budget, choose who the agent can pay, and decide when you need to approve a request. A changed recipient, repeated invoice or revoked agent should never get a free pass because a model says the payment is fine.

[Open AEGIS](https://aegis-agent-security.vercel.app) · [Documentation](https://aegis-agent-security.vercel.app/docs) · [Workspace](https://aegis-agent-security.vercel.app/app)

## What works

- Register agents and give each one a separate allowance.
- Set shared budgets, payment caps and approved recipients.
- Approve the exact request, reject it, or pause the treasury.
- Retry an invoice without paying twice.
- Run the attack lab and inspect the decision in the audit log.
- Request live cross-chain quotes through NEAR Intents.
- Request an MPC signature through a policy-controlled NEAR testnet contract.

## Where NEAR comes in

The native treasury is deployed at `treasury.aegis-hack10-261106.testnet`. It has a settled testnet payment and blocked requests that can be checked onchain.

The Chain Signatures contract is `aegis-chain-mw7yr2zc.testnet`. It builds a native Sepolia transfer, checks the allowance, and asks NEAR's MPC network to sign after owner approval. A signature and a settled transfer are shown as separate states.

NEAR Intents supplies live NEAR-to-USDC quotes. Mainnet funding is disabled on the hosted app until the funded wallet flow has been verified. NEAR AI Cloud can review the purpose of a sandbox payment. Warnings and unavailable reviews go to the owner.

The dashboard uses fictional demo USD. The native treasury uses test NEAR. Neither funds an Intents swap.

## Run it

Use Node 22.22.2 or later.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Configure storage before opening a workspace. [Setup](docs/setup.md) covers the environment and contracts. [Integration status](docs/integrations.md) records what has been tested and what still needs access or funds.

```sh
npm test
npm run build
```

Built by HACK1.0 for the NEAR hackathon. This is a testnet prototype; it hasn't had a custody security audit.

