import { describe, expect, it } from 'vitest'
import { TRANSIT_CRAWL_SOURCES } from './scheduleTransitCrawl'

describe('scheduleTransitCrawl', () => {
  it('crawls only transit stop sources', () => {
    expect(TRANSIT_CRAWL_SOURCES).toEqual(['bus_stop', 'subway_station'])
  })
})
