import {
  CONTRACT_NAME,
  EXPECTED_ACCOUNT,
  MAINNET_CHAIN_ID
} from './contract.js'
import {
  assertContractAddress,
  assertTransactionHash,
  deploymentTransaction,
  verifyDeployment
} from './deployment.js'
import { addGasMargin, formatEther, sameAddress, shortHex, walletError } from './model.js'

const elements = {
  account: document.querySelector('#account'),
  network: document.querySelector('#network'),
  action: document.querySelector('#action'),
  estimate: document.querySelector('#estimate'),
  status: document.querySelector('#status'),
  result: document.querySelector('#result')
}

const state = {
  account: null,
  chainId: null,
  estimate: null,
  busy: false,
  complete: false
}

const provider = window.ethereum

function setStatus(message, kind = '') {
  elements.status.textContent = message
  elements.status.className = `status ${kind}`.trim()
}

function eligible() {
  return sameAddress(state.account, EXPECTED_ACCOUNT) && state.chainId === MAINNET_CHAIN_ID
}

function setAction(label, hint, disabled = false) {
  elements.action.replaceChildren()
  const text = document.createElement('span')
  const suffix = document.createElement('span')
  text.textContent = label
  suffix.textContent = hint
  elements.action.append(text, suffix)
  elements.action.disabled = disabled
}

function clearEstimate() {
  state.estimate = null
  elements.estimate.hidden = true
  elements.estimate.replaceChildren()
}

function render() {
  if (!provider) {
    elements.account.textContent = 'no injected wallet found'
    elements.account.className = 'bad'
    setAction('INSTALL OR OPEN A WALLET', '[required]', true)
    setStatus('Open this page in a browser with an injected Ethereum wallet.', 'error')
    return
  }

  elements.account.textContent = state.account ? shortHex(state.account) : 'not connected'
  elements.account.title = state.account ?? ''
  elements.account.className = state.account
    ? (sameAddress(state.account, EXPECTED_ACCOUNT) ? 'ok' : 'bad')
    : ''

  elements.network.textContent = state.chainId === MAINNET_CHAIN_ID
    ? 'Ethereum mainnet · chain 1'
    : (state.chainId ? `wrong chain · ${BigInt(state.chainId)}` : 'Ethereum mainnet required')
  elements.network.className = state.chainId === MAINNET_CHAIN_ID ? 'ok' : (state.chainId ? 'bad' : '')

  if (state.complete) {
    setAction('DEPLOYED + VERIFIED', '[done]', true)
    return
  }
  if (state.busy) {
    setAction('WORKING', '[check wallet]', true)
    return
  }
  if (!state.account) {
    setAction('CONNECT WALLET', '[injected]')
    return
  }
  if (state.chainId !== MAINNET_CHAIN_ID) {
    setAction('SWITCH TO ETHEREUM', '[chain 1]')
    return
  }
  if (!sameAddress(state.account, EXPECTED_ACCOUNT)) {
    setAction('SELECT CAZALA.ETH', '[wrong account]')
    return
  }
  if (!state.estimate) {
    setAction('ESTIMATE DEPLOYMENT', '[read only]')
    return
  }
  setAction('DEPLOY BEACON', '[wallet approval]')
}

async function request(method, params = []) {
  return provider.request({ method, params })
}

async function syncWallet() {
  if (!provider) return render()
  const [accounts, chainId] = await Promise.all([
    request('eth_accounts'),
    request('eth_chainId')
  ])
  const nextAccount = accounts[0] ?? null
  if (!sameAddress(nextAccount, state.account) || chainId !== state.chainId) clearEstimate()
  state.account = nextAccount
  state.chainId = chainId
  render()
}

async function connect() {
  const accounts = await request('eth_requestAccounts')
  state.account = accounts[0] ?? null
  state.chainId = await request('eth_chainId')
}

async function switchToMainnet() {
  await request('wallet_switchEthereumChain', [{ chainId: MAINNET_CHAIN_ID }])
  state.chainId = await request('eth_chainId')
}

async function selectExpectedAccount() {
  try {
    await request('wallet_requestPermissions', [{ eth_accounts: {} }])
  } catch (error) {
    if (error?.code !== -32601 && error?.code !== 4200) throw error
    await request('eth_requestAccounts')
  }
  const accounts = await request('eth_accounts')
  state.account = accounts[0] ?? null
  if (!sameAddress(state.account, EXPECTED_ACCOUNT)) {
    throw new Error(`Select cazala.eth (${shortHex(EXPECTED_ACCOUNT)}) in your wallet.`)
  }
}

