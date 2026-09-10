import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import {
  CREATION_BYTECODE,
  EXPECTED_ACCOUNT,
  RUNTIME_BYTECODE
} from '../contract.js'

const root = fileURLToPath(new URL('../../..', import.meta.url))
const source = await readFile(new URL('../../../contracts/src/ResurrectBeaconV1.sol', import.meta.url), 'utf8')
const packagedSource = await readFile(new URL('../../../packages/contracts/src/ResurrectBeaconV1.sol', import.meta.url), 'utf8')

assert.equal(source, packagedSource, 'canonical and packaged Beacon source differ')
assert.match(source, /contract ResurrectBeaconV1/)
assert.match(source, /error InvalidTTL\(uint32 supplied\)/)
assert.match(source, /error RecordTooLarge\(uint256 supplied\)/)
assert.equal((CREATION_BYTECODE.length - 2) / 2, 781)
assert.equal((RUNTIME_BYTECODE.length - 2) / 2, 752)
assert.match(EXPECTED_ACCOUNT, /^0x[0-9a-fA-F]{40}$/)

try {
  const artifact = JSON.parse(await readFile(`${root}/contracts/out/ResurrectBeaconV1.sol/ResurrectBeaconV1.json`, 'utf8'))
  assert.equal(CREATION_BYTECODE, artifact.bytecode.object, 'embedded creation bytecode is stale')
  assert.equal(RUNTIME_BYTECODE, artifact.deployedBytecode.object, 'embedded runtime bytecode is stale')
} catch (error) {
  if (error?.code !== 'ENOENT') throw error
}

console.log('Beacon deployer artifact is internally consistent.')
