# Onchain explorer

The production Resurrect explorer is permanently stored on Ethereum mainnet behind an immutable [ERC-5219](https://eips.ethereum.org/EIPS/eip-5219) resource router. Cloudflare Pages remains a convenient conventional mirror; neither distribution path is part of the Resurrect protocol.

## Live deployment

| Field | Value |
|---|---|
| Network | Ethereum mainnet, chain ID `1` |
| Router | `0xb69aF08877a0C417169135D6710Bca4840CCCdE1` |
| Router block | `25936611` |
| First data-contract block | `25936585` |
| Deployment time | `2026-09-09T01:44:35Z` |
| Router transaction | `0x79f6fe3d1871d574d2e6e3201a08e7c1a36878648401af6f9ba597729ef88b78` |
| Source commit | `5f167abf8a4d5cac38b8f56dd22f9ab236cd4c62` |
| Explorer artifact commit | `dff3cc44087a4c3b1931aef9d5beb9f6c3bed73c` |
| Router runtime hash | `0x4e8268e3d86eea86e5b2a4b376d240273a25bee5b1d76cade546375ad6a181bf` |
| Manifest hash | `0xd23db1c25fef981cc403b978336a1795c0f891ac5f1f942c4ef4b33c15c33c02` |
| Deployment cost | `0.006929689171978036 ETH`, `110247127` gas |

Open the address through:

- native ERC-4804: `web3://0xb69aF08877a0C417169135D6710Bca4840CCCdE1:1/`;
- [w3eth](https://0xb69af08877a0c417169135d6710bca4840cccde1.w3eth.io/); or
- [w3link](https://0xb69af08877a0c417169135d6710bca4840cccde1.1.w3link.io/).

The router and transaction are also visible on [Etherscan](https://etherscan.io/address/0xb69aF08877a0C417169135D6710Bca4840CCCdE1). The complete authoritative record—including every chunk address, transaction, block, payload length, and file hash—is [`deployments/ethereum-mainnet-explorer.json`](../deployments/ethereum-mainnet-explorer.json). It is published as `@resurrect-protocol/contracts/deployments/ethereum-mainnet-explorer.json`.

## Artifact and storage layout

The deployment contains 494,226 resource bytes: one immutable router and 25 immutable data contracts across 26 confirmed transactions. Each data contract stores up to 24,000 payload bytes in runtime bytecode after a one-byte `STOP` sentinel. The router holds only immutable path metadata and chunk addresses, reconstructing a response with `EXTCODECOPY`. It has no owner, mutable storage, proxy, upgrade, or withdrawal path.

| Path | Content type | Bytes | Chunks | Keccak-256 |
|---|---:|---:|---:|---|
| `/`, `/index.html` | `text/html; charset=utf-8` | 661 | 1 | `0xb11742d9a343d4d8ca148ef1592a8cdbb470752fd60e596b8b3a329c7cd3e213` |
| `/index.css` | `text/css; charset=utf-8` | 5,521 | 1 | `0x46890c55fc010d0cbc6fe7851cb1ff53c14b1abaa1ddd3a81c97c1d6dc019719` |
| `/app.js` | `text/javascript; charset=utf-8` | 63,525 | 3 | `0x04d1f263ea798d7df89dd06b74b8da6d0a10a67a96f953b94da410e9309dccf5` |
| `/rolldown-runtime.js` | `text/javascript; charset=utf-8` | 716 | 1 | `0x7de63044a95dcac21b8884ab40985883e687488e6e2abfd5770266e2c537cfb2` |
| `/peer-record.js` | `text/javascript; charset=utf-8` | 132,713 | 6 | `0xe69fcbeb747bf15edf524ec758d6340157a4460ac14ff0a7fcf77b84e1eb2529` |
| `/peer-probe.js` | `text/javascript; charset=utf-8` | 291,090 | 13 | `0xd52f2b97fec863c83fdffce1ad05e338e95a762e81cab8bacd99437c421ada7a` |

The manifest hash is `keccak256(abi.encode(paths, contentTypes, resourceHashes))` in the fixed order shown above. The production build uses relative URLs, deterministic filenames, no source maps, and no fonts, images, analytics, indexer, private API, RPC credential, or wallet account request. Registry decoding loads with discovery; the larger libp2p/Noise probe loads only after `Ping` is selected.

`ResurrectOnchainSite.request` implements ERC-5219 and returns immutable cache headers, correct MIME types, and `404` for unknown or nested resources. `resolveMode()` returns the bytes32 value `"5219"` for the draft [ERC-6944](https://eips.ethereum.org/EIPS/eip-6944) bridge used by current ERC-4804 gateways. ERC-4804 and ERC-5219 are final; ERC-6944 remains a draft, so each intended gateway must be tested independently.

## Verification performed

The final mainnet deployment passed all of these checks:

- `resolveMode`, `manifestHash`, response status, MIME, immutable cache header, resource metadata, and `404` behavior were read from Ethereum;
- all 494,226 application bytes returned by the router matched `apps/explorer/dist` byte-for-byte;
- w3eth and w3link returned every CSS and JavaScript asset with exact bytes and correct content types;
- the w3eth page loaded with no browser console errors;
- Scan found the live seed through registry events; and
- Ping authenticated the recovered peer through Noise, ran identify, and completed standard libp2p ping over `/dns4/resurrect-ws.caza.la/tcp/443/wss`.

The tested peer was `12D3KooWRFAprLu4b2RQzq9PWJ2sTYSYuCYA9yDJNEF5kFPYh7B6`; the observed gateway run completed connection in 1,950 ms and ping in 306 ms. These timings are observations, not service guarantees.

HTTP ERC-4804 gateways may inject a compatibility shim into the returned HTML, so their root document is larger than the immutable 661-byte source. The imported resource bodies remained exact. Gateway injection, caching, observation, or omission is part of the gateway trust boundary; use a native client backed by a trusted Ethereum provider for the strongest verification path.

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

## Publishing a new immutable version

An onchain release cannot be patched. Build and test a reviewed commit, deploy every resource and a new router, reconstruct every file through a caller-selected mainnet provider, test intended gateways and authenticated ping, then add a new immutable deployment manifest. Preserve prior addresses and hashes. Update the ENS address record to the new router only after verification; never introduce a mutable owner or proxy merely to reuse the old address.

See [ENS onchain explorer](ens-onchain-explorer.md) for the exact `resurrect.cazala.eth` update and verification procedure.

## Discovery without an indexer

The explorer does not require an archive node. Ethereum permits at most one execution block per 12-second slot, so 90 days contains at most 648,000 execution blocks. The explorer scans 650,000 blocks, including safety margin, using topic-filtered `eth_getLogs` requests of at most 10,000 blocks. The canonical registry is newer than that window today, so scanning begins at its deployment block.

The interface automatically tries an ordered, source-visible set of public Ethereum RPCs and displays the provider currently being queried. A custom RPC field and read-only injected-wallet path appear only after every default fails. Each successful result is still decoded and cryptographically validated locally. An optional index could accelerate discovery but must never become the only recovery path. Bloom filters do not avoid an RPC query—`eth_getLogs` already uses indexed receipts and bloom data—and more frequent seed announcements do not shorten the safe scan window while records remain valid.
