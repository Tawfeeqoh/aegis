# AEGIS

Financial governance for autonomous agents, built by HACK1.0 for the NEAR hackathon.

The first version combines a persistent, isolated sandbox treasury with a NEAR testnet contract and a wallet-based onchain console. An agent proposes a payment; deterministic rules govern authority independently of the model.

## Working core

- Agent-specific and aggregate rolling spending limits.
- Exact recipient allowlists, per-payment caps, and request-bound owner approvals.
- Idempotent retries, payload conflict detection, expiry, revocation, and emergency pause.
- Atomic database compare-and-swap for concurrent sandbox requests.
- Hash-linked audit exports and repeatable adversarial scenarios.
- NEAR contract transfers with explicit asynchronous settlement callbacks.

Sandbox USD are fictional database units. They are never presented as real USDC or onchain settlement. The live console reads a separate testnet contract. Wallet signatures authorize native test NEAR operations.

## Development

Node 22.22.2 or later. Run `npm ci`, copy `.env.example` to `.env.local`, configure the isolated Supabase gateway, then `npm run dev`. Run `npm test` and `npm run build` before deploying.

The gateway uses a server-only secret in addition to the publishable Supabase key. Tables live in a non-exposed schema with RLS and no public table grants. See `database/schema.sql`. Set a SHA-256 digest of the randomly generated gateway secret in the private configuration table. Never commit the secret or wallet keys.

## Limits

This is a hackathon prototype, not an audited custody product. Wallet owners and contract upgrade keys remain trusted. No AI risk score overrides a hard authorization rule. The model-risk integration, cross-chain settlement, reputation network and escrow are follow-on work.

Validation and deployment evidence will be recorded as the build is completed.
