# Resurrect Explorer

The production explorer is hosted at [resurrect.caza.la](https://resurrect.caza.la). Its source is this directory; it has no server-side application or private API.

The explorer is a small static browser application built on `@resurrect-protocol/client`. It separates two different claims:

1. **Discovery:** Ethereum contains an unexpired, cryptographically valid signed peer record.
2. **Liveness:** this browser established a Noise-authenticated libp2p connection to that exact peer and received a standard libp2p ping response.

The Ethereum provider can be an editable JSON-RPC URL or an injected EIP-1193 wallet provider. The default is `https://rpc.mevblocker.io`. That URL is a UI convenience, not part of the Resurrect protocol or network descriptor. Injected discovery is read-only and never requests wallet accounts.

The canonical Ethereum profile scans a conservative 650,000-block window: the 648,000 execution slots that fit inside the registry's 90-day `MAX_TTL`, plus a 2,000-block confirmation and boundary margin. It uses `eth_getLogs` in 10,000-block chunks and does not request historical state or historical block bodies. This works with ordinary full-node RPC service; it does not require an archive node. Custom and wallet providers can still impose their own method, range, CORS, or rate limits.

## Run locally

```bash
pnpm install
pnpm dev:explorer
```

Build deployable static files with:

```bash
pnpm --dir apps/explorer run build
```

The output is written to `apps/explorer/dist/` with relative asset URLs.

Enforce the onchain-oriented artifact budget after building:

```bash
pnpm --dir apps/explorer run check:size
```

The build has deterministic relative filenames, omits source maps, and loads the large libp2p probe only when a peer is pinged. CI caps the complete artifact at 525 KB raw and 160 KB gzip. See [Onchain explorer](../../docs/onchain-explorer.md).

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
