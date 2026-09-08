import {
  ResurrectBrowserClient,
  injectedProvider,
  jsonRpcProvider,
  type BrowserPeerCandidate,
  type Eip1193Provider,
  type RegistryProvider,
  type ScanReport
} from '@resurrect-protocol/client'
import {
  DEFAULT_RPC_ENDPOINTS,
  DefaultRpcEndpointsError,
  EXPLORER_SCAN_OPTIONS,
  LOCAL_RPC_PLACEHOLDER,
  errorMessage,
  formatChainTime,
  friendlyError,
  networkDescriptor,
  normalizeRpcUrl,
  scanWithRpcFallback,
  shortValue,
  summarizeScan
} from './model.js'
import type { PeerProbeSession } from './peer-probe.js'
import './styles.css'

declare global {
  interface Window {
    ethereum?: Eip1193Provider
  }
}

const descriptor = networkDescriptor()
const app = document.querySelector<HTMLDivElement>('#app')
if (app == null) throw new Error('Explorer mount point is missing')

app.innerHTML = `
  <div class="shell">
    <header>
      <a class="wordmark" href="./" aria-label="Resurrect Explorer home"><span aria-hidden="true">./</span>resurrect</a>
      <nav aria-label="Project links">
        <a href="https://etherscan.io/address/${descriptor.registry.address}#code" target="_blank" rel="noreferrer">contract</a>
        <a href="https://github.com/cazala/resurrect" target="_blank" rel="noreferrer">source↗</a>
      </nav>
    </header>

    <main>
      <section class="intro">
        <p class="eyebrow">ethereum // peer recovery</p>
        <h1>find_peer()</h1>
        <p>Scan the registry. Verify the record. Ping the peer.</p>
      </section>

      <section class="controls" aria-label="Ethereum registry scan">
        <button class="scan-button" id="scan-button" type="button"><span id="scan-button-label">Scan</span><span aria-hidden="true">[enter]</span></button>

        <div class="fallback" id="provider-fallback" hidden>
          <p class="fallback-copy"><strong>Default RPCs didn’t work.</strong> Enter an Ethereum RPC or connect your wallet.</p>
          <form class="fallback-form" id="fallback-form">
            <label class="sr-only" for="rpc-url">Ethereum JSON-RPC URL</label>
            <input id="rpc-url" name="rpc-url" type="url" placeholder="${LOCAL_RPC_PLACEHOLDER}" aria-label="Ethereum JSON-RPC URL" spellcheck="false" autocomplete="off" />
            <button id="custom-rpc-button" type="submit">Use RPC</button>
            <button id="wallet-button" type="button">Wallet</button>
          </form>
          <p class="form-error" id="form-error" role="alert" hidden></p>
        </div>
      </section>

      <section class="network" aria-live="polite">
        <div class="status-line">
          <div class="status idle" id="connection-status"><i></i><span id="connection-label">idle</span></div>
          <span id="scan-context">ethereum:1 // resurrect:v1</span>
        </div>

        <div class="summary" id="scan-summary" hidden>
          <span><strong id="metric-peers">0</strong> peers</span>
          <span><strong id="metric-announcements">0</strong> events</span>
          <span>block <strong id="metric-head">—</strong></span>
        </div>

        <div class="peer-list" id="peer-list">
          <p class="empty">ready to scan signed peer records.</p>
        </div>
      </section>
    </main>
  </div>
`

const fallback = requiredElement<HTMLElement>('provider-fallback')
const fallbackForm = requiredElement<HTMLFormElement>('fallback-form')
const rpcInput = requiredElement<HTMLInputElement>('rpc-url')
const scanButton = requiredElement<HTMLButtonElement>('scan-button')
const scanButtonLabel = requiredElement<HTMLElement>('scan-button-label')
const customRpcButton = requiredElement<HTMLButtonElement>('custom-rpc-button')
const walletButton = requiredElement<HTMLButtonElement>('wallet-button')
const formError = requiredElement<HTMLElement>('form-error')
let scanNumber = 0
let activeProbe: PeerProbeSession | undefined