async function estimateDeployment() {
  await syncWallet()
  if (!eligible()) throw new Error('Connect cazala.eth on Ethereum mainnet first.')

  const transaction = deploymentTransaction(state.account)
  const [gasHex, gasPriceHex, balanceHex] = await Promise.all([
    request('eth_estimateGas', [transaction]),
    request('eth_gasPrice'),
    request('eth_getBalance', [state.account, 'latest'])
  ])
  const gas = BigInt(gasHex)
  const gasLimit = addGasMargin(gas)
  const gasPrice = BigInt(gasPriceHex)
  const balance = BigInt(balanceHex)
  const fee = gasLimit * gasPrice
  state.estimate = { gas, gasLimit, gasPrice, balance, fee }

  elements.estimate.replaceChildren()
  const gasText = document.createElement('span')
  const feeText = document.createElement('span')
  const gasValue = document.createElement('strong')
  const feeValue = document.createElement('strong')
  gasText.append('GAS ', gasValue)
  feeText.append('MAX ≈ ', feeValue)
  gasValue.textContent = gas.toLocaleString()
  feeValue.textContent = `${formatEther(fee)} ETH`
  elements.estimate.append(gasText, feeText)
  elements.estimate.hidden = false

  if (balance < fee) {
    setStatus(`Wallet balance is ${formatEther(balance)} ETH; the estimate may not be fundable.`, 'error')
  } else {
    setStatus('Estimate ready. The next click opens the wallet confirmation.', 'success')
  }
}

async function waitForReceipt(transactionHash, timeoutMs = 20 * 60 * 1000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const receipt = await request('eth_getTransactionReceipt', [transactionHash])
    if (receipt) return receipt
    await new Promise((resolve) => setTimeout(resolve, 1_500))
  }
  throw new Error('Timed out waiting for confirmation. Check the transaction in your wallet.')
}

async function deploy() {
  await syncWallet()
  if (!eligible()) throw new Error('Wallet account or network changed. Estimate again.')
  const gasLimit = state.estimate?.gasLimit
  if (!gasLimit) throw new Error('Estimate the deployment first.')

  setStatus('Review the contract-creation transaction in your wallet.', 'working')
  const transactionHash = assertTransactionHash(await request(
    'eth_sendTransaction',
    [deploymentTransaction(state.account, gasLimit)]
  ))
  setStatus(`Transaction sent: ${shortHex(transactionHash)}. Waiting for confirmation…`, 'working')

  const receipt = await waitForReceipt(transactionHash)
  if (receipt.status !== '0x1' || !receipt.contractAddress) {
    throw new Error('The deployment transaction reverted or returned no contract address.')
  }
  assertContractAddress(receipt.contractAddress)

  setStatus('Confirmed. Verifying runtime and constants…', 'working')
  await verifyDeployment(provider, receipt.contractAddress)
  state.complete = true
  const verified = document.createElement('span')
  const addressLink = document.createElement('a')
  const transactionLink = document.createElement('a')
  verified.textContent = 'BYTECODE + VERSION + LIMITS VERIFIED'
  addressLink.href = `https://etherscan.io/address/${receipt.contractAddress}`
  addressLink.target = '_blank'
  addressLink.rel = 'noreferrer'
  addressLink.textContent = receipt.contractAddress
  transactionLink.href = `https://etherscan.io/tx/${transactionHash}`
  transactionLink.target = '_blank'
  transactionLink.rel = 'noreferrer'
  transactionLink.textContent = `transaction ${shortHex(transactionHash)}`
  elements.result.replaceChildren(verified, addressLink, transactionLink)
  elements.result.hidden = false
  setStatus(`${CONTRACT_NAME} is deployed and matches the reviewed artifact.`, 'success')
}

async function handleAction() {
  state.busy = true
  render()
  try {
    if (!state.account) {
      setStatus('Waiting for wallet connection…', 'working')
      await connect()
      clearEstimate()
      setStatus('Wallet connected. Confirm the account and network.', 'success')
    } else if (state.chainId !== MAINNET_CHAIN_ID) {
      setStatus('Waiting for the network switch…', 'working')
      await switchToMainnet()
      clearEstimate()
      setStatus('Ethereum mainnet selected.', 'success')
    } else if (!sameAddress(state.account, EXPECTED_ACCOUNT)) {
      setStatus('Select the account that owns cazala.eth.', 'working')
      await selectExpectedAccount()
      clearEstimate()
      setStatus('cazala.eth account selected.', 'success')
    } else if (!state.estimate) {
      setStatus('Estimating with your wallet provider…', 'working')
      await estimateDeployment()
    } else {
      await deploy()
    }
  } catch (error) {
    setStatus(walletError(error), 'error')
  } finally {
    state.busy = false
    render()
  }
}

elements.action.addEventListener('click', handleAction)
provider?.on?.('accountsChanged', () => syncWallet().catch((error) => setStatus(walletError(error), 'error')))
provider?.on?.('chainChanged', () => syncWallet().catch((error) => setStatus(walletError(error), 'error')))

syncWallet().catch((error) => {
  setStatus(walletError(error), 'error')
  render()
})
