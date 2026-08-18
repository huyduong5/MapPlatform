import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
/** apps/api/src/lib → repo root (override via COMPOSE_PROJECT_DIR in Docker) */
const REPO_ROOT = process.env.COMPOSE_PROJECT_DIR || path.resolve(dirname, '../../../../')
const CRAWLER_ROOT = process.env.CRAWLER_ROOT || path.join(REPO_ROOT, 'crawler')

export type CrawlSummary = {
  ok: boolean
  found: number
  created: number
  updated: number
  deactivated: number
  failedSources: string[]
  payloadCrawlJobId: string | null
  resultsCount: number
}

export type InvokeCrawlInput = {
  cities: string[]
  sources: string[]
  citiesJson?: string
  /** CMS parent id for correlation/logs only — not SQL crawl_jobs.id */
  payloadCrawlJobId?: string
}

export type InvokeCrawlResult = {
  exitCode: number
  stdout: string
  stderr: string
  summary: CrawlSummary | null
  logTail: string
}

const SUMMARY_PREFIX = 'CRAWL_SUMMARY_JSON='

function runProcess(
  command: string,
  args: string[],
  opts: { cwd: string; env: NodeJS.ProcessEnv },
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: opts.cwd,
      env: opts.env,
      shell: false,
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (buf: Buffer) => {
      stdout += buf.toString()
    })
    child.stderr.on('data', (buf: Buffer) => {
      stderr += buf.toString()
    })
    child.on('error', reject)
    child.on('close', (code) => {
      resolve({ code: code ?? 1, stdout, stderr })
    })
  })
}

export function tailLog(text: string, max = 12_000): string {
  if (text.length <= max) return text
  return `…\n${text.slice(-max)}`
}

/** Parse machine-readable summary line emitted by scheduler.run_once */
export function parseCrawlSummary(combinedOutput: string): CrawlSummary | null {
  const lines = combinedOutput.split(/\r?\n/)
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim()
    if (!line.startsWith(SUMMARY_PREFIX)) continue
    const raw = line.slice(SUMMARY_PREFIX.length)
    try {
      const data = JSON.parse(raw) as Record<string, unknown>
      return {
        ok: Boolean(data.ok),
        found: Number(data.found) || 0,
        created: Number(data.created) || 0,
        updated: Number(data.updated) || 0,
        deactivated: Number(data.deactivated) || 0,
        failedSources: Array.isArray(data.failedSources)
          ? data.failedSources.map(String)
          : [],
        payloadCrawlJobId:
          data.payloadCrawlJobId != null && data.payloadCrawlJobId !== ''
            ? String(data.payloadCrawlJobId)
            : null,
        resultsCount: Number(data.resultsCount) || 0,
      }
    } catch {
      return null
    }
  }
  return null
}

/**
 * Stable bridge to the old Python crawl flow (`python -m scheduler.run_once`).
 * Used by Payload Job runCrawl and POST /api/internal/crawl.
 */
export async function invokeCrawl(input: InvokeCrawlInput): Promise<InvokeCrawlResult> {
  const cities = input.cities.map((c) => c.trim()).filter(Boolean)
  const sources = input.sources.map((s) => s.trim()).filter(Boolean)
  if (cities.length === 0) throw new Error('invokeCrawl: cities required')
  if (sources.length === 0) throw new Error('invokeCrawl: sources required')

  const citiesJson = input.citiesJson || ''
  const payloadCrawlJobId = input.payloadCrawlJobId ? String(input.payloadCrawlJobId) : ''

  const crawlEnv: NodeJS.ProcessEnv = {
    ...process.env,
    CRAWL_CITIES: cities.join(','),
    CRAWL_SOURCES: sources.join(','),
    ...(citiesJson ? { CITIES_JSON: citiesJson } : {}),
    ...(payloadCrawlJobId
      ? {
          PAYLOAD_CRAWL_JOB_ID: payloadCrawlJobId,
          // legacy alias — Python prefers PAYLOAD_CRAWL_JOB_ID
          CRAWL_JOB_ID: payloadCrawlJobId,
        }
      : {}),
  }

  const execMode = (process.env.CRAWL_EXEC || 'docker').toLowerCase()
  let result: { code: number; stdout: string; stderr: string }

  if (execMode === 'python') {
    const py = process.env.CRAWLER_PYTHON || 'python3'
    result = await runProcess(py, ['-m', 'scheduler.run_once'], {
      cwd: CRAWLER_ROOT,
      env: crawlEnv,
    })
  } else {
    const composeArgs = [
      'compose',
      'run',
      '--rm',
      '-e',
      `CRAWL_CITIES=${cities.join(',')}`,
      '-e',
      `CRAWL_SOURCES=${sources.join(',')}`,
      ...(citiesJson ? (['-e', `CITIES_JSON=${citiesJson}`] as const) : []),
      ...(payloadCrawlJobId
        ? ([
            '-e',
            `PAYLOAD_CRAWL_JOB_ID=${payloadCrawlJobId}`,
            '-e',
            `CRAWL_JOB_ID=${payloadCrawlJobId}`,
          ] as const)
        : []),
      'crawler',
      'python',
      '-m',
      'scheduler.run_once',
    ]
    result = await runProcess('docker', composeArgs, {
      cwd: REPO_ROOT,
      env: process.env,
    })
  }

  const combined = `${result.stdout}\n${result.stderr}`
  return {
    exitCode: result.code,
    stdout: result.stdout,
    stderr: result.stderr,
    summary: parseCrawlSummary(combined),
    logTail: tailLog(combined),
  }
}
