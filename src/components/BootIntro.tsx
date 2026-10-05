import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { useApp } from '../state'

/**
 * Opening boot intro (ShopZen / RSLASH pattern):
 * 1) Dark stage — logo pieces spring/spin into the TrustLens mark
 * 2) Wordmark rises, sage–cyan glow blooms
 * 3) Hold while the engine finishes scoring (if still busy)
 * 4) Zoom through the lens core as the stage fades off
 *
 * Animations are CSS-driven (index.css "Boot intro") so they run on the
 * compositor. Skipped when prefers-reduced-motion is on.
 */

const ASSEMBLE_MS = 2400
const ZOOM_MS = 1100
const FADE_MS = 700
const EXIT_MS = ZOOM_MS + FADE_MS

const STAGE_STYLE = {
  '--intro-zoom-ms': `${ZOOM_MS}ms`,
  '--intro-fade-ms': `${FADE_MS}ms`,
} as CSSProperties

const ATMOSPHERE: CSSProperties = {
  backgroundImage:
    'radial-gradient(ellipse at center, rgba(168,188,161,0.22), transparent 55%),' +
    'radial-gradient(circle at 14% 18%, rgba(150,238,251,0.14), transparent 40%),' +
    'radial-gradient(circle at 88% 82%, rgba(168,188,161,0.16), transparent 42%)',
}

const GLOW: CSSProperties = {
  backgroundImage:
    'radial-gradient(circle, rgba(150,238,251,0.32), rgba(168,188,161,0.14) 38%, transparent 64%)',
}

// Piece flight: translate + spin about each element's own centre in the 64 viewBox.
const PIECES: { id: string; style: CSSProperties }[] = [
  { id: 'ring-outer', style: { '--fx': '-42%', '--fy': '-18%', '--fr': '-120deg', '--origin': '50% 46.9%', '--d': '160ms' } as CSSProperties },
  { id: 'ring-inner', style: { '--fx': '38%', '--fy': '22%', '--fr': '140deg', '--origin': '50% 46.9%', '--d': '340ms' } as CSSProperties },
  { id: 'scan', style: { '--fx': '-20%', '--fy': '40%', '--fr': '200deg', '--origin': '50% 46.9%', '--d': '520ms' } as CSSProperties },
  { id: 'core', style: { '--fx': '0%', '--fy': '-28%', '--fr': '0deg', '--origin': '50% 46.9%', '--d': '760ms' } as CSSProperties },
  { id: 'anchor', style: { '--fx': '0%', '--fy': '48%', '--fr': '0deg', '--origin': '50% 72%', '--d': '960ms' } as CSSProperties },
]

let played = false

