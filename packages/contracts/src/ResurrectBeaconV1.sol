// SPDX-License-Identifier: CC0-1.0
pragma solidity 0.8.24;

/// @title Resurrect rendezvous beacon v1
/// @notice Permissionless, immutable, log-only transport for caller-supplied peer-record bytes.
/// @dev The contract does not verify signatures or bind namespace, recordType, ttl, peerRecord, or
/// msg.sender to one another. Consumers must perform those trust checks off-chain. This is not an
/// upgradeable proxy beacon and deliberately has no owner, storage, upgrade, pause, or withdrawal
/// path.
contract ResurrectBeaconV1 {
    uint32 public constant VERSION = 1;
    uint32 public constant MAX_TTL = 90 days;
    uint32 public constant MAX_RECORD_BYTES = 4096;

    error InvalidTTL(uint32 supplied);
    error RecordTooLarge(uint256 supplied);

    event PeerAnnounced(
        bytes32 indexed namespace, uint32 indexed recordType, uint64 validUntil, bytes peerRecord
    );

    /// @notice Publishes a bounded-lifetime record for an application namespace.
    /// @param namespace Application/network isolation identifier.
    /// @param recordType Resurrect peer-record codec identifier.
    /// @param ttl Lifetime in seconds, bounded by `MAX_TTL`.
    /// @param peerRecord Raw peer-record bytes; this contract does not authenticate them.
    function announce(bytes32 namespace, uint32 recordType, uint32 ttl, bytes calldata peerRecord)
        external
    {
        if (ttl == 0 || ttl > MAX_TTL) revert InvalidTTL(ttl);

        uint256 recordLength = peerRecord.length;
        if (recordLength == 0 || recordLength > MAX_RECORD_BYTES) {
            revert RecordTooLarge(recordLength);
        }

        emit PeerAnnounced(namespace, recordType, uint64(block.timestamp) + uint64(ttl), peerRecord);
    }
}
