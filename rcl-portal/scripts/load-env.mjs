// Tiny .env.local loader for scripts (Next.js loads it itself for the app).
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

export function loadEnv(file = '.env.local') {
  const p = path.resolve(process.cwd(), file)
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!m || line.trim().startsWith('#')) continue
    let v = m[2]
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!(m[1] in process.env)) process.env[m[1]] = v
  }
}
