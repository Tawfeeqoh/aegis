# Setup

## App and storage

Use Node 22.22.2 or later. Install with `npm ci` and copy `.env.example` to `.env.local`.

Create a dedicated Supabase project and apply `database/schema.sql` as its database owner. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in the server environment. Generate a random 32-byte gateway secret, set it as `AEGIS_DB_SECRET`, and store its SHA-256 digest in `aegis_private.configuration.secret_hash` for the row with `id = true`.

The publishable key alone cannot read a ledger. Tables and configuration are in a non-exposed schema with RLS and no anonymous table grants. The public gateway function checks a separate server secret before every operation. It deliberately uses SECURITY DEFINER; the Supabase advisor reports that entry point. This is not an issue-free security audit. Do not expose the private schema, grant table access, or use `NEXT_PUBLIC_` for secrets.

Run `npm run dev`. Check storage separately:

```sh
node --env-file=.env.local --experimental-transform-types scripts/verify-storage.ts
```

That script uses an isolated disposable workspace. The in-app attack lab runs thirteen scenarios, including concurrent database requests against one shared cap.

## NEAR AI Cloud

Set `NEAR_AI_API_KEY` to a key with inference credits. `NEAR_AI_MODEL` defaults to `zai-org/GLM-5.1-FP8`; choose a currently available model in your account. Redeploy after changing Vercel variables. Enable context review under Connections for each workspace.

Reviews use the official Chat Completions endpoint. Only the agent role, recipient, amount, purpose and recent request count are sent. The review has no tools or signing authority. Hard financial rules run again after the provider call. Warnings, errors, missing credentials and malformed responses require exact owner approval. A persisted lease bounds inference to twelve distinct requests per workspace per hour and avoids billing again during database write retries. Vercel deployment access is part of the prototype's access boundary; add production authentication and a global usage limit before opening paid inference publicly.

Provider responses are not represented as hardware-attestation or signature verified. The `verification` field remains `not-verified`.

## NEAR Intents

The public 1Click API supports live quote previews without a partner key. `NEAR_INTENTS_API_KEY` is optional and changes the provider's fee schedule. Save a mainnet NEAR allowance, approved EVM recipient and NEAR refund account under Connections. These limits are independent of demo USD.

`AEGIS_INTENTS_LIVE=false` keeps funding disabled. Enable it only when an owner-controlled mainnet wallet is ready to test the deposit and destination receipt flow. Enabling this variable does not fund anything. Every route still requires an exact approval, and each deposit needs the owner's wallet signature. The app never receives that wallet's private key.

The approval binds the preview's minimum output. A worse live quote is refused. Prepared deposits stay reserved while their settlement or refund is unverified, including after the quote deadline. The current prototype does not automatically release a provider-reported refund. Destination verification checks USDC Transfer logs and confirmations, alongside the final NEAR deposit. The provider and public RPC services remain trusted data sources.

## Native treasury

See [the contract setup](../contracts/README.md). Native test NEAR transfers and sandbox demo USD are separate ledgers. The original native demo contract's administrative keys are not distributed; deploy your own instance for owner actions.

## Chain Signatures

Build `contracts/crosschain` with Rust and `wasm32-unknown-unknown`:

```sh
CARGO_TARGET_DIR=contracts/aegis/target cargo test --manifest-path contracts/crosschain/Cargo.toml
CARGO_TARGET_DIR=contracts/aegis/target cargo build --manifest-path contracts/crosschain/Cargo.toml --target wasm32-unknown-unknown --release
```

`scripts/deploy-crosschain.mjs` is a testnet-only example for a fresh funded NEAR account. It expects `AEGIS_DEPLOY_KEY_FILE` to point to an ignored JSON file with `account` and `privateKey`. Never run the initializer against an existing deployed instance. The verification script uses ignored test administrator and agent keys; they are not included in the repository.

Set `AEGIS_CHAIN_CONTRACT` to the deployed contract or select it in Connections. Register the agent through the NEAR owner's wallet. The contract fixes Sepolia's chain ID, the derivation path and native-transfer format. It rejects arbitrary calldata, includes maximum gas in the cost cap, allocates nonces in order, and requires exact owner approval before contacting `v1.signer-prod.testnet`.

Fund the derived address with Sepolia test ETH to broadcast a transfer. The server recovers the MPC signer before broadcasting and checks destination receipts separately. Signed and unresolved authority remains reserved; this first contract does not recycle signed budgets automatically. Contract administrators and upgrade keys remain trusted.
