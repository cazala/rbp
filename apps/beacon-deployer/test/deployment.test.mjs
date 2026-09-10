import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CONSTANT_CALLS,
  CREATION_BYTECODE,
  EXPECTED_ACCOUNT,
  RUNTIME_BYTECODE
} from '../contract.js'
import {
  assertContractAddress,
  assertTransactionHash,
  deploymentTransaction,
  verifyDeployment
} from '../deployment.js'

const ADDRESS = '0x1111111111111111111111111111111111111111'
const TRANSACTION_HASH = `0x${'22'.repeat(32)}`

test('deployment payload has no recipient, value, constructor argument, or secret', () => {
  const transaction = deploymentTransaction(EXPECTED_ACCOUNT, 123_456n)
  assert.deepEqual(transaction, {
    from: EXPECTED_ACCOUNT,
    data: CREATION_BYTECODE,
    gas: '0x1e240'
  })
  assert.equal('to' in transaction, false)
  assert.equal('value' in transaction, false)
})

test('deployment payload refuses every other wallet account', () => {
  assert.throws(
    () => deploymentTransaction('0x0000000000000000000000000000000000000000'),
    /Only the current cazala\.eth account/
  )
})

test('transaction and contract identifiers are validated before links or RPC calls', () => {
  assert.equal(assertTransactionHash(TRANSACTION_HASH), TRANSACTION_HASH)
  assert.equal(assertContractAddress(ADDRESS), ADDRESS)
  assert.throws(() => assertTransactionHash('0x1234'), /invalid transaction hash/)
  assert.throws(() => assertContractAddress('javascript:alert(1)'), /invalid contract address/)
})

test('verification checks exact runtime and all protocol constants', async () => {
  const calls = []
  const provider = {
    async request(payload) {
      calls.push(payload)
      if (payload.method === 'eth_getCode') return RUNTIME_BYTECODE
      const constant = CONSTANT_CALLS.find(([, selector]) => selector === payload.params[0].data)
      return `0x${constant[2].toString(16)}`
    }
  }

  await verifyDeployment(provider, ADDRESS)
  assert.equal(calls[0].method, 'eth_getCode')
  assert.deepEqual(calls.slice(1).map((call) => call.params[0].data).sort(),
    CONSTANT_CALLS.map(([, selector]) => selector).sort())
})

test('verification rejects bytecode or constant drift', async () => {
  const wrongCode = { request: async () => '0x6000' }
  await assert.rejects(verifyDeployment(wrongCode, ADDRESS), /does not match/)

  const wrongVersion = {
    async request(payload) {
      if (payload.method === 'eth_getCode') return RUNTIME_BYTECODE
      return payload.params[0].data === '0xffa1ad74' ? '0x2' : '0x1000'
    }
  }
  await assert.rejects(verifyDeployment(wrongVersion, ADDRESS), /VERSION returned 2/)
})
