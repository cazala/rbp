// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.8.24;

import { ResurrectBeaconV1 } from "../src/ResurrectBeaconV1.sol";

interface VmBeaconScript {
    function envUint(string calldata name) external view returns (uint256);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

contract DeployResurrectBeaconV1 {
    VmBeaconScript internal constant vm =
        VmBeaconScript(address(uint160(uint256(keccak256("hevm cheat code")))));

    function run() external returns (ResurrectBeaconV1 beacon) {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);
        beacon = new ResurrectBeaconV1();
        vm.stopBroadcast();
    }
}
