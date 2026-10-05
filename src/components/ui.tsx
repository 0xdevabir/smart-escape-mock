import { useEffect, useState, type ReactNode } from 'react'
import type { CaseStatus, Scored, Typology } from '../engine/types'
import { useApp } from '../state'

export const TYP_COLOR: Record<Typology, string> = {
  ato: 'var(--c-ato)',
  mule: 'var(--c-mule)',
  scam: 'var(--c-scam)',
  agent: 'var(--c-agent)',
  other: 'var(--c-other)',
  normal: 'var(--muted)',
}
export const TYPOLOGIES: Typology[] = ['ato', 'mule', 'scam', 'agent', 'other']

const BAND_STYLE = {
  high: { dot: 'var(--risk-high)', wash: 'var(--risk-high-wash)' },
  medium: { dot: 'var(--risk-med)', wash: 'var(--risk-med-wash)' },
  low: { dot: 'var(--risk-low)', wash: 'var(--risk-low-wash)' },
}

/** Score + band label; colour never carries the meaning alone. */
export function RiskBadge({ s, size = 'sm' }: { s: Pick<Scored, 'score' | 'band'>; size?: 'sm' | 'lg' }) {
  const { i18n } = useApp()
  const st = BAND_STYLE[s.band]
  return (
    <span
      className={`num inline-flex items-center gap-1.5 rounded-full font-semibold text-ink ${size === 'lg' ? 'px-3.5 py-1.5 text-base' : 'px-2.5 py-0.5 text-[0.82rem]'}`}
      style={{ background: st.wash }}
    >
      <span aria-hidden className="inline-block rounded-full" style={{ width: size === 'lg' ? 10 : 8, height: size === 'lg' ? 10 : 8, background: st.dot }} />
      {i18n.num(s.score)}
      <span className="font-medium text-ink-2">{i18n.t(`band.${s.band}`)}</span>
    </span>
  )
}

export function TypologyTag({ typ }: { typ: Typology }) {
  const { i18n } = useApp()
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[0.88rem]">
      <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ background: TYP_COLOR[typ] }} />
      {i18n.t(`typ.${typ}`)}
    </span>
  )
}

const STATUS_STYLE: Record<CaseStatus, string> = {
  open: 'bg-surface-2 text-ink-2',
  escalated: 'bg-accent-wash text-accent-ink',
  confirmed: 'bg-[var(--risk-high-wash)] text-high',
  dismissed: 'bg-[var(--risk-low-wash)] text-ink-2',
}
export function StatusPill({ status }: { status: CaseStatus }) {
  const { i18n } = useApp()
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[0.78rem] font-semibold ${STATUS_STYLE[status]}`}>{i18n.t(`status.${status}`)}</span>
}

export function Panel({ title, hint, actions, children, className = '', pad = true }: { title?: ReactNode; hint?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`panel ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-1">
          <div>
            {title && <h2 className="h-sec">{title}</h2>}
            {hint && <p className="mt-0.5 text-[0.85rem] text-muted">{hint}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className={pad ? 'p-5' : ''}>{children}</div>
    </section>
  )
}

export function Stat({ label, value, sub }: { label: ReactNode; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[0.82rem] font-medium text-muted">{label}</div>
      <div className="num mt-1 text-[1.7rem] leading-tight font-bold tracking-[-0.03em]">{value}</div>
      {sub && <div className="mt-0.5 text-[0.82rem] text-ink-2">{sub}</div>}
    </div>
  )
}

export function PageHead({ title, lede, actions }: { title: ReactNode; lede?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="h-page">{title}</h1>
        {lede && <p className="lede mt-2">{lede}</p>}
      </div>
      {actions}
    </div>
  )
}

/** Horizontal 0–100 meter with the alert threshold marked. */
export function ScoreMeter({ score, threshold, band }: { score: number; threshold: number; band: Scored['band'] }) {
  const { i18n } = useApp()
  return (
    <div className="relative h-2.5 w-full rounded-full bg-surface-3" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score} aria-label={i18n.t('sm.result')}>
      <div className="h-full rounded-full transition-[width] duration-500 ease-[var(--ease-ios)]" style={{ width: `${score}%`, background: BAND_STYLE[band].dot }} />
      <div className="absolute -top-1.5 h-[22px] w-[3px] -translate-x-1/2 rounded-full bg-ink ring-2 ring-surface" style={{ left: `${threshold}%` }} title={`${i18n.t('md.threshold')}: ${threshold}`} />
    </div>
  )
}

export const toast = (msg: string) => window.dispatchEvent(new CustomEvent('tl-toast', { detail: msg }))

export function Toast() {
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const on = (e: Event) => {
      setMsg((e as CustomEvent<string>).detail)
      clearTimeout(timer)
      timer = setTimeout(() => setMsg(null), 3200)
    }
    window.addEventListener('tl-toast', on)
    return () => {
      window.removeEventListener('tl-toast', on)
      clearTimeout(timer)
    }
  }, [])
  return (
    <div aria-live="polite" className="pointer-events-none fixed top-3 left-1/2 z-50 w-max max-w-[calc(100vw-32px)] -translate-x-1/2">
      {msg && (
        <div key={msg} className="anim-banner glass-strong flex items-center gap-2.5 rounded-full px-4 py-2.5 text-sm font-medium text-ink shadow-[var(--shadow-float)]">
          <span aria-hidden className="h-2 w-2 flex-none rounded-full bg-low" />
          {msg}
        </div>
      )}
    </div>
  )
}
