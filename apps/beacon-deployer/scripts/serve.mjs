import { createReadStream } from 'node:fs'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'

const host = process.env.RESURRECT_DEPLOY_HOST ?? '0.0.0.0'
const port = Number(process.env.RESURRECT_DEPLOY_PORT ?? 4175)
const root = fileURLToPath(new URL('..', import.meta.url))
const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/contract.js', ['contract.js', 'text/javascript; charset=utf-8']],
  ['/deployment.js', ['deployment.js', 'text/javascript; charset=utf-8']],
  ['/model.js', ['model.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']]
])

const server = createServer((request, response) => {
  const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
  const target = files.get(pathname)
  if (!target) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Not found')
    return
  }

  response.writeHead(200, {
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src data:; connect-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'",
    'Content-Type': target[1],
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff'
  })
  createReadStream(`${root}/${target[0]}`).pipe(response)
})

server.listen(port, host, () => {
  console.log(`Resurrect Beacon deployer listening on http://${host}:${port}`)
})
