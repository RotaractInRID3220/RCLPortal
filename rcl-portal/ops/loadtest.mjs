#!/usr/bin/env node
// Public-page load test (no dependencies): node ops/loadtest.mjs [baseUrl] [concurrency] [seconds]
// Hits the public leaderboard (with ETag revalidation like the real pages), events, brackets and health.
// Pass criteria suggested in docs/OPERATIONS.md: p95 < 400 ms, 0 errors at 300 concurrent visitors.
const base = process.argv[2] || 'http://localhost:3000'
const conc = Number(process.argv[3] || 100)
const secs = Number(process.argv[4] || 30)
const paths = ['/api/leaderboard/aggregated', '/api/events', '/api/brackets', '/api/public/event-info', '/api/public/health']
const lat = []; let errors = 0, notModified = 0, total = 0
const etags = new Map()
const end = Date.now() + secs * 1000
async function visitor() {
  while (Date.now() < end) {
    const p = paths[Math.floor(Math.random() * paths.length)]
    const headers = etags.has(p) ? { 'If-None-Match': etags.get(p) } : {}
    const t = performance.now()
    try {
      const r = await fetch(base + p, { headers })
      await r.arrayBuffer()
      lat.push(performance.now() - t); total++
      if (r.status === 304) notModified++
      else if (r.status >= 400) errors++
      const e = r.headers.get('etag'); if (e) etags.set(p, e)
    } catch { errors++; total++ }
    await new Promise((res) => setTimeout(res, 200 + Math.random() * 800))   // think time
  }
}
await Promise.all(Array.from({ length: conc }, visitor))
lat.sort((a, b) => a - b)
const q = (x) => lat[Math.min(lat.length - 1, Math.floor(lat.length * x))]?.toFixed(0)
console.log(JSON.stringify({ base, concurrency: conc, seconds: secs, requests: total, errors, notModified, rps: +(total / secs).toFixed(1), p50_ms: +q(0.5), p95_ms: +q(0.95), p99_ms: +q(0.99) }, null, 2))
process.exit(errors ? 1 : 0)
