// Disable Payload schema push against geo tables (SQL migration owns them).
// Payload Admin vẫn chạy cho Users; geo collections dùng dbName riêng nếu cần.
// Phase 0: public API + crawler dùng SQL schema; Payload Users + admin shell.

import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Sources } from './collections/Sources'
import { Locations } from './collections/Locations'
import { CrawlJobs } from './collections/CrawlJobs'
import { CrawlLogs } from './collections/CrawlLogs'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      titleSuffix: ' — MapPlatform',
    },
  },
  collections: [Users, Sources, Locations, CrawlJobs, CrawlLogs],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || 'change-me-payload-secret-min-32-characters-long',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString:
        process.env.DATABASE_URL ||
        'postgresql://geouser:geopass@127.0.0.1:5433/geo_platform',
    },
    // Phase 0: cho Payload tự quản lý bảng admin (users + collection mirrors).
    // Dữ liệu map public lấy từ SQL migration / crawler (bảng locations/sources).
    push: true,
  }),
  sharp,
})
