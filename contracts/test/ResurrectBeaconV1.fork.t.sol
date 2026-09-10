// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ResurrectBeaconV1 } from "../src/ResurrectBeaconV1.sol";
import { TestBase } from "./TestBase.sol";

/// @dev Set MAINNET_RPC_URL to exercise deployment/calls against a real-state fork.
contract ResurrectBeaconV1ForkTest is TestBase {
    address internal constant ETHEREUM_MAINNET_BEACON = 0x136c191B5e6541532E42Ecd7C719C29D7ecdf468;
    uint256 internal constant ETHEREUM_MAINNET_DEPLOYMENT_BLOCK = 25_943_058;
    bytes32 internal constant ETHEREUM_MAINNET_RUNTIME_BYTECODE_HASH =
        0x20999e7bf54d855e3bfedebfd7053d41f0c873ecde3b9d70a71ee6dcd086bce7;

    function testForkDeploymentRemainsPermissionlessAndStateless() public {
        string memory rpcUrl = vm.envOr("MAINNET_RPC_URL", string(""));
        if (bytes(rpcUrl).length == 0) return;

        vm.createSelectFork(rpcUrl);
        ResurrectBeaconV1 beacon = new ResurrectBeaconV1();
        vm.prank(address(0xA11CE));
        beacon.announce(keccak256("resurrect:fork-test:1"), 2, 30 days, hex"010203");

        assertEq(beacon.VERSION(), 1);
        assertEq(beacon.MAX_TTL(), 90 days);
        for (uint256 slot; slot < 16; ++slot) {
            assertEq(uint256(vm.load(address(beacon), bytes32(slot))), 0);
        }
    }

    function testPublishedEthereumMainnetDeploymentMatchesPinnedMetadata() public {
        string memory rpcUrl = vm.envOr("MAINNET_RPC_URL", string(""));
        if (bytes(rpcUrl).length == 0) return;

        vm.createSelectFork(rpcUrl);
        assertTrue(block.number >= ETHEREUM_MAINNET_DEPLOYMENT_BLOCK);
        assertEq(
            uint256(ETHEREUM_MAINNET_BEACON.codehash),
            uint256(ETHEREUM_MAINNET_RUNTIME_BYTECODE_HASH)
        );

        ResurrectBeaconV1 beacon = ResurrectBeaconV1(ETHEREUM_MAINNET_BEACON);
        assertEq(beacon.VERSION(), 1);
        assertEq(beacon.MAX_TTL(), 90 days);
        assertEq(beacon.MAX_RECORD_BYTES(), 4096);
        for (uint256 slot; slot < 16; ++slot) {
            assertEq(uint256(vm.load(address(beacon), bytes32(slot))), 0);
        }
    }
}
