#!/usr/bin/env bash
set -euo pipefail

REPOSITORY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REPOSITORY_ROOT}"

cmp contracts/src/ResurrectBeaconV1.sol packages/contracts/src/ResurrectBeaconV1.sol
cmp contracts/src/ResurrectOnchainSite.sol packages/contracts/src/ResurrectOnchainSite.sol
cmp deployments/ethereum-mainnet.json packages/contracts/deployments/ethereum-mainnet.json
cmp deployments/ethereum-mainnet-explorer.json packages/contracts/deployments/ethereum-mainnet-explorer.json
node -e "const fs=require('node:fs'); JSON.parse(fs.readFileSync('packages/contracts/abi/ResurrectBeaconV1.json')); JSON.parse(fs.readFileSync('packages/contracts/abi/ResurrectOnchainSite.json')); const deployment=JSON.parse(fs.readFileSync('deployments/ethereum-mainnet.json')); if (deployment.contract !== 'ResurrectBeaconV1' || deployment.chainId !== 1 || deployment.address !== '0x136c191B5e6541532E42Ecd7C719C29D7ecdf468' || deployment.deploymentBlock !== 25943058 || deployment.runtimeBytecodeHash !== '0x20999e7bf54d855e3bfedebfd7053d41f0c873ecde3b9d70a71ee6dcd086bce7' || deployment.audit?.jobId !== 904) throw new Error('canonical Ethereum deployment metadata drift'); const explorer=JSON.parse(fs.readFileSync('deployments/ethereum-mainnet-explorer.json')); if (explorer.chainId !== 1 || explorer.address !== '0x14765f12a7f068EDf42dF4920fd5170ADBa73306' || explorer.canonicalBeacon?.address !== deployment.address || explorer.canonicalBeacon?.deploymentBlock !== deployment.deploymentBlock || explorer.deploymentBlock !== 25943864 || explorer.manifestHash !== '0x36f8d8a77af7849aa040a86d4f7663ab5a185b9d72e2ab500c9db85785ddd026' || explorer.storage?.resourceBytes !== 467179 || explorer.storage?.chunkContracts !== 24 || explorer.verification.sourceCode.etherscan.status !== 'pass' || explorer.verification.sourceCode.sourcify.status !== 'pass' || explorer.verification.ethereumRpc.canonicalBeaconEmbedded !== true) throw new Error('onchain explorer deployment metadata drift')"

cargo package --workspace --locked --allow-dirty --no-verify

PACKAGE_DIRECTORY="$(mktemp -d "${TMPDIR:-/tmp}/resurrect-packages.XXXXXX")"
pnpm --dir packages/contracts pack --pack-destination "${PACKAGE_DIRECTORY}"
pnpm --dir packages/ts pack --pack-destination "${PACKAGE_DIRECTORY}"
test "$(find "${PACKAGE_DIRECTORY}" -type f -name '*.tgz' | wc -l | tr -d ' ')" -eq 2

CONTRACT_ARCHIVE="$(find "${PACKAGE_DIRECTORY}" -type f -name 'resurrect-protocol-contracts-*.tgz' -print -quit)"
CLIENT_ARCHIVE="$(find "${PACKAGE_DIRECTORY}" -type f -name 'resurrect-protocol-client-*.tgz' -print -quit)"
test -n "${CONTRACT_ARCHIVE}"
test -n "${CLIENT_ARCHIVE}"
CONTRACT_LISTING="$(tar -tzf "${CONTRACT_ARCHIVE}")"
CLIENT_LISTING="$(tar -tzf "${CLIENT_ARCHIVE}")"
grep -qx 'package/src/ResurrectBeaconV1.sol' <<<"${CONTRACT_LISTING}"
grep -qx 'package/src/ResurrectOnchainSite.sol' <<<"${CONTRACT_LISTING}"
grep -qx 'package/abi/ResurrectBeaconV1.json' <<<"${CONTRACT_LISTING}"
grep -qx 'package/abi/ResurrectOnchainSite.json' <<<"${CONTRACT_LISTING}"
grep -qx 'package/deployments/ethereum-mainnet.json' <<<"${CONTRACT_LISTING}"
grep -qx 'package/deployments/ethereum-mainnet-explorer.json' <<<"${CONTRACT_LISTING}"
grep -qx 'package/dist/index.js' <<<"${CLIENT_LISTING}"
grep -qx 'package/dist/index.d.ts' <<<"${CLIENT_LISTING}"
