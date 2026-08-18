// Disable Payload schema push against geo tables (SQL migration owns them).
// Payload Admin: Users + Cities + CrawlJobs (+ Jobs Queue). Geo public API = PostGIS SQL.
// Monolith: Admin + map UI + REST in one Next.js app.

import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Cities } from './collections/Cities'
import { Sources } from './collections/Sources'
import { Locations } from './collections/Locations'
import { CrawlJobs } from './collections/CrawlJobs'
import { CrawlLogs } from './collections/CrawlLogs'
import { runCrawlTask } from './jobs/runCrawl'
import { scheduleCrawlTask } from './jobs/scheduleCrawl'
import { scheduleTransitCrawlTask } from './jobs/scheduleTransitCrawl'
import { seedCitiesIfEmpty } from './lib/seedCities'
import { invalidateCitiesCache } from './lib/citiesStore'

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
  collections: [Users, Cities, Sources, Locations, CrawlJobs, CrawlLogs],
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
    // Isolate CMS tables from PostGIS public.* (locations/sources/…) —
    // otherwise drizzle push interactively asks to RENAME geo tables → hang/data loss.
    schemaName: process.env.PAYLOAD_SCHEMA || 'payload',
    // Dev: push creates CMS tables on first Admin boot (once). Set PAYLOAD_PUSH=0 after.
    push: process.env.PAYLOAD_PUSH !== '0',
  }),
  jobs: {
    tasks: [runCrawlTask, scheduleCrawlTask, scheduleTransitCrawlTask],
    deleteJobOnComplete: false,
    jobsCollectionOverrides: ({ defaultJobsCollection }) => {
      defaultJobsCollection.admin = {
        ...defaultJobsCollection.admin,
        hidden: false,
        description:
          'Payload Jobs Queue — runCrawl + scheduleCrawl + scheduleTransitCrawl (HN/HCM transit every 4h). Debug retries/failures.',
        defaultColumns: ['id', 'taskSlug', 'queue', 'completedAt', 'totalTried', 'hasError'],
      }
      return defaultJobsCollection
    },
    autoRun: [
      {
        // Drain crawl queue one-at-a-time to avoid hammering Overpass
        cron: '* * * * *',
        queue: 'crawl',
        limit: Number(process.env.CRAWL_QUEUE_LIMIT || '1') || 1,
      },
    ],
    // Required for scheduleCrawl / scheduleTransitCrawl. Set PAYLOAD_JOBS_AUTORUN=0 only on serverless.
    shouldAutoRun: async () => process.env.PAYLOAD_JOBS_AUTORUN !== '0',
  },
  onInit: async (payload) => {
    try {
      const n = await seedCitiesIfEmpty(payload)
      if (n > 0) {
        invalidateCitiesCache()
        payload.logger.info(`Seeded ${n} cities into Payload Cities collection`)
      }
    } catch (err) {
      payload.logger.error(
        `Cities seed skipped: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  },
  sharp,
})
