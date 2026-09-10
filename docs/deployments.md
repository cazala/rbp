# Ethereum deployments

## Reference Ethereum mainnet deployment

The reference packages default to this immutable, audited `ResurrectBeaconV1` deployment. Despite its name, it is a rendezvous beacon rather than an upgradeable proxy beacon:

| Field | Value |
|---|---|
| Network | Ethereum mainnet |
| EIP-155 chain ID | `1` |
| Contract | `0x136c191B5e6541532E42Ecd7C719C29D7ecdf468` |
| Deployment block | `25943058` |
| Deployment time | `2026-09-09T23:19:35Z` |
| Transaction | `0x8e7c2ddf815d44166d436fabd886a05bac6eab25ba5abf6faf9e93e3e179b8d6` |
| Deployer | `0x6E4a6b178Fea5FA7cE3051615C49F26b177E74F0` |
| Creation bytecode hash | `0x449675c0d8b1c3ba38a1cd0c633ee043a9f328c14535ea04ff6d9e51845efa3a` |
| Runtime bytecode hash | `0x20999e7bf54d855e3bfedebfd7053d41f0c873ecde3b9d70a71ee6dcd086bce7` |
| Compiler | Solidity `0.8.24`, optimizer enabled, `20000` runs, EVM `cancun`, CBOR metadata disabled, bytecode hash `none` |
| Audit | OneDollarAudit job `904`, completed `2026-09-10` |

