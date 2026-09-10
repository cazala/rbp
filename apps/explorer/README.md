# Resurrect Explorer

The production explorer is hosted at [resurrect.caza.la](https://resurrect.caza.la). Its source is this directory; it has no server-side application or private API.

The explorer is a small static browser application built on `@resurrect-protocol/client`. It separates two different claims:

1. **Discovery:** Ethereum contains an unexpired, cryptographically valid signed peer record.
2. **Liveness:** this browser established a Noise-authenticated libp2p connection to that exact peer and received a standard libp2p ping response.

The compact namespace row accepts a readable application identifier and major version. Press **Scan** or Enter to derive the namespace and query it. Every pair, including the default `resurrect:v1`, is derived canonically as `keccak256("resurrect:<application>:<major>")` by the client helper.

The scan tries these browser-compatible public Ethereum RPCs in order and stops at the first complete result:

1. `https://rpc.mevblocker.io`
2. `https://ethereum-rpc.publicnode.com`
3. `https://evm.stupidtech.net/v1/ethereum`
4. `https://eth.drpc.org`
5. `https://cloudflare-eth.com`

The loading line names the active RPC and advances automatically when a provider fails. Only after every default fails does the explorer reveal an editable Ethereum RPC field and injected-wallet option. The defaults are UI conveniences, not part of the Resurrect protocol or network descriptor. Injected discovery is read-only and never requests wallet accounts.

The canonical Ethereum profile scans a conservative 650,000-block window: the 648,000 execution slots that fit inside the registry's 90-day `MAX_TTL`, plus a 2,000-block confirmation and boundary margin. It uses `eth_getLogs` in 10,000-block chunks and does not request historical state or historical block bodies. This works with ordinary full-node RPC service; it does not require an archive node. Custom and wallet providers can still impose their own method, range, CORS, or rate limits.

## Run locally

```bash
pnpm install
pnpm dev:explorer
```

To test from another device on the same network, bind Vite to all local interfaces:

```bash
pnpm --dir apps/explorer run dev -- --host 0.0.0.0
```

Open the printed network URL on the other device. The manual fallback placeholder, `http://127.0.0.1:8545`, is the standard local execution-client RPC address. `127.0.0.1` always means the device running the browser; use the node machine's LAN address instead when they are different devices. A browser-accessible node must also allow the explorer origin through CORS.

Build deployable static files with:

```bash
pnpm --dir apps/explorer run build
```

The output is written to `apps/explorer/dist/` with relative asset URLs.

Enforce the onchain-oriented artifact budget after building:

```bash
pnpm --dir apps/explorer run check:size
```

The build has deterministic relative filenames, omits source maps, avoids runtime ABI parsers in the registry scanner, and loads the large libp2p probe only when a peer is pinged. CI caps the complete artifact at 525 KB raw and 160 KB gzip; the size report also shows the Brotli equivalent.

`dist/` intentionally contains normal uncompressed resources. Cloudflare or another conventional HTTP server can compress those bytes in transit. A future onchain router can instead store compressed bodies and return `Content-Encoding` metadata using [ERC-7618](https://eips.ethereum.org/EIPS/eip-7618), subject to gateway support. The current immutable ERC-5219 router serves these raw resource bodies, so local builds do not add `.gz` files that gateways would treat as different resources. See [Onchain explorer](../../docs/onchain-explorer.md).

## Deployment

The Cloudflare Pages project is named `resurrect`, its production branch is
`main`, and the custom domain is `resurrect.caza.la`. The
`deploy-explorer.yml` workflow checks out the exact commit from a successful
push-triggered CI run, repeats the explorer checks, and deploys that build.
Pull requests build and test the explorer but never deploy it.

The workflow needs repository or `explorer-production` environment secrets
named `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`. The token needs
Cloudflare Pages edit access for the account; it does not need DNS, Tunnel, or
zone-wide write access after the custom domain is attached.

## What the explorer reports

- Matching announcements and deduplicated browser-ready peers.
- Peer identity, endpoint, expiry, and announcement block.
- Live WSS connection time, ping RTT, remote agent, and protocol version.

An announcement count is not a live-peer count. Announcements can be duplicated and can remain unexpired after a peer goes offline. Resurrect deliberately has no authoritative membership or topology service.

The probe appends the expected peer ID to a signed endpoint before dialing, completes Noise and Yamux negotiation, compares the authenticated remote identity with the registry record, runs identify, and then uses the standard libp2p ping protocol. TLS protects the browser WebSocket hop; Noise binds the connection to the announced libp2p identity.

The reference seed advertises
`/dns4/resurrect-ws.caza.la/tcp/443/wss`. Cloudflare terminates TLS and forwards
WebSocket upgrades through a dedicated tunnel to the seed's loopback-only
`/ip4/127.0.0.1/tcp/4002/ws` listener. The same Rust process continues serving
native clients on TCP 4001.
