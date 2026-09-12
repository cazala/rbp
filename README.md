# Resurrect

Resurrect v1 is a permissionless cold-start and network-resurrection layer for peer-to-peer applications. It lets a network recover after every application node and every operator-controlled bootstrap service has disappeared, provided its configured EVM chain remains readable and writable.

The repository contains a complete reference implementation of [`docs/spec.md`](docs/spec.md):

- an immutable, stateless Solidity registry;
- reusable Rust protocol, Ethereum, and peer-record crates;
- a native Tokio/rust-libp2p seed and light-node process;
- a browser/static TypeScript registry client;
- a static browser explorer that authenticates WSS peers and measures live ping;
- an immutable ERC-5219 deployment of that explorer on Ethereum;
- canonical contract source and ABI packages;
- deterministic cross-language vectors; and
- unit, fuzz, invariant, fork, reboot, simultaneous-reboot, and packaging tests.

Resurrect is discovery, not trust. Every registry event is attacker-controlled input until the embedded peer record is cryptographically verified and accepted by local endpoint and application policy.

## How it works

```text
cache → native discovery → recent Resurrect events → self-announce if eligible → retry
                                │
                                └─ verify signature, identity, sequence,
                                   expiry, codec, namespace, and endpoints
```

The onchain contract stores no peer list. Anyone can emit a bounded announcement under any namespace. A client scans only the block window that can contain unexpired events, validates signed peer records, and dials a bounded candidate set. Once native connectivity exists, the registry leaves the hot path.

Resurrect does not recover lost application data, define application membership, prove endpoint reachability, provide NAT traversal, or replace a DHT, peer exchange, pub/sub, consensus, or application handshake.

## Repository map

