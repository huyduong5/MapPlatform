import { LandingPage } from '@/components/landing/LandingPage'
import { getPool } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function fetchPoiCount(): Promise<number | null> {
  try {
    const pool = getPool()
    const { rows } = await pool.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM locations WHERE status = 'active'`,
    )
    return rows[0]?.c ?? null
  } catch {
    return null
  }
}

export default async function HomePage() {
  const poiCount = await fetchPoiCount()
  return <LandingPage poiCount={poiCount} />
}
