# WNS onchain explorer

The primary human-readable entry point for the immutable explorer is
[`resurrect.wei`](https://resurrect.wei.limo/), registered through the
[Wei Name Service](https://wei.domains/) on Ethereum mainnet.
[`resurrect.wei.domains`](https://resurrect.wei.domains/) is an alternative
gateway for the same name. Both resolve the WNS records and serve the ERC-5219
router's resources directly from Ethereum.

## Registration

| Field | Value |
|---|---|
| Name | `resurrect.wei` |
| Primary gateway | `https://resurrect.wei.limo/` |
| Alternative gateway | `https://resurrect.wei.domains/` |
| Native URL | `web3://resurrect.wei/` |
| WNS contract | `0x0000000000696760E15f265e828DB644A0c242EB` |
| WNS token ID | `0x5ad6a3b22580f32032bc963e77903e6c2d7baa9199d605fa31cc1613dd98fb12` |
| Owner | `cazala.eth` (`0x3107af70F278D3824f9BaB4222b3361A545356C2`) |
| Resolved address | `0x14765f12a7f068EDf42dF4920fd5170ADBa73306` |
| `contentcontract` | `eth:0x14765f12a7f068EDf42dF4920fd5170ADBa73306` |
| Contenthash | empty (`0x`) |
| Registered | `2026-09-10T12:10:47Z` |
| Expires | `2027-09-10T12:10:47Z` |
| Registration fee | `0.0005 ETH` |
| Registration plus configuration gas | `350304` gas |
| Total paid | `0.000526901469028467 ETH` |

The WNS contract uses a 60-second commit–reveal registration. The commitment
was bound directly to the owner address; no shared router or relayer was used.
The registration and configuration used four confirmed transactions. Ownership
was then transferred to `cazala.eth`:

| Operation | Block | Transaction |
|---|---:|---|
| Commit | `25946893` | [`0x064532…98d9`](https://etherscan.io/tx/0x0645328813aa11e75aaf9286bc11d35dd3905f417131736ebdcef8a9c54298d9) |
| Reveal and register | `25946901` | [`0x010cce…9c4`](https://etherscan.io/tx/0x010cce17ac09ea0a1deda110993d904e5af402217fe954439636866a9dad79c4) |
| Set resolved address | `25946902` | [`0x420f90…e09f`](https://etherscan.io/tx/0x420f900ae42dfa456770c5334694de467d81e3f804fd3d6c58db92f549f3e09f) |
| Set `contentcontract` | `25946904` | [`0x45d0cd…8674`](https://etherscan.io/tx/0x45d0cd803dd6e04f623d42e2cb5519f954fd0ec958a52a7b8cd37b57fec98674) |
| Transfer ownership to `cazala.eth` | `25948245` | [`0x3c8ee9…fd8d`](https://etherscan.io/tx/0x3c8ee9a2452daab45ab1030a6abaea5a6b4296f5360388e91ca7820205d4fd8d) |

The resolved address and the ERC-6821 record intentionally agree. The empty
contenthash prevents an IPFS record from taking precedence over the
contract-hosted application. Name ownership belongs to `cazala.eth`; the
immutable router has no owner or management interface.

## Verification

The authoritative WNS deployment is documented by the
[official project](https://github.com/z0r0z/wei-names) and is
[source-verified on Etherscan](https://etherscan.io/address/0x0000000000696760E15f265e828DB644A0c242EB#code).
Using any caller-selected Ethereum mainnet RPC, verify the name without trusting
the gateway:

```bash
WNS=0x0000000000696760E15f265e828DB644A0c242EB
TOKEN_ID=41087391431831184440468199834649177938136395864233436476895591760904781888274

cast call "$WNS" 'ownerOf(uint256)(address)' "$TOKEN_ID" \
  --rpc-url https://YOUR_ETHEREUM_RPC
cast call "$WNS" 'resolve(uint256)(address)' "$TOKEN_ID" \
  --rpc-url https://YOUR_ETHEREUM_RPC
cast call "$WNS" 'text(uint256,string)(string)' "$TOKEN_ID" contentcontract \
  --rpc-url https://YOUR_ETHEREUM_RPC
cast call "$WNS" 'contenthash(uint256)(bytes)' "$TOKEN_ID" \
  --rpc-url https://YOUR_ETHEREUM_RPC
cast call "$WNS" 'expiresAt(uint256)(uint256)' "$TOKEN_ID" \
  --rpc-url https://YOUR_ETHEREUM_RPC
```

Expected records are the `cazala.eth` owner address, router, `eth:`-prefixed
router, empty bytes, and Unix timestamp `1820578247`, respectively. The
repository also verified that both name gateways return the root document and
all five imported CSS/JavaScript assets byte-for-byte equal to
`apps/explorer/dist`. A real browser loaded the application with the expected
title, namespace controls, Scan action, contract link, and source link.

Each name gateway is still an offchain HTTP transport: it can cache, observe,
omit, or modify responses. The name record, router bytecode, and resource data
remain independently readable from Ethereum. Use the address-based
[w3eth](https://0x14765f12a7f068edf42df4920fd5170adba73306.w3eth.io/)
or [w3link](https://0x14765f12a7f068edf42df4920fd5170adba73306.1.w3link.io/)
gateway if both name gateways are unavailable, and compare returned assets with the
hashes in the deployment manifest.

## Renewal and future versions

The name expires at `2027-09-10T12:10:47Z`; renewal is an operational
requirement even though the explorer router itself is immutable. Before expiry,
the owner should query `getFee(9)` on the WNS contract and call
`renew(TOKEN_ID)` with that current fee. Do not hardcode the original fee because
WNS pricing can change.

A future explorer version must use a newly deployed immutable router. Verify its
source, manifest, reconstructed resources, gateway behavior, and browser probe
before updating both `setAddr(TOKEN_ID, router)` and
`setText(TOKEN_ID, "contentcontract", "eth:<router>")`. Keep contenthash empty
for a contract-hosted site and update the machine-readable deployment record in
the same reviewed release.
