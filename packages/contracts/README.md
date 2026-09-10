# `@resurrect-protocol/contracts`

Canonical Resurrect Solidity sources, ABIs, and Ethereum mainnet deployment records.

```bash
npm install @resurrect-protocol/contracts
```

## Beacon

```js
import beaconAbi from '@resurrect-protocol/contracts/abi/ResurrectBeaconV1.json' with { type: 'json' }
import ethereumMainnet from '@resurrect-protocol/contracts/deployments/ethereum-mainnet.json' with { type: 'json' }
```

Solidity tools can import `@resurrect-protocol/contracts/src/ResurrectBeaconV1.sol`. The permissionless beacon exposes exactly `VERSION`, `MAX_TTL`, `MAX_RECORD_BYTES`, and `announce`. It has no owner, administrator, allowlist, pause, upgrade, withdrawal, or peer-storage path. Despite the name, it is a rendezvous beacon rather than an upgradeable proxy beacon.

The canonical deployment is [`0x136c191B5e6541532E42Ecd7C719C29D7ecdf468`](https://etherscan.io/address/0x136c191B5e6541532E42Ecd7C719C29D7ecdf468#code) on Ethereum mainnet, chain ID `1`, receipt block `25943058`. Its deployment JSON includes the transaction, deployer, compiler settings, bytecode hashes, Etherscan and Sourcify links, and audit metadata.

Applications may use the canonical deployment or deploy the exact source elsewhere, but must pin the chosen chain, address, deployment block, namespace, and constants. A shared stateless beacon does not create a shared peer list. RPC providers remain caller-selected, and an event remains an untrusted discovery hint until the signed record, sequence, expiry, endpoints, and application handshake are verified.

OneDollarAudit job [#904](https://www.onedollaraudit.com/audit/904) reviewed the exact canonical address and produced an [immutable IPFS report](https://bafkreid22gqqrzwo6b6scxqnmcmiinru3xzigz74xkere2573r6ivulzjq.ipfs.community.bgipfs.com/) with 0 Critical, 0 High, 0 Medium, 2 Low, and 1 Informational finding.

## Immutable explorer

```js
import siteAbi from '@resurrect-protocol/contracts/abi/ResurrectOnchainSite.json' with { type: 'json' }
import explorerMainnet from '@resurrect-protocol/contracts/deployments/ethereum-mainnet-explorer.json' with { type: 'json' }
```

Solidity tools can import `@resurrect-protocol/contracts/src/ResurrectOnchainSite.sol`. The contract implements ERC-5219 and the ERC-6944 `5219` resolve mode, reconstructing immutable resources from bytecode-storage contracts. It has no owner, mutable storage, or upgrade path.

The source-verified production router is `0x14765f12a7f068EDf42dF4920fd5170ADBa73306` on Ethereum mainnet at block `25943864`. Its deployment JSON records the 24 data contracts, all 25 transaction hashes and blocks, every resource hash and payload length, the router runtime and manifest hashes, compiler settings, Etherscan and Sourcify verification, deployment cost, gateway URLs, and runtime verification results. The embedded explorer uses the canonical `ResurrectBeaconV1` at `0x136c191B5e6541532E42Ecd7C719C29D7ecdf468`.

Open it through:

- `web3://0x14765f12a7f068EDf42dF4920fd5170ADBa73306:1/`;
- `https://0x14765f12a7f068edf42df4920fd5170adba73306.w3eth.io/`; or
- `https://0x14765f12a7f068edf42df4920fd5170adba73306.1.w3link.io/`.

Consumers should independently compare deployed code and resources with the pinned source and build artifact before relying on them.

## License

`ResurrectBeaconV1.sol` is CC0-1.0. `ResurrectOnchainSite.sol` is available under MIT or Apache-2.0 at your option. Deployment metadata and dependency licenses remain their own.
