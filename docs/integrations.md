# Integration status

Updated 8 November 2026. The root README is the short introduction; this file records verification boundaries.

| Component | Implemented | Live verification | Still required |
| --- | --- | --- | --- |
| Sandbox treasury | Persistent ledger, scoped credentials, policies, exact approvals, expiry, revocation, audit and attack lab | Database concurrency and storage checks; hosted payment checks from the previous release | Production authentication and recovery |
| Native NEAR treasury | Rust contract, wallet console, transfer callback | Deployed testnet contract; settled 0.12 test NEAR payment; prohibited recipient and shared-cap blocks | Fresh user-owned wallet test; custody audit |
| NEAR Intents | Public live quotes; separate native NEAR allowance; exact route/minimum approval; owner wallet deposit; origin and destination receipt checks | Live 1Click quote from native NEAR to USDC on Base | Funded mainnet wallet test; hosted funding remains disabled |
| Chain Signatures | Separate NEAR contract constructs native Sepolia transactions; scoped recipient and amount checks; owner approval; real MPC call; local signature recovery; broadcast and receipt adapters | Deployed contract and MPC signing evidence in `public/evidence/chain-signatures.json` | Derived address needs Sepolia test ETH; destination transfer not yet mined |
| NEAR AI Cloud | Server-only provider call, validated response, advisory escalation, persistent call limit and review displayed with payment | Error, malformed response, hard-cap and fail-closed tests | API key with credits; live inference test; hardware-attestation verification |

## Evidence

- `public/evidence/testnet.json`: native treasury requests and transaction hashes.
- `public/evidence/intents.json`: live preview quote; no deposit or funds moved.
- `public/evidence/chain-signatures.json`: cross-chain requests, owner/MPC transaction and signature verification.
- `scripts/verify-storage.ts`: isolated database checks.
- `tests/integrations.test.ts`: risk authority boundary, provider failures, integer units, quote binding, budget reservations, USDC receipts and chain-bound payloads.

The dashboard does not describe a live quote as a swap, an MPC signature as settlement, or a provider response as verified confidential execution. Mainnet execution is disabled in the hosted configuration. The private repository and deployment are not a completed public hackathon submission.

## Provider references

- [NEAR Intents request flow](https://docs.near-intents.org/integration/distribution-channels/1click-api/quickstart/making-a-request)
- [NEAR AI Cloud setup](https://docs.near.ai/cloud/quickstart)
- [Chain Signatures](https://docs.near.org/chain-abstraction/chain-signatures/implementation)
