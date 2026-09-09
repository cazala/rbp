// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity 0.8.24;

struct KeyValue {
    string key;
    string value;
}

interface IDecentralizedApp {
    function request(string[] memory resource, KeyValue[] memory params)
        external
        view
        returns (uint16 statusCode, string memory body, KeyValue[] memory headers);
}

/// @notice Writes immutable bytes into contract runtime code and reads them with EXTCODECOPY.
/// @dev Runtime byte zero is a STOP sentinel; the remaining bytes are the payload.
library ResurrectBytecodeStorage {
    uint256 internal constant MAX_CHUNK_BYTES = 24_000;

    error EmptyChunk();
    error ChunkTooLarge(uint256 length);
    error ChunkDeploymentFailed();

    function write(bytes memory data) internal returns (address pointer) {
        if (data.length == 0) revert EmptyChunk();
        if (data.length > MAX_CHUNK_BYTES) revert ChunkTooLarge(data.length);

        uint16 runtimeLength = uint16(data.length + 1);
        bytes memory initCode =
            abi.encodePacked(hex"61", bytes2(runtimeLength), hex"80600a5f395ff300", data);
        assembly ("memory-safe") {
            pointer := create(0, add(initCode, 0x20), mload(initCode))
        }
        if (pointer == address(0)) revert ChunkDeploymentFailed();
    }

    function payloadSize(address pointer) internal view returns (uint256 length) {
        assembly ("memory-safe") {
            length := extcodesize(pointer)
        }
        if (length == 0) return 0;
        unchecked {
            --length;
        }
    }

    function copy(address pointer, bytes memory output, uint256 outputOffset) internal view {
        uint256 length = payloadSize(pointer);
        assembly ("memory-safe") {
            extcodecopy(pointer, add(add(output, 0x20), outputOffset), 1, length)
        }
    }
}

/// @notice Immutable ERC-5219 resource router for one Resurrect explorer build.
/// @dev No resource can be added, changed, or removed after construction.
contract ResurrectOnchainSite is IDecentralizedApp {
    using ResurrectBytecodeStorage for address;

    bytes32 public constant INDEX_PATH_HASH = keccak256("index.html");
    bytes32 public immutable manifestHash;

    struct Resource {
        string contentType;
        address[] chunks;
        uint256 length;
        bool exists;
    }

    mapping(bytes32 pathHash => Resource resource) private resources;

    error ArrayLengthMismatch();
    error DuplicatePath(bytes32 pathHash);
    error EmptyResource(bytes32 pathHash);
    error InvalidChunk(bytes32 pathHash, address chunk);
    error ResourceLengthMismatch(bytes32 pathHash, uint256 expected, uint256 actual);
    error MissingIndex();

    constructor(
        bytes32[] memory pathHashes,
        string[] memory contentTypes,
        address[][] memory chunks,
        uint256[] memory lengths,
        bytes32 expectedManifestHash
    ) {
        uint256 count = pathHashes.length;
        if (
            count == 0 || count != contentTypes.length || count != chunks.length
                || count != lengths.length
        ) revert ArrayLengthMismatch();

        manifestHash = expectedManifestHash;
        for (uint256 i; i < count; ++i) {
            bytes32 pathHash = pathHashes[i];
            Resource storage target = resources[pathHash];
            if (target.exists) revert DuplicatePath(pathHash);
            if (lengths[i] == 0 || chunks[i].length == 0) revert EmptyResource(pathHash);

            target.contentType = contentTypes[i];
            target.length = lengths[i];
            target.exists = true;
            uint256 actualLength;
            for (uint256 j; j < chunks[i].length; ++j) {
                address chunk = chunks[i][j];
                uint256 chunkLength = chunk.payloadSize();
                if (chunkLength == 0 || chunkLength > ResurrectBytecodeStorage.MAX_CHUNK_BYTES) {
                    revert InvalidChunk(pathHash, chunk);
                }
                actualLength += chunkLength;
                target.chunks.push(chunk);
            }
            if (actualLength != lengths[i]) {
                revert ResourceLengthMismatch(pathHash, lengths[i], actualLength);
            }
        }
        if (!resources[INDEX_PATH_HASH].exists) revert MissingIndex();
    }

    function resolveMode() external pure returns (bytes32 mode) {
        return "5219";
    }

    function request(string[] memory resource, KeyValue[] memory)
        external
        view
        override
        returns (uint16 statusCode, string memory body, KeyValue[] memory headers)
    {
        bytes32 pathHash;
        if (resource.length == 0) {
            pathHash = INDEX_PATH_HASH;
        } else if (resource.length == 1) {
            pathHash = keccak256(bytes(resource[0]));
        } else {
            return _notFound();
        }

        Resource storage selected = resources[pathHash];
        if (!selected.exists) return _notFound();

        bytes memory data = new bytes(selected.length);
        uint256 offset;
        for (uint256 i; i < selected.chunks.length; ++i) {
            address chunk = selected.chunks[i];
            chunk.copy(data, offset);
            offset += chunk.payloadSize();
        }

        headers = _headers(selected.contentType, true);
        return (200, string(data), headers);
    }

    function resourceInfo(string calldata path)
        external
        view
        returns (bool exists, string memory contentType, uint256 length, address[] memory chunks)
    {
        Resource storage selected = resources[keccak256(bytes(path))];
        return (selected.exists, selected.contentType, selected.length, selected.chunks);
    }

    function _notFound()
        private
        pure
        returns (uint16 statusCode, string memory body, KeyValue[] memory headers)
    {
        return (404, "not found\n", _headers("text/plain; charset=utf-8", false));
    }

    function _headers(string memory contentType, bool immutableResource)
        private
        pure
        returns (KeyValue[] memory headers)
    {
        headers = new KeyValue[](2);
        headers[0] = KeyValue("Content-Type", contentType);
        headers[1] = KeyValue(
            "Cache-Control", immutableResource ? "public, max-age=31536000, immutable" : "no-store"
        );
    }
}
