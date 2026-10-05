import { useEffect, useMemo, useRef, useState } from 'react'
import type { Scored, Tx } from '../engine/types'
import { DAY } from '../engine/time'
import { go, useApp } from '../state'
import { TYP_COLOR, TYPOLOGIES } from './ui'

interface Point {
  tx: Tx
  s: Scored
  reviewed: boolean
}

/** Every alert on one strip: x = time, y = score above threshold, colour = likely pattern, ring = already reviewed. */
export default function RiskRibbon({ points, start, end, threshold }: { points: Point[]; start: number; end: number; threshold: number }) {
  const { i18n } = useApp()
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(900)
  const [hover, setHover] = useState<Point | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const H = 190
  const pad = { l: 34, r: 10, t: 12, b: 26 }
  const x = (ts: number) => pad.l + ((ts - start) / Math.max(1, end - start)) * (w - pad.l - pad.r)
  const y = (score: number) => pad.t + (1 - (score - threshold) / Math.max(1, 100 - threshold)) * (H - pad.t - pad.b)

  const days = useMemo(() => {
    const out: number[] = []
    const step = Math.max(1, Math.ceil((end - start) / DAY / Math.max(3, Math.floor(w / 90))))
    for (let t = start; t <= end; t += step * DAY) out.push(t)
    return out
  }, [start, end, w])

  const yTicks = [threshold, Math.round((threshold + 100) / 2), 100]
  const typCounts = TYPOLOGIES.map((typ) => ({ typ, n: points.filter((p) => p.s.typology === typ).length })).filter((c) => c.n)

  return (
    <div>
      <div ref={ref} className="relative w-full">
        <svg width={w} height={H} className="ribbon-reveal block" role="img" aria-label={i18n.t('ov.ribbon')}>
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={pad.l} x2={w - pad.r} y1={y(v)} y2={y(v)} stroke="var(--grid)" strokeWidth={1} />
              <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill="var(--muted)" className="num">
                {i18n.num(v)}
              </text>
            </g>
          ))}
          {days.map((d) => (
            <text key={d} x={x(d)} y={H - 8} fontSize={11} fill="var(--muted)" textAnchor="middle">
              {i18n.day(d)}
            </text>
          ))}
          {points.map((p) => (
            <circle
              key={p.tx.id}
              cx={x(p.tx.ts)}
              cy={y(p.s.score)}
              r={hover === p ? 6 : 4}
              fill={p.reviewed ? 'var(--surface)' : TYP_COLOR[p.s.typology]}
              stroke={p.reviewed ? TYP_COLOR[p.s.typology] : 'var(--surface)'}
              strokeWidth={p.reviewed ? 1.6 : 1.5}
            />
          ))}
          {/* larger invisible hit targets */}
          {points.map((p) => (
            <circle
              key={`h${p.tx.id}`}
              cx={x(p.tx.ts)}
              cy={y(p.s.score)}
              r={9}
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => setHover(p)}
              onMouseLeave={() => setHover(null)}
              onClick={() => go(`alerts/${encodeURIComponent(p.tx.id)}`)}
            />
          ))}
        </svg>
        {hover && (
          <div
            className="glass-strong pointer-events-none absolute z-10 w-56 rounded-xl px-3 py-2 text-[0.82rem] shadow-[var(--shadow-float)]"
            style={{ left: Math.min(Math.max(0, x(hover.tx.ts) - 112), w - 224), top: Math.max(0, y(hover.s.score) - 92) }}
          >
            <div className="flex justify-between font-semibold">
              <span>{hover.tx.id}</span>
              <span className="num">{i18n.num(hover.s.score)}</span>
            </div>
            <div className="text-ink-2">{i18n.t(`typ.${hover.s.typology}`)}</div>
            <div className="num text-ink-2">
              {i18n.money(hover.tx.amount)} · {i18n.t(`tx.${hover.tx.type}`)}
            </div>
            <div className="num text-muted">{i18n.date(hover.tx.ts)}</div>
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.84rem] text-ink-2">
        {typCounts.map(({ typ, n }) => (
          <span key={typ} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: TYP_COLOR[typ] }} />
            {i18n.t(`typ.${typ}`)} <span className="num text-muted">{i18n.num(n)}</span>
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 text-muted">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full border-[1.6px] border-muted" />
          {i18n.t('ov.reviewed')}
        </span>
      </div>
    </div>
  )
}
