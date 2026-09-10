import { describe, expect, it } from 'vitest'
import { deriveNamespace, type ScanReport } from '@resurrect-protocol/client'
import {
  DEFAULT_NAMESPACE_APPLICATION,
  DEFAULT_NAMESPACE_MAJOR_VERSION,
  DEFAULT_RPC_ENDPOINTS,
  DEFAULT_NAMESPACE,
  DEFAULT_RPC_URL,
  DefaultRpcEndpointsError,
  ETHEREUM_MAX_BLOCKS_PER_TTL,
  EXPLORER_SCAN_OPTIONS,
  LOCAL_RPC_PLACEHOLDER,
  errorMessage,
  formatChainTime,
  friendlyError,
  networkDescriptor,
  normalizeRpcUrl,
  resolveNamespace,
  scanWithRpcFallback,
  shortValue,
  summarizeScan
} from '../src/model.js'

function report(): ScanReport {
  return { startBlock: 100n, headBlock: 149n, headTimestamp: 2_000n, logsProcessed: 3, recordsRejected: 2, chunkReductions: 1, candidates: [] }
}

describe('explorer model', () => {
  it('derives the canonical Resurrect namespace and pins the Ethereum deployment', () => {
    const descriptor = networkDescriptor()
    expect(descriptor.namespace).toBe(DEFAULT_NAMESPACE)
    expect(DEFAULT_NAMESPACE).toBe('0x71572bed5372559cfc007b7da8b411f2d96091816cdf057de65151b984a74e90')
    expect(descriptor.registry.chainId).toBe(1n)
    expect(descriptor.registry.address).toBe('0x136c191B5e6541532E42Ecd7C719C29D7ecdf468')
    expect(DEFAULT_RPC_URL).toBe('https://rpc.mevblocker.io')
    expect(DEFAULT_RPC_ENDPOINTS).toEqual([
      { name: 'MEV Blocker', url: 'https://rpc.mevblocker.io' },
      { name: 'PublicNode', url: 'https://ethereum-rpc.publicnode.com' },
      { name: 'StupidTech', url: 'https://evm.stupidtech.net/v1/ethereum' },
      { name: 'dRPC', url: 'https://eth.drpc.org' },
      { name: 'Cloudflare', url: 'https://cloudflare-eth.com' }
    ])
    expect(LOCAL_RPC_PLACEHOLDER).toBe('http://127.0.0.1:8545')
    expect(ETHEREUM_MAX_BLOCKS_PER_TTL).toBe(650_000n)
    expect(EXPLORER_SCAN_OPTIONS).toMatchObject({ maxBlockLookback: 650_000n, initialChunkSize: 10_000n })
  })

  it('accepts readable namespace inputs and derives every namespace canonically', () => {
    expect(resolveNamespace(DEFAULT_NAMESPACE_APPLICATION, DEFAULT_NAMESPACE_MAJOR_VERSION)).toEqual({
      application: 'resurrect',
      majorVersion: 1n,
      label: 'resurrect:v1',
      namespace: deriveNamespace('resurrect', 1n)
    })

    const custom = resolveNamespace('  example-app  ', '2')
    expect(custom).toEqual({
      application: 'example-app',
      majorVersion: 2n,
      label: 'example-app:v2',
      namespace: deriveNamespace('example-app', 2n)
    })
    expect(networkDescriptor('example-app', 2n).namespace).toBe(custom.namespace)
  })

  it('rejects unreadable namespace inputs', () => {
    expect(() => resolveNamespace('   ', '1')).toThrow(/must not be empty/)
    expect(() => resolveNamespace('example', '-1')).toThrow(/unsigned decimal/)
    expect(() => resolveNamespace('example', '01')).toThrow(/unsigned decimal/)
    expect(() => resolveNamespace('example', '1.5')).toThrow(/unsigned decimal/)
    expect(() => resolveNamespace('example', Number.MAX_SAFE_INTEGER + 1)).toThrow(/safe integer/)
  })

  it('tries public RPCs in order and stops on the first successful scan', async () => {
    const endpoints = DEFAULT_RPC_ENDPOINTS.slice(0, 3)
    const attempts: string[] = []
    const progress: string[] = []
    const fallback = await scanWithRpcFallback(
      async (endpoint) => {
        attempts.push(endpoint.name)
        if (endpoint.name !== 'StupidTech') throw new Error(`${endpoint.name} unavailable`)
        return 'scan report'
      },
      (endpoint, index, total) => progress.push(`${index + 1}/${total}:${endpoint.name}`),
      endpoints
    )

    expect(fallback).toEqual({ endpoint: endpoints[2], result: 'scan report' })
    expect(attempts).toEqual(['MEV Blocker', 'PublicNode', 'StupidTech'])
    expect(progress).toEqual(['1/3:MEV Blocker', '2/3:PublicNode', '3/3:StupidTech'])
  })

  it('reports every failed default RPC so the UI can reveal manual providers', async () => {
    const endpoints = DEFAULT_RPC_ENDPOINTS.slice(0, 2)
    const failure = await scanWithRpcFallback(
      async (endpoint) => { throw new Error(`${endpoint.name} unavailable`) },
      undefined,
      endpoints
    ).catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(DefaultRpcEndpointsError)
    expect((failure as DefaultRpcEndpointsError).failures.map(({ endpoint, error }) => [endpoint.name, errorMessage(error)])).toEqual([
      ['MEV Blocker', 'MEV Blocker unavailable'],
      ['PublicNode', 'PublicNode unavailable']
    ])
  })

  it('normalizes HTTP providers and rejects other transports', () => {
    expect(normalizeRpcUrl(' https://rpc.mevblocker.io ')).toBe('https://rpc.mevblocker.io/')
    expect(normalizeRpcUrl('http://127.0.0.1:8545')).toBe('http://127.0.0.1:8545/')
    expect(() => normalizeRpcUrl('wss://rpc.example')).toThrow(/HTTPS or HTTP/)
  })

  it('keeps announcements and browser peers as separate metrics', () => {
    expect(summarizeScan(report())).toEqual({ announcements: '3', browserPeers: '0', filteredRecords: '2', confirmedHead: '149', scannedBlocks: '50' })
  })

  it('formats chain time and long identifiers', () => {
    expect(formatChainTime(2_000n)).not.toMatch(/Invalid|range/)
    expect(formatChainTime(BigInt(Number.MAX_SAFE_INTEGER))).toBe('Timestamp out of range')
    expect(shortValue('0x1234567890abcdef', 6, 4)).toBe('0x1234…cdef')
    expect(shortValue('short')).toBe('short')
  })

  it('preserves useful error messages', () => {
    expect(errorMessage(new Error('provider failed'))).toBe('provider failed')
    expect(errorMessage('unknown failure')).toBe('unknown failure')
    expect(errorMessage({ code: 4001, message: 'User rejected the request' })).toBe('User rejected the request')
    expect(errorMessage({ data: { originalError: { message: 'nested provider failure' } } })).toBe('nested provider failure')
    expect(errorMessage({ code: -1 })).toBe('The provider request failed.')
    expect(friendlyError({ message: 'JSON-RPC 30: Request timeout on the free plan' })).toBe(
      'This provider cannot serve the recent event scan. Try another public Ethereum RPC.'
    )
  })
})