Inspect the [deployment transaction](https://etherscan.io/tx/0x8e7c2ddf815d44166d436fabd886a05bac6eab25ba5abf6faf9e93e3e179b8d6), [verified source on Etherscan](https://etherscan.io/address/0x136c191B5e6541532E42Ecd7C719C29D7ecdf468#code), [Sourcify full match](https://sourcify.dev/server/v2/contract/1/0x136c191B5e6541532E42Ecd7C719C29D7ecdf468), [audit job](https://www.onedollaraudit.com/audit/904), or the [immutable audit report](https://bafkreid22gqqrzwo6b6scxqnmcmiinru3xzigz74xkere2573r6ivulzjq.ipfs.community.bgipfs.com/). The complete deployment record is machine-readable at [`deployments/ethereum-mainnet.json`](../deployments/ethereum-mainnet.json) and is also published by `@resurrect-protocol/contracts/deployments/ethereum-mainnet.json`.

Deployment verification established all of the following:

- the receipt succeeded at the pinned block;
- the onchain runtime bytecode is byte-for-byte equal to the local build;
- Etherscan reports the exact source verified with Solidity `0.8.24` and `20000` optimizer runs;
- Sourcify reports matching creation and runtime code for the published source;
- `VERSION() == 1`, `MAX_TTL() == 7776000`, and `MAX_RECORD_BYTES() == 4096`;
- the contract exposes only the three constant getters and `announce(bytes32,uint32,uint32,bytes)`;
- sampled storage remains empty; and
- the deployer has no owner, upgrade, pause, allowlist, withdrawal, or namespace authority.

The audit reports 0 Critical, 0 High, 0 Medium, 2 Low, and 1 Informational finding. Maintainer decisions and the precise audit boundary are recorded in [Audits](audits.md).

The deployment is a convenient shared log contract, not a canonical peer list or control plane. Applications still choose their own namespace and signed-record codecs. Users still choose their own RPC provider. Any account may publish under any namespace, and clients treat every event as untrusted until its signed peer record and application handshake are verified.

## Immutable explorer deployment

The current Resurrect explorer is stored entirely on Ethereum. This is a separate ERC-5219 content contract; it is not a Beacon and applications do not place it in a network descriptor. Its embedded browser client uses the canonical Beacon above.

| Field | Value |
|---|---|
| Network | Ethereum mainnet, chain ID `1` |
| Router | `0x14765f12a7f068EDf42dF4920fd5170ADBa73306` |
| Deployment block | `25943864` |
| Deployment time | `2026-09-10T02:00:47Z` |
| Transaction | `0x4a128735f12908e0979982b3b3e92d575a5bdd6b19f280eaaf6a6fb8c40e05b0` |
| Deployer | `0x6E4a6b178Fea5FA7cE3051615C49F26b177E74F0` |
| Runtime bytecode hash | `0x7d6198765aea906764d581185b310fa9c2a41670c5a6b674233b442c11ea9ecd` |
| Resource manifest hash | `0x36f8d8a77af7849aa040a86d4f7663ab5a185b9d72e2ab500c9db85785ddd026` |
| Storage | 467,179 bytes in 24 immutable data contracts plus one router |
| Primary name gateway | [`resurrect.wei`](https://resurrect.wei.limo/) |
| Alternative name gateway | [`resurrect.wei`](https://resurrect.wei.domains/) |

Open the primary human-readable deployment at [resurrect.wei.limo](https://resurrect.wei.limo/), with [resurrect.wei.domains](https://resurrect.wei.domains/) as an alternative. The WNS name resolves to the router and its ERC-6821 `contentcontract` record names the same Ethereum address. Inspect the [verified router source on Etherscan](https://etherscan.io/address/0x14765f12a7f068EDf42dF4920fd5170ADBa73306#code), the independent [Sourcify match](https://repo.sourcify.dev/1/0x14765f12a7f068EDf42dF4920fd5170ADBa73306), its [deployment transaction](https://etherscan.io/tx/0x4a128735f12908e0979982b3b3e92d575a5bdd6b19f280eaaf6a6fb8c40e05b0), or the address-based [w3eth](https://0x14765f12a7f068edf42df4920fd5170adba73306.w3eth.io/) and [w3link](https://0x14765f12a7f068edf42df4920fd5170adba73306.1.w3link.io/) fallbacks. Etherscan reports Solidity `0.8.24`, 20,000 optimizer runs, and non-proxy status. Sourcify reports matching creation and runtime bytecode. The complete machine-readable record is [`deployments/ethereum-mainnet-explorer.json`](../deployments/ethereum-mainnet-explorer.json) and is exported by `@resurrect-protocol/contracts/deployments/ethereum-mainnet-explorer.json`.

Deployment verification reconstructed all six resources from mainnet and compared every byte with the production artifact. The `.wei.limo` and `.wei.domains` name gateways, w3eth, and w3link served every imported resource exactly. See [Onchain explorer](onchain-explorer.md) for hashes, architecture, reproduction commands, and trust boundaries; see [WNS onchain explorer](wei-onchain-explorer.md) for the registration, resolver records, transactions, expiry, and renewal procedure.

## Reference descriptor

Replace the namespace below with the application-derived value:

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
  "acceptedRecordTypes": [2]
}
```

A descriptor never includes an RPC URL. The Rust and TypeScript packages expose constructors and constants for the reference deployment. The native node accepts either `--application` plus `--major-version` to derive the canonical namespace, or `--namespace` for a precomputed value, as its Ethereum-mainnet shortcut.

## Independent verification

Do not trust documentation alone. A production integrator should:

1. obtain the transaction, receipt, code, and block from a caller-selected Ethereum mainnet provider;
2. build the canonical source with the pinned Foundry settings;
3. compare the complete deployed runtime bytecode and its hash;
4. inspect the verified source and compiler input through an independent explorer;
5. call all three constants and inspect the four-selector surface; and
6. pin the address and receipt block in the application release.

With Foundry, the repository's optional live fork test performs the code-hash, constant, deployment-block, and empty-storage checks:

```bash
MAINNET_RPC_URL=https://your-ethereum-mainnet-rpc.example \
  forge test --root contracts --match-contract ResurrectBeaconV1ForkTest -vv
```

## Deploying another exact beacon

Applications may deploy the same immutable contract on another EVM chain when its availability, finality, censorship resistance, cost, or RPC ecosystem better fits their recovery assumptions:

```bash
forge create \
  --root contracts \
  src/ResurrectBeaconV1.sol:ResurrectBeaconV1 \
  --rpc-url https://caller-selected-rpc.example \
  --private-key 0x... \
  --broadcast
```

Record the chain ID, deployed address, receipt block, transaction, exact source revision, compiler settings, runtime bytecode hash, and public verification link. The deployer has no special permission after construction because the contract has no constructor state or administrative surface.

Do not add a proxy, owner, pause, allowlist, fee withdrawal, mutable namespace mapping, or peer storage. Such a deployment would not implement the canonical v1 beacon semantics.

## Deployment-listing policy

Future community deployment entries must provide the same reproducible evidence as the Ethereum mainnet entry. A listing is informational: it does not grant a deployer governance, make one namespace global, bundle an RPC provider, or prevent applications from choosing another exact deployment.
