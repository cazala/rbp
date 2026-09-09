# Resurrect documentation

The normative protocol is [spec.md](spec.md). Other documents explain this repository's reference implementation and do not override the specification.

| Document | Audience | Contents |
|---|---|---|
| [Architecture](architecture.md) | reviewers and maintainers | trust boundaries, components, data flow, state |
| [Application integration](application-integration.md) | protocol developers | descriptor/profile decisions and Rust integration |
| [Node operations](node-operations.md) | seed operators | keys, endpoints, configuration, lifecycle, recovery |
| [Browser client](browser-client.md) | web developers | providers, privacy, scanning, dial-context rules |
| [Onchain explorer](onchain-explorer.md) | web3 and release engineers | live ERC-5219 deployment, immutable storage, hashes, and verification |
| [ENS onchain explorer](ens-onchain-explorer.md) | ENS owner and operators | point and verify `resurrect.cazala.eth` without changing the contract |
| [Hosted services](hosted-services.md) | operators and maintainers | reference seed, WSS tunnel, Pages deployment, and production checks |
| [Security](security.md) | security reviewers and operators | threats, mitigations, residual risk |
| [Testing](testing.md) | contributors and auditors | unit, fuzz, invariant, fork, interop, reboot suites |
| [Conformance](conformance.md) | implementers | spec checklist-to-evidence map |
| [Releasing](releasing.md) | maintainers | next/latest automation and required credentials |
| [Deployments](deployments.md) | application maintainers | Ethereum registry and immutable explorer addresses, evidence, and reproducibility |

Start with the [project README](../README.md) for installation and quick-start commands.
