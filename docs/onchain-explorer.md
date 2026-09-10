# Onchain explorer

The current Resurrect explorer is stored entirely on Ethereum mainnet behind an immutable [ERC-5219](https://eips.ethereum.org/EIPS/eip-5219) resource router. The deployed application embeds the canonical `ResurrectBeaconV1` address and deployment block, so its default scan uses the same audited Beacon as the Rust and TypeScript packages. The explorer is a distribution and diagnostics client, not part of the Resurrect protocol.

## Deployment

| Field | Value |
|---|---|
| Network | Ethereum mainnet, chain ID `1` |
| Router | `0x14765f12a7f068EDf42dF4920fd5170ADBa73306` |
| Router block | `25943864` |
| First data-contract block | `25943834` |
| Deployment time | `2026-09-10T02:00:47Z` |
| Router transaction | `0x4a128735f12908e0979982b3b3e92d575a5bdd6b19f280eaaf6a6fb8c40e05b0` |
| Deployer | `0x6E4a6b178Fea5FA7cE3051615C49F26b177E74F0` |
| Canonical Beacon | `0x136c191B5e6541532E42Ecd7C719C29D7ecdf468`, block `25943058` |
| Router runtime hash | `0x7d6198765aea906764d581185b310fa9c2a41670c5a6b674233b442c11ea9ecd` |
| Manifest hash | `0x36f8d8a77af7849aa040a86d4f7663ab5a185b9d72e2ab500c9db85785ddd026` |
| Deployment cost | `0.007086418126710057 ETH`, `104317581` gas |

Open the immutable application through:

- [resurrect.wei](https://resurrect.wei.limo/) — primary human-readable entry point;
- [resurrect.wei.domains](https://resurrect.wei.domains/) — alternative name gateway;
- native name URL: `web3://resurrect.wei/`;
- native ERC-4804: `web3://0x14765f12a7f068EDf42dF4920fd5170ADBa73306:1/`;
- [w3eth](https://0x14765f12a7f068edf42df4920fd5170adba73306.w3eth.io/); or
- [w3link](https://0x14765f12a7f068edf42df4920fd5170adba73306.1.w3link.io/).

Inspect the publicly verified router source on [Etherscan](https://etherscan.io/address/0x14765f12a7f068EDf42dF4920fd5170ADBa73306#code) or [Sourcify](https://repo.sourcify.dev/1/0x14765f12a7f068EDf42dF4920fd5170ADBa73306). Etherscan reports `ResurrectOnchainSite`, Solidity `v0.8.24+commit.e11b9ed9`, optimization enabled with 20,000 runs, and a non-proxy deployment. Sourcify independently reports matching creation and runtime bytecode under match ID `48334992`. The authoritative machine-readable record—including every data address, transaction, block, payload length, and resource hash—is [`deployments/ethereum-mainnet-explorer.json`](../deployments/ethereum-mainnet-explorer.json) and is published as `@resurrect-protocol/contracts/deployments/ethereum-mainnet-explorer.json`.

## Artifact and storage layout

The deployment contains 467,179 resource bytes: one immutable router and 24 immutable data contracts across 25 confirmed transactions. Each data contract stores up to 24,000 payload bytes in runtime bytecode after a one-byte `STOP` sentinel. The router holds only immutable path metadata and data-contract addresses, reconstructing responses with `EXTCODECOPY`. It has no owner, mutable storage, proxy, upgrade, or withdrawal path.

| Path | Content type | Bytes | Chunks | Keccak-256 |
|---|---:|---:|---:|---|
| `/`, `/index.html` | `text/html; charset=utf-8` | 846 | 1 | `0xa041546d52f4a94300f04fb1ced3e058f843f2cd9edf54cab9370b7c4dff37a3` |
| `/index.css` | `text/css; charset=utf-8` | 6,573 | 1 | `0x1783b9d52010f4d0f016b802b7f73142142bc1395605bf57525f896d3174c544` |
| `/app.js` | `text/javascript; charset=utf-8` | 35,241 | 2 | `0x7add949f94f202fae190835642abec74bdeb4421b39ac7660934315be257f887` |
| `/rolldown-runtime.js` | `text/javascript; charset=utf-8` | 716 | 1 | `0x7de63044a95dcac21b8884ab40985883e687488e6e2abfd5770266e2c537cfb2` |
| `/peer-record.js` | `text/javascript; charset=utf-8` | 132,713 | 6 | `0xe69fcbeb747bf15edf524ec758d6340157a4460ac14ff0a7fcf77b84e1eb2529` |
| `/peer-probe.js` | `text/javascript; charset=utf-8` | 291,090 | 13 | `0xd52f2b97fec863c83fdffce1ad05e338e95a762e81cab8bacd99437c421ada7a` |

The manifest hash is `keccak256(abi.encode(paths, contentTypes, resourceHashes))` in the fixed order above. The build uses relative URLs, deterministic filenames, no source maps, and no fonts, images, analytics, indexer, embedded private API, RPC credential, or wallet account request. Beacon-event decoding loads with discovery; the larger libp2p/Noise probe loads only after `Ping` is selected.

`ResurrectOnchainSite.request` implements ERC-5219 and returns immutable cache headers, correct MIME types, and `404` for unknown or nested resources. `resolveMode()` returns the bytes32 value `"5219"` for the draft [ERC-6944](https://eips.ethereum.org/EIPS/eip-6944) bridge used by current ERC-4804 gateways. ERC-4804 and ERC-5219 are final; ERC-6944 remains a draft, so intended gateways must be tested independently.

## Deployment verification

The deployment passed these checks:

- all 25 transaction receipts succeeded;
- direct Ethereum calls returned `resolveMode`, `manifestHash`, resource metadata, correct responses, and `404` behavior;
- all 467,179 resource bytes reconstructed through the router matched `apps/explorer/dist` byte-for-byte;
- the deployed JavaScript contains the canonical Beacon address and omits superseded discovery defaults;
- Etherscan accepted the pinned source and compiler settings;
- Sourcify independently matched creation and runtime bytecode; and
- `resurrect.wei` resolved to the router with a matching ERC-6821 `contentcontract` record and empty contenthash;
- the `.wei.limo` and `.wei.domains` name gateways served all six resources byte-for-byte equal to the local build; and
- w3eth and w3link served the root document and every imported CSS and JavaScript resource, with every imported resource byte-for-byte equal to the local build.

The browser interoperability suite separately proves signed-record validation, Noise peer authentication, identify, and standard libp2p ping. A release operator should also perform a manual Scan/Ping check through the intended gateway before changing ENS.

HTTP ERC-4804 gateways may inject a compatibility shim into returned HTML. Gateway injection, caching, observation, or omission is part of the gateway trust boundary; imported resource hashes and direct contract responses remain independently verifiable.

## Compression

The router stores and returns the raw resource bodies listed above. Conventional HTTP hosting can negotiate gzip or Brotli without changing those artifacts, but this immutable deployment cannot add response encodings later.

[ERC-7618](https://eips.ethereum.org/EIPS/eip-7618) extends ERC-5219 resolve mode with `Content-Encoding` metadata for compressed onchain resources. A future deployment may store compressed bodies once selected clients and gateways are compatibility-tested. The explorer size check reports raw, gzip, and Brotli totals, but does not place compressed duplicates in `dist/`.

## Reproduce locally

Build and enforce the artifact budget:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm --filter @resurrect-protocol/explorer run build
pnpm --filter @resurrect-protocol/explorer run check:size
forge test --root contracts --match-contract ResurrectOnchainSiteTest -vv
```

Deploy to an already-running local Anvil chain using a funded local test key:

```bash
DEPLOYER_PRIVATE_KEY=0x... forge script \
  --root contracts \
  contracts/script/DeployResurrectExplorer.s.sol:DeployResurrectExplorer \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast
```

Then verify all resources against the local build:

```bash
scripts/verify-onchain-explorer.sh \
  http://127.0.0.1:8545 \
  0xYOUR_LOCAL_ROUTER
```

`scripts/checklist-integration.sh` performs that deployment and reconstruction automatically on a fresh Anvil chain before running the full multi-process Resurrect checklist.

## Publishing another immutable version

An onchain release cannot be patched. Build and test a reviewed source tree that pins the intended Beacon, deploy every resource and a new router, reconstruct every file through a caller-selected mainnet provider, verify the router source independently, test intended gateways and authenticated ping, replace the package deployment manifest, and then update both WNS router records. Never introduce a mutable owner or proxy merely to reuse an address.

See [WNS onchain explorer](wei-onchain-explorer.md) for the exact `resurrect.wei` registration, verification, renewal, and future-router procedure.

## Discovery without an indexer

The explorer does not require an archive node. Ethereum permits at most one execution block per 12-second slot, so 90 days contains at most 648,000 execution blocks. The explorer scans 650,000 blocks, including safety margin, using topic-filtered `eth_getLogs` requests of at most 10,000 blocks. The canonical Beacon is newer than that window today, so scanning begins at its deployment block.

The interface automatically tries an ordered, source-visible set of public Ethereum RPCs and displays the provider currently being queried. A custom RPC field and read-only injected-wallet path appear only after every default fails. Each result is decoded and cryptographically validated locally. An optional index can accelerate discovery but must never become the only recovery path. Bloom filters do not avoid an RPC query—`eth_getLogs` already uses indexed receipts and bloom data—and more frequent seed announcements do not shorten the safe scan window while records remain valid.
