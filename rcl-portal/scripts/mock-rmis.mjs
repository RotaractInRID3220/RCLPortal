#!/usr/bin/env node
// Local stand-in for the RMIS 2.0 RCL API (RMIS-2 docs/RCL-API-USAGE.md). It mirrors the documented
// behaviour (key check, error codes, wrapped lists, cursors, throttle, test-account hiding) so the
// RCL client and login can be developed and tested without the real RMIS.
//   node scripts/mock-rmis.mjs            -> http://localhost:4010/api/public/rcl  (key: local-mock-rmis-key)
import http from 'node:http'
import { fileURLToPath } from 'node:url'

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const unb64 = (s) => { try { return JSON.parse(Buffer.from(s, 'base64url').toString()) } catch { return null } }
const iso = (d) => new Date(d).toISOString()

export function buildData() {
  const clubs = [
    { club_id: 1, club_name: 'Rotaract in RID 3220', club_name_short: 'RID3220', category: 'community', zone: 1, status: 1 },
    { club_id: 2, club_name: 'Rotaract Club of Alpha', club_name_short: 'ALPHA', category: 'community', zone: 1, status: 1 },
    { club_id: 3, club_name: 'Rotaract Club of Beta University', club_name_short: 'BETA', category: 'university', zone: 2, status: 1 },
    { club_id: 4, club_name: 'Rotaract Club of Gamma', club_name_short: 'GAMMA', category: 'community', zone: 2, status: 1 },
    { club_id: 9, club_name: 'Rotaract Club of Closed', club_name_short: 'CLOSED', category: 'community', zone: 3, status: 0 },
  ]
  const members = []
  let id = 1000
  const base = Date.parse('2026-06-23T10:00:00Z')
  const add = (m) => { members.push({ member_id: ++id, membership_id: `M${id}`, full_name: m.card_name, gender: 'F', status: 1,
    nic: `9${id}0000V`, dob: '2000-01-01', role_id: 31, created_at: iso(base), updated_at: iso(base), username: null, password: null, transfer_completed_at: null, has_pending_transfer: false, ...m }); return id }
  for (const c of [2, 3, 4]) for (let i = 1; i <= 12; i++) {
    add({ card_name: `Member ${c}-${i}`, club_id: c, gender: i % 2 ? 'M' : 'F', status: [1, 1, 3, 5][i % 4],
      role_id: i === 1 ? 5 : i === 2 ? 6 : 31, created_at: iso(base + i * 1000) })
  }
  add({ card_name: 'Test President', full_name: 'Test President Account', club_id: 1, gender: 'M', role_id: 5, status: 1, membership_id: null, username: 'test.president', password: 'test1234' })
  add({ card_name: 'Test Disco', club_id: 1, role_id: 4, status: 3, username: 'test.disco', password: 'test1234' })
  add({ card_name: 'Alice Admin', club_id: 1, role_id: 2, status: 1, username: 'alice.admin', password: 'pass1234' })
  add({ card_name: 'Pat President', club_id: 2, role_id: 5, status: 1, username: 'pat.president', password: 'pass1234' })
  add({ card_name: 'Ina Inactive', club_id: 2, role_id: 31, status: 2, username: 'ina.inactive', password: 'pass1234' })
  add({ card_name: 'Terry Terminated', club_id: 2, role_id: 31, status: 4, username: 'terry.term', password: 'pass1234' })
  add({ card_name: 'Cleo Closed', club_id: 9, role_id: 5, status: 1, username: 'cleo.closed', password: 'pass1234' })
  add({ card_name: 'Gary General', club_id: 3, role_id: 31, status: 1, username: 'gary.general', password: 'pass1234' }) // role 31: no access
  // transfers: finalised before the cutoff / after it / legacy (no transfer record) / old RMIS that omits the field
  add({ card_name: 'Tom Transfer', club_id: 2, status: 3, transfer_completed_at: iso(base - 86400000) })
  add({ card_name: 'Late Lena', club_id: 2, status: 3, transfer_completed_at: iso(base + 90 * 86400000) })
  add({ card_name: 'Legacy Leo', club_id: 2, status: 3 })
  add({ card_name: 'Pending Pia', club_id: 2, status: 1, has_pending_transfer: true })
  add({ card_name: 'Mock Seed', club_id: 2, email: 'x@example.com', gender: 'O' }) // hidden test account
  return { clubs, members }
}

// Same rule as RMIS: gender 'O', membership_id 'TEST-*', username 'test.*', or an @example.com email.
// (test.* accounts can still log in; they are only hidden from lists, lookups and search.)
const hidden = (m) => m.gender === 'O'
  || String(m.membership_id || '').toUpperCase().startsWith('TEST-')
  || String(m.username || '').toLowerCase().startsWith('test.')
  || (m.email || '').endsWith('@example.com')

const pub = (m) => ({ member_id: m.member_id, membership_id: m.membership_id, card_name: m.card_name, full_name: m.full_name,
  gender: m.gender, status: m.status, nic: m.nic, dob: m.dob, club_id: m.club_id, role_id: m.role_id, created_at: m.created_at,
  ...(m.legacy_no_transfer ? {} : { transfer_completed_at: m.transfer_completed_at, has_pending_transfer: m.has_pending_transfer }) })

