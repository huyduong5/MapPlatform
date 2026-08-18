import type { CollectionConfig } from 'payload'

/** Crawl source kinds accepted by Python `scheduler.run_once` (`CRAWL_SOURCES`). */
export const CRAWL_SOURCE_OPTIONS = [
  { label: 'VinFast seed', value: 'vinfast' },
  { label: 'Charging', value: 'charging' },
  { label: 'Parking', value: 'parking' },
  { label: 'Rescue', value: 'rescue' },
  { label: 'Gas', value: 'gas' },
  { label: 'University', value: 'university' },
  { label: 'Hospital', value: 'hospital' },
  { label: 'Pharmacy', value: 'pharmacy' },
  { label: 'ATM', value: 'atm' },
  { label: 'Bank', value: 'bank' },
  { label: 'Police', value: 'police' },
  { label: 'Fire station', value: 'fire_station' },
  { label: 'School', value: 'school' },
  { label: 'Marketplace', value: 'marketplace' },
  { label: 'Bus stop', value: 'bus_stop' },
  { label: 'Subway / metro', value: 'subway_station' },
  { label: 'Park', value: 'park' },
  { label: 'Tourist attraction', value: 'tourist_attraction' },
] as const

export type CrawlSourceValue = (typeof CRAWL_SOURCE_OPTIONS)[number]['value']

/**
 * All crawler kinds that feed map layers (LayerControl / LocationType).
 * vinfast → store/showroom/service_center/dealer; others map 1:1 to OSM types.
 */
export const ALL_MAP_CRAWL_SOURCES: CrawlSourceValue[] = CRAWL_SOURCE_OPTIONS.map(
  (o) => o.value,
)

/** Default for auto schedule + Admin when CRAWL_SOURCES unset. */
export const DEFAULT_CRAWL_SOURCES_CSV = ALL_MAP_CRAWL_SOURCES.join(',')

export const CrawlJobs: CollectionConfig = {
  slug: 'crawl-jobs',
  dbName: 'cms_crawl_jobs',
  admin: {
    useAsTitle: 'label',
    defaultColumns: ['label', 'status', 'trigger', 'startedAt', 'recordsFound', 'finishedAt'],
    description:
      'Manual: Create → Save (Pending) để crawl ngay. Auto map POI: scheduleCrawl. Auto điểm dừng: scheduleTransitCrawl (HN + HCM, bus_stop+subway, mỗi 4h). Queue tuần tự. Debug: Payload Jobs.',
  },
  hooks: {
    beforeChange: [
      async ({ data, operation }) => {
        if (!data) return data
        if (operation === 'create' && !data.startedAt) {
          data.startedAt = new Date().toISOString()
        }
        if (operation === 'create' && !data.status) {
          data.status = 'pending'
        }
        const citiesCount = Array.isArray(data.cities) ? data.cities.length : 0
        const sources = Array.isArray(data.crawlSources) ? data.crawlSources : []
        const srcPreview = sources.slice(0, 3).join(',')
        const when = data.startedAt ? String(data.startedAt).slice(0, 19) : 'now'
        data.label =
          data.label ||
          `crawl · ${citiesCount || '?'} city · ${srcPreview || 'sources'} · ${when}`
        return data
      },
    ],
    afterChange: [
      async ({ doc, operation, previousDoc, req, context }) => {
        if ((context as { skipCrawlQueue?: boolean } | undefined)?.skipCrawlQueue) return
        if (doc.status !== 'pending') return
        const becamePending =
          operation === 'create' || (previousDoc && previousDoc.status !== 'pending')
        if (!becamePending) return

        try {
          await req.payload.jobs.queue({
            task: 'runCrawl',
            queue: 'crawl',
            input: { crawlJobId: String(doc.id) },
            req,
          })
          // Kick worker immediately (do not block Admin Save on Overpass duration)
          void req.payload.jobs
            .run({
              queue: 'crawl',
              limit: 1,
              req,
            })
            .catch((err: unknown) => {
              const message = err instanceof Error ? err.message : String(err)
              req.payload.logger.error(`runCrawl worker error for ${doc.id}: ${message}`)
            })
          await req.payload.create({
            collection: 'crawl-logs',
            data: {
              crawlJob: doc.id,
              level: 'INFO',
              message:
                'Queued runCrawl on "crawl"; worker started (invokeCrawl → python -m scheduler.run_once)',
            },
            req,
            overrideAccess: true,
            context: { skipCrawlQueue: true },
          })
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          req.payload.logger.error(`Failed to queue/run runCrawl for ${doc.id}: ${message}`)
          await req.payload.update({
            collection: 'crawl-jobs',
            id: doc.id,
            data: {
              status: 'failed',
              errorMessage: `Queue/run failed: ${message}`,
              finishedAt: new Date().toISOString(),
            },
            req,
            overrideAccess: true,
            context: { skipCrawlQueue: true },
          })
        }
      },
    ],
  },
  fields: [
    {
      name: 'label',
      type: 'text',
      admin: { description: 'Tiêu đề list Admin (tự sinh nếu để trống).' },
    },
    {
      name: 'cities',
      type: 'relationship',
      relationTo: 'cities',
      hasMany: true,
      required: true,
      admin: { description: 'Thành phố cần crawl (từ Cities).' },
    },
    {
      name: 'crawlSources',
      type: 'select',
      hasMany: true,
      required: true,
      defaultValue: [...ALL_MAP_CRAWL_SOURCES],
      options: [...CRAWL_SOURCE_OPTIONS],
      admin: {
        description:
          'Mặc định = đủ loại trên bản đồ (vinfast + Overpass). Tương ứng CRAWL_SOURCES Python.',
      },
    },
    {
      name: 'trigger',
      type: 'select',
      required: true,
      defaultValue: 'manual',
      options: [
        { label: 'Manual', value: 'manual' },
        { label: 'Schedule', value: 'schedule' },
      ],
    },
    {
      name: 'source',
      type: 'relationship',
      relationTo: 'sources',
      required: false,
      admin: {
        description: 'Legacy CMS mirror (optional). Job mới dùng crawlSources.',
        position: 'sidebar',
      },
    },
    {
      name: 'startedAt',
      type: 'date',
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'finishedAt',
      type: 'date',
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Running', value: 'running' },
        { label: 'Success', value: 'success' },
        { label: 'Failed', value: 'failed' },
      ],
    },
    { name: 'recordsFound', type: 'number', defaultValue: 0 },
    { name: 'recordsCreated', type: 'number', defaultValue: 0 },
    { name: 'recordsUpdated', type: 'number', defaultValue: 0 },
    { name: 'recordsDeactivated', type: 'number', defaultValue: 0 },
    { name: 'errorMessage', type: 'textarea' },
    {
      name: 'logTail',
      type: 'textarea',
      admin: {
        description: 'Stdout/stderr rút gọn từ lần chạy crawler gần nhất.',
        readOnly: true,
      },
    },
  ],
}
