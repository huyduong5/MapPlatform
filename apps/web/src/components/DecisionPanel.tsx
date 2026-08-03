'use client'

import { useState } from 'react'
import type { DecideResult } from '@/services/decisionApi'

const EXAMPLES = [
  'Xe tôi gần Times City, pin còn 10%, tìm trạm sạc phù hợp nhất.',
  'Tìm cửa hàng gần Royal City',
  'Pin còn 25%, trạm sạc gần Hồ Hoàn Kiếm',
]

export function DecisionPanel({
  onDecide,
  result,
  loading,
}: {
  onDecide: (query: string, useMyLocation: boolean) => void
  result: DecideResult | null
  loading: boolean
}) {
  const [query, setQuery] = useState(EXAMPLES[0])
  const [useMyLocation, setUseMyLocation] = useState(false)

  return (
    <aside className="panel" aria-label="AI Decision">
      <div className="title">
        <strong>AI Decision</strong>
        <span>Phase 2 · $0 rules + Photon</span>
      </div>
      <textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        rows={3}
        placeholder="Mô tả nhu cầu bằng tiếng Việt…"
        aria-label="Câu hỏi quyết định"
      />
      <label className="check">
        <input
          type="checkbox"
          checked={useMyLocation}
          onChange={(e) => setUseMyLocation(e.target.checked)}
        />
        Dùng vị trí GPS của tôi (bỏ qua landmark nếu có)
      </label>
      <div className="row">
        <button
          type="button"
          disabled={loading || !query.trim()}
          onClick={() => onDecide(query.trim(), useMyLocation)}
        >
          {loading ? 'Đang phân tích…' : 'Gợi ý địa điểm'}
        </button>
        <button
          type="button"
          className="ghost"
          onClick={() => setQuery(EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)])}
        >
          Ví dụ
        </button>
      </div>
      {result && (
        <div className="result">
          <p className="explain">{result.explanation.replace(/\*\*/g, '')}</p>
          <ul>
            {result.recommendations.map((r) => (
              <li key={r.id}>
                <span className="rank">#{r.rank}</span>
                <div>
                  <strong>{r.name}</strong>
                  <div className="meta">
                    {r.distanceKm.toFixed(2)} km · score {r.score.toFixed(2)}
                  </div>
                  <div className="why">{r.reasons.slice(0, 2).join(' · ')}</div>
                </div>
              </li>
            ))}
          </ul>
          <div className="meta">
            Intent: {result.intent.intent} · neo: {result.anchor.label} · R=
            {result.radiusMeters}m · NLU: {result.intent.source}
          </div>
        </div>
      )}
      <style jsx>{`
        .panel {
          position: absolute;
          z-index: 1000;
          top: 12px;
          left: 12px;
          width: min(360px, calc(100% - 24px));
          max-height: calc(100% - 24px);
          overflow: auto;
          background: rgba(255, 255, 255, 0.96);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 12px;
          box-shadow: 0 8px 24px rgba(20, 33, 43, 0.12);
        }
        .title {
          display: flex;
          flex-direction: column;
          gap: 2px;
          margin-bottom: 8px;
        }
        .title span {
          font-size: 12px;
          color: var(--muted);
        }
        textarea {
          width: 100%;
          resize: vertical;
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 8px;
          font: inherit;
        }
        .check {
          display: flex;
          gap: 8px;
          align-items: flex-start;
          font-size: 13px;
          color: var(--muted);
          margin: 8px 0;
        }
        .row {
          display: flex;
          gap: 8px;
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
          cursor: not-allowed;
        }
        button.ghost {
          background: transparent;
          color: var(--ink);
          border: 1px solid var(--border);
        }
        .result {
          margin-top: 12px;
          border-top: 1px solid var(--border);
          padding-top: 10px;
        }
        .explain {
          font-size: 14px;
          line-height: 1.45;
          margin: 0 0 10px;
        }
        ul {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 8px;
        }
        li {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 8px;
          align-items: start;
        }
        .rank {
          font-weight: 700;
          color: var(--accent);
        }
        .meta,
        .why {
          font-size: 12px;
          color: var(--muted);
          margin-top: 2px;
        }
      `}</style>
    </aside>
  )
}
