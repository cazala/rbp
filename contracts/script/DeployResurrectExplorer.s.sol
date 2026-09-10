// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ResurrectBytecodeStorage, ResurrectOnchainSite } from "../src/ResurrectOnchainSite.sol";

interface VmExplorerScript {
    function envUint(string calldata name) external view returns (uint256);
    function projectRoot() external view returns (string memory);
    function readFileBinary(string calldata path) external view returns (bytes memory);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

contract DeployResurrectExplorer {
    VmExplorerScript internal constant vm =
        VmExplorerScript(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 internal constant RESOURCE_COUNT = 6;
    uint256 internal constant CHUNK_BYTES = 24_000;

    function run() external returns (ResurrectOnchainSite site) {
        string[RESOURCE_COUNT] memory paths = [
            string("index.html"),
            "index.css",
            "app.js",
            "rolldown-runtime.js",
            "peer-record.js",
            "peer-probe.js"
        ];
        string[RESOURCE_COUNT] memory contentTypes = [
            string("text/html; charset=utf-8"),
            "text/css; charset=utf-8",
            "text/javascript; charset=utf-8",
            "text/javascript; charset=utf-8",
            "text/javascript; charset=utf-8",
            "text/javascript; charset=utf-8"
        ];

        bytes[] memory files = new bytes[](RESOURCE_COUNT);
        bytes32[] memory pathHashes = new bytes32[](RESOURCE_COUNT);
        string[] memory dynamicContentTypes = new string[](RESOURCE_COUNT);
        uint256[] memory lengths = new uint256[](RESOURCE_COUNT);
        bytes32[] memory fileHashes = new bytes32[](RESOURCE_COUNT);
        string memory explorerDist = string.concat(vm.projectRoot(), "/../apps/explorer/dist/");
        for (uint256 i; i < RESOURCE_COUNT; ++i) {
            files[i] = vm.readFileBinary(string.concat(explorerDist, paths[i]));
            pathHashes[i] = keccak256(bytes(paths[i]));
            dynamicContentTypes[i] = contentTypes[i];
            lengths[i] = files[i].length;
            fileHashes[i] = keccak256(files[i]);
        }
        bytes32 manifestHash = keccak256(abi.encode(paths, contentTypes, fileHashes));

        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);
        address[][] memory chunks = new address[][](RESOURCE_COUNT);
        for (uint256 i; i < RESOURCE_COUNT; ++i) {
            chunks[i] = _deployChunks(files[i]);
        }
        site = new ResurrectOnchainSite(
            pathHashes, dynamicContentTypes, chunks, lengths, manifestHash
        );
        vm.stopBroadcast();
    }

    function _deployChunks(bytes memory file) private returns (address[] memory chunks) {
        uint256 count = (file.length + CHUNK_BYTES - 1) / CHUNK_BYTES;
        chunks = new address[](count);
        for (uint256 i; i < count; ++i) {
            uint256 offset = i * CHUNK_BYTES;
            uint256 length = file.length - offset;
            if (length > CHUNK_BYTES) length = CHUNK_BYTES;
            bytes memory chunk = new bytes(length);
            for (uint256 j; j < length; ++j) {
                chunk[j] = file[offset + j];
            }
            chunks[i] = ResurrectBytecodeStorage.write(chunk);
        }
    }
}
