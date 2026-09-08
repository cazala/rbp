import {
  ETHEREUM_MAINNET_MAX_BLOCKS_PER_TTL,
  ethereumMainnetDescriptor,
  type NetworkDescriptor,
  type ScanOptions,
  type ScanReport
} from '@resurrect-protocol/client'

export interface PublicRpcEndpoint {
  readonly name: string
  readonly url: string
}

export const DEFAULT_RPC_ENDPOINTS = [
  { name: 'MEV Blocker', url: 'https://rpc.mevblocker.io' },
  { name: 'PublicNode', url: 'https://ethereum-rpc.publicnode.com' },
  { name: 'StupidTech', url: 'https://evm.stupidtech.net/v1/ethereum' },
  { name: 'dRPC', url: 'https://eth.drpc.org' },
  { name: 'Cloudflare', url: 'https://cloudflare-eth.com' }
] as const satisfies readonly PublicRpcEndpoint[]
export const DEFAULT_RPC_URL = DEFAULT_RPC_ENDPOINTS[0].url
export const LOCAL_RPC_PLACEHOLDER = 'http://127.0.0.1:8545'
export const DEFAULT_NAMESPACE = '0x0c07fdd466a110bea1916247b73191c331123bbc77b010462676a10d1c3928e2'

export const ETHEREUM_MAX_BLOCKS_PER_TTL = ETHEREUM_MAINNET_MAX_BLOCKS_PER_TTL
export const EXPLORER_SCAN_OPTIONS: Readonly<ScanOptions> = {
  maxBlockLookback: ETHEREUM_MAX_BLOCKS_PER_TTL,
  initialChunkSize: 10_000n
}

export interface ScanSummary {
  announcements: string
  browserPeers: string
  filteredRecords: string
  confirmedHead: string
  scannedBlocks: string
}

export interface RpcFallbackResult<T> {
  endpoint: PublicRpcEndpoint
  result: T
}

export interface RpcAttemptFailure {
  endpoint: PublicRpcEndpoint
  error: unknown
}

export class DefaultRpcEndpointsError extends Error {
  readonly failures: readonly RpcAttemptFailure[]

  constructor(failures: readonly RpcAttemptFailure[]) {
    super('Every default Ethereum RPC failed.')
    this.name = 'DefaultRpcEndpointsError'
    this.failures = failures
  }
}

export function networkDescriptor(): NetworkDescriptor {
  return ethereumMainnetDescriptor(DEFAULT_NAMESPACE)
}

export function normalizeRpcUrl(value: string): string {
  const url = new URL(value.trim())
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('RPC URL must use HTTPS or HTTP')
  }
  return url.href
}

export async function scanWithRpcFallback<T>(
  scan: (endpoint: PublicRpcEndpoint) => Promise<T>,
  onAttempt: (endpoint: PublicRpcEndpoint, index: number, total: number) => void = () => {},
  endpoints: readonly PublicRpcEndpoint[] = DEFAULT_RPC_ENDPOINTS
): Promise<RpcFallbackResult<T>> {
  const failures: RpcAttemptFailure[] = []
  for (const [index, endpoint] of endpoints.entries()) {
    onAttempt(endpoint, index, endpoints.length)
    try {
      return { endpoint, result: await scan(endpoint) }
    } catch (error) {
      failures.push({ endpoint, error })
    }
  }
  throw new DefaultRpcEndpointsError(failures)
}

export function summarizeScan(report: ScanReport): ScanSummary {
  return {
    announcements: report.logsProcessed.toLocaleString(),
    browserPeers: report.candidates.length.toLocaleString(),
    filteredRecords: report.recordsRejected.toLocaleString(),
    confirmedHead: report.headBlock.toLocaleString(),
    scannedBlocks: (report.headBlock - report.startBlock + 1n).toLocaleString()
  }
}

export function formatChainTime(timestamp: bigint): string {
  const milliseconds = Number(timestamp) * 1000
  if (!Number.isSafeInteger(milliseconds)) return 'Timestamp out of range'
  const date = new Date(milliseconds)
  if (Number.isNaN(date.getTime())) return 'Invalid timestamp'
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function shortValue(value: string, leading = 10, trailing = 8): string {
  if (value.length <= leading + trailing + 1) return value
  return `${value.slice(0, leading)}…${value.slice(-trailing)}`
}

export function errorMessage(error: unknown): string {
  return nestedErrorMessage(error, new Set(), 0) ?? 'The provider request failed.'
}

export function friendlyError(error: unknown): string {
  const message = errorMessage(error)
  if (/free plan|archive|historical|request timeout|eth_getlogs|block range|range limit/i.test(message)) {
    return 'This provider cannot serve the recent event scan. Try another public Ethereum RPC.'
  }
  if (/chain id|does not match/i.test(message)) {
    return `${message} Switch the wallet to Ethereum mainnet or use Public RPC.`
  }
  if (/failed to fetch|network error|cors|load failed/i.test(message)) {
    return 'The provider could not be reached. Check its URL and browser access policy.'
  }
  return message
}

function nestedErrorMessage(value: unknown, visited: Set<object>, depth: number): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined
  if (value instanceof Error && value.message.trim() !== '') return value.message
  if (typeof value !== 'object' || value == null || depth > 3 || visited.has(value)) return undefined
  visited.add(value)
  const record = value as Record<string, unknown>
  for (const key of ['shortMessage', 'message', 'reason', 'details'] as const) {
    const candidate = record[key]
    if (typeof candidate === 'string' && candidate.trim() !== '') return candidate
  }
  for (const key of ['error', 'cause', 'data', 'originalError'] as const) {
    const candidate = nestedErrorMessage(record[key], visited, depth + 1)
    if (candidate != null) return candidate
  }
  return undefined
}
