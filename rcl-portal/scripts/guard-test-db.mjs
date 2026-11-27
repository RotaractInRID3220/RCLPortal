// `npm test` writes and deletes rows. Refuse to run unless the target database is a dev/test one.
import { loadEnv } from './load-env.mjs'
loadEnv()
const url = process.env.DATABASE_URL || ''
const db = url.split('/').pop().split('?')[0]
if (!/(_dev|_test)$/.test(db) && process.env.RCL_ALLOW_TESTS_ON_ANY_DB !== '1') {
  console.error(`Refusing to run tests: DATABASE_URL points at database "${db}" (tests only run on *_dev / *_test databases).`)
  process.exit(1)
}
