# Security audits

## ResurrectBeaconV1 — OneDollarAudit job 904

OneDollarAudit reviewed the exact source-verified `ResurrectBeaconV1` deployment at [`0x136c191B5e6541532E42Ecd7C719C29D7ecdf468`](https://etherscan.io/address/0x136c191B5e6541532E42Ecd7C719C29D7ecdf468#code) on Ethereum mainnet. The review completed on 2026-09-10.

- [Immutable report on IPFS](https://bafkreid22gqqrzwo6b6scxqnmcmiinru3xzigz74xkere2573r6ivulzjq.ipfs.community.bgipfs.com/)
- [Hosted report](https://leftclaw.services/result/904.html)
- [Audit job and payment record](https://www.onedollaraudit.com/audit/904)
- [Deployment transaction](https://etherscan.io/tx/0x8e7c2ddf815d44166d436fabd886a05bac6eab25ba5abf6faf9e93e3e179b8d6)
- [Audit payment transaction on Base](https://basescan.org/tx/0xe69042d4d93e52a6738baa25e82476bc80029532011fe0d2fa398e2a8b0facae)

The report records 0 Critical, 0 High, 0 Medium, 2 Low, and 1 Informational finding. It independently confirmed the absence of an owner, storage, upgrades, reentrancy, and ETH-handling paths; safe expiry arithmetic; bounded record length and TTL; and correct event encoding.

### Findings and disposition

| Finding | Severity | Disposition |
|---|---:|---|
| Event metadata is not cryptographically bound to the peer record or announcer | Low | Accepted v1 trust boundary. Documentation and contract NatSpec now state the boundary explicitly. Consumers must verify the embedded record and transport identity, must not treat event metadata as authorization or current signer intent, and must perform an application handshake. A metadata-binding codec remains an application-profile option. |
| `RecordTooLarge(0)` is a misleading diagnostic for an empty record | Low | Accepted for the deployed immutable v1 ABI. The bounds check is correct and cannot be bypassed. Tooling should interpret argument `0` as an empty-record rejection; a future contract version may introduce a separate `EmptyRecord` error. |
| A one-second TTL is imprecise relative to ordinary block timestamp variation | Informational | Accepted and documented. `validUntil` is a discovery/cache hint, not a precision timer; applications should avoid relying on sub-minute TTL precision. |

The reference Rust and TypeScript clients already filter the emitting contract, configured namespace, accepted record type, and codec/type consistency before verifying the signed identity and endpoints. Those checks prevent generic event-type confusion. They cannot prove that the peer-record signer chose the event TTL or intended the record for a compatible namespace, because standard v1 peer-record formats contain neither value.

No deployed-code change is required for the findings. Splitting the empty-record error would change the runtime bytecode and error selector, producing a new contract rather than remediating the immutable audited deployment. The trust-boundary and TTL findings are consumer-policy concerns and are addressed in [Security](security.md), [Application integration](application-integration.md), [Architecture](architecture.md), and the normative [specification](spec.md).

### Scope and limitations

The audit covered one 37-line Solidity contract at the pinned address. It did not review the protocol specification, Rust or TypeScript clients, peer-record codecs, node, browser explorer, hosted services, deployment tooling, or downstream applications. The report was produced by an AI-orchestrated multi-pass methodology and expressly provides no guarantee that vulnerabilities are absent. Consumers should read the report itself rather than relying only on the severity summary.
