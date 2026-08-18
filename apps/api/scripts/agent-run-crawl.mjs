/**
 * One-shot: update crawl-jobs#JOB_ID → invokeCrawl (direct) → sync CMS.
 * Avoids HTTP headers timeout on long Overpass runs.
 * Usage: JOB_ID=2 node --import tsx/esm scripts/agent-run-crawl.mjs
 */
import { getPayload } from 'payload'
import config from '../src/payload.config.ts'
import { invokeCrawl } from '../src/lib/crawlRunner.ts'

const JOB_ID = Number(process.env.JOB_ID || '2')

const payload = await getPayload({ config })
const job = await payload.findByID({
  collection: 'crawl-jobs',
  id: JOB_ID,
  depth: 1,
  overrideAccess: true,
})

const cities = (job.cities || [])
  .map((c) => (typeof c === 'object' ? c.code : null))
  .filter(Boolean)
const sources =
  Array.isArray(job.crawlSources) && job.crawlSources.length
    ? job.crawlSources
    : String(
        process.env.CRAWL_SOURCES ||
          'vinfast,charging,parking,rescue,gas,university,hospital,pharmacy,atm,bank,police,fire_station,school,marketplace',
      )
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

console.log(JSON.stringify({ phase: 'start', jobId: JOB_ID, cities, sources }))

await payload.update({
  collection: 'crawl-jobs',
  id: JOB_ID,
  data: { status: 'running', startedAt: new Date().toISOString(), errorMessage: null },
  overrideAccess: true,
  context: { skipCrawlQueue: true },
})

const result = await invokeCrawl({
  cities,
  sources,
  payloadCrawlJobId: String(JOB_ID),
})

const summary = result.summary
const ok = Boolean(result.exitCode === 0 && (summary?.ok ?? true))

console.log(
  JSON.stringify({
    phase: 'crawl',
    exit: result.exitCode,
    summary,
    logTailLen: result.logTail?.length ?? 0,
  }),
)

const updated = await payload.update({
  collection: 'crawl-jobs',
  id: JOB_ID,
  data: {
    status: ok ? 'success' : 'failed',
    finishedAt: new Date().toISOString(),
    recordsFound: summary?.found ?? 0,
    recordsCreated: summary?.created ?? 0,
    recordsUpdated: summary?.updated ?? 0,
    recordsDeactivated: summary?.deactivated ?? 0,
    errorMessage: ok ? null : `exit ${result.exitCode}`,
    logTail: String(result.logTail || '').slice(-12000),
  },
  overrideAccess: true,
  context: { skipCrawlQueue: true },
})

await payload.create({
  collection: 'crawl-logs',
  data: {
    crawlJob: updated.id,
    level: ok ? 'INFO' : 'ERROR',
    message: ok
      ? `Agent auto-crawl finished found=${summary?.found} created=${summary?.created} updated=${summary?.updated}`
      : `Agent auto-crawl failed: exit ${result.exitCode}`,
  },
  overrideAccess: true,
  context: { skipCrawlQueue: true },
})

console.log(
  JSON.stringify({
    phase: 'done',
    id: updated.id,
    status: updated.status,
    found: updated.recordsFound,
    created: updated.recordsCreated,
    updated: updated.recordsUpdated,
  }),
)
process.exit(ok ? 0 : 1)
