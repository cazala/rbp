import assert from 'node:assert/strict'
import test from 'node:test'
import { addGasMargin, formatEther, sameAddress, shortHex, toQuantity, walletError } from '../model.js'

test('addresses compare case-insensitively', () => {
  assert.equal(sameAddress('0xABcd', '0xabCD'), true)
  assert.equal(sameAddress(null, '0xabCD'), false)
})

test('gas margin rounds up and serializes as an RPC quantity', () => {
  assert.equal(addGasMargin(21_001n), 25_202n)
  assert.equal(toQuantity(25_202n), '0x6272')
})

test('ether values are formatted without floating point loss', () => {
  assert.equal(formatEther(1_234_567_890_000_000_000n), '1.234567')
  assert.equal(formatEther(5_000_000_000_000n), '0.000005')
})

test('wallet errors always become readable text', () => {
  assert.equal(walletError({ code: 4001, message: 'denied' }), 'Request rejected in the wallet.')
  assert.equal(walletError({ shortMessage: 'bad chain' }), 'bad chain')
  assert.equal(walletError({ data: { message: 'RPC failed' } }), 'RPC failed')
  assert.equal(walletError({}), 'The wallet returned an unknown error.')
})

test('long hashes are shortened while preserving both ends', () => {
  assert.equal(shortHex('0x1234567890abcdef'), '0x12345678…abcdef')
})