scanButton.addEventListener('click', () => { void scanDefaults() })
fallbackForm.addEventListener('submit', (event) => { event.preventDefault(); void scanCustomRpc() })
walletButton.addEventListener('click', () => { void scanWallet() })
window.addEventListener('pagehide', () => { void activeProbe?.close() })

async function scanDefaults(): Promise<void> {
  const currentScan = await beginScan()
  fallback.hidden = true
  try {
    const { endpoint, result } = await scanWithRpcFallback(
      async ({ url }) => new ResurrectBrowserClient(descriptor, jsonRpcProvider(url)).scan(EXPLORER_SCAN_OPTIONS),
      (endpoint, index, total) => {
        if (currentScan !== scanNumber) return
        setStatus('loading', 'scanning')
        requiredElement<HTMLElement>('scan-context').textContent = `rpc ${index + 1}/${total} // ${endpoint.name} // ${new URL(endpoint.url).host}`
        renderEmpty(`querying ${endpoint.name}…`)
      }
    )
    if (currentScan !== scanNumber) return
    renderReport(result, endpoint.name)
    setStatus('connected', 'found')
  } catch (error) {
    if (currentScan !== scanNumber) return
    if (error instanceof DefaultRpcEndpointsError) {
      fallback.hidden = false
      setStatus('error', 'rpc failed')
      requiredElement<HTMLElement>('scan-context').textContent = `tried ${DEFAULT_RPC_ENDPOINTS.length} public RPCs // manual fallback ready`
      renderEmpty('scan incomplete.')
      rpcInput.focus()
    } else {
      showProviderError(error)
    }
  } finally {
    if (currentScan === scanNumber) setBusy(false)
  }
}

async function scanCustomRpc(): Promise<void> {
  let url: string
  try {
    url = normalizeRpcUrl(rpcInput.value)
  } catch (error) {
    showProviderError(error)
    return
  }
  await scanSingleProvider(jsonRpcProvider(url), `custom // ${new URL(url).host}`)
}

async function scanWallet(): Promise<void> {
  let provider: RegistryProvider
  try {
    provider = injectedProvider(requireInjectedProvider())
  } catch (error) {
    showProviderError(error)
    return
  }
  await scanSingleProvider(provider, 'injected wallet')
}

async function scanSingleProvider(provider: RegistryProvider, label: string): Promise<void> {
  const currentScan = await beginScan()
  setStatus('loading', 'scanning')
  requiredElement<HTMLElement>('scan-context').textContent = `rpc // ${label}`
  renderEmpty(`querying ${label}…`)
  try {
    const report = await new ResurrectBrowserClient(descriptor, provider).scan(EXPLORER_SCAN_OPTIONS)
    if (currentScan !== scanNumber) return
    renderReport(report, label)
    setStatus('connected', 'found')
  } catch (error) {
    if (currentScan !== scanNumber) return
    showProviderError(error)
  } finally {
    if (currentScan === scanNumber) setBusy(false)
  }
}

async function beginScan(): Promise<number> {
  const currentScan = ++scanNumber
  clearError()
  setBusy(true)
  requiredElement<HTMLElement>('scan-summary').hidden = true
  await activeProbe?.close()
  activeProbe = undefined
  return currentScan
}

function showProviderError(error: unknown): void {
  fallback.hidden = false
  formError.textContent = friendlyError(error)
  formError.hidden = false
  setStatus('error', 'failed')
  requiredElement<HTMLElement>('scan-context').textContent = 'manual provider failed // retry or scan defaults'
  renderEmpty('scan incomplete.')
}

function renderEmpty(message: string): void {
  const list = requiredElement<HTMLElement>('peer-list')
  const empty = document.createElement('p')
  empty.className = 'empty'
  empty.textContent = message
  list.replaceChildren(empty)
}

