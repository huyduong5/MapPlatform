'use client'

import Link from 'next/link'

export function Header({
  query,
  onQueryChange,
  onNearMe,
  onRetry,
  cityLabel = 'Hà Nội',
}: {
  query: string
  onQueryChange: (v: string) => void
  onNearMe: () => void
  onRetry: () => void
  cityLabel?: string
}) {
  return (
    <header className="header">
      <div className="brand">
        <strong>Geo Decision Platform</strong>
        <span>{cityLabel} · Phase 7</span>
      </div>
      <div className="actions">
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Tìm theo tên / địa chỉ…"
          aria-label="Tìm kiếm"
        />
        <button type="button" onClick={onNearMe}>
          Gần tôi
        </button>
        <button type="button" className="ghost" onClick={onRetry}>
          Tải lại
        </button>
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
