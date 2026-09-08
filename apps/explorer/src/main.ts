import {
  ResurrectBrowserClient,
  injectedProvider,
  jsonRpcProvider,
  type BrowserPeerCandidate,
  type Eip1193Provider,
  type ScanReport
} from '@resurrect-protocol/client'
import {
  DEFAULT_RPC_URL,
  EXPLORER_SCAN_OPTIONS,
  errorMessage,
  formatChainTime,
  friendlyError,
  networkDescriptor,
  normalizeRpcUrl,
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

type ProviderMode = 'rpc' | 'wallet'
const descriptor = networkDescriptor()
const app = document.querySelector<HTMLDivElement>('#app')
if (app == null) throw new Error('Explorer mount point is missing')

app.innerHTML = `
  <div class="shell">
    <header>
      <a class="wordmark" href="./" aria-label="Resurrect Explorer home"><span>R</span>resurrect</a>
      <nav aria-label="Project links">
        <a href="https://etherscan.io/address/${descriptor.registry.address}#code" target="_blank" rel="noreferrer">Ethereum</a>
        <a href="https://github.com/cazala/resurrect" target="_blank" rel="noreferrer">GitHub ↗</a>
      </nav>
    </header>

    <main>
      <section class="intro">
        <p class="eyebrow">Peer recovery</p>
        <h1>Find a live peer.</h1>
        <p>Read a signed endpoint from Ethereum, then authenticate and ping it.</p>
      </section>

      <form id="provider-form">
        <div class="provider-tabs" role="radiogroup" aria-label="Ethereum provider">
          <button class="provider-tab active" type="button" role="radio" aria-checked="true" data-mode="rpc">Public RPC</button>
          <button class="provider-tab" type="button" role="radio" aria-checked="false" data-mode="wallet">Wallet</button>
        </div>

        <div class="provider-row" id="rpc-field">
          <label class="sr-only" for="rpc-url">Ethereum JSON-RPC URL</label>
          <input id="rpc-url" name="rpc-url" type="url" value="${DEFAULT_RPC_URL}" aria-label="Ethereum JSON-RPC URL" spellcheck="false" autocomplete="off" />
        </div>
        <p class="provider-note" id="wallet-note" hidden>Read-only. No account request.</p>

        <button class="discover-button" id="scan-button" type="submit"><span id="scan-button-label">Discover</span><span aria-hidden="true">→</span></button>
        <p class="form-error" id="form-error" role="alert" hidden></p>
      </form>

      <section class="network" aria-live="polite">
        <div class="status-line">
          <div class="status idle" id="connection-status"><i></i><span id="connection-label">Ready</span></div>
          <span id="scan-context">Ethereum mainnet · Resurrect v1</span>
        </div>

        <div class="summary" id="scan-summary" hidden>
          <span><strong id="metric-peers">0</strong> peers</span>
          <span><strong id="metric-announcements">0</strong> events</span>
          <span>block <strong id="metric-head">—</strong></span>
        </div>

        <div class="peer-list" id="peer-list">
          <p class="empty">Discover signed browser peers, then prove one is live.</p>
        </div>
      </section>
    </main>
  </div>
`

const form = requiredElement<HTMLFormElement>('provider-form')
const rpcInput = requiredElement<HTMLInputElement>('rpc-url')
const rpcField = requiredElement<HTMLElement>('rpc-field')
const walletNote = requiredElement<HTMLElement>('wallet-note')
const scanButton = requiredElement<HTMLButtonElement>('scan-button')
const scanButtonLabel = requiredElement<HTMLElement>('scan-button-label')
const formError = requiredElement<HTMLElement>('form-error')
let providerMode: ProviderMode = 'rpc'
let scanNumber = 0
let activeProbe: PeerProbeSession | undefined

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-mode]')) {
  button.addEventListener('click', () => selectMode(button.dataset.mode === 'wallet' ? 'wallet' : 'rpc'))
}
form.addEventListener('submit', (event) => { event.preventDefault(); void scan() })
window.addEventListener('pagehide', () => { void activeProbe?.close() })

function selectMode(mode: ProviderMode): void {
  providerMode = mode
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-mode]')) {
    const active = button.dataset.mode === mode
    button.classList.toggle('active', active)
    button.setAttribute('aria-checked', String(active))
  }
  rpcField.hidden = mode !== 'rpc'
  walletNote.hidden = mode !== 'wallet'
  clearError()
}

async function scan(): Promise<void> {
  const currentScan = ++scanNumber
  clearError()
  setBusy(true)
  setStatus('loading', 'Scanning')
  requiredElement<HTMLElement>('scan-context').textContent = 'Reading recent registry events…'
  requiredElement<HTMLElement>('scan-summary').hidden = true
  renderEmpty('Reading Ethereum…')
  try {
    await activeProbe?.close()
    activeProbe = undefined
    const provider = providerMode === 'rpc'
      ? jsonRpcProvider(normalizeRpcUrl(rpcInput.value))
      : injectedProvider(requireInjectedProvider())
    const report = await new ResurrectBrowserClient(descriptor, provider).scan(EXPLORER_SCAN_OPTIONS)
    if (currentScan !== scanNumber) return
    renderReport(report)
    setStatus('connected', 'Found')
  } catch (error) {
    if (currentScan !== scanNumber) return
    formError.textContent = friendlyError(error)
    formError.hidden = false
    setStatus('error', 'Failed')
    requiredElement<HTMLElement>('scan-context').textContent = 'Choose another provider and retry.'
    renderEmpty('Discovery did not complete.')
  } finally {
    if (currentScan === scanNumber) setBusy(false)
  }
}

function renderEmpty(message: string): void {
  const list = requiredElement<HTMLElement>('peer-list')
  const empty = document.createElement('p')
  empty.className = 'empty'
  empty.textContent = message
  list.replaceChildren(empty)
}

function renderReport(report: ScanReport): void {
  const summary = summarizeScan(report)
  requiredElement<HTMLElement>('metric-announcements').textContent = summary.announcements
  requiredElement<HTMLElement>('metric-peers').textContent = summary.browserPeers
  requiredElement<HTMLElement>('metric-head').textContent = summary.confirmedHead
  requiredElement<HTMLElement>('scan-context').textContent = formatChainTime(report.headTimestamp)
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
  if (window.ethereum == null) throw new Error('No browser wallet was found. Enable one or use Public RPC.')
  return window.ethereum
}

function setBusy(busy: boolean): void {
  scanButton.disabled = busy
  scanButtonLabel.textContent = busy ? 'Scanning…' : 'Discover'
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
