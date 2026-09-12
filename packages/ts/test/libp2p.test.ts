import { describe, expect, it, vi } from 'vitest'
import { generateKeyPair } from '@libp2p/crypto/keys'
import { peerIdFromPrivateKey } from '@libp2p/peer-id'
import { peerDiscoverySymbol, type PeerInfo } from '@libp2p/interface'
import { ResurrectPeerDiscovery, resurrectPeerDiscovery } from '../src/libp2p.js'
import type { ResurrectBrowserClient } from '../src/client.js'
import type { BrowserPeerCandidate, ScanReport } from '../src/types.js'

async function identity(): Promise<string> {
  const key = await generateKeyPair('Ed25519')
  return peerIdFromPrivateKey(key).toString()
}

function candidate(peerId: string, endpoints: readonly string[]): BrowserPeerCandidate {
  return {
    recordType: 2,
    peerId,
    sequence: 1n,
    endpoints,
    rawSignedRecord: '0x01',
    validUntil: 2n ** 63n,
    blockNumber: 1n,
    logIndex: 0n
  }
}

function report(candidates: readonly BrowserPeerCandidate[]): ScanReport {
  return {
    startBlock: 1n,
    headBlock: 2n,
    headTimestamp: 3n,
    logsProcessed: candidates.length,
    recordsRejected: 0,
    chunkReductions: 0,
    candidates
  }
}

/** Stands in for the client, recording how often the registry was read. */
function stubClient(result: ScanReport | Error): { client: ResurrectBrowserClient, scans: () => number } {
  let scans = 0
  const client = {
    async scan(): Promise<ScanReport> {
      scans++
      if (result instanceof Error) throw result
      return result
    }
  } as unknown as ResurrectBrowserClient
  return { client, scans: () => scans }
}

function collect(discovery: ResurrectPeerDiscovery): PeerInfo[] {
  const found: PeerInfo[] = []
  discovery.addEventListener('peer', (event) => {
    found.push(event.detail)
  })
  return found
}

/** Asserts a single discovery and narrows it for strict index checking. */
function only(found: PeerInfo[]): PeerInfo {
  expect(found).toHaveLength(1)
  const [peer] = found
  if (peer === undefined) throw new Error('expected exactly one discovered peer')
  return peer
}

