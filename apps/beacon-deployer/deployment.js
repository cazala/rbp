import {
  CONSTANT_CALLS,
  CREATION_BYTECODE,
  EXPECTED_ACCOUNT,
  RUNTIME_BYTECODE
} from './contract.js'
import { sameAddress, toQuantity } from './model.js'

export function deploymentTransaction(account, gasLimit) {
  if (!sameAddress(account, EXPECTED_ACCOUNT)) {
    throw new Error('Only the current cazala.eth account can deploy this artifact.')
  }
  const transaction = { from: account, data: CREATION_BYTECODE }
  if (gasLimit !== undefined) transaction.gas = toQuantity(gasLimit)
  return transaction
}

export function assertTransactionHash(value) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error('The wallet returned an invalid transaction hash.')
  }
  return value
}

export function assertContractAddress(value) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error('The wallet returned an invalid contract address.')
  }
  return value
}

export async function verifyDeployment(provider, address) {
  assertContractAddress(address)
  const code = await provider.request({ method: 'eth_getCode', params: [address, 'latest'] })
  if (code.toLowerCase() !== RUNTIME_BYTECODE.toLowerCase()) {
    throw new Error('Deployed runtime bytecode does not match the reviewed artifact.')
  }

  await Promise.all(CONSTANT_CALLS.map(async ([name, selector, expected]) => {
    const result = await provider.request({
      method: 'eth_call',
      params: [{ to: address, data: selector }, 'latest']
    })
    const value = BigInt(result)
    if (value !== expected) throw new Error(`${name} returned ${value}; expected ${expected}.`)
  }))
}
