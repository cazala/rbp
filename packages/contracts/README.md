# `@resurrect-protocol/contracts`

Canonical Resurrect Solidity sources, ABIs, and Ethereum mainnet deployment records.

```bash
npm install @resurrect-protocol/contracts
```

## Registry

```js
import registryAbi from '@resurrect-protocol/contracts/abi/ResurrectRegistryV1.json' with { type: 'json' }
import ethereumMainnet from '@resurrect-protocol/contracts/deployments/ethereum-mainnet.json' with { type: 'json' }
```

Solidity tools can import `@resurrect-protocol/contracts/src/ResurrectRegistryV1.sol`. The permissionless registry exposes exactly `VERSION`, `MAX_TTL`, `MAX_RECORD_BYTES`, and `announce`. It has no owner, administrator, allowlist, pause, upgrade, withdrawal, or peer-storage path.

The reference deployment is `0x6F33c332e8251dcd307D85A27fCcAbd85d578910` on Ethereum mainnet, chain ID `1`, receipt block `25882327`. Its deployment JSON includes the transaction, deployer, compiler settings, runtime hash, source revision, and Etherscan and Sourcify links.

Applications may use the reference deployment or deploy the exact source elsewhere, but must pin the chosen chain, address, deployment block, namespace, and constants. A shared stateless registry does not create a shared peer list. RPC providers remain caller-selected, and an event remains an untrusted discovery hint until the signed record, sequence, expiry, endpoints, and application handshake are verified.

## Immutable explorer

```js
import siteAbi from '@resurrect-protocol/contracts/abi/ResurrectOnchainSite.json' with { type: 'json' }
import explorerMainnet from '@resurrect-protocol/contracts/deployments/ethereum-mainnet-explorer.json' with { type: 'json' }
```

Solidity tools can import `@resurrect-protocol/contracts/src/ResurrectOnchainSite.sol`. The contract implements ERC-5219 and the ERC-6944 `5219` resolve mode, reconstructing immutable resources from bytecode-storage contracts. It has no owner, mutable storage, or upgrade path.

The production router is `0xb69aF08877a0C417169135D6710Bca4840CCCdE1` on Ethereum mainnet at block `25936611`. Its deployment JSON records the 25 data contracts, all 26 transaction hashes and blocks, every resource hash and payload length, the router runtime and manifest hashes, compiler settings, deployment cost, gateway URLs, and verification results.

Open it through:

- `web3://0xb69aF08877a0C417169135D6710Bca4840CCCdE1:1/`;
- `https://0xb69af08877a0c417169135d6710bca4840cccde1.w3eth.io/`; or
- `https://0xb69af08877a0c417169135d6710bca4840cccde1.1.w3link.io/`.

Consumers should independently compare deployed code and resources with the pinned source and build artifact before relying on them.

## License

`ResurrectRegistryV1.sol` is CC0-1.0. `ResurrectOnchainSite.sol` is available under MIT or Apache-2.0 at your option. Deployment metadata and dependency licenses remain their own.
