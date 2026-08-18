import type { Payload, TaskHandler } from 'payload'
import type { CrawlSourceValue } from '@/collections/CrawlJobs'

/** Transit-only Overpass kinds (điểm dừng bus + ga metro). */
export const TRANSIT_CRAWL_SOURCES: CrawlSourceValue[] = ['bus_stop', 'subway_station']

const DEFAULT_TRANSIT_CITIES = ['hanoi', 'hcm'] as const

type CityDoc = { id: number | string; code?: string | null; name?: string | null }

function transitCities(): string[] {
  const raw = process.env.CRAWL_TRANSIT_CITIES || DEFAULT_TRANSIT_CITIES.join(',')
  const list = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  return list.length > 0 ? list : [...DEFAULT_TRANSIT_CITIES]
}

function transitCron(): string {
  // Every 4 hours at :00 — 0, 4, 8, 12, 16, 20
  return process.env.CRAWL_TRANSIT_AUTO_CRON || '0 */4 * * *'
}

async function createTransitCityJob(
  payload: Payload,
  opts: { city: CityDoc; when: string },
): Promise<{ id: string | number; code: string }> {
  const code = String(opts.city.code || opts.city.id)
  const job = await payload.create({
    collection: 'crawl-jobs',
    data: {
      status: 'pending',
      trigger: 'schedule',
      cities: [opts.city.id],
      crawlSources: [...TRANSIT_CRAWL_SOURCES],
      label: `auto · transit · ${code} · bus_stop,subway_station · ${opts.when}`,
      startedAt: new Date().toISOString(),
    },
    overrideAccess: true,
    // Avoid afterChange jobs.run per city (keep Overpass sequential via crawl queue).
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
      message: 'Queued runCrawl (transit schedule; bus_stop + subway_station)',
    },
    overrideAccess: true,
    context: { skipCrawlQueue: true },
    ...(req ? { req } : {}),
  })
}

/**
 * Cron task: create two Payload Crawl Jobs (Hanoi + HCM by default),
 * each crawling only transit stops (bus_stop, subway_station), every 4h.
 *
 * Env:
 * - CRAWL_TRANSIT_AUTO_SCHEDULE=0 to disable
 * - CRAWL_TRANSIT_AUTO_CRON (default every 4 hours at minute 0)
 * - CRAWL_TRANSIT_CITIES (default hanoi,hcm)
 */
export const scheduleTransitCrawlHandler: TaskHandler<{
  input: Record<string, never>
  output: { crawlJobIds: string; cities: number; sources: number; mode: string }
}> = async ({ req }) => {
  if (process.env.CRAWL_TRANSIT_AUTO_SCHEDULE === '0') {
    req.payload.logger.info('scheduleTransitCrawl skipped (CRAWL_TRANSIT_AUTO_SCHEDULE=0)')
    return { output: { crawlJobIds: '', cities: 0, sources: 0, mode: 'off' } }
  }

  const wanted = new Set(transitCities())
  const cities = await req.payload.find({
    collection: 'cities',
    where: {
      and: [{ enabled: { equals: true } }, { code: { in: [...wanted] } }],
    },
    limit: 20,
    sort: 'order',
    depth: 0,
    overrideAccess: true,
  })

  const cityDocs = (cities.docs as CityDoc[]).filter((d) =>
    wanted.has(String(d.code || '').toLowerCase()),
  )

  if (cityDocs.length === 0) {
    throw new Error(
      `scheduleTransitCrawl: no enabled cities matching ${[...wanted].join(',')} — seed Cities first`,
    )
  }

  const when = new Date().toISOString().slice(0, 16)
  const createdIds: Array<string | number> = []
  const createdCodes: string[] = []

  // Exactly one Crawl Job per city (separate Admin rows).
  for (const city of cityDocs) {
    const created = await createTransitCityJob(req.payload, { city, when })
    createdIds.push(created.id)
    createdCodes.push(created.code)
    await enqueueRunCrawl(req.payload, created.id, req)
  }

  void req.payload.jobs
    .run({
      queue: 'crawl',
      limit: 1,
      req,
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err)
      req.payload.logger.error(`scheduleTransitCrawl jobs.run error: ${message}`)
    })

  req.payload.logger.info(
    `scheduleTransitCrawl created=${createdIds.join(',')} cities=${createdCodes.join(',')} sources=${TRANSIT_CRAWL_SOURCES.join(',')}`,
  )

  return {
    output: {
      crawlJobIds: createdIds.map(String).join(','),
      cities: createdIds.length,
      sources: TRANSIT_CRAWL_SOURCES.length,
      mode: 'transit_per_city',
    },
  }
}

export const scheduleTransitCrawlTask = {
  slug: 'scheduleTransitCrawl' as const,
  label: 'Auto crawl transit stops (HN + HCM, every 4h)',
  retries: 0,
  schedule: [
    {
      cron: transitCron(),
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
  handler: scheduleTransitCrawlHandler,
}
