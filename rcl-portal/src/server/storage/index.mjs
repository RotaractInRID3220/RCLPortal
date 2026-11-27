// Private file storage for payment slips. Files are never public: they are read through an
// authenticated route that checks the club. Two drivers behind one interface:
//   local : files on disk (development, tests)        STORAGE_DRIVER=local  STORAGE_LOCAL_DIR=.data/storage
//   s3    : S3 / MinIO bucket (production)             STORAGE_DRIVER=s3  S3_ENDPOINT S3_REGION S3_BUCKET S3_ACCESS_KEY S3_SECRET_KEY
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

const KEY = /^slips\/\d{1,9}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/
export const isValidKey = (k) => KEY.test(k)
const CONTENT_TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }
const typeOf = (key) => CONTENT_TYPES[key.split('.').pop()] ?? 'application/octet-stream'

function assertKey(key) {
  if (!isValidKey(key)) throw new Error('Invalid storage key')
}

function localDriver(dir) {
  const root = path.resolve(dir)
  const file = (key) => { assertKey(key); return path.join(root, key) }
  return {
    name: 'local',
    async put(key, buffer) { const f = file(key); await mkdir(path.dirname(f), { recursive: true }); await writeFile(f, buffer) },
    async get(key) {
      try { return { body: await readFile(file(key)), contentType: typeOf(key) } }
      catch (e) { if (e.code === 'ENOENT') return null; throw e }
    },
    async delete(key) { await rm(file(key), { force: true }) },
  }
}

function s3Driver(env, client) {
  const bucket = env.S3_BUCKET
  return {
    name: 's3',
    async put(key, buffer) {
      assertKey(key)
      const { PutObjectCommand } = await import('@aws-sdk/client-s3')
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: typeOf(key) }))
    },
    async get(key) {
      assertKey(key)
      const { GetObjectCommand } = await import('@aws-sdk/client-s3')
      try {
        const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
        return { body: Buffer.from(await res.Body.transformToByteArray()), contentType: typeOf(key) }
      } catch (e) {
        if (e?.name === 'NoSuchKey' || e?.$metadata?.httpStatusCode === 404) return null
        throw e
      }
    },
    async delete(key) {
      assertKey(key)
      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3')
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
    },
  }
}

export async function createStorage(env = process.env, { s3Client } = {}) {
  const driver = env.STORAGE_DRIVER || (env.S3_BUCKET ? 's3' : 'local')
  if (driver === 'local') return localDriver(env.STORAGE_LOCAL_DIR || '.data/storage')
  if (driver === 's3') {
    for (const k of ['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY', 'S3_SECRET_KEY']) if (!env[k]) throw new Error(`${k} is not set`)
    let client = s3Client
    if (!client) {
      const { S3Client } = await import('@aws-sdk/client-s3')
      client = new S3Client({ endpoint: env.S3_ENDPOINT, region: env.S3_REGION || 'us-east-1', forcePathStyle: true,
        credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY } })
    }
    return s3Driver(env, client)
  }
  throw new Error(`Unknown STORAGE_DRIVER "${driver}"`)
}

let shared
export const getStorage = async () => (shared ??= await createStorage())
export const resetStorageForTests = () => { shared = undefined }
