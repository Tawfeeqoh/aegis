# NEAR treasury

Use Rust 1.95.0 and near-sdk 5.30.1. All token amounts are integer yoctoNEAR. The web sandbox uses fictional demo USD and is a separate ledger.

```sh
rustup target add wasm32-unknown-unknown
cargo test --manifest-path contracts/aegis/Cargo.toml --lib
cargo near build non-reproducible-wasm --manifest-path contracts/aegis/Cargo.toml --no-abi
```

Deploy to a fresh testnet treasury account. Initialize using the treasury account itself, with your separate wallet account as `owner`. The constructor rejects other callers. Fund the contract with `fund`, then register each agent account through the owner.

Grant the agent runner only a function-call key for this contract and `request_payment`. Its allowance is a gas limit, not the spending budget. Keep treasury account keys and owner keys out of the agent runtime. Neither the web UI nor a model may obtain those keys.

The prototype retains up to 100 requests. A settled request remains counted for a rolling day. Approval requests reserve aggregate and per-agent budgets. Dispatching requests remain counted without expiry until their callback resolves. Expiry or revocation cannot reverse a transfer already dispatched. A private callback confirms success or restores accounted funds after a failed transfer.

The owner and anyone retaining a treasury full-access/upgrade key remain trusted. Unknown callback outcomes remain reserved; recovery from a failed callback requires an explicitly designed recovery mechanism before production custody. No cross-chain signing or token approvals are exposed in this version.

The published demo contract is `treasury.aegis-hack10-261106.testnet`. Its live state is inspectable through the Developer screen. Configure a contract you own to exercise owner actions with your wallet. The repository does not distribute the demo's administrative keys.
