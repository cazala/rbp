# ENS onchain explorer

This runbook points `resurrect.cazala.eth` at the immutable Ethereum mainnet ERC-5219 router. The ENS-owning account must perform the record transaction; the Resurrect deployer does not own `cazala.eth` and is not needed.

## Target

| Field | Value |
|---|---|
| ENS name | `resurrect.cazala.eth` |
| Network | Ethereum mainnet |
| ETH address record | `0xb69aF08877a0C417169135D6710Bca4840CCCdE1` |
| Native URL | `web3://resurrect.cazala.eth/` |
| w3eth URL | `https://resurrect.cazala.w3eth.io/` |
| w3link URL | `https://resurrect.cazala.eth.1.w3link.io/` |

The target is the router address, not one of its 25 data contracts, the Resurrect registry, the deployer, or a content hash. Do not transfer ownership of the ENS name to the router: it has no record-management methods.

## ENS Manager steps

At the time of deployment, a public mainnet lookup did not resolve `resurrect.cazala.eth` to an address. The subname may need creation, a resolver, an address record, or more than one of those actions.

1. Open [ENS Manager](https://app.ens.domains/cazala.eth) on Ethereum mainnet and connect the account that owns or manages `cazala.eth`.
2. Open **Subnames**. If `resurrect.cazala.eth` does not exist, create the L1 subname `resurrect`. Keep its owner or manager set to your account.
3. Open `resurrect.cazala.eth`. If the manager reports that it has no resolver, choose **Set resolver** and use the current ENS Public Resolver. Confirm that transaction before editing records.
4. Edit the name's address records. Add or replace the **ETH** address—coin type 60, the legacy `addr(bytes32)` Ethereum record—with `0xb69aF08877a0C417169135D6710Bca4840CCCdE1`. If the UI distinguishes a generic “Default EVM” address from **ETH**, set **ETH** for maximum gateway compatibility.
5. Save and confirm the Ethereum transaction. A `contenthash` record is not required for ERC-4804 address resolution and should not replace the ETH address record.
6. Wait for confirmation and ENS/gateway cache refresh. Reopen the name in ENS Manager and confirm that the displayed ETH address is exactly the checksummed router address.

Creating the subname, setting its resolver, and setting its record may be separate transactions. ENS's [subname guide](https://docs.ens.domains/web/subdomains/) explains L1 subname ownership, and the [Public Resolver documentation](https://docs.ens.domains/resolvers/public/) describes the shared resolver used for editable records. The resolver's Ethereum address interface is documented in [resolver interfaces](https://docs.ens.domains/resolvers/interfaces/).

## Verify after the transaction

From a machine with Foundry and an Ethereum mainnet RPC:

```bash
cast resolve-name resurrect.cazala.eth --rpc-url https://YOUR_ETHEREUM_RPC
```

The result must be:

```text
0xb69aF08877a0C417169135D6710Bca4840CCCdE1
```

Then open each target URL in a clean browser profile:

1. `web3://resurrect.cazala.eth/` in a native ERC-4804 client;
2. `https://resurrect.cazala.w3eth.io/`;
3. `https://resurrect.cazala.eth.1.w3link.io/`.

Confirm that the page renders, select **Scan**, and then select **Ping** on the recovered seed. A complete test must show a validated signed peer record, an authenticated Noise connection to the same peer ID, identify information, and a successful libp2p ping. The HTTP gateway may inject a compatibility shim into HTML; JavaScript and CSS resources should still match the immutable onchain deployment.

If address-based gateway URLs work but the ENS URLs do not, recheck the name's resolver and ETH address record before changing the contract. ENS and gateway caches can delay name-based access after the mainnet transaction is confirmed.

## Future versions

Every onchain explorer version uses a new immutable router. Verify the new address and complete deployment manifest before updating ENS. Changing the ENS ETH address is the only intended upgrade mechanism; historical router addresses and manifests remain usable and must remain documented.
