/**
 * Cleanup old multi-city jobs + create 1 pending Crawl Job per enabled city.
 * Queues runCrawl sequentially (skipCrawlQueue on create).
 *
 * Usage: node --import tsx/esm scripts/setup-per-city-jobs.mjs
 */
import { getPayload } from 'payload'
import config from '../src/payload.config.ts'

const SOURCES = String(
  process.env.CRAWL_SOURCES ||
  'vinfast,charging,parking,rescue,gas,university,hospital,pharmacy,atm,bank,police,fire_station,school,marketplace',
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const payload = await getPayload({ config })

// Delete all existing crawl-jobs (+ logs via cascade if any; else manual)
const existing = await payload.find({
  collection: 'crawl-jobs',
  limit: 200,
  depth: 0,
  overrideAccess: true,
})
for (const doc of existing.docs) {
  const logs = await payload.find({
    collection: 'crawl-logs',
    where: { crawlJob: { equals: doc.id } },
    limit: 500,
    depth: 0,
    overrideAccess: true,
  })
  for (const log of logs.docs) {
    await payload.delete({
      collection: 'crawl-logs',
      id: log.id,
      overrideAccess: true,
      context: { skipCrawlQueue: true },
    })
  }
  await payload.delete({
    collection: 'crawl-jobs',
    id: doc.id,
    overrideAccess: true,
    context: { skipCrawlQueue: true },
  })
  console.log(JSON.stringify({ deleted: doc.id, label: doc.label }))
}

const cities = await payload.find({
  collection: 'cities',
  where: { enabled: { equals: true } },
  limit: 100,
  sort: 'order',
  depth: 0,
  overrideAccess: true,
})

const when = new Date().toISOString().slice(0, 16)
const created = []

for (const city of cities.docs) {
  const code = city.code || String(city.id)
  const job = await payload.create({
    collection: 'crawl-jobs',
    data: {
      status: 'pending',
      trigger: 'schedule',
      cities: [city.id],
      crawlSources: SOURCES,
      label: `auto · city · ${code} · ${SOURCES.slice(0, 3).join(',')} · ${when}`,
      startedAt: new Date().toISOString(),
    },
    overrideAccess: true,
    context: { skipCrawlQueue: true },
  })
  await payload.jobs.queue({
    task: 'runCrawl',
    queue: 'crawl',
    input: { crawlJobId: String(job.id) },
  })
  await payload.create({
    collection: 'crawl-logs',
    data: {
      crawlJob: job.id,
      level: 'INFO',
      message: 'Queued runCrawl (per-city setup; sequential queue)',
    },
    overrideAccess: true,
    context: { skipCrawlQueue: true },
  })
  created.push({ id: job.id, code })
  console.log(JSON.stringify({ created: job.id, code }))
}

void payload.jobs
  .run({ queue: 'crawl', limit: 1 })
  .catch((err) => console.error('jobs.run error', err))

console.log(
  JSON.stringify({
    phase: 'done',
    jobs: created.length,
    sources: SOURCES,
    schedule: process.env.CRAWL_AUTO_CRON || '0 */6 * * *',
    mode: process.env.CRAWL_SCHEDULE_MODE || 'per_city',
  }),
)
process.exit(0)