export function startMock({ port = 0, key = 'local-mock-rmis-key', nextKey = null } = {}) {
  const data = buildData()
  const state = { ...data, delayMs: 0, failNext: 0, failStatus: 503, requests: [], failures: new Map(), now: () => Date.now() }
  const roles = { 1: 'DRR/RDS', 2: 'ADRR', 3: 'RDT', 4: 'RDSC', 5: 'President', 6: 'Secretary', 31: 'General Member' }

  const server = http.createServer(async (req, res) => {
    const send = (status, body, headers = {}) => { res.writeHead(status, { 'content-type': 'application/json', ...headers }); res.end(JSON.stringify(body)) }
    const err = (status, code, message, headers) => send(status, { error: { code, message } }, headers)
    const url = new URL(req.url, 'http://x')
    const route = url.pathname.replace(/^\/api\/public\/rcl/, '') || '/'
    state.requests.push({ method: req.method, route, search: url.search })
    if (state.delayMs) await new Promise((r) => setTimeout(r, state.delayMs))
    if (state.failNext > 0) { state.failNext--; return err(state.failStatus, 'internal_error', 'Injected failure.') }

    const provided = (req.headers['x-api-key'] || (req.headers.authorization || '').replace(/^Bearer\s+/i, '')) || ''
    if (![key, nextKey].filter(Boolean).includes(provided)) return err(401, 'unauthorized', 'Missing or invalid API key.')

    let body = null
    if (req.method === 'POST') {
      const chunks = []; for await (const c of req) chunks.push(c)
      try { body = JSON.parse(Buffer.concat(chunks).toString() || 'null') } catch { return err(400, 'invalid_request', 'Request body must be valid JSON.') }
    }
    const limitOf = (v) => (v === null ? 500 : /^\d+$/.test(v) && +v >= 1 && +v <= 1000 ? +v : null)

    if (route === '/health') return send(200, { status: 'ok', time: iso(state.now()) })

    if (route === '/auth/verify' && req.method === 'POST') {
      const u = String(body?.username ?? '').trim().toLowerCase()
      const ip = body?.client_ip
      if (!/^[a-z0-9._]{3,30}$/.test(u) || !body?.password || !ip || !/^[0-9a-f.:]+$/i.test(ip)) return err(400, 'invalid_request', 'username, password and client_ip are required and must be well-formed.')
      const pair = `${u}|${ip}`
      const f = state.failures.get(pair) || { n: 0, until: 0 }
      if (f.until > state.now()) return err(429, 'rate_limited', 'Too many failed attempts. Try again later.', { 'retry-after': String(Math.ceil((f.until - state.now()) / 1000)) })
      const m = state.members.find((x) => x.username === u)
      if (!m || m.password !== body.password) {
        f.n++; if (f.n >= 10) { f.until = state.now() + 300_000; f.n = 0 }
        state.failures.set(pair, f)
        return err(401, 'invalid_credentials', 'Invalid username or password.')
      }
      state.failures.delete(pair)
      const club = state.clubs.find((c) => c.club_id === m.club_id)
      if (!club || club.status !== 1) return err(403, 'club_terminated', "This member's club is no longer active.")
      if (m.status === 2) return err(403, 'member_inactive', 'This member account is inactive.')
      if (m.status === 4) return err(403, 'member_terminated', 'This member account has been terminated.')
      if (![1, 3, 5].includes(m.status)) return err(403, 'account_restricted', 'This member account is restricted.')
      return send(200, { member_id: m.member_id, membership_id: m.membership_id, username: u, card_name: m.card_name, full_name: m.full_name,
        club_id: m.club_id, club_name: club.club_name, role_id: m.role_id, role_label: roles[m.role_id] ?? null, designation: roles[m.role_id] ?? null, status: m.status })
    }

    if (route === '/clubs') {
      const incl = url.searchParams.get('includeInactive') === 'true'
      return send(200, { clubs: state.clubs.filter((c) => incl || c.status === 1) })
    }

    let mt = route.match(/^\/clubs\/([^/]+)\/members$/)
    if (mt) {
      const cid = /^\d+$/.test(mt[1]) ? +mt[1] : null
      if (cid === null) return err(400, 'invalid_request', 'Bad club id.')
      const club = state.clubs.find((c) => c.club_id === cid && c.status === 1)
      if (!club) return err(404, 'club_not_found', 'Club not found.')
      const statuses = (url.searchParams.get('statuses') || '1,3,5').split(',').map(Number)
      if (statuses.some((s) => ![1, 2, 3, 4, 5].includes(s))) return err(400, 'invalid_request', 'Bad statuses.')
      const lim = limitOf(url.searchParams.get('limit')); if (lim === null) return err(400, 'invalid_request', 'limit must be an integer 1-1000.')
      const cutoff = url.searchParams.get('createdOnOrBefore')
      if (cutoff && Number.isNaN(Date.parse(cutoff))) return err(400, 'invalid_request', 'Bad cutoff.')
      let list = state.members.filter((m) => m.club_id === cid && statuses.includes(m.status) && !hidden(m) && (!cutoff || Date.parse(m.created_at) <= Date.parse(cutoff)))
        .sort((a, b) => a.card_name.localeCompare(b.card_name) || a.member_id - b.member_id)
      const cur = url.searchParams.get('cursor') ? unb64(url.searchParams.get('cursor')) : null
      if (cur) list = list.filter((m) => m.card_name > cur.n || (m.card_name === cur.n && m.member_id > cur.i))
      const page = list.slice(0, lim)
      const last = page[page.length - 1]
      return send(200, { members: page.map(pub), next_cursor: list.length > lim && last ? b64({ n: last.card_name, i: last.member_id }) : null })
    }

    if (route === '/members/lookup' && req.method === 'POST') {
      const ids = [...new Set(body?.member_ids ?? [])], mids = [...new Set(body?.membership_ids ?? [])]
      if (ids.length + mids.length === 0) return err(400, 'invalid_request', 'Provide member_ids and/or membership_ids.')
      if (ids.length + mids.length > 500) return err(400, 'invalid_request', 'At most 500 ids per call.')
      const f = (m) => ({ member_id: m.member_id, membership_id: m.membership_id, found: true, status: m.status, club_id: m.club_id, role_id: m.role_id, nic: m.nic, created_at: m.created_at,
        ...(m.legacy_no_transfer ? {} : { transfer_completed_at: m.transfer_completed_at, has_pending_transfer: m.has_pending_transfer }) })
      return send(200, { results: [
        ...ids.map((i) => { const m = state.members.find((x) => x.member_id === i && !hidden(x)); return m ? f(m) : { member_id: i, found: false } }),
        ...mids.map((i) => { const m = state.members.find((x) => x.membership_id === i && !hidden(x)); return m ? f(m) : { membership_id: i, found: false } }),
      ] })
    }

    if (route === '/members/changes') {
      const lim = limitOf(url.searchParams.get('limit')); if (lim === null) return err(400, 'invalid_request', 'limit must be an integer 1-1000.')
      const cur = url.searchParams.get('cursor') ? unb64(url.searchParams.get('cursor')) : null
      if (url.searchParams.get('cursor') && !cur) return err(400, 'invalid_request', 'cursor is invalid.')
      const since = url.searchParams.get('updatedSince')
      if (!cur && !since) return err(400, 'invalid_request', 'updatedSince is required.')
      if (since && Number.isNaN(Date.parse(since))) return err(400, 'invalid_request', 'updatedSince must be an ISO-8601 timestamp.')
      let list = state.members.filter((m) => !hidden(m)).sort((a, b) => a.updated_at.localeCompare(b.updated_at) || a.member_id - b.member_id)
      list = cur ? list.filter((m) => m.updated_at > cur.u || (m.updated_at === cur.u && m.member_id > cur.i)) : list.filter((m) => Date.parse(m.updated_at) > Date.parse(since))
      const page = list.slice(0, lim), last = page[page.length - 1]
      return send(200, { members: page.map((m) => ({ ...pub(m), updated_at: m.updated_at })),
        next_cursor: list.length > lim && last ? b64({ u: last.updated_at, i: last.member_id }) : null, server_time: iso(state.now()) })
    }

    if (route === '/members/search') {
      const name = (url.searchParams.get('name') || '').trim()
      if (name.length < 3 || name.length > 100) return err(400, 'invalid_request', 'name must be 3-100 characters.')
      const out = state.members.filter((m) => !hidden(m) && m.role_id >= 1 && m.role_id <= 4 && [1, 3, 5].includes(m.status) &&
        (m.card_name + ' ' + m.full_name).toLowerCase().includes(name.toLowerCase())).slice(0, 20)
      return send(200, { members: out.map((m) => ({ member_id: m.member_id, membership_id: m.membership_id, card_name: m.card_name, role_id: m.role_id, role_label: roles[m.role_id], club_id: m.club_id })) })
    }

    mt = route.match(/^\/members\/([^/]+)$/) || (route === '/members' ? [null, '0'] : null)
    if (mt) {
      const q = url.searchParams
      const m = q.get('membershipId') ? state.members.find((x) => x.membership_id === q.get('membershipId'))
        : /^\d+$/.test(q.get('memberId') || mt[1]) ? state.members.find((x) => x.member_id === +(q.get('memberId') || mt[1])) : undefined
      if (!q.get('membershipId') && !/^\d+$/.test(q.get('memberId') || mt[1])) return err(400, 'invalid_request', 'Bad member id.')
      return !m || hidden(m) ? err(404, 'member_not_found', 'Member not found.') : send(200, pub(m))
    }
    return err(404, 'not_found', 'Unknown route.')
  })

  return new Promise((resolve) => server.listen(port, () => {
    const p = server.address().port
    resolve({ url: `http://localhost:${p}/api/public/rcl`, key, state, close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r) }) })
  }))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { url } = await startMock({ port: Number(process.env.PORT || 4010) })
  console.log(`mock RMIS listening on ${url}  (key: local-mock-rmis-key)`)
  console.log('logins: test.president / test.disco (test1234), alice.admin, pat.president (pass1234)')
}
