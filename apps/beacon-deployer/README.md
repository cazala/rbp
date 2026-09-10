# Resurrect Beacon deployer

This is a dependency-free, local-only deployment page for `ResurrectBeaconV1`. It asks an injected
wallet to deploy the exact reviewed creation bytecode on Ethereum mainnet. It never reads or stores a
private key.

The page accepts only the current `cazala.eth` account
(`0x3107af70F278D3824f9BaB4222b3361A545356C2`). It estimates the deployment before enabling the
transaction, then verifies the deployed runtime bytecode and all three public constants after the
receipt is confirmed.

From the repository root:

```console
pnpm --dir apps/beacon-deployer test
pnpm --dir apps/beacon-deployer dev
```

Open the printed LAN address in a browser with an injected wallet. Use this only on a network you
trust: the development server uses plain HTTP so another device can reach it without certificate
setup.

The embedded artifact was compiled with Solidity 0.8.24, optimizer enabled with 20,000 runs, Cancun
EVM, and CBOR metadata disabled. `scripts/check-contract.mjs` checks the embedded bytecode against a
local Foundry artifact whenever `contracts/out` is present.
