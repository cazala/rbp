# Security model

## Assets and trust boundaries

The implementation protects peer identity authenticity, descriptor/chain binding, bounded resource use, and bootstrap liveness under the assumptions in the specification. It does not make announcements trustworthy membership claims.

Trust is deliberately split:

- application releases distribute the descriptor and application handshake rules;
- Ethereum provides a censorship- and availability-dependent event substrate;
- an RPC provider supplies an untrusted view of that chain;
- peer-record keys authenticate peer identities and signed endpoints;
- the application handshake authenticates protocol behavior or membership;
- local operator policy decides which endpoints and peers are acceptable.

## Attacker capabilities

Assume an attacker can publish unlimited syntactically valid or malformed events when willing to pay gas, create many legitimate peer identities, operate endpoints, control an RPC provider, tamper with a local cache, manipulate DNS, observe public announcements, and race or reorder dial attempts. Also assume ordinary chain reorgs and unavailable peers.

## Implemented controls

- Closed descriptor parsing and explicit chain/constant verification prevent accidental same-address cross-chain use.
- Registry address/topic/namespace/codec/expiry checks reject unrelated events.
- ENR and libp2p signature verification plus identity consistency prevent unsigned endpoint substitution.
- Highest-sequence retention prevents stale records from replacing newer signed records.
- Endpoint caps and policies reject malformed, unsupported, local, and special-use targets by default.
- Log, candidate, and dial caps limit memory, RPC, and connection amplification.
- Adaptive bounded queries avoid genesis scans and provider range exhaustion.
- Timeouts and exponential retry backoff prevent dead records from hanging bootstrap or causing tight polling.
- Deterministic sampling avoids treating registry ordering as rank.
- SQLite records are revalidated on every load.
- Native discovery remains independent of registry/provider availability.
- The contract has no privileged account or mutable peer storage to capture.

The published Ethereum mainnet address is deployment metadata, not a trust claim about its deployer. The bytecode, constants, and receipt block are pinned and reproducible; the deployer cannot change the contract or administer namespaces. Consumers should still verify the code through independent providers and explorers.

The v1 ENR and libp2p signatures authenticate the peer-record contents defined by those codecs. They do not authenticate the surrounding event's namespace, record type, TTL, expiry, transaction sender, position, or recency. A third party can replay valid record bytes with different event metadata. Treat those fields only as discovery filters and bounded cache hints, never as authorization or proof of the peer's current intent. Authenticate the peer identity again during transport setup and enforce the application's own handshake after dialing.

## Residual risks

Resurrect cannot prevent a well-funded Sybil/eclipsing population, prove liveness before dialing, guarantee RPC completeness, route around EVM censorship, hide public seed endpoints, recover deleted application data, or fix a vulnerable application handshake. One available attacker-controlled peer may be the only discoverable candidate.

Applications should diversify discovery sources and network prefixes, remember successful peers, rotate samples, compare providers when appropriate, and enforce authorization after transport connection. High-value deployments should operate or verify against their own Ethereum node.

The contract accepts a one-second TTL, but `validUntil` is based on a block timestamp and is not a precision timer. Applications should avoid relying on sub-minute expiry precision. `ResurrectBeaconV1` also reports an empty record as `RecordTooLarge(0)`; this is an imprecise v1 diagnostic, not a bounds bypass. Callers should interpret the zero argument as an empty-record rejection.

## Contract audit

The source-verified `ResurrectBeaconV1` deployment at [`0x136c191B5e6541532E42Ecd7C719C29D7ecdf468`](https://etherscan.io/address/0x136c191B5e6541532E42Ecd7C719C29D7ecdf468#code) received an external AI-orchestrated review through OneDollarAudit, job [#904](https://www.onedollaraudit.com/audit/904). The [immutable IPFS report](https://bafkreid22gqqrzwo6b6scxqnmcmiinru3xzigz74xkere2573r6ivulzjq.ipfs.community.bgipfs.com/) reports no Critical, High, or Medium findings, two Low findings, and one Informational finding.

The review covered only the deployed 37-line beacon contract. It did not cover the protocol specification, Rust or TypeScript packages, peer-record codecs, node, explorer, hosted services, deployment tooling, or application integrations. See [Audits](audits.md) for each finding and its disposition.

## Key handling

The native identity key authenticates the peer record and transport. Protect it like a service identity. The Ethereum key only pays for `announce`; use a separate account, a limited balance, and a secret manager. Compromise of the payer cannot impersonate an uncompromised peer, but it can spend funds and publish spam. Compromise of the peer key permits signed endpoint impersonation until applications revoke or reject that identity through mechanisms outside Resurrect.

## SSRF and egress

Dialing registry-derived addresses is an outbound request to attacker-controlled input. Production endpoint policy rejects local and private address literals, but DNS names can resolve differently over time or be rebound. Applications with sensitive internal networks should resolve and filter all addresses at dial time, enforce egress controls outside the process, and account for proxies and IPv4-mapped IPv6.

## WebSocket TLS edges

A TLS-terminating WSS proxy or tunnel can observe timing and addresses, deny
connections, and present its own Web PKI identity. It must not replace libp2p
authentication. Browser clients must complete Noise and compare the remote peer
ID with the signed record before treating the connection as the announced peer.
Keep plain `/ws` origins loopback-only, restrict connector tokens to their
dedicated tunnel, and never place identity or payer keys at the edge.

## Supply-chain and release security

CI builds locked Rust and pnpm dependency graphs, packages every public artifact, and runs conformance tests. Stable native binaries receive checksums and GitHub attestations. Consumers should verify repository/tag provenance, package publisher provenance, checksums, their own dependency policy, and the exact scope of the [published contract audit](audits.md).

## Reporting vulnerabilities

Follow [SECURITY.md](../SECURITY.md). Do not publish exploitable details before maintainers have had a reasonable opportunity to investigate and release a fix.
