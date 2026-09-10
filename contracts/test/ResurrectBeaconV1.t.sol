// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.8.24;

import { ResurrectBeaconV1 } from "../src/ResurrectBeaconV1.sol";
import { TestBase } from "./TestBase.sol";

contract ResurrectBeaconV1Test is TestBase {
    ResurrectBeaconV1 internal beacon;

    event PeerAnnounced(
        bytes32 indexed namespace, uint32 indexed recordType, uint64 validUntil, bytes peerRecord
    );

    function setUp() public {
        beacon = new ResurrectBeaconV1();
    }

    function testConstantsAndProtocolSelector() public view {
        assertEq(beacon.VERSION(), 1);
        assertEq(beacon.MAX_TTL(), 90 days);
        assertEq(beacon.MAX_RECORD_BYTES(), 4096);
        assertEq(
            uint256(uint32(ResurrectBeaconV1.announce.selector)),
            uint256(uint32(bytes4(keccak256("announce(bytes32,uint32,uint32,bytes)"))))
        );
    }

    function testBytecodeHashesMatchCanonicalDeployment() public pure {
        assertEq(
            uint256(keccak256(type(ResurrectBeaconV1).creationCode)),
            uint256(0x449675c0d8b1c3ba38a1cd0c633ee043a9f328c14535ea04ff6d9e51845efa3a)
        );
        assertEq(
            uint256(keccak256(type(ResurrectBeaconV1).runtimeCode)),
            uint256(0x20999e7bf54d855e3bfedebfd7053d41f0c873ecde3b9d70a71ee6dcd086bce7)
        );
    }

    function testTtlZeroReportsSuppliedValue() public {
        vm.expectRevert(abi.encodeWithSelector(ResurrectBeaconV1.InvalidTTL.selector, uint32(0)));
        beacon.announce(bytes32(uint256(1)), 2, 0, hex"01");
    }

    function testTtlAboveMaximumReportsSuppliedValue() public {
        uint32 invalidTtl = beacon.MAX_TTL() + 1;
        vm.expectRevert(abi.encodeWithSelector(ResurrectBeaconV1.InvalidTTL.selector, invalidTtl));
        beacon.announce(bytes32(uint256(1)), 2, invalidTtl, hex"01");
    }

    function testEmptyRecordReportsSuppliedLength() public {
        vm.expectRevert(
            abi.encodeWithSelector(ResurrectBeaconV1.RecordTooLarge.selector, uint256(0))
        );
        beacon.announce(bytes32(uint256(1)), 2, 1, "");
    }

    function testOversizedRecordReportsSuppliedLength() public {
        vm.expectRevert(
            abi.encodeWithSelector(ResurrectBeaconV1.RecordTooLarge.selector, uint256(4097))
        );
        beacon.announce(bytes32(uint256(1)), 2, 1, new bytes(4097));
    }

    function testValidAnnouncementEmitsContractDerivedExpiry() public {
        bytes32 namespace = keccak256("resurrect:test:1");
        bytes memory peerRecord = hex"010203";
        vm.warp(1_700_000_000);
        vm.expectEmit(true, true, false, true, address(beacon));
        emit PeerAnnounced(namespace, 2, 1_700_000_600, peerRecord);
        beacon.announce(namespace, 2, 600, peerRecord);
    }

    function testAnyAddressCanAnnounce() public {
        vm.prank(address(0xBEEF));
        beacon.announce(bytes32(uint256(1)), 2, 1, hex"01");
    }

    function testNoOwnerAdminPauseOrUpgradeSurfaceExists() public {
        (bool ownerOk,) = address(beacon).call(abi.encodeWithSignature("owner()"));
        (bool pauseOk,) = address(beacon).call(abi.encodeWithSignature("pause()"));
        (bool upgradeOk,) =
            address(beacon).call(abi.encodeWithSignature("upgradeTo(address)", address(1)));
        (bool implementationOk,) = address(beacon).call(abi.encodeWithSignature("implementation()"));
        (bool transferOk,) =
            address(beacon).call(abi.encodeWithSignature("transferOwnership(address)", address(1)));
        assertFalse(ownerOk);
        assertFalse(pauseOk);
        assertFalse(upgradeOk);
        assertFalse(implementationOk);
        assertFalse(transferOk);
    }

    function testFuzzValidBoundsAlwaysSucceed(
        bytes32 namespace,
        uint32 recordType,
        uint32 ttlSeed,
        bytes calldata input
    ) public {
        uint32 ttl = uint32(uint256(ttlSeed) % beacon.MAX_TTL()) + 1;
        uint256 size = (input.length % beacon.MAX_RECORD_BYTES()) + 1;
        beacon.announce(namespace, recordType, ttl, new bytes(size));
    }

    function testFuzzNoStorageIsWritten(
        bytes32 namespace,
        uint32 recordType,
        uint32 ttlSeed,
        bytes calldata input
    ) public {
        uint32 ttl = uint32(uint256(ttlSeed) % beacon.MAX_TTL()) + 1;
        uint256 size = (input.length % 256) + 1;
        beacon.announce(namespace, recordType, ttl, new bytes(size));
        for (uint256 slot; slot < 32; ++slot) {
            assertEq(uint256(vm.load(address(beacon), bytes32(slot))), 0);
        }
    }
}
