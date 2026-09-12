import { peerDiscoverySymbol, type PeerDiscovery, type PeerDiscoveryEvents, type PeerInfo, type Startable } from '@libp2p/interface'
import { peerIdFromString } from '@libp2p/peer-id'
import { multiaddr } from '@multiformats/multiaddr'
import { TypedEventEmitter } from 'main-event'
import type { ResurrectBrowserClient } from './client.js'
import type { BrowserPeerCandidate, ScanOptions } from './types.js'

export interface ResurrectPeerDiscoveryInit {
  /**
   * Client bound to the application's network descriptor and Ethereum
   * provider.
   */
  client: ResurrectBrowserClient

  /**
   * Gate consulted before every scan. Returning `false` skips the scan
   * entirely, costing no Ethereum request.
   *
   * Resurrect is a recovery path, not a discovery loop: a node that already
   * has peers should not be reading the registry. Supply a predicate over the
   * host's own connection count, for example
   * `() => node.getConnections().length < 2`. Defaults to scanning on every
   * interval, which is appropriate only for a node that has no other
   * discovery mechanism.
   */
  shouldScan?(): boolean | Promise<boolean>

  /**
   * Milliseconds between scan attempts. Defaults to five minutes. Registry
   * announcements are TTL-bounded and change slowly; polling faster mostly
   * spends provider quota.
   */
  intervalMs?: number

  /**
   * Scan bounds forwarded to the registry scanner.
   */
  scan?: ScanOptions

  /**
   * Receives non-fatal scan failures. Discovery errors are hints, not faults,
   * so they are never thrown at the libp2p host.
   */
  onError?(error: unknown): void
}

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000

/**
 * Resurrect registry discovery as a libp2p `PeerDiscovery`.
 *
 * Peers are emitted as `peer` events for the host to place in its peer store.
 * Every candidate has already had its signed record verified by the scanner;
 * emitting one is not an endorsement, and the host applies its own dial
 * policy as with any other discovery source.
 */
export class ResurrectPeerDiscovery extends TypedEventEmitter<PeerDiscoveryEvents> implements PeerDiscovery, Startable {
  readonly #client: ResurrectBrowserClient
  readonly #shouldScan: () => boolean | Promise<boolean>
  readonly #intervalMs: number
  readonly #scan: ScanOptions
  readonly #onError: (error: unknown) => void
  #timer: ReturnType<typeof setInterval> | undefined
  #scanning = false
  #running = false

  constructor(init: ResurrectPeerDiscoveryInit) {
    super()
    this.#client = init.client
    this.#shouldScan = init.shouldScan?.bind(init) ?? (() => true)
    this.#intervalMs = init.intervalMs ?? DEFAULT_INTERVAL_MS
    this.#scan = init.scan ?? {}
    this.#onError = init.onError?.bind(init) ?? (() => {})
  }

  get [peerDiscoverySymbol](): PeerDiscovery {
    return this
  }

  get [Symbol.toStringTag](): string {
    return '@resurrect-protocol/peer-discovery'
  }

  get isStarted(): boolean {
    return this.#running
  }

  start(): void {
    if (this.#running) return
    this.#running = true
    this.#timer = setInterval(() => {
      void this.scanOnce()
    }, this.#intervalMs)
  }

  stop(): void {
    this.#running = false
    if (this.#timer !== undefined) {
      clearInterval(this.#timer)
      this.#timer = undefined
    }
  }

  /**
   * Runs one gated scan and emits every usable candidate.
   *
   * Safe to call directly, which is the useful shape for a host that would
   * rather drive recovery from its own connectivity events than on a timer.
   * Overlapping calls are collapsed: a scan already in flight wins.
   */
  async scanOnce(): Promise<number> {
    if (this.#scanning) return 0
    this.#scanning = true
    try {
      if (!(await this.#shouldScan())) return 0
      const report = await this.#client.scan(this.#scan)
      let emitted = 0
      for (const candidate of report.candidates) {
        // A scan that finished after stop() must not keep feeding the host.
        if (!this.#running) break
        const peer = toPeerInfo(candidate)
        if (peer === undefined) continue
        this.safeDispatchEvent('peer', { detail: peer })
        emitted++
      }
      return emitted
    } catch (error) {
      // Every discovery source is allowed to fail; the host keeps running.
      this.#onError(error)
      return 0
    } finally {
      this.#scanning = false
    }
  }
}

/**
 * Converts a verified registry candidate into a libp2p `PeerInfo`.
 *
 * Returns `undefined` when the identity or every endpoint fails to parse.
 * Candidates are attacker-supplied until parsed, so a malformed one is
 * dropped rather than allowed to throw into the host's discovery loop.
 */
function toPeerInfo(candidate: BrowserPeerCandidate): PeerInfo | undefined {
  let id
  try {
    id = peerIdFromString(candidate.peerId)
  } catch {
    return undefined
  }
  const multiaddrs = []
  for (const endpoint of candidate.endpoints) {
    try {
      multiaddrs.push(multiaddr(endpoint))
    } catch {
      // Skip the endpoint, keep the peer: one bad address among several is
      // not a reason to discard a verified record.
    }
  }
  if (multiaddrs.length === 0) return undefined
  return { id, multiaddrs }
}

/**
 * Builds the libp2p `peerDiscovery` entry.
 *
 * ```TypeScript
 * const node = await createLibp2p({
 *   peerDiscovery: [resurrectPeerDiscovery({ client, shouldScan: () => connections() < 2 })]
 * })
 * ```
 */
export function resurrectPeerDiscovery(init: ResurrectPeerDiscoveryInit): () => ResurrectPeerDiscovery {
  return () => new ResurrectPeerDiscovery(init)
}
