import { describe, expect, it } from 'vitest'
import { parseCrawlSummary } from './crawlRunner'

describe('parseCrawlSummary', () => {
  it('parses the last CRAWL_SUMMARY_JSON line', () => {
    const out = `
2026-08-03 INFO Crawl finished
CRAWL_SUMMARY_JSON={"ok":true,"found":10,"created":3,"updated":7,"deactivated":1,"failedSources":[],"payloadCrawlJobId":"abc","resultsCount":2}
`
    const s = parseCrawlSummary(out)
    expect(s).toEqual({
      ok: true,
      found: 10,
      created: 3,
      updated: 7,
      deactivated: 1,
      failedSources: [],
      payloadCrawlJobId: 'abc',
      resultsCount: 2,
    })
  })

  it('returns null when missing', () => {
    expect(parseCrawlSummary('no summary here')).toBeNull()
  })

  it('ignores malformed JSON', () => {
    expect(parseCrawlSummary('CRAWL_SUMMARY_JSON={not-json}')).toBeNull()
  })
})
