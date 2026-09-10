# ENS onchain explorer

The verified ERC-5219 router is ready to become the ETH address record for `resurrect.cazala.eth`. The operational deployer does not own `cazala.eth`; the account that owns or manages the ENS name must make this change.

## Target

| Field | Value |
|---|---|
| ENS name | `resurrect.cazala.eth` |
| Network | Ethereum mainnet |
| ETH address record | `0x14765f12a7f068EDf42dF4920fd5170ADBa73306` |
| Native URL | `web3://resurrect.cazala.eth/` |
| w3eth URL | `https://resurrect.cazala.w3eth.io/` |
| w3link URL | `https://resurrect.cazala.eth.1.w3link.io/` |

Verify the router first through its [Etherscan source](https://etherscan.io/address/0x14765f12a7f068EDf42dF4920fd5170ADBa73306#code), [Sourcify match](https://repo.sourcify.dev/1/0x14765f12a7f068EDf42dF4920fd5170ADBa73306), and [deployment record](../deployments/ethereum-mainnet-explorer.json).

## ENS Manager steps

1. Open [ENS Manager](https://app.ens.domains/cazala.eth) on Ethereum mainnet and connect the account that owns or manages `cazala.eth`.
2. Open **Subnames**. If `resurrect.cazala.eth` does not exist, create the L1 subname `resurrect`. Keep its owner or manager set to your account.
3. Open `resurrect.cazala.eth`. If it has no resolver, choose **Set resolver** and use the current ENS Public Resolver. Confirm that transaction before editing records.
4. Edit **Records**, choose the Ethereum address record, and set it to `0x14765f12a7f068EDf42dF4920fd5170ADBa73306`.
5. Review the chain, name, record type, and address in the wallet before signing. Submit and wait for confirmation.
6. Reopen the name in ENS Manager and confirm that the displayed Ethereum address is exact.

Do not transfer name ownership to the router or deployer. The router is not an account and has no administrative functions.

## Verify resolution

Use a caller-selected Ethereum RPC:

```bash
cast resolve-name resurrect.cazala.eth --rpc-url https://YOUR_ETHEREUM_RPC
```

The result must be:

```text
0x14765f12a7f068EDf42dF4920fd5170ADBa73306
```

Then open each target URL in a clean browser profile:

1. `web3://resurrect.cazala.eth/` in a native ERC-4804 client;
2. `https://resurrect.cazala.w3eth.io/`;
3. `https://resurrect.cazala.eth.1.w3link.io/`.

Confirm that the page renders, select **Scan**, and then select **Ping** on the recovered seed. A complete test must show a validated signed peer record, an authenticated Noise connection to the same peer ID, identify information, and a successful libp2p ping. HTTP gateways may inject a compatibility shim into HTML; imported JavaScript and CSS should still match the immutable onchain deployment.

If address-based gateway URLs work but ENS URLs do not, recheck the resolver and ETH address record before changing the contract. ENS and gateway caches can delay name-based access after the transaction confirms.

## Future versions

Every onchain explorer version uses a new immutable router. Verify its source, full deployment manifest, reconstructed resources, gateways, and browser ping before changing the ENS record. The ENS ETH address is the only intended upgrade mechanism.
