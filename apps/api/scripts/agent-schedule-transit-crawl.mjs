/**
 * One-shot: run scheduleTransitCrawl handler once → creates 2 Crawl Jobs
 * (hanoi + hcm, bus_stop+subway_station) and queues runCrawl.
 *
 * Usage: node --import tsx/esm scripts/agent-schedule-transit-crawl.mjs
 */
import { getPayload } from 'payload'
import config from '../src/payload.config.ts'
import { scheduleTransitCrawlHandler } from '../src/jobs/scheduleTransitCrawl.ts'

const payload = await getPayload({ config })
const result = await scheduleTransitCrawlHandler({
  input: {},
  job: { id: 'manual-transit-schedule' },
  req: { payload },
})

console.log(JSON.stringify({ phase: 'done', result }, null, 2))
process.exit(0)
