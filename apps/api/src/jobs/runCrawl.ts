import type { Payload, TaskHandler } from 'payload'
import { citiesJsonForCrawler } from '@/lib/citiesStore'
import { invokeCrawl, tailLog } from '@/lib/crawlRunner'

type RunCrawlInput = { crawlJobId: string }
type RunCrawlOutput = { status: string; exitCode: number }

async function resolveCityCodes(payload: Payload, citiesField: unknown): Promise<string[]> {
  if (!Array.isArray(citiesField) || citiesField.length === 0) return []
  const codes: string[] = []
  for (const item of citiesField) {
    if (
      typeof item === 'object' &&
      item &&
      'code' in item &&
      typeof (item as { code: unknown }).code === 'string'
    ) {
      codes.push((item as { code: string }).code)
      continue
    }
    const id =
      typeof item === 'object' && item && 'id' in item
        ? (item as { id: string | number }).id
        : item
    if (id == null) continue
    try {
      const doc = await payload.findByID({
        collection: 'cities',
        id: String(id),
        depth: 0,
        overrideAccess: true,
      })
      if (doc?.code) codes.push(String(doc.code))
    } catch {
      // skip missing
    }
  }
  return codes
}

/**
 * Payload Job: orchestrate only — invoke shared crawlRunner → python run_once.
 */
export const runCrawlHandler: TaskHandler<{
  input: RunCrawlInput
  output: RunCrawlOutput
}> = async ({ input, req }) => {
  const { payload } = req
  if (!input.crawlJobId) {
    throw new Error('runCrawl: crawlJobId is required')
  }
  // Relationship fields expect numeric ids; queue input is text.
  const crawlJobId = Number(input.crawlJobId)
  if (!Number.isFinite(crawlJobId)) {
    throw new Error(`runCrawl: invalid crawlJobId=${input.crawlJobId}`)
  }

  const job = await payload.findByID({
    collection: 'crawl-jobs',
    id: crawlJobId,
    depth: 1,
    overrideAccess: true,
  })

  const cityCodes = await resolveCityCodes(payload, job.cities)
  const sources = Array.isArray(job.crawlSources) ? job.crawlSources.map(String) : []
  if (cityCodes.length === 0) {
    throw new Error('runCrawl: no cities selected')
  }
  if (sources.length === 0) {
    throw new Error('runCrawl: no crawlSources selected')
  }

  await payload.update({
    collection: 'crawl-jobs',
    id: crawlJobId,
    data: {
      status: 'running',
      startedAt: new Date().toISOString(),
      errorMessage: null,
    },
    overrideAccess: true,
    context: { skipCrawlQueue: true },
  })

  await payload.create({
    collection: 'crawl-logs',
    data: {
      crawlJob: crawlJobId,
      level: 'INFO',
      message: `Starting crawl cities=${cityCodes.join(',')} sources=${sources.join(',')}`,
    },
    overrideAccess: true,
    context: { skipCrawlQueue: true },
  })

  const citiesJson = await citiesJsonForCrawler(cityCodes)
  let result
  try {
    result = await invokeCrawl({
      cities: cityCodes,
      sources,
      citiesJson,
      payloadCrawlJobId: String(crawlJobId),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await payload.update({
      collection: 'crawl-jobs',
      id: crawlJobId,
      data: {
        status: 'failed',
        finishedAt: new Date().toISOString(),
        errorMessage: message,
        logTail: message,
      },
      overrideAccess: true,
      context: { skipCrawlQueue: true },
    })
    await payload.create({
      collection: 'crawl-logs',
      data: {
        crawlJob: crawlJobId,
        level: 'ERROR',
        message: `Crawl spawn failed: ${message}`,
      },
      overrideAccess: true,
      context: { skipCrawlQueue: true },
    })
    throw err
  }

  const summary = result.summary
  const ok = result.exitCode === 0 && (summary?.ok ?? result.exitCode === 0)
  const failedNote =
    summary?.failedSources?.length
      ? ` failedSources=${summary.failedSources.join(',')}`
      : ''

  await payload.update({
    collection: 'crawl-jobs',
    id: crawlJobId,
    data: {
      status: ok ? 'success' : 'failed',
      finishedAt: new Date().toISOString(),
      recordsFound: summary?.found ?? 0,
      recordsCreated: summary?.created ?? 0,
      recordsUpdated: summary?.updated ?? 0,
      recordsDeactivated: summary?.deactivated ?? 0,
      errorMessage: ok
        ? null
        : `Crawler exited with code ${result.exitCode}${failedNote}`,
      logTail: result.logTail,
    },
    overrideAccess: true,
    context: { skipCrawlQueue: true },
  })

  await payload.create({
    collection: 'crawl-logs',
    data: {
      crawlJob: crawlJobId,
      level: ok ? 'INFO' : 'ERROR',
      message: ok
        ? `Crawl finished successfully (exit 0) found=${summary?.found ?? '?'} created=${summary?.created ?? '?'}`
        : `Crawl failed (exit ${result.exitCode}): ${tailLog(result.stderr, 2000)}`,
    },
    overrideAccess: true,
    context: { skipCrawlQueue: true },
  })

  if (!ok) {
    throw new Error(`Crawler exited with code ${result.exitCode}`)
  }

  return {
    output: {
      status: 'success',
      exitCode: result.exitCode,
    },
  }
}

export const runCrawlTask = {
  slug: 'runCrawl' as const,
  label: 'Run Crawl',
  retries: 0,
  inputSchema: [
    {
      name: 'crawlJobId',
      type: 'text' as const,
      required: true,
    },
  ],
  outputSchema: [
    { name: 'status', type: 'text' as const },
    { name: 'exitCode', type: 'number' as const },
  ],
  handler: runCrawlHandler,
}
