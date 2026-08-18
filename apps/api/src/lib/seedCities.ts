import type { Payload } from 'payload'
import { CITIES, type CityCode } from '@/lib/cities'

/** Seed hardcode cities into Payload. Uses the already-initialized `payload` instance (no getPayload). */
export async function seedCitiesIfEmpty(payload: Payload): Promise<number> {
  const existing = await payload.find({
    collection: 'cities',
    limit: 1,
    overrideAccess: true,
  })
  if (existing.totalDocs > 0) return 0

  let created = 0
  let order = 0
  for (const code of Object.keys(CITIES) as CityCode[]) {
    const c = CITIES[code]
    await payload.create({
      collection: 'cities',
      data: {
        code: c.code,
        name: c.name,
        latitude: c.latitude,
        longitude: c.longitude,
        zoom: c.zoom,
        bbox: c.bbox,
        enabled: true,
        order,
      },
      overrideAccess: true,
    })
    order += 1
    created += 1
  }
  return created
}
