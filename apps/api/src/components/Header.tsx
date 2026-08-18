'use client'

import Link from 'next/link'
import type { GeolocationStatus } from '@/hooks/useGeolocation'

function locateLabel(status: GeolocationStatus | undefined, active: boolean): string {
  if (status === 'locating') return 'Đang lấy vị trí…'
  if (status === 'denied') return 'Cho phép vị trí'
  if (active || status === 'active') return 'Vị trí của tôi'
  return 'Vị trí của tôi'
}

export function Header({
  query,
  onQueryChange,
  onShowMyLocation,
  onRetry,
  cityLabel = 'Hà Nội',
  geoStatus,
  locateActive = false,
}: {
  query: string
  onQueryChange: (v: string) => void
  /** Single action: show my position on the map (Google Maps–style). */
  onShowMyLocation: () => void
  onRetry: () => void
  cityLabel?: string
  geoStatus?: GeolocationStatus
  locateActive?: boolean
}) {
  const busy = geoStatus === 'locating'
  const denied = geoStatus === 'denied'
  const active = locateActive || geoStatus === 'active'

  return (
    <header className="header">
      <div className="brand">
        <Link href="/" className="brand-home">
          <strong>MapPlatform</strong>
        </Link>
        <span>{cityLabel} · Bản đồ</span>
      </div>
      <div className="actions">
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Tìm theo tên / địa chỉ…"
          aria-label="Tìm kiếm"
        />
        <button
          type="button"
          className={`locate${active ? ' on' : ''}${denied ? ' bad' : ''}${busy ? ' busy' : ''}`}
          onClick={onShowMyLocation}
          aria-pressed={active}
          aria-busy={busy}
          title={
            busy ? 'Đang lấy vị trí…' : 'Hiện vị trí của bạn trên bản đồ'
          }
        >
          {locateLabel(geoStatus, active)}
        </button>
        <button type="button" className="ghost" onClick={onRetry}>
          Tải lại
        </button>
        <a className="ops" href="/admin">
          Admin
        </a>
        <Link className="ops" href="/ops">
          Ops
        </Link>
      </div>
      <style jsx>{`
        .header {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: linear-gradient(180deg, #ffffff 0%, #f7faf8 100%);
          border-bottom: 1px solid var(--border);
        }
        .brand {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .brand :global(a.brand-home) {
          color: inherit;
          text-decoration: none;
        }
        .brand :global(a.brand-home:hover) strong {
          color: var(--accent);
        }
        .brand span {
          font-size: 12px;
          color: var(--muted);
        }
        .actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
        }
        input {
          min-width: 220px;
          padding: 8px 10px;
          border: 1px solid var(--border);
          border-radius: 8px;
        }
        button,
        :global(a.ops) {
          padding: 8px 12px;
          border: none;
          border-radius: 8px;
          background: var(--accent);
          color: white;
          cursor: pointer;
          text-decoration: none;
          font-size: 14px;
        }
        button.locate {
          background: #1d4ed8;
          font-weight: 600;
          min-width: 9.5rem;
        }
        button.locate.on {
          background: #2563eb;
          box-shadow: inset 0 0 0 2px #93c5fd;
        }
        button.locate.busy {
          opacity: 0.9;
        }
        button.locate.bad {
          background: #b42318;
        }
        button.ghost {
          background: transparent;
          color: var(--ink);
          border: 1px solid var(--border);
        }
        :global(a.ops) {
          background: #14212b;
        }
      `}</style>
    </header>
  )
}
