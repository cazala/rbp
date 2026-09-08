import { gzipSync } from 'node:zlib'
import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const limits = { raw: 525_000, gzip: 160_000 }

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? files(path) : [path]
  }))
  return nested.flat()
}

const paths = await files(dist)
const payloads = await Promise.all(paths.map((path) => readFile(path)))
const raw = (await Promise.all(paths.map((path) => stat(path)))).reduce((sum, item) => sum + item.size, 0)
const gzip = payloads.reduce((sum, payload) => sum + gzipSync(payload, { level: 9 }).byteLength, 0)

if (raw > limits.raw || gzip > limits.gzip) {
  throw new Error(`explorer exceeds size budget: ${raw}/${limits.raw} raw bytes, ${gzip}/${limits.gzip} gzip bytes`)
}

console.log(`explorer size: ${raw} raw bytes, ${gzip} gzip bytes across ${paths.length} files`)
for (const path of paths.sort()) console.log(`  ${relative(dist, path)}`)
