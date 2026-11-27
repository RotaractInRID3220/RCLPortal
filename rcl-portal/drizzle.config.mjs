// Drizzle is used as a typed query layer only. The hand-written SQL files in db/migrations remain the
// single source of truth for the schema (triggers, partial indexes and grants live there).
// Never run `drizzle-kit push` or `drizzle-kit migrate` against this project; use `npm run db:pull`
// to regenerate src/server/db/schema.mjs from the database after a migration.
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  out: './.drizzle-pull',
  schema: './src/server/db/schema.mjs',
  dbCredentials: { url: process.env.DATABASE_MIGRATOR_URL },
  schemaFilter: ['public'],
  tablesFilter: ['!schema_migrations'],
  strict: true,
  verbose: true,
})
