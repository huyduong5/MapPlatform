import type { LocationType } from '@/types/location'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') || ''

function adminHeaders(): HeadersInit {
  const token = process.env.NEXT_PUBLIC_ADMIN_TOKEN || ''
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) h['x-admin-token'] = token
  return h
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    cache: 'no-store',
    ...init,
    headers: { ...adminHeaders(), ...(init?.headers || {}) },
  })
  const json = await res.json()
  if (!res.ok || json.success === false) {
    throw new Error(json?.error?.message || `HTTP ${res.status}`)
  }
  return json as T
}

export type CrawlStats = {
  jobs: Array<{
    id: string
    source: string
    status: string
    startedAt: string
    finishedAt: string | null
    recordsFound: number | null
    recordsCreated: number | null
    recordsUpdated: number | null
    recordsDeactivated?: number | null
    errorMessage: string | null
  }>
  jobsByStatus: Array<{ status: string; count: number }>
  logSummary: { openWarnings: number; totalWarnings: number; errors: number }
  locationsByType: Array<{ type: LocationType | string; count: number }>
  locationsByCityType?: Array<{ city: string; type: string; count: number }>
  locationStatus?: { active: number; inactive: number; inactivePct: number }
}

export type CrawlWarning = {
  id: string
  crawlJobId: string
  level: string
  message: string
  reviewStatus: string
  reviewNote: string | null
  reviewedAt: string | null
  createdAt: string
  source: string
}

export async function getCrawlStats() {
  const json = await request<{ success: true; data: CrawlStats }>('/api/admin/crawl-stats')
  return json.data
}

export async function getCrawlWarnings(status: 'open' | 'all' | 'resolved' | 'ignored' = 'open') {
  const json = await request<{ success: true; data: CrawlWarning[] }>(
    `/api/admin/crawl-warnings?status=${status}&limit=50`,
  )
  return json.data
}

export async function patchCrawlWarning(
  id: string,
  body: { status: 'resolved' | 'ignored' | 'open'; note?: string },
) {
  const json = await request<{ success: true; data: CrawlWarning }>(
    `/api/admin/crawl-warnings/${id}`,
    { method: 'PATCH', body: JSON.stringify(body) },
  )
  return json.data
}

export async function getMetrics() {
  const json = await request<{
    success: true
    data: {
      locationsByType: Array<{ type: string; count: number }>
      locationsByCityType?: Array<{ city: string; type: string; count: number }>
      locationStatus?: { active: number; inactive: number; inactivePct: number }
      enrichmentCoverage?: {
        withPhone: number
        withHours: number
        withWebsite: number
        withNormalizedAddress: number
        withRating: number
        pctPhone: number
        pctHours: number
        pctWebsite: number
        pctNormalizedAddress: number
        byCity?: Array<{
          city: string
          active: number
          pctPhone: number
          pctHours: number
          pctWebsite: number
          pctNormalizedAddress: number
        }>
      }
      syntheticNames?: {
        total: number
        active: number
        undisplayableActive: number
      }
      jobsLast7d: Array<{ status: string; count: number }>
      openWarnings: number
      generatedAt: string
    }
  }>('/api/metrics')
  return json.data
}

/** Download CSV export for a city (admin). Triggers browser download. */
export function exportLocationsCsvUrl(city: string = 'hanoi'): string {
  const q = new URLSearchParams({ city })
  const token = process.env.NEXT_PUBLIC_ADMIN_TOKEN || ''
  // Token is sent via header when fetching; URL alone is for display / manual curl.
  void token
  return `${API_BASE}/api/admin/export/locations.csv?${q.toString()}`
}

export async function downloadLocationsCsv(city: string = 'hanoi'): Promise<void> {
  const url = exportLocationsCsvUrl(city)
  const res = await fetch(url, {
    cache: 'no-store',
    headers: adminHeaders(),
  })
  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const json = await res.json()
      message = json?.error?.message || message
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }
  const blob = await res.blob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `locations_${city}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}
