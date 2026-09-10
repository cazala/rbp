# Changelog

All notable changes are documented here. The project follows Semantic Versioning for released artifacts; pre-1.0 minor versions may include intentional interface changes described in release notes.

## Unreleased

### Added

- An archive-free TypeScript scan mode using a chain-profile block lookback,
  with regression coverage for free-tier request timeouts.
- An enforced explorer artifact-size budget and ERC-5219/onchain deployment
  guidance.

### Changed

- The canonical Ethereum descriptor, native node, browser client, explorer, deployment manifest, and contracts package now use the source-verified and audited `ResurrectBeaconV1` deployment at `0x136c191B5e6541532E42Ecd7C719C29D7ecdf468`.
- `ResurrectBeaconV1` is now the sole rendezvous contract source and ABI shipped by `@resurrect-protocol/contracts`.
- The explorer now uses a compact single-screen interface, deterministic
  relative assets, no production source maps, and a lazy-loaded libp2p probe.
- The default public Ethereum endpoint is `https://rpc.mevblocker.io`.

### Fixed

- Injected-provider errors now preserve nested wallet messages instead of
  rendering `[object Object]`.
- Ethereum browser discovery no longer requires historical block-body calls.

## 0.4.0 - 2026-09-03

### Added

- Native libp2p-over-WebSocket listeners alongside the existing TCP transport,
  with Noise/Yamux authentication and Rust transport tests.
- A static browser explorer with editable or injected read-only Ethereum
  providers, bounded discovery metrics, authenticated WSS dialing, peer-ID
  verification, identify, and ping.
- A real Rust-to-JavaScript WebSocket interoperability suite included in the
  implementer-checklist integration test.
- Cloudflare Pages deployment automation for the tested `main` commit and
  production topology/runbook documentation.

### Fixed

- JSON-RPC range errors are decoded before HTTP status handling so providers
  such as dRPC can trigger the scanner's adaptive block-range reduction.

## 0.3.0 - 2026-09-02

### Added

- `--application` and `--major-version` namespace-preimage support in the native
  node, alongside the existing precomputed `--namespace` option.
- Release and CI coverage for namespace derivation and canonical deployment
  defaults.

## 0.2.0 - 2026-09-01

### Changed

- Package publication waits for npm registry scan visibility and safely resumes
  after partial registry publication.
- Release asset uploads explicitly target the canonical repository.

## 0.1.0 - 2026-09-01

### Added

- Immutable, stateless, permissionless `ResurrectBeaconV1` with Foundry
  example, fuzz, invariant, and optional fork suites.
- Rust core, Ethereum, libp2p, and native-node crates; browser/static TypeScript
  client; canonical contracts package; and cross-language vectors.
- End-to-end Anvil implementer-checklist coverage for empty-network promotion,
  Resurrect-only discovery, native joining, total shutdown, unrelated-operator
  reboot, and simultaneous reboot.
- Automated `next` and `latest` package publication plus native release binaries,
  checksums, attestations, and comprehensive protocol documentation.
