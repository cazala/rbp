# Reference architecture

## Design boundary

Resurrect supplies signed candidate endpoints only. Ethereum establishes event availability and ordering; it does not attest to peer quality, application membership, reachability, or honesty. The peer-record signature establishes control of the embedded peer identity and signed addresses; it does not establish application authorization. The application's normal cryptographic handshake remains mandatory.

## Components

```text
application descriptor
        │
        ├─────────────── caller-selected Ethereum provider
        │                              │
        ▼                              ▼
 strict descriptor            recent-window log scanner
 validation                    + constant/chain checks
        │                              │
        └──────────────┬───────────────┘
                       ▼
            signed peer-record codecs
              ENR (1) / libp2p (2)
                       │
                       ▼
         endpoint policy + bounded candidate store
                       │
              ┌────────┴────────┐
              ▼                 ▼
        native peer store    bounded dialer
              │                 │
              └────────┬────────┘
                       ▼
              application handshake
```

The Rust workspace separates protocol primitives (`resurrect-core`), EVM access (`resurrect-ethereum`), codecs (`resurrect-libp2p`), the transport-independent cold-start state machine (`resurrect-bootstrap`), and an opinionated runnable composition (`resurrect-node`). The TypeScript package independently implements the browser-safe subset and verifies deterministic signed-record vectors shared with Rust.

## Startup state machine

One supervisor cycle uses this order:

1. Return healthy if enough authenticated peers already exist.
2. Revalidate and try the disposable SQLite cache.
3. observe native rust-libp2p discovery and try those peers.
4. Verify the caller-supplied registry provider, scan recent announcements, revalidate records, feed them to the native peer store, and dial them.
5. If still isolated and configured as a seed, publish the node's own signed record.
6. Back off exponentially and repeat.

Healthy nodes do not continuously scan Ethereum. Seeds renew their announcement on their maintenance interval. An unavailable registry does not stop native recovery because the provider is verified only when a scan or write is actually needed.

## Beacon invariants

The registry has no storage variables and exposes only three constants plus `announce`. The event expiry is calculated from the block timestamp. Contract tests prove boundary reverts, permissionless access, no common admin selectors, no writes across sampled storage slots, fuzzed valid inputs, and invariant stability.

The authoritative source is `contracts/src/ResurrectBeaconV1.sol`. The npm source mirror must compare byte-for-byte in CI.

The reference packages pin the audited Ethereum mainnet instance of that bytecode at `0x136c191B5e6541532E42Ecd7C719C29D7ecdf468`, deployment block `25943058`. This removes repeated deployment work without changing the boundary above: namespace, provider, signed identity, candidate policy, and application authorization remain outside the beacon.

## Provider and scanner model

`RegistryProvider` is a caller-supplied async abstraction. The Alloy adapter is one implementation; tests use deterministic providers. Before accepting logs the scanner checks:

- descriptor validity;
- the actual chain ID;
- registry `VERSION`, `MAX_TTL`, and `MAX_RECORD_BYTES`;
- the deployment block against a safe/finalized or confirmed head;
- the event address, namespace, codec, expiry, and record byte cap;
- signed-record decoding, signature, identity, sequence, and endpoint policy.

The general scanner binary-searches timestamps to locate the maximum-TTL window. Chain profiles with a protocol-enforced block-production bound can instead translate the TTL into a conservative block lookback and avoid historical block-body queries; the Ethereum browser profile uses 650,000 blocks. Both paths reduce log ranges after provider limits/timeouts, cap raw logs and active candidates, and deduplicate by codec-defined identity. A reorg never turns a discovery hint into application authority.

## Peer records and endpoints

Codec 1 accepts raw EIP-778 RLP ENRs and enforces the ENR size/signature rules. Codec 2 accepts libp2p Signed Envelopes in the standard peer-record domain and verifies that the payload peer ID matches the signing key. Sequence-aware candidate storage prevents an older record from replacing a newer one.

Those standard signatures cover the peer-record payload, not the Resurrect event envelope. In v1 they do not bind `namespace`, `recordType`, `validUntil`, TTL, transaction sender, or log position to the signer. An observer can replay valid record bytes with different event metadata; this may prolong an unavailable endpoint as a discovery candidate but does not let the observer impersonate the signed peer in Noise or the application handshake. Consumers therefore use event metadata only for bounded discovery and apply transport plus application authentication before granting trust.

Endpoint policy is environment-specific. The native default rejects loopback, private, unspecified, multicast, documentation, and unsupported endpoints. Test/private overlays must opt in. The browser package accepts authenticated secure WebTransport, WSS, HTTPS, or TLS+WebSocket multiaddrs and rejects private IP literals by default.

## Browser-to-seed path

The reference node can listen on native TCP and plain WebSocket at the same
time. In the hosted deployment, native TCP is exposed directly while the
WebSocket listener is bound to loopback behind a TLS edge:

```text
browser explorer
   ├─ JSON-RPC read ───────────────► caller-selected Ethereum provider
   └─ WSS ─► Cloudflare TLS/tunnel ─► node /ws listener
                │                         │
                └── transport privacy    └── Noise peer authentication,
                                             Yamux, identify, ping
```

The TLS edge cannot impersonate the announced libp2p peer without its identity
key because the browser compares the Noise-authenticated peer ID with the
signed registry record. It can still deny, delay, or observe traffic. Neither
the tunnel nor the hosted explorer is required by the protocol.

The current explorer is distributed through Cloudflare Pages and an immutable ERC-5219 router in Ethereum contract bytecode. Both builds embed the canonical Beacon deployment. An HTTP ERC-4804 gateway is a convenience and adds its own observation, caching, and response-transformation boundary; onchain resource hashes and direct contract responses remain independently verifiable.

## Persistent and ephemeral state

The contract stores no mutable state. Local SQLite rows are a disposable performance cache and contain the raw signed record plus observation metadata. Every row is cryptographically decoded and checked for expiry again on load. A corrupt, stale, or attacker-modified cache therefore cannot bypass record validation.

The native libp2p identity is durable and security-sensitive. The Ethereum payer key is separate. Status JSON and logs are observability outputs, not protocol state.

## Liveness assumptions

Total resurrection requires at least one compatible participant able to reach and pay the configured EVM chain, followed by another participant able to dial its advertised transport. Existing native components can continue when the registry or RPC is unavailable. Resurrect cannot reconstruct application data that no participant retained.
