# Onchain explorer

The Resurrect explorer is intentionally packaged so a version can later be served from Ethereum through an [ERC-5219 contract resource resolver](https://eips.ethereum.org/EIPS/eip-5219) and reached through an ERC-4804/Web3 URL gateway. Cloudflare Pages remains the current distribution path; it is not part of the protocol.

## Current artifact

Run:

```bash
pnpm --filter @resurrect-protocol/explorer run build
pnpm --filter @resurrect-protocol/explorer run check:size
```

The production build:

- uses only relative URLs;
- emits deterministic resource names instead of content-hashed paths;
- omits source maps;
- has no font, image, analytics, indexer, or private API dependency;
- loads registry decoding with the discovery client and defers the libp2p/Noise probe until `Ping` is selected; and
- is capped in CI at 525,000 raw bytes and 160,000 gzip bytes across all resources.

The exact byte count is printed by `check:size`; CI fails if it crosses either budget. Text and CSS are deliberately small, but most bytes are cryptography, libp2p, Noise, Yamux, identify, ping, and signed-record decoding. Removing explanatory copy alone cannot materially reduce that protocol payload.

## Recommended resource layout

Use a versioned, immutable resource deployment. An ERC-5219 router should return these build outputs with their correct content types:

| Path | Content type | Load phase |
|---|---|---|
| `/` and `/index.html` | `text/html; charset=utf-8` | initial |
| `/index.css` | `text/css; charset=utf-8` | initial |
| `/app.js` | `text/javascript; charset=utf-8` | initial |
| `/peer-record.js` | `text/javascript; charset=utf-8` | discovery |
| `/rolldown-runtime.js` | `text/javascript; charset=utf-8` | shared runtime |
| `/peer-probe.js` | `text/javascript; charset=utf-8` | first ping only |

The router should implement the ERC-5219 `request` interface and the ERC-6944 `resolveMode()` value `"5219"`. ERC-4804 and ERC-5219 are final; the ERC-6944 resolve-mode bridge, ERC-7617 chunking, and ERC-7618 content-encoding extensions are currently drafts. Test actual gateway behavior before relying on draft chunking or Brotli/gzip decoding.

Ethereum contract code is limited in size, so the resolver should keep only its path table and immutable resource pointers in the routing contract. Store large byte sequences across immutable data contracts or another audited bytecode-storage primitive. Do not concatenate the complete application in a stateful storage mapping: deployment gas is much higher and accidental mutation weakens the permanence claim.

ERC-5219 also permits `message/external-body` responses pointing to IPFS. That is dramatically cheaper, but it is an offchain-content deployment. Use it only as an explicit alternative; it does not meet a strict requirement that every application byte be present on Ethereum.

## ENS and gateway rollout

For `resurrect.cazala.eth`:

1. Deploy a versioned resource router from the exact release artifact and record every resource hash.
2. Rebuild locally and compare the complete artifact hash set with the deployed bytes.
3. Point the ENS subname at the resource contract using the resolver configuration required by the selected ERC-4804 client.
4. Test the native `web3://` URL and each intended HTTP gateway independently. At minimum verify `/`, every module import, content types, CORS access to the selected Ethereum RPC, injected-wallet discovery, and WSS ping.
5. Keep the prior contract address and artifact hashes documented. Upgrade the ENS pointer to a new immutable deployment rather than modifying a published version.

Gateway URLs are convenience transports and may observe, cache, omit, or alter responses unless the client verifies Ethereum state itself. A local ERC-4804 client backed by a light client provides a stronger verification path than a public HTTP gateway.

## Discovery without an indexer

The explorer does not need an archive node. Ethereum permits at most one execution block per 12-second slot, so 90 days contains at most 648,000 execution blocks. The explorer scans 650,000 blocks, including safety margin, directly with topic-filtered `eth_getLogs` requests of at most 10,000 blocks each. The canonical contract is newer than that window today, so scanning starts at its deployment block.

This avoids the historical `eth_getBlockByNumber` calls that some free RPCs time out or classify as premium history. It also retains Resurrect's recovery property: a static copy can discover peers from Ethereum without depending on a Resurrect-operated server.

The hosted interface automatically tries an ordered, source-visible set of public Ethereum RPCs. It shows the provider currently being queried and falls through on any incomplete scan. A custom RPC field and read-only injected-wallet path remain hidden until every default fails. This improves availability without making any provider authoritative: each successful result is still decoded and cryptographically validated by the browser client.

An HTTP index can be added later as an optional accelerator, but it must never be the only path. An index can omit events and is unavailable if its operator or domain disappears. Bloom filters do not remove the need for an RPC query; `eth_getLogs` already uses the node's indexed receipts and bloom data. Publishing seed announcements more often also does not shorten the safe scan window while 90-day records remain valid, and it increases gas and duplicate logs.

## Release gate

Before an onchain deployment:

- all explorer and cross-runtime Rust-to-browser tests must pass;
- `check:size` must pass on the release build;
- the output must contain no source maps, absolute asset paths, secrets, or RPC credentials;
- all resources must be reproducibly hashed and compared after deployment;
- the resolver interface and MIME behavior must be tested against the target gateways; and
- discovery and authenticated ping must be repeated from the final ENS/gateway origin.
