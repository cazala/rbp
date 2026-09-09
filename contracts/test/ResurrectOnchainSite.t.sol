// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.8.24;

import {
    IDecentralizedApp,
    KeyValue,
    ResurrectBytecodeStorage,
    ResurrectOnchainSite
} from "../src/ResurrectOnchainSite.sol";
import { TestBase } from "./TestBase.sol";

contract BytecodeStorageHarness {
    function write(bytes memory data) external returns (address) {
        return ResurrectBytecodeStorage.write(data);
    }
}

contract ResurrectOnchainSiteTest is TestBase {
    ResurrectOnchainSite internal site;

    function setUp() public {
        bytes32[] memory paths = new bytes32[](2);
        paths[0] = keccak256("index.html");
        paths[1] = keccak256("app.js");

        string[] memory contentTypes = new string[](2);
        contentTypes[0] = "text/html; charset=utf-8";
        contentTypes[1] = "text/javascript; charset=utf-8";

        address[][] memory chunks = new address[][](2);
        chunks[0] = new address[](1);
        chunks[0][0] = ResurrectBytecodeStorage.write(bytes("<h1>resurrect</h1>"));
        chunks[1] = new address[](2);
        chunks[1][0] = ResurrectBytecodeStorage.write(bytes("console."));
        chunks[1][1] = ResurrectBytecodeStorage.write(bytes("log('ok')"));

        uint256[] memory lengths = new uint256[](2);
        lengths[0] = 18;
        lengths[1] = 17;
        site = new ResurrectOnchainSite(paths, contentTypes, chunks, lengths, keccak256("manifest"));
    }

    function testResolveModeAndManifest() public view {
        assertEq(uint256(site.resolveMode()), uint256(bytes32("5219")));
        assertEq(uint256(site.manifestHash()), uint256(keccak256("manifest")));
    }

    function testRootServesIndexWithImmutableHeaders() public view {
        string[] memory resource = new string[](0);
        KeyValue[] memory params = new KeyValue[](0);
        (uint16 status, string memory body, KeyValue[] memory headers) =
            site.request(resource, params);
        assertEq(status, 200);
        assertEq(bytes(body), bytes("<h1>resurrect</h1>"));
        assertEq(bytes(headers[0].key), bytes("Content-Type"));
        assertEq(bytes(headers[0].value), bytes("text/html; charset=utf-8"));
        assertEq(bytes(headers[1].value), bytes("public, max-age=31536000, immutable"));
    }

    function testResourceReassemblesMultipleBytecodeChunks() public view {
        string[] memory resource = new string[](1);
        resource[0] = "app.js";
        (uint16 status, string memory body,) = site.request(resource, new KeyValue[](0));
        assertEq(status, 200);
        assertEq(bytes(body), bytes("console.log('ok')"));
    }

    function testExplicitIndexPathServesTheSameResource() public view {
        string[] memory resource = new string[](1);
        resource[0] = "index.html";
        KeyValue[] memory params = new KeyValue[](1);
        params[0] = KeyValue("ignored", "ignored");
        (uint16 status, string memory body,) = site.request(resource, params);
        assertEq(status, 200);
        assertEq(bytes(body), bytes("<h1>resurrect</h1>"));
    }

    function testMissingAndNestedResourcesReturn404() public view {
        string[] memory missing = new string[](1);
        missing[0] = "missing.js";
        (uint16 missingStatus, string memory missingBody, KeyValue[] memory headers) =
            site.request(missing, new KeyValue[](0));
        assertEq(missingStatus, 404);
        assertEq(bytes(missingBody), bytes("not found\n"));
        assertEq(bytes(headers[1].value), bytes("no-store"));

        string[] memory nested = new string[](2);
        nested[0] = "a";
        nested[1] = "b";
        (uint16 nestedStatus,,) = site.request(nested, new KeyValue[](0));
        assertEq(nestedStatus, 404);
    }

    function testResourceInfoExposesTheImmutableManifestPointers() public view {
        (bool exists, string memory contentType, uint256 length, address[] memory chunks) =
            site.resourceInfo("app.js");
        assertTrue(exists);
        assertEq(bytes(contentType), bytes("text/javascript; charset=utf-8"));
        assertEq(length, 17);
        assertEq(chunks.length, 2);
    }

    function testNoOwnerOrMutationSurfaceExists() public {
        (bool ownerOk,) = address(site).call(abi.encodeWithSignature("owner()"));
        (bool updateOk,) = address(site)
            .call(
                abi.encodeWithSignature("setResource(string,bytes)", "index.html", bytes("changed"))
            );
        assertFalse(ownerOk);
        assertFalse(updateOk);
    }

    function testConstructorRejectsMissingIndex() public {
        bytes32[] memory paths = new bytes32[](1);
        paths[0] = keccak256("app.js");
        string[] memory contentTypes = new string[](1);
        contentTypes[0] = "text/javascript";
        address[][] memory chunks = new address[][](1);
        chunks[0] = new address[](1);
        chunks[0][0] = ResurrectBytecodeStorage.write(bytes("x"));
        uint256[] memory lengths = new uint256[](1);
        lengths[0] = 1;

        vm.expectRevert(ResurrectOnchainSite.MissingIndex.selector);
        new ResurrectOnchainSite(paths, contentTypes, chunks, lengths, bytes32(0));
    }

    function testConstructorRejectsArrayLengthMismatch() public {
        bytes32[] memory paths = new bytes32[](1);
        string[] memory contentTypes = new string[](0);
        address[][] memory chunks = new address[][](1);
        uint256[] memory lengths = new uint256[](1);

        vm.expectRevert(ResurrectOnchainSite.ArrayLengthMismatch.selector);
        new ResurrectOnchainSite(paths, contentTypes, chunks, lengths, bytes32(0));
    }

    function testConstructorRejectsDuplicatePath() public {
        bytes32[] memory paths = new bytes32[](2);
        paths[0] = keccak256("index.html");
        paths[1] = paths[0];
        string[] memory contentTypes = new string[](2);
        contentTypes[0] = "text/html";
        contentTypes[1] = "text/html";
        address pointer = ResurrectBytecodeStorage.write(bytes("x"));
        address[][] memory chunks = new address[][](2);
        chunks[0] = new address[](1);
        chunks[0][0] = pointer;
        chunks[1] = new address[](1);
        chunks[1][0] = pointer;
        uint256[] memory lengths = new uint256[](2);
        lengths[0] = 1;
        lengths[1] = 1;

        vm.expectPartialRevert(ResurrectOnchainSite.DuplicatePath.selector);
        new ResurrectOnchainSite(paths, contentTypes, chunks, lengths, bytes32(0));
    }

    function testConstructorRejectsEmptyAndInvalidResources() public {
        bytes32[] memory paths = new bytes32[](1);
        paths[0] = keccak256("index.html");
        string[] memory contentTypes = new string[](1);
        contentTypes[0] = "text/html";
        address[][] memory chunks = new address[][](1);
        chunks[0] = new address[](0);
        uint256[] memory lengths = new uint256[](1);

        vm.expectPartialRevert(ResurrectOnchainSite.EmptyResource.selector);
        new ResurrectOnchainSite(paths, contentTypes, chunks, lengths, bytes32(0));

        chunks[0] = new address[](1);
        chunks[0][0] = address(0);
        lengths[0] = 1;
        vm.expectPartialRevert(ResurrectOnchainSite.InvalidChunk.selector);
        new ResurrectOnchainSite(paths, contentTypes, chunks, lengths, bytes32(0));
    }

    function testConstructorRejectsResourceLengthMismatch() public {
        bytes32[] memory paths = new bytes32[](1);
        paths[0] = keccak256("index.html");
        string[] memory contentTypes = new string[](1);
        contentTypes[0] = "text/html";
        address[][] memory chunks = new address[][](1);
        chunks[0] = new address[](1);
        chunks[0][0] = ResurrectBytecodeStorage.write(bytes("x"));
        uint256[] memory lengths = new uint256[](1);
        lengths[0] = 2;

        vm.expectPartialRevert(ResurrectOnchainSite.ResourceLengthMismatch.selector);
        new ResurrectOnchainSite(paths, contentTypes, chunks, lengths, bytes32(0));
    }

    function testBytecodeStorageRejectsInvalidSizesAndPreservesEveryByte() public {
        BytecodeStorageHarness harness = new BytecodeStorageHarness();
        vm.expectRevert(ResurrectBytecodeStorage.EmptyChunk.selector);
        harness.write(new bytes(0));

        vm.expectPartialRevert(ResurrectBytecodeStorage.ChunkTooLarge.selector);
        harness.write(new bytes(24_001));

        address pointer = harness.write(bytes("abc"));
        assertEq(pointer.code, hex"00616263");
    }

    function testCanonicalInterfaceSelector() public pure {
        assertEq(
            uint256(uint32(IDecentralizedApp.request.selector)),
            uint256(uint32(bytes4(keccak256("request(string[],(string,string)[])"))))
        );
    }
}
