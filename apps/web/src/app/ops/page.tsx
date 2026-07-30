'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  downloadLocationsCsv,
  getCrawlStats,
  getCrawlWarnings,
  getMetrics,
  patchCrawlWarning,
  type CrawlStats,
  type CrawlWarning,
} from '@/services/adminApi'

export default function OpsPage() {
  const [stats, setStats] = useState<CrawlStats | null>(null)
  const [metrics, setMetrics] = useState<Awaited<ReturnType<typeof getMetrics>> | null>(null)
  const [warnings, setWarnings] = useState<CrawlWarning[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [exportCity, setExportCity] = useState('hanoi')
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [s, w, m] = await Promise.all([
        getCrawlStats(),
        getCrawlWarnings('open'),
        getMetrics(),
      ])
      setStats(s)
      setWarnings(w)
      setMetrics(m)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được ops data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onReview = async (id: string, status: 'resolved' | 'ignored') => {
    try {
      await patchCrawlWarning(id, { status, note: `ops:${status}` })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Patch warning failed')
    }
  }

  const onExport = async () => {
    setExporting(true)
    setError(null)
    try {
      await downloadLocationsCsv(exportCity)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'CSV export failed')
    } finally {
      setExporting(false)
    }
  }

  return (
    <main className="ops">
      <header>
        <div>
          <strong>Ops Console</strong>
          <span>Phase 7 · crawl stats, WARNING review & CSV export</span>
        </div>
        <div className="actions">
          <Link href="/">← Bản đồ</Link>
          <button type="button" onClick={() => void load()}>
            Tải lại
          </button>
        </div>
      </header>

      {error && <div className="banner error">{error}</div>}
      {loading && <div className="banner">Đang tải…</div>}

      <section>
        <h2>CSV export</h2>
        <div className="row">
          <select
            value={exportCity}
            onChange={(e) => setExportCity(e.target.value)}
            aria-label="Thành phố export"
          >
            <option value="hanoi">Hà Nội</option>
            <option value="hcm">Hồ Chí Minh</option>
            <option value="danang">Đà Nẵng</option>
            <option value="haiphong">Hải Phòng</option>
            <option value="cantho">Cần Thơ</option>
            <option value="hue">Huế</option>
          </select>
          <button type="button" disabled={exporting} onClick={() => void onExport()}>
            {exporting ? 'Đang xuất…' : 'Tải locations.csv'}
          </button>
        </div>
      </section>

      {metrics && (
        <section>
          <h2>Metrics</h2>
          <p className="muted">Open warnings: {metrics.openWarnings}</p>
          {metrics.locationStatus && (
            <p className="muted">
              Active: {metrics.locationStatus.active} · Inactive:{' '}
              {metrics.locationStatus.inactive} ({metrics.locationStatus.inactivePct}%)
            </p>
          )}
          {metrics.syntheticNames && (
            <p className="muted">
              Synthetic OSM names: active {metrics.syntheticNames.active} · undisplayable{' '}
              {metrics.syntheticNames.undisplayableActive} · total flagged{' '}
              {metrics.syntheticNames.total}
            </p>
          )}
          {metrics.enrichmentCoverage && (
            <>
              <p className="muted">
                Enrichment: phone {metrics.enrichmentCoverage.pctPhone}% · hours{' '}
                {metrics.enrichmentCoverage.pctHours}% · website{' '}
                {metrics.enrichmentCoverage.pctWebsite}% · addr{' '}
                {metrics.enrichmentCoverage.pctNormalizedAddress}%
              </p>
              {metrics.enrichmentCoverage.byCity &&
                metrics.enrichmentCoverage.byCity.length > 0 && (
                  <ul className="chips">
                    {metrics.enrichmentCoverage.byCity.map((c) => (
                      <li key={c.city}>
                        {c.city}: phone {c.pctPhone}% · hours {c.pctHours}% · web{' '}
                        {c.pctWebsite}% · addr {c.pctNormalizedAddress}%
                      </li>
                    ))}
                  </ul>
                )}
            </>
          )}
          <ul className="chips">
            {metrics.locationsByType.map((x) => (
              <li key={x.type}>
                {x.type}: <strong>{x.count}</strong>
              </li>
            ))}
          </ul>
          {metrics.locationsByCityType && metrics.locationsByCityType.length > 0 && (
            <>
              <h3 style={{ fontSize: 14, marginTop: 12 }}>Theo city × type</h3>
              <ul className="chips">
                {metrics.locationsByCityType.map((x) => (
                  <li key={`${x.city}-${x.type}`}>
                    {x.city}/{x.type}: <strong>{x.count}</strong>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {stats && (
        <section>
          <h2>Crawl jobs (gần đây)</h2>
          {stats.locationStatus && (
            <p className="muted">
              Locations active {stats.locationStatus.active} · inactive{' '}
              {stats.locationStatus.inactive} ({stats.locationStatus.inactivePct}%)
            </p>
          )}
          <table>
            <thead>
              <tr>
                <th>Source</th>
                <th>Status</th>
                <th>Found</th>
                <th>Created</th>
                <th>Updated</th>
                <th>Deactivated</th>
                <th>Started</th>
              </tr>
            </thead>
            <tbody>
              {stats.jobs.map((j) => (
                <tr key={j.id}>
                  <td>{j.source}</td>
                  <td className={j.status}>{j.status}</td>
                  <td>{j.recordsFound ?? '—'}</td>
                  <td>{j.recordsCreated ?? '—'}</td>
                  <td>{j.recordsUpdated ?? '—'}</td>
                  <td>{j.recordsDeactivated ?? '—'}</td>
                  <td>{new Date(j.startedAt).toLocaleString('vi-VN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section>
        <h2>WARNING review queue ({warnings.length})</h2>
        {warnings.length === 0 ? (
          <p className="muted">Không có warning đang mở.</p>
        ) : (
          <ul className="warns">
            {warnings.map((w) => (
              <li key={w.id}>
                <div>
                  <strong>{w.source}</strong>
                  <div className="muted">{w.message}</div>
                  <div className="muted">{new Date(w.createdAt).toLocaleString('vi-VN')}</div>
                </div>
                <div className="row">
                  <button type="button" onClick={() => void onReview(w.id, 'resolved')}>
                    Resolve
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => void onReview(w.id, 'ignored')}
                  >
                    Ignore
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <style jsx>{`
        .ops {
          max-width: 1100px;
          margin: 0 auto;
          padding: 16px;
        }
        header {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
          margin-bottom: 16px;
        }
        header span,
        .muted {
          display: block;
          color: var(--muted);
          font-size: 13px;
        }
        .actions {
          display: flex;
          gap: 10px;
          align-items: center;
        }
        section {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 12px 14px;
          margin-bottom: 14px;
        }
        h2 {
          margin: 0 0 10px;
          font-size: 16px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        th,
        td {
          text-align: left;
          padding: 6px 8px;
          border-bottom: 1px solid var(--border);
        }
        td.failed {
          color: var(--danger);
        }
        td.success {
          color: var(--accent);
        }
        .chips,
        .warns {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          gap: 8px;
        }
        .chips {
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        }
        .chips li {
          background: #f3f6f8;
          padding: 8px 10px;
          border-radius: 8px;
          font-size: 13px;
        }
        .warns li {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          border-bottom: 1px solid var(--border);
          padding-bottom: 8px;
        }
        .row {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        select {
          padding: 8px 10px;
          border: 1px solid var(--border);
          border-radius: 8px;
        }
        button {
          padding: 8px 12px;
          border: none;
          border-radius: 8px;
          background: var(--accent);
          color: #fff;
          cursor: pointer;
        }
        button:disabled {
          opacity: 0.6;
          cursor: wait;
        }
        button.ghost {
          background: transparent;
          color: var(--ink);
          border: 1px solid var(--border);
        }
        .banner {
          padding: 8px 12px;
          background: #e8f2ec;
          border-radius: 8px;
          margin-bottom: 12px;
        }
        .banner.error {
          background: #fdecea;
          color: var(--danger);
        }
      `}</style>
    </main>
  )
}
