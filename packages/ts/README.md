# `@resurrect-protocol/client`

Browser/static Resurrect v1 registry discovery with caller-supplied JSON-RPC or EIP-1193 providers. The package verifies descriptors, provider chain and contract constants, recent registry logs, standard libp2p Signed Envelopes, peer identity, record sequence, expiry, and secure browser endpoint policy.

It does not request wallet accounts, ship a mandatory RPC hostname, persist URLs automatically, dial a transport, or authenticate your application protocol.

## Use it with libp2p

A js-libp2p host can consume the registry directly through the `./libp2p`
subpath export, which implements the standard `PeerDiscovery` interface:

```ts
import { resurrectPeerDiscovery } from '@resurrect-protocol/client/libp2p'

const node = await createLibp2p({
  peerDiscovery: [
    resurrectPeerDiscovery({
      client,
      // Resurrect is a recovery path, not a discovery loop. Without this gate
      // a healthy node keeps reading Ethereum for peers it does not need.
      shouldScan: () => node.getConnections().length < 2
    })
  ]
})
```

Discovered peers arrive as ordinary `peer` events and land in the host's peer
store. Each one has had its signed record verified, but discovery is not
endorsement: the host applies its usual dial and connection-gating policy, as
it would for any other discovery source.

## Install

```bash
npm install @resurrect-protocol/client
```

Node.js 22 or newer is required for the supported server-side toolchain. The emitted ESM targets modern browsers and ES2022.

## Create a descriptor and provider

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

const provider = selectedEip1193Provider
  ? injectedProvider(selectedEip1193Provider)
  : jsonRpcProvider(userEnteredRpcUrl)

const client = new ResurrectBrowserClient(descriptor, provider)
const report = await client.scan({
  maxBlockLookback: ETHEREUM_MAINNET_MAX_BLOCKS_PER_TTL
})
for (const candidate of report.candidates) {
  await yourAuthenticatedBrowserTransport.dial(candidate.peerId, candidate.endpoints)
}
```

`ethereumMainnetDescriptor` pins the published Beacon at `0x136c191B5e6541532E42Ecd7C719C29D7ecdf468`, chain ID `1`, and deployment block `25943058`; it defaults to signed libp2p records (codec `2`). The namespace and RPC provider remain application-owned. Use `parseDescriptor` when selecting a different verified deployment or codec profile. A descriptor must never contain an RPC URL.

## Provider behavior

The provider abstraction exposes `request(method, params)`. Discovery calls only read methods and rejects a provider whose `eth_chainId` or registry constants differ from the descriptor. The injected adapter does not call `eth_requestAccounts`.

Replace a failed or untrusted provider without reconstructing the client:

```ts
client.setProvider(jsonRpcProvider(replacementUrl))
await client.verifyProvider()
```

Custom URLs remain in memory by default. Persistence requires an explicit call:

```ts
persistJsonRpcUrl(userApprovedUrl, window.localStorage)
```

Do not log URLs containing credentials. Surface CORS, TLS, mixed-content, wrong-chain, and provider-limit errors to the user.

## Scan options

```ts
const report = await client.scan({
  confirmations: 12n,
  // Ethereum: 90 days / 12-second slots, plus confirmation/boundary margin.
  // This avoids historical block-body requests on constrained RPCs.
  maxBlockLookback: ETHEREUM_MAINNET_MAX_BLOCKS_PER_TTL,
  initialChunkSize: 10_000n,
  minimumChunkSize: 64n,
  maxLogs: 50_000,
  maxCandidates: 256,
  maxEndpointsPerRecord: 16,
  allowPrivateEndpoints: false
})
```

Without `maxBlockLookback`, the scanner binary-searches block timestamps to avoid genesis scans. A chain profile may instead provide a conservative maximum number of blocks that can fit inside `MAX_TTL`; that path reads the latest block and bounded event logs only, so it does not require historical state or block-body access. The value MUST be large enough for the chain's maximum block production over the full TTL, including a finality/boundary margin. The scanner automatically reduces log ranges after common provider limit or timeout errors.

Individual invalid events are counted in `recordsRejected`; provider and configuration failures reject the scan.

`candidates` contain the peer ID, signed-record sequence, secure browser endpoints, raw signed envelope, registry expiry, block number, and log index. Duplicate peers retain the highest signed sequence, with onchain position as a tie-breaker.

## Browser endpoint profile

Codec 2 records must contain at least one signed multiaddr usable by a browser: WebTransport, secure WebSocket, HTTPS, or TLS+WebSocket. A present `/p2p` component must agree with the signed identity. Private/special IP literals and plaintext native-only TCP endpoints are rejected by default.

Resurrect discovery is not application authorization. After dialing, authenticate the expected transport peer and perform your application's normal version/capability/membership handshake.

## Public API

- `parseDescriptor`, `parseDescriptorJson`, `deriveNamespace`, `ethereumMainnetDescriptor`
- `ETHEREUM_MAINNET_MAX_BLOCKS_PER_TTL` for archive-free Ethereum scans
- `ETHEREUM_MAINNET_REGISTRY` and its chain/address/deployment-block constants
- `jsonRpcProvider`, `injectedProvider`, `persistJsonRpcUrl`
- `ResurrectBrowserClient`, `scanRegistry`, `verifyProvider`
- `decodeBrowserPeerRecord`
- TypeScript interfaces for descriptors, providers, scan options/reports, and candidates

## Security

RPC results and registry events are untrusted. Keep log, candidate, endpoint, and dial limits bounded. Permit provider replacement. Do not infer trust from the transaction sender or registry ordering. See the repository [security model](https://github.com/cazala/resurrect/blob/main/docs/security.md) and specification for the complete threat model.

Licensed under the [MIT License](https://opensource.org/license/mit).