export function BootIntro() {
  const { busy, i18n } = useApp()
  const uid = useId().replace(/:/g, '')
  const [skip] = useState(() => played)
  const [assembled, setAssembled] = useState(false)
  const [exiting, setExiting] = useState(false)
  const [gone, setGone] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const ready = !busy

  const ringGrad = `tlIntroRing-${uid}`
  const coreGrad = `tlIntroCore-${uid}`

  useEffect(() => {
    const stage = ref.current
    if (!stage) return

    // Reduced motion: CSS sets display:none — leave as soon as data is ready.
    if (getComputedStyle(stage).display === 'none') {
      played = true
      setGone(true)
      return
    }

    const t = window.setTimeout(() => setAssembled(true), ASSEMBLE_MS)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (skip || gone || exiting) return
    if (assembled && ready) setExiting(true)
  }, [assembled, ready, skip, gone, exiting])

  useEffect(() => {
    if (!exiting) return
    const t = window.setTimeout(() => {
      played = true
      setGone(true)
    }, EXIT_MS)
    return () => clearTimeout(t)
  }, [exiting])

  if (skip || gone) return null

  const stageClass = exiting
    ? 'tl-intro-stage fixed inset-0 z-[200] flex items-center justify-center overflow-hidden is-exiting'
    : 'tl-intro-stage fixed inset-0 z-[200] flex items-center justify-center overflow-hidden'

  const coreClass = !ready && assembled
    ? 'tl-intro-core absolute inset-0 is-pulse'
    : 'tl-intro-core absolute inset-0'

  return (
    <div
      ref={ref}
      className={stageClass}
      style={STAGE_STYLE}
      aria-hidden={exiting || undefined}
      role="status"
      aria-live="polite"
      aria-label={i18n.t('loading')}
    >
      <div className="pointer-events-none absolute inset-0" style={ATMOSPHERE} />

      <div className="tl-intro-content flex flex-col items-center [--tile:120px] sm:[--tile:148px]">
        <div className="relative size-[var(--tile)]">
          <div className="tl-intro-glow pointer-events-none absolute -inset-[130%]" style={GLOW} />

          <svg viewBox="0 0 64 64" className="tl-intro-tile absolute inset-0 h-full w-full" aria-hidden>
            <defs>
              <linearGradient id={ringGrad} x1="12" y1="10" x2="52" y2="54" gradientUnits="userSpaceOnUse">
                <stop stopColor="#c4d6bd" />
                <stop offset="0.55" stopColor="#a8bca1" />
                <stop offset="1" stopColor="#6f8a68" />
              </linearGradient>
              <linearGradient id={coreGrad} x1="24" y1="22" x2="40" y2="42" gradientUnits="userSpaceOnUse">
                <stop stopColor="#96eefb" />
                <stop offset="1" stopColor="#a8bca1" />
              </linearGradient>
            </defs>
            <rect width="64" height="64" rx="18" fill="#1b1b1b" />
            <rect
              width="64"
              height="64"
              rx="18"
              fill="none"
              stroke="#fff"
              strokeOpacity="0.08"
              strokeWidth="1"
              transform="translate(0.5 0.5) scale(0.984)"
            />
          </svg>

          <div className="tl-intro-piece absolute inset-0" style={PIECES[0].style}>
            <svg viewBox="0 0 64 64" overflow="visible" className="h-full w-full" aria-hidden>
              <circle cx="32" cy="30" r="16.5" fill="none" stroke={`url(#${ringGrad})`} strokeWidth="2.4" />
            </svg>
          </div>

          <div className="tl-intro-piece absolute inset-0" style={PIECES[1].style}>
            <svg viewBox="0 0 64 64" overflow="visible" className="h-full w-full" aria-hidden>
              <circle cx="32" cy="30" r="10.2" fill="none" stroke="#a8bca1" strokeWidth="1.6" opacity="0.9" />
            </svg>
          </div>

          <div className="tl-intro-piece absolute inset-0" style={PIECES[2].style}>
            <svg viewBox="0 0 64 64" overflow="visible" className="h-full w-full" aria-hidden>
              <path
                d="M18.8 33.5a13.8 13.8 0 0 1 22.4-10.2"
                fill="none"
                stroke="#96eefb"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <div className={coreClass} style={PIECES[3].style}>
            <svg viewBox="0 0 64 64" overflow="visible" className="h-full w-full" aria-hidden>
              <circle cx="32" cy="30" r="4.2" fill={`url(#${coreGrad})`} />
              <circle cx="32" cy="30" r="1.7" fill="#1b1b1b" />
            </svg>
          </div>

          <div className="tl-intro-piece absolute inset-0" style={PIECES[4].style}>
            <svg viewBox="0 0 64 64" overflow="visible" className="h-full w-full" aria-hidden>
              <path d="M26.5 46.5h11" stroke="#a8bca1" strokeWidth="2.2" strokeLinecap="round" opacity="0.7" />
              <path d="M32 42.2v5.8" stroke="#a8bca1" strokeWidth="2.2" strokeLinecap="round" opacity="0.85" />
            </svg>
          </div>
        </div>

        <div className="mt-7 overflow-hidden pb-1">
          <p className="tl-intro-word text-[1.7rem] font-bold tracking-[-0.04em] text-[#f5f5f5] sm:text-[2rem]">
            {i18n.t('appName')}
          </p>
        </div>
        <p className="tl-intro-tag mt-1.5 text-[0.78rem] tracking-wide text-[#a8bca1]">{i18n.t('loading')}</p>
      </div>
    </div>
  )
}