function renderReport(report: ScanReport, provider: string): void {
  const summary = summarizeScan(report)
  requiredElement<HTMLElement>('metric-announcements').textContent = summary.announcements
  requiredElement<HTMLElement>('metric-peers').textContent = summary.browserPeers
  requiredElement<HTMLElement>('metric-head').textContent = summary.confirmedHead
  requiredElement<HTMLElement>('scan-context').textContent = `${provider} // ${formatChainTime(report.headTimestamp)}`
  requiredElement<HTMLElement>('scan-summary').hidden = false
  const list = requiredElement<HTMLElement>('peer-list')
  list.replaceChildren()
  if (report.candidates.length === 0) {
    const empty = document.createElement('p')
    empty.className = 'empty'
    empty.textContent = report.recordsRejected > 0
      ? `${report.recordsRejected.toLocaleString()} records were expired, invalid, or not browser-ready.`
      : 'No browser-ready peers found.'
    list.append(empty)
    return
  }
  report.candidates.forEach((candidate) => list.append(peerCard(candidate)))
}

function peerCard(candidate: BrowserPeerCandidate): HTMLElement {
  const article = document.createElement('article')
  article.className = 'peer'
  const peerLine = document.createElement('div')
  peerLine.className = 'peer-line'
  const identity = document.createElement('div')
  const badge = document.createElement('span')
  badge.className = 'peer-status'
  badge.textContent = 'Announced'
  const peerId = document.createElement('code')
  peerId.textContent = shortValue(candidate.peerId, 16, 10)
  peerId.title = candidate.peerId
  identity.append(badge, peerId)
  const button = document.createElement('button')
  button.className = 'ping-button'
  button.type = 'button'
  button.textContent = 'Ping →'
  peerLine.append(identity, button)

  const endpoint = document.createElement('p')
  endpoint.className = 'endpoint'
  endpoint.textContent = candidate.endpoints[0] ?? 'No endpoint'
  endpoint.title = candidate.endpoints.join('\n')
  const metadata = document.createElement('p')
  metadata.className = 'metadata'
  metadata.textContent = `block ${candidate.blockNumber.toLocaleString()} · valid until ${formatChainTime(candidate.validUntil)}`
  const result = document.createElement('div')
  result.className = 'probe-result'
  result.hidden = true
  button.addEventListener('click', () => { void runProbe(candidate, button, result, badge) })
  article.append(peerLine, endpoint, metadata, result)
  return article
}

async function runProbe(
  candidate: BrowserPeerCandidate,
  button: HTMLButtonElement,
  result: HTMLElement,
  badge: HTMLElement
): Promise<void> {
  button.disabled = true
  button.textContent = 'Connecting…'
  result.hidden = true
  badge.textContent = 'Checking'
  badge.className = 'peer-status checking'
  try {
    const { probePeer } = await import('./peer-probe.js')
    await activeProbe?.close()
    activeProbe = await probePeer(candidate)
    const probe = activeProbe.result
    badge.textContent = 'Live'
    badge.className = 'peer-status live'
    result.textContent = `${probe.pingMs.toFixed(0)} ms ping · ${probe.connectionMs.toFixed(0)} ms connect · ${probe.agentVersion ?? 'unknown agent'} · ${probe.protocolVersion ?? 'unknown protocol'}`
    result.title = `Noise peer ${probe.peerId}\n${probe.protocols.join('\n')}`
    result.hidden = false
    button.textContent = 'Ping again →'
  } catch (error) {
    badge.textContent = 'Offline'
    badge.className = 'peer-status failed'
    result.textContent = errorMessage(error)
    result.hidden = false
    button.textContent = 'Retry →'
  } finally {
    button.disabled = false
  }
}

function requireInjectedProvider(): Eip1193Provider {
  if (window.ethereum == null) throw new Error('No browser wallet was found. Enable one or enter an Ethereum RPC URL.')
  return window.ethereum
}

function setBusy(busy: boolean): void {
  scanButton.disabled = busy
  customRpcButton.disabled = busy
  walletButton.disabled = busy
  scanButtonLabel.textContent = busy ? 'Scanning…' : 'Scan'
}

function setStatus(state: 'loading' | 'connected' | 'error', label: string): void {
  const status = requiredElement<HTMLElement>('connection-status')
  status.className = `status ${state}`
  requiredElement<HTMLElement>('connection-label').textContent = label
}

function clearError(): void {
  formError.hidden = true
  formError.textContent = ''
}

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id)
  if (element == null) throw new Error(`Missing #${id}`)
  return element as T
}
