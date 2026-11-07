# Security boundary

This prototype has two independent execution environments.

The web sandbox moves fictional integer demo USD in an isolated database ledger. A cryptographically random HttpOnly, SameSite cookie grants control of one sandbox. An attacker who obtains that cookie controls that sandbox; this is not a production identity or recovery system. Owner actions are same-origin. Scoped agent tokens are generated randomly, hashed at rest, expire after seven days and are checked against current agent revocation on every request.

Database writes use compare-and-swap revisions. Every losing concurrent attempt reevaluates the current treasury policy and reservations. Pending requests count against shared and per-agent budgets. Expiry releases reservations. Policy changes invalidate pending approvals while retaining settled spending history. Idempotency is keyed by agent and caller-provided reference; a malicious caller choosing a new reference represents a new purchase, which is still bounded by the hard budgets.

The gateway secret stays in Vercel runtime configuration and the untracked local environment file. It is separate from the publishable Supabase key. The public RPC is an intentional secret-checked entry point; private table contents and the stored secret hash are not granted to anonymous clients. The database administrator and web server remain trusted for sandbox integrity. The hash-linked audit verifies internal consistency; an administrator could rewrite the whole chain. No external anchor is claimed.

The NEAR contract enforces actual testnet authority without depending on the model or sandbox database. Only registered agent accounts may request payments. Full-access treasury keys and the owner remain trusted and must never be given to an agent runner. A function-call key restricts calls and gas; business spending limits live in the contract.

Native transfers are asynchronous. Funds and budget are committed before dispatch, settlement callbacks are private, and failure restores the accounted funds. A callback that cannot complete leaves the request Dispatching and its budget reserved; the prototype has no general recovery procedure for uncertain outcomes. Pausing or revoking cannot undo dispatched or settled transfers.

This version does not provide audited production custody, real USDC settlement, cross-chain signing, arbitrary contract calls, AI vendor due diligence, threat intelligence sharing, or multi-agent consensus. Avoid entering real financial records in the sandbox. No claim is made that an allowed vendor is honest or a permitted purchase is economically useful.
