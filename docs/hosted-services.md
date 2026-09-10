# Hosted reference services

The hosted components are a public demonstration and an integration target for
the reference implementation. They are not part of the Resurrect protocol's
liveness assumptions: another operator can use the immutable Ethereum registry,
their own namespace, RPC provider, seed, DNS name, TLS edge, and UI.

## Production endpoints

| Component | Public endpoint | Role |
|---|---|---|
| Explorer | [https://resurrect.caza.la](https://resurrect.caza.la) | static discovery and authenticated peer probe |
| Native seed | `/dns4/resurrect-seed.caza.la/tcp/4001` | direct rust-libp2p TCP/Noise/Yamux |
| Browser seed | `/dns4/resurrect-ws.caza.la/tcp/443/wss` | WSS/Noise/Yamux through Cloudflare Tunnel |

Both seed endpoints terminate in the same `resurrect-node` process and therefore
authenticate as peer
`12D3KooWRFAprLu4b2RQzq9PWJ2sTYSYuCYA9yDJNEF5kFPYh7B6`. The record is
announced under namespace
`0x71572bed5372559cfc007b7da8b411f2d96091816cdf057de65151b984a74e90`,
derived from `resurrect:resurrect:1`,
through the canonical Ethereum Beacon at
`0x136c191B5e6541532E42Ecd7C719C29D7ecdf468`.

The production service pins that chain, Beacon address, deployment block, namespace, TTL limit, and signed libp2p codec in `/etc/resurrect/network.json`, installed from [`deploy/systemd/resurrect-mainnet.json`](../deploy/systemd/resurrect-mainnet.json). This explicit descriptor lets the deployment remain pinned even while the binary is upgraded.

These values are public routing and identity data. The libp2p private key,
Ethereum payer key, provider URL, Cloudflare connector token, and CI token are
never stored in the repository or served to the browser.

## Seed topology

The `resurrect-seed.service` systemd unit runs the released Linux binary with two
listeners:

```text
0.0.0.0:4001  → /ip4/0.0.0.0/tcp/4001
127.0.0.1:4002 → /ip4/127.0.0.1/tcp/4002/ws
```

TCP 4001 is allowed through the instance firewall. TCP 4002 remains loopback
only. A separately supervised `cloudflared` connector opens an outbound tunnel
and maps `resurrect-ws.caza.la` to `http://127.0.0.1:4002`, with a final 404
catch-all. The connector token is stored in a root-readable file outside the
repository. Cloudflare terminates public TLS and carries WebSocket upgrades;
libp2p Noise still authenticates the peer end to end.

The node's identity file and SQLite cache live under `/var/lib/resurrect`; its
RPC URL and dedicated limited-balance announcement key live in the root-only
`/etc/resurrect/seed.env`. Preserve the identity across upgrades. The cache is
disposable. Never put the tunnel token or either private key in the unit file,
shell history, logs, deployment manifest, or GitHub Actions output.

## Explorer deployment

The explorer is a static Vite build with no origin server, database, analytics,
or server-held RPC credential. Cloudflare Pages project `resurrect` serves the
production `main` branch. `resurrect.caza.la` is attached as its custom domain.

Pull requests and pushes run the explorer type checks, unit tests, production
build, and Rust-to-browser libp2p interoperability test in CI. A successful
push-triggered CI run for `main` starts `deploy-explorer.yml`, which checks out
the exact tested commit, repeats the explorer checks, and performs a direct
Pages upload. A pull request never deploys.

The deployment workflow uses:

- `CLOUDFLARE_ACCOUNT_ID`: the account that owns the Pages project; and
- `CLOUDFLARE_API_TOKEN`: a token restricted to Cloudflare Pages edit access.

Place them in the `explorer-production` GitHub Environment or as repository
secrets. Environment protection rules can require approval before production
deployment. DNS and Tunnel administration are not required by routine Pages
deployments after the one-time setup.

The production ERC-5219 deployment at `0x14765f12a7f068EDf42dF4920fd5170ADBa73306` is an immutable build that embeds the canonical Beacon. Routine Pages deployments cannot update it; another onchain version requires a deliberate manual deployment and full verification before the ENS address record changes. See [Onchain explorer](onchain-explorer.md) and [ENS onchain explorer](ens-onchain-explorer.md).

## Upgrade procedure

1. Merge a CI-green change to `main`; confirm the `next` packages and Pages
   deployment correspond to that exact commit.
2. Publish a stable `vMAJOR.MINOR.PATCH` GitHub Release and wait for packages,
   checksums, attestations, and all platform binaries.
3. Verify the Linux archive against `SHA256SUMS`, install it atomically on the
   seed host, and keep the previous binary available for rollback.
4. Add both listeners and both advertised endpoints to the systemd unit, then
   restart the node and inspect its local status JSON and logs.
5. Confirm the Cloudflare connector is active and the DNS records are proxied.
6. Wait for the higher-sequence record containing the WSS endpoint to become
   visible at the selected confirmed head.
7. Scan and run an authenticated ping from a fresh browser session at the
   production explorer. Also dial TCP 4001 from a native node.

Roll back the binary if the process cannot maintain either listener. Do not
remove the previous WSS ingress until a newer signed record without that
endpoint is confirmed or the old record expires.

## Production verification

Check all layers independently:

```bash
systemctl is-active resurrect-seed cloudflared
ss -lntp | grep -E ':4001|:4002'
curl --fail --silent --show-error https://resurrect.caza.la/
```

A normal HTTPS request to `resurrect-ws.caza.la` is not a complete health check;
the origin speaks libp2p WebSocket rather than HTTP content. Use the explorer's
authenticated probe or another libp2p client to verify WSS, Noise, Yamux,
identify, and ping together. Finally, inspect the registry scan result to prove
the endpoint is discoverable rather than merely dialable when supplied out of
band.

Operational success means all of the following agree: DNS, tunnel ingress,
running listener, signed record, authenticated peer ID, and live ping. A Pages
200 response alone proves only that the static UI is available.
