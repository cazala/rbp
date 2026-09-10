// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ResurrectBeaconV1 } from "../src/ResurrectBeaconV1.sol";
import { InvariantBase } from "./TestBase.sol";

contract BeaconAnnouncementHandler {
    ResurrectBeaconV1 internal immutable beacon;

    constructor(ResurrectBeaconV1 beacon_) {
        beacon = beacon_;
    }

    function announce(bytes32 namespace, uint32 recordType, uint32 ttlSeed, bytes calldata input)
        external
    {
        uint32 ttl = uint32(uint256(ttlSeed) % beacon.MAX_TTL()) + 1;
        uint256 size = (input.length % 512) + 1;
        beacon.announce(namespace, recordType, ttl, new bytes(size));
    }
}

contract ResurrectBeaconV1InvariantTest is InvariantBase {
    ResurrectBeaconV1 internal beacon;
    BeaconAnnouncementHandler internal handler;

    function setUp() public {
        beacon = new ResurrectBeaconV1();
        handler = new BeaconAnnouncementHandler(beacon);
    }

    function targetContracts() public view override returns (address[] memory targets) {
        targets = new address[](1);
        targets[0] = address(handler);
    }

    function invariantBeaconRemainsStateless() public view {
        for (uint256 slot; slot < 64; ++slot) {
            assertEq(uint256(vm.load(address(beacon), bytes32(slot))), 0);
        }
    }

    function invariantConstantsCannotChange() public view {
        assertEq(beacon.VERSION(), 1);
        assertEq(beacon.MAX_TTL(), 90 days);
        assertEq(beacon.MAX_RECORD_BYTES(), 4096);
    }
}