| Path | Purpose | Release artifact |
|---|---|---|
| `contracts/` | Canonical Foundry project, registry, immutable-site router, and tests | source via `@resurrect-protocol/contracts` |
| `crates/resurrect-core` | descriptors, namespaces, validation, bounded candidates | `resurrect-core` |
| `crates/resurrect-bootstrap` | transport-independent cold-start state machine and its traits | `resurrect-bootstrap` |
| `crates/resurrect-ethereum` | Alloy provider, scanner, publisher ABI | `resurrect-ethereum` |
| `crates/resurrect-libp2p` | EIP-778 ENR and libp2p signed-record codecs, optional `Swarm` behaviour | `resurrect-libp2p` |
| `crates/resurrect-node` | native libp2p host, SQLite cache, supervisor, CLI | `resurrect-node` crate and binaries |
| `packages/ts` | browser/static provider, registry scanner, libp2p peer discovery | `@resurrect-protocol/client` |
| `packages/contracts` | canonical Solidity source and ABI | `@resurrect-protocol/contracts` |
| `apps/explorer` | browser discovery, authenticated WSS dial, identify, and ping UI | [resurrect.wei](https://resurrect.wei.limo/) |
| `test-vectors/` | deterministic Rust/TypeScript interoperability data | repository data |
| `scripts/` | conformance, packaging, and release automation | CI tooling |

## Requirements

Development uses:

- Rust 1.91 or newer;
- Foundry 1.7.1 with Solidity 0.8.24;
- Node.js 22 or 24;
- pnpm 11.17; and
- `jq` for the end-to-end checklist test.

The native `resurrect-node` binary has no Node.js runtime dependency.

## Build and test

```bash
cargo build --workspace --locked
cargo test --workspace --all-targets --locked
cargo test --workspace --all-targets --all-features --locked
cargo clippy --workspace --all-targets --locked -- -D warnings -W clippy::pedantic
forge test --root contracts
corepack enable
pnpm install --frozen-lockfile
pnpm --recursive run check
pnpm --recursive run test
```

Run the full implementer-checklist integration test with Anvil:

```bash
scripts/checklist-integration.sh
```

It deploys a fresh registry and a complete immutable explorer, verifies every explorer byte through ERC-5219, and proves empty-network self-promotion, Resurrect-only discovery, authenticated libp2p dialing, native discovery without registry access, total shutdown and unrelated-operator reboot, and simultaneous reboot. The machine-readable result is written to `artifacts/implementer-checklist.json`.

See [Testing](docs/testing.md) for suite boundaries and [Conformance](docs/conformance.md) for the checklist mapping.

## Network descriptor

Every application pins the chain, immutable registry, deployment block, namespace, and accepted codecs:

```json
{
  "resurrectVersion": 1,
  "registry": {
    "chainId": 1,
    "address": "0x136c191B5e6541532E42Ecd7C719C29D7ecdf468",
    "deploymentBlock": 25943058,
    "maxTtlSeconds": 7776000
  },
  "namespace": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "acceptedRecordTypes": [1, 2]
}
```

The JSON schema is intentionally closed: unknown fields are rejected. It never contains an RPC hostname. Applications derive a namespace with `keccak256("resurrect:<application>:<major-version>")` and distribute the descriptor as ordinary versioned application configuration.

The reference packages pin the verified and audited Ethereum mainnet Beacon at `0x136c191B5e6541532E42Ecd7C719C29D7ecdf468` (chain ID `1`, block `25943058`). Its transaction, compiler settings, runtime-bytecode hash, verification links, and audit are recorded in [Deployments](docs/deployments.md) and the machine-readable [deployment manifest](deployments/ethereum-mainnet.json). A shared stateless beacon does not select an application namespace, peer list, or RPC provider.

## Run a native node

Build the process:

```bash
cargo build -p resurrect-node --release --locked
```

Run a read-only light node with a caller-selected RPC endpoint:

```bash
target/release/resurrect-node \
  --application your-application \
  --major-version 1 \
  --rpc-url https://your-ethereum-mainnet-rpc.example \
  --listen /ip4/0.0.0.0/tcp/4001
```

Run a publicly reachable seed:

```bash
export RESURRECT_ETHEREUM_PRIVATE_KEY=0x...
target/release/resurrect-node \
  --application your-application \
  --major-version 1 \
  --rpc-url https://your-ethereum-mainnet-rpc.example \
  --seed \
  --listen /ip4/0.0.0.0/tcp/4001 \
  --advertise /dns4/seed.example/tcp/4001
```

One process can also serve native TCP and browser WebSocket clients. Put the
plain WebSocket listener behind a TLS reverse proxy or Cloudflare Tunnel, then
sign both public endpoints:

```bash
target/release/resurrect-node \
  --application your-application \
  --major-version 1 \
  --rpc-url https://your-ethereum-mainnet-rpc.example \
  --seed \
  --listen /ip4/0.0.0.0/tcp/4001 \
  --listen /ip4/127.0.0.1/tcp/4002/ws \
  --advertise /dns4/seed.example/tcp/4001 \
  --advertise /dns4/seed-ws.example/tcp/443/wss
```

Seed mode requires an Ethereum signing key and at least one explicitly advertised signed endpoint. The Ethereum payer need not match the peer identity. Keep the peer identity file stable, publish only externally reachable endpoints, and use a dedicated limited-balance payer key. Private and loopback endpoints are rejected unless `--allow-private-endpoints` is explicitly enabled.

`--application` with `--major-version` constructs and hashes the canonical `resurrect:<application>:<major-version>` preimage, then uses the built-in Ethereum mainnet registry and signed-libp2p codec defaults. `--namespace 0x...` accepts the already-derived value. Supply `--descriptor ./network.resurrect.json` instead when using another independently verified registry or codec profile. These three descriptor sources are mutually exclusive, and all still require a caller-selected `--rpc-url`.

The process writes no mandatory hosted API and needs no DNS name when an IP multiaddr is usable. `--status-file` enables an atomically replaced local JSON health snapshot. Use `--allow-unfinalized` only for development chains whose `safe` or `finalized` tag does not progress.

For deterministic native bootstrap without multicast, repeat `--native-peer` with a peer-ID-qualified multiaddr such as `/dns4/seed.example/tcp/4001/p2p/<peer-id>`. Configured peers, mDNS, and identify are attempted before Resurrect.

Operational details are in [Node operations](docs/node-operations.md).

## Use the Rust libraries

```toml
[dependencies]
resurrect-core = "0.4"
resurrect-ethereum = "0.4"
resurrect-libp2p = "0.4"
```

The main abstractions accept caller-owned providers, codecs, discovery sources, native peer stores, connectors, and publishers. Applications can use the scanner/codecs without adopting the reference CLI or SQLite cache. See [Application integration](docs/application-integration.md).

## Use the browser/static client

```bash
pnpm add @resurrect-protocol/client
```

```ts
import {
  ResurrectBrowserClient,
  ETHEREUM_MAINNET_MAX_BLOCKS_PER_TTL,
  deriveNamespace,
  ethereumMainnetDescriptor,
  injectedProvider,
  jsonRpcProvider
} from '@resurrect-protocol/client'

const descriptor = ethereumMainnetDescriptor(
  deriveNamespace('your-application', 1)
)
const provider = window.ethereum
  ? injectedProvider(window.ethereum)
  : jsonRpcProvider(userEnteredRpcUrl)

const client = new ResurrectBrowserClient(descriptor, provider)
const { candidates } = await client.scan({
  maxBlockLookback: ETHEREUM_MAINNET_MAX_BLOCKS_PER_TTL
})
```

Discovery never invokes `eth_requestAccounts`. The client verifies the chain and contract constants before scanning, searches only the recent TTL window, validates libp2p signed envelopes, and retains secure browser-capable endpoints. The Ethereum block lookback avoids historical state and block-body access; it uses bounded `eth_getLogs` calls and does not require an archive node. RPC URLs remain in memory unless the application explicitly calls `persistJsonRpcUrl`.

The package returns signed, validated dial candidates; the host application still owns its browser transport and authenticated application handshake. The repository's [onchain explorer](https://resurrect.wei.limo/) is a minimal reference host: it scans the canonical namespace, completes an authenticated libp2p WSS/Noise/Yamux connection, checks the remote peer ID, runs identify, and measures a standard libp2p ping. See [Browser client](docs/browser-client.md).

The explorer is permanently stored on Ethereum behind the immutable, [source-verified ERC-5219 router](https://etherscan.io/address/0x14765f12a7f068EDf42dF4920fd5170ADBa73306#code) `0x14765f12a7f068EDf42dF4920fd5170ADBa73306`. The registered WNS name `resurrect.wei` resolves to that router and publishes its ERC-6821 `contentcontract` record, making [resurrect.wei.limo](https://resurrect.wei.limo/) the primary onchain entry point. [resurrect.wei.domains](https://resurrect.wei.domains/) is an alternative name gateway; address-based [w3eth](https://0x14765f12a7f068edf42df4920fd5170adba73306.w3eth.io/) and [w3link](https://0x14765f12a7f068edf42df4920fd5170adba73306.1.w3link.io/) URLs remain independent fallbacks. Deployment hashes and byte-for-byte reconstruction evidence are recorded in [Onchain explorer](docs/onchain-explorer.md).

## Contract

`ResurrectBeaconV1` has exactly four public function selectors: `VERSION()`, `MAX_TTL()`, `MAX_RECORD_BYTES()`, and `announce(bytes32,uint32,uint32,bytes)`. It has no owner, storage-backed peer set, upgrade, pause, allowlist, withdrawal, or namespace administrator. Despite its name, it is a rendezvous beacon rather than an upgradeable proxy beacon.

The canonical source is [`contracts/src/ResurrectBeaconV1.sol`](contracts/src/ResurrectBeaconV1.sol). CI requires its npm package mirror to be byte-for-byte identical. The canonical Ethereum mainnet deployment is [`0x136c191B5e6541532E42Ecd7C719C29D7ecdf468`](https://etherscan.io/address/0x136c191B5e6541532E42Ecd7C719C29D7ecdf468#code) at block `25943058`; its runtime bytecode matches the local build, its source is publicly verified, and it received an external AI-orchestrated contract review. The [immutable audit report](https://bafkreid22gqqrzwo6b6scxqnmcmiinru3xzigz74xkere2573r6ivulzjq.ipfs.community.bgipfs.com/) reports 0 Critical, 0 High, 0 Medium, 2 Low, and 1 Informational finding. See [Audits](docs/audits.md) for scope and disposition.

`ResurrectOnchainSite` is a separate immutable content-router implementation. The production deployment serves six explorer resources from 24 bytecode-storage contracts, implements ERC-5219, and advertises the ERC-6944 resolve mode `5219`. It has no owner, mutable storage, or upgrade path. Its source, ABI, complete Ethereum deployment manifest, and `resurrect.wei` registration evidence are exported by `@resurrect-protocol/contracts`; see [Deployments](docs/deployments.md).

## Security

- Treat all registry data and RPC responses as untrusted.
- Authenticate the signed record and then the application protocol.
- Bound decoding, log processing, retained candidates, concurrent dials, timeouts, and retry rate.
- Do not interpret publisher addresses, log ordering, or payment as reputation.
- Do not assume the peer-record signature binds the event namespace, record type, TTL, expiry, or transaction sender; those fields remain untrusted discovery metadata in v1.
- Preserve native discovery and peer diversity to reduce eclipse risk.
- Do not announce private endpoints or stable identities when endpoint privacy is required.
- Replace or compare registry providers when omission or privacy threats matter.

Read the [security model](docs/security.md) and [security policy](SECURITY.md) before production deployment.

## Releases and publishing

All publishable artifacts are released by one CI workflow:

- a successful CI run for `main` publishes a unique `<workspace-base>-dev.<run>.<attempt>` version under npm's `next` tag and as matching crates.io prereleases;
- publishing a GitHub Release tagged `vMAJOR.MINOR.PATCH` publishes that exact stable version under npm's `latest` tag and crates.io's normal stable channel; and
- stable releases also attach versioned Linux, macOS, and Windows native binaries, checksums, and build attestations.

The private explorer application is not a registry package. After the same
`main` CI run succeeds, a separate workflow deploys its tested static build to
a Cloudflare Pages mirror. The canonical onchain release remains the immutable
build at [resurrect.wei.limo](https://resurrect.wei.limo/); publishing a
new Pages build does not alter the onchain router or WNS records.

The release pipeline runs tests before publication and publishes dependency crates in topological order with registry propagation retries. See [Releasing](docs/releasing.md).

## Project status

**Status: Production.** Resurrect v1 and its reference implementation are conformance-oriented and comprehensively tested. `ResurrectBeaconV1` at `0x136c191B5e6541532E42Ecd7C719C29D7ecdf468` was reviewed through OneDollarAudit; read the [report and maintainer disposition](docs/audits.md). That review is scoped to the 37-line deployed contract, not the Rust, TypeScript, node, explorer, peer-record codecs, or application handshake. Production users should review those components, key handling, and chain/RPC assumptions for their threat model.

## Contributing and license

See [CONTRIBUTING.md](CONTRIBUTING.md). Resurrect's original source code and documentation are licensed under the [MIT License](LICENSE). Dependency licenses remain their own.