describe('libp2p peer discovery', () => {
  it('emits a verified candidate as a peer the host can store', async () => {
    const peerId = await identity()
    const { client } = stubClient(report([candidate(peerId, ['/ip4/127.0.0.1/tcp/4001/ws'])]))
    const discovery = new ResurrectPeerDiscovery({ client })
    const found = collect(discovery)

    discovery.start()
    expect(await discovery.scanOnce()).toBe(1)
    discovery.stop()

    const peer = only(found)
    expect(peer.id.toString()).toBe(peerId)
    expect(peer.multiaddrs.map(String)).toEqual(['/ip4/127.0.0.1/tcp/4001/ws'])
  })

  it('reads nothing from Ethereum while the host already has peers', async () => {
    const peerId = await identity()
    const { client, scans } = stubClient(report([candidate(peerId, ['/ip4/127.0.0.1/tcp/4001/ws'])]))
    const discovery = new ResurrectPeerDiscovery({ client, shouldScan: () => false })
    const found = collect(discovery)

    discovery.start()
    expect(await discovery.scanOnce()).toBe(0)
    discovery.stop()

    // The gate must short-circuit before the provider is touched: a healthy
    // node pays no request for having Resurrect installed.
    expect(scans()).toBe(0)
    expect(found).toHaveLength(0)
  })

  it('drops a malformed identity instead of throwing into the host', async () => {
    const good = await identity()
    const { client } = stubClient(
      report([
        candidate('not-a-peer-id', ['/ip4/127.0.0.1/tcp/4001/ws']),
        candidate(good, ['/ip4/127.0.0.1/tcp/4002/ws'])
      ])
    )
    const discovery = new ResurrectPeerDiscovery({ client })
    const found = collect(discovery)

    discovery.start()
    expect(await discovery.scanOnce()).toBe(1)
    discovery.stop()

    expect(found.map((peer) => peer.id.toString())).toEqual([good])
  })

  it('keeps a peer whose other endpoints parse, and drops one whose none do', async () => {
    const partial = await identity()
    const unusable = await identity()
    const { client } = stubClient(
      report([
        candidate(partial, ['not-an-address', '/ip4/127.0.0.1/tcp/4001/ws']),
        candidate(unusable, ['not-an-address', 'also-not-one'])
      ])
    )
    const discovery = new ResurrectPeerDiscovery({ client })
    const found = collect(discovery)

    discovery.start()
    await discovery.scanOnce()
    discovery.stop()

    const peer = only(found)
    expect(peer.id.toString()).toBe(partial)
    expect(peer.multiaddrs.map(String)).toEqual(['/ip4/127.0.0.1/tcp/4001/ws'])
  })

  it('treats a scan failure as a hint rather than a fault', async () => {
    const { client } = stubClient(new Error('rpc unavailable'))
    const errors: unknown[] = []
    const discovery = new ResurrectPeerDiscovery({
      client,
      onError: (error) => errors.push(error)
    })

    discovery.start()
    await expect(discovery.scanOnce()).resolves.toBe(0)
    discovery.stop()

    expect(errors).toHaveLength(1)
    expect((errors[0] as Error).message).toBe('rpc unavailable')
  })

  it('collapses an overlapping scan rather than doubling provider load', async () => {
    const peerId = await identity()
    let release = (): void => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let scans = 0
    const client = {
      async scan(): Promise<ScanReport> {
        scans++
        await gate
        return report([candidate(peerId, ['/ip4/127.0.0.1/tcp/4001/ws'])])
      }
    } as unknown as ResurrectBrowserClient

    const discovery = new ResurrectPeerDiscovery({ client })
    discovery.start()
    const first = discovery.scanOnce()
    const second = discovery.scanOnce()
    release()

    expect(await first).toBe(1)
    expect(await second).toBe(0)
    expect(scans).toBe(1)
    discovery.stop()
  })

  it('stops feeding the host when a scan outlives stop()', async () => {
    const peerId = await identity()
    let release = (): void => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const client = {
      async scan(): Promise<ScanReport> {
        await gate
        return report([candidate(peerId, ['/ip4/127.0.0.1/tcp/4001/ws'])])
      }
    } as unknown as ResurrectBrowserClient

    const discovery = new ResurrectPeerDiscovery({ client })
    const found = collect(discovery)
    discovery.start()
    const scanning = discovery.scanOnce()
    discovery.stop()
    release()

    expect(await scanning).toBe(0)
    expect(found).toHaveLength(0)
  })

  it('polls on its interval only while started', async () => {
    vi.useFakeTimers()
    try {
      const peerId = await identity()
      const { client, scans } = stubClient(report([candidate(peerId, ['/ip4/127.0.0.1/tcp/4001/ws'])]))
      const discovery = new ResurrectPeerDiscovery({ client, intervalMs: 1_000 })

      expect(discovery.isStarted).toBe(false)
      discovery.start()
      expect(discovery.isStarted).toBe(true)

      await vi.advanceTimersByTimeAsync(3_500)
      expect(scans()).toBe(3)

      discovery.stop()
      expect(discovery.isStarted).toBe(false)
      await vi.advanceTimersByTimeAsync(10_000)
      expect(scans()).toBe(3)
    } finally {
      vi.useRealTimers()
    }
  })

  it('presents itself to libp2p as a peer-discovery provider', async () => {
    const { client } = stubClient(report([]))
    const discovery = resurrectPeerDiscovery({ client })()

    expect(discovery[peerDiscoverySymbol]).toBe(discovery)
    expect(discovery[Symbol.toStringTag]).toBe('@resurrect-protocol/peer-discovery')
  })
})
