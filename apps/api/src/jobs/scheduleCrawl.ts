import type { Payload, TaskHandler } from 'payload'
import {
  ALL_MAP_CRAWL_SOURCES,
  CRAWL_SOURCE_OPTIONS,
  DEFAULT_CRAWL_SOURCES_CSV,
  type CrawlSourceValue,
} from '@/collections/CrawlJobs'

const ALLOWED = new Set<string>(CRAWL_SOURCE_OPTIONS.map((o) => o.value))

type ScheduleMode = 'per_city' | 'round_robin' | 'all'

/** Default sources = all map layers (override with CRAWL_SOURCES). */
function defaultSources(): CrawlSourceValue[] {
  const raw = process.env.CRAWL_SOURCES || DEFAULT_CRAWL_SOURCES_CSV
  const parsed = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is CrawlSourceValue => Boolean(s) && ALLOWED.has(s))
  return parsed.length > 0 ? parsed : [...ALL_MAP_CRAWL_SOURCES]
}

function scheduleMode(): ScheduleMode {
  const raw = (process.env.CRAWL_SCHEDULE_MODE || 'per_city').toLowerCase()
  if (raw === 'all' || raw === 'round_robin' || raw === 'per_city') return raw
  return 'per_city'
}

type CityDoc = { id: number | string; code?: string | null; name?: string | null }

async function createCityCrawlJob(
  payload: Payload,
  opts: {
    city: CityDoc
    sources: CrawlSourceValue[]
    when: string
    modeLabel: string
  },
): Promise<{ id: string | number; code: string }> {
  const code = String(opts.city.code || opts.city.id)
  const job = await payload.create({
    collection: 'crawl-jobs',
    data: {
      status: 'pending',
      trigger: 'schedule',
      cities: [opts.city.id],
      crawlSources: opts.sources,
      label: `auto · ${opts.modeLabel} · ${code} · ${opts.sources.slice(0, 3).join(',')} · ${opts.when}`,
      startedAt: new Date().toISOString(),
    },
    overrideAccess: true,
    // Avoid afterChange firing jobs.run per city (would parallelize Overpass).
    context: { skipCrawlQueue: true },
  })
  return { id: job.id, code }
}

async function enqueueRunCrawl(
  payload: Payload,
  crawlJobId: string | number,
  req?: Parameters<TaskHandler>[0]['req'],
): Promise<void> {
  await payload.jobs.queue({
    task: 'runCrawl',
    queue: 'crawl',
    input: { crawlJobId: String(crawlJobId) },
    ...(req ? { req } : {}),
  })
  const logJobId = Number(crawlJobId)
  await payload.create({
    collection: 'crawl-logs',
    data: {
      crawlJob: Number.isFinite(logJobId) ? logJobId : crawlJobId,
      level: 'INFO',
      message: 'Queued runCrawl (per-city schedule; queue concurrency=1)',
    },
    overrideAccess: true,
    context: { skipCrawlQueue: true },
    ...(req ? { req } : {}),
  })
}

/**
 * Cron task: create Payload Crawl Job(s) (trigger=schedule).
 * Default mode `per_city`: one job per enabled city (lighter Overpass load;
 * crawl queue runs them sequentially).
 *
 * Modes (CRAWL_SCHEDULE_MODE):
 * - per_city (default): N jobs, one city each
 * - round_robin: 1 job for the next city (rotate by hour)
 * - all: legacy single job with every enabled city
 */
export const scheduleCrawlHandler: TaskHandler<{
  input: Record<string, never>
  output: { crawlJobIds: string; cities: number; sources: number; mode: string }
}> = async ({ req }) => {
  if (process.env.CRAWL_AUTO_SCHEDULE === '0') {
    req.payload.logger.info('scheduleCrawl skipped (CRAWL_AUTO_SCHEDULE=0)')
    return { output: { crawlJobIds: '', cities: 0, sources: 0, mode: 'off' } }
  }

  const cities = await req.payload.find({
    collection: 'cities',
    where: { enabled: { equals: true } },
    limit: 100,
    sort: 'order',
    depth: 0,
    overrideAccess: true,
  })
  const cityDocs = cities.docs as CityDoc[]
  if (cityDocs.length === 0) {
    throw new Error('scheduleCrawl: no enabled cities in Payload')
  }

  const sources = defaultSources()
  if (sources.length === 0) {
    throw new Error('scheduleCrawl: no valid CRAWL_SOURCES')
  }

  const mode = scheduleMode()
  const when = new Date().toISOString().slice(0, 16)
  const createdIds: Array<string | number> = []

  if (mode === 'all') {
    const cityIds = cityDocs.map((d) => d.id)
    const job = await req.payload.create({
      collection: 'crawl-jobs',
      data: {
        status: 'pending',
        trigger: 'schedule',
        cities: cityIds,
        crawlSources: sources,
        label: `auto · all · ${cityIds.length} city · ${sources.slice(0, 3).join(',')} · ${when}`,
        startedAt: new Date().toISOString(),
      },
      overrideAccess: true,
      context: { skipCrawlQueue: true },
    })
    createdIds.push(job.id)
    await enqueueRunCrawl(req.payload, job.id, req)
  } else if (mode === 'round_robin') {
    // Rotate by UTC hour so hourly cron still covers every city across a day.
    const idx = new Date().getUTCHours() % cityDocs.length
    const city = cityDocs[idx]
    const created = await createCityCrawlJob(req.payload, {
      city,
      sources,
      when,
      modeLabel: 'rr',
    })
    createdIds.push(created.id)
    await enqueueRunCrawl(req.payload, created.id, req)
  } else {
    // per_city — one job each; queue worker concurrency keeps Overpass sequential
    for (const city of cityDocs) {
      const created = await createCityCrawlJob(req.payload, {
        city,
        sources,
        when,
        modeLabel: 'city',
      })
      createdIds.push(created.id)
      await enqueueRunCrawl(req.payload, created.id, req)
    }
  }

  // Kick at most one worker; autoRun (limit=1) drains the rest sequentially.
  void req.payload.jobs
    .run({
      queue: 'crawl',
      limit: 1,
      req,
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err)
      req.payload.logger.error(`scheduleCrawl jobs.run error: ${message}`)
    })

  req.payload.logger.info(
    `scheduleCrawl mode=${mode} created=${createdIds.join(',')} cities=${cityDocs.length} sources=${sources.join(',')}`,
  )

  return {
    output: {
      crawlJobIds: createdIds.map(String).join(','),
      cities: mode === 'all' ? cityDocs.length : createdIds.length,
      sources: sources.length,
      mode,
    },
  }
}

/** Cron: default every 6h. With per_city, each tick enqueues one job per city (run sequentially). */
const AUTO_CRON = process.env.CRAWL_AUTO_CRON || '0 */6 * * *'

export const scheduleCrawlTask = {
  slug: 'scheduleCrawl' as const,
  label: 'Auto crawl (per city)',
  retries: 0,
  schedule: [
    {
      cron: AUTO_CRON,
      queue: 'crawl',
    },
  ],
  inputSchema: [],
  outputSchema: [
    { name: 'crawlJobIds', type: 'text' as const },
    { name: 'cities', type: 'number' as const },
    { name: 'sources', type: 'number' as const },
    { name: 'mode', type: 'text' as const },
  ],
  handler: scheduleCrawlHandler,
}
