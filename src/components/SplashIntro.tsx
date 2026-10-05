import { useEffect, useRef, useState, type CSSProperties } from 'react'

type Props = {
  title: string
  subtitle: string
  onDone: () => void
}

/** Full-viewport brand intro: shards assemble → path races → zoom blast out. */
export function SplashIntro({ title, subtitle, onDone }: Props) {
  const [exiting, setExiting] = useState(false)
  const done = useRef(false)
  const reduce =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    const finish = () => {
      if (done.current) return
      done.current = true
      onDone()
    }

    if (reduce) {
      const t = window.setTimeout(finish, 80)
      return () => window.clearTimeout(t)
    }

    const exitAt = window.setTimeout(() => setExiting(true), 2200)
    const doneAt = window.setTimeout(finish, 2800)
    return () => {
      window.clearTimeout(exitAt)
      window.clearTimeout(doneAt)
    }
  }, [onDone, reduce])

  if (reduce) return null

  const letters = [...title]

  return (
    <div
      className={`splash-stage${exiting ? ' is-out' : ''}`}
      aria-hidden="true"
    >
      <div className="splash-grain" />
      <div className="splash-glow" />
      <div className="splash-rings" aria-hidden="true">
        <span /><span /><span />
      </div>

      <div className="splash-core">
        <div className="splash-mark">
          <div className="splash-aura" />

          <svg className="splash-svg" viewBox="0 0 64 64" aria-hidden="true">
            <defs>
              <linearGradient id="splash-tile" x1="10" y1="6" x2="54" y2="58" gradientUnits="userSpaceOnUse">
                <stop stopColor="#b9cdb2" />
                <stop offset="0.45" stopColor="#7f9c77" />
                <stop offset="1" stopColor="#4a6644" />
              </linearGradient>
              <linearGradient id="splash-ink" x1="16" y1="12" x2="52" y2="48" gradientUnits="userSpaceOnUse">
                <stop stopColor="#ffffff" />
                <stop offset="1" stopColor="#f5f5dc" />
              </linearGradient>
              <filter id="splash-bloom" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2.4" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Tile — elastic pop */}
            <rect
              className="splash-tile"
              x="8" y="8" width="48" height="48" rx="14"
              fill="url(#splash-tile)"
              filter="url(#splash-bloom)"
            />

            {/* Stair pieces fly in with spin */}
            <g fill="none" stroke="url(#splash-ink)" strokeWidth="4.4" strokeLinecap="round" strokeLinejoin="round">
              <path
                className="splash-piece"
                style={{ '--fx': '-48px', '--fy': '28px', '--fr': '-140deg', '--d': '380ms', '--origin': '18% 72%' } as CSSProperties}
                d="M14 46h10"
              />
              <path
                className="splash-piece"
                style={{ '--fx': '-18px', '--fy': '42px', '--fr': '110deg', '--d': '480ms', '--origin': '38% 64%' } as CSSProperties}
                d="M24 46v-10h10"
              />
              <path
                className="splash-piece"
                style={{ '--fx': '22px', '--fy': '-40px', '--fr': '-95deg', '--d': '580ms', '--origin': '54% 42%' } as CSSProperties}
                d="M34 36v-10h10"
              />
              <path
                className="splash-piece"
                style={{ '--fx': '36px', '--fy': '-30px', '--fr': '160deg', '--d': '680ms', '--origin': '69% 28%' } as CSSProperties}
                d="M44 26v-8"
              />
              <path
                className="splash-piece splash-arrow"
                style={{ '--fx': '52px', '--fy': '-18px', '--fr': '220deg', '--d': '780ms', '--origin': '78% 30%' } as CSSProperties}
                d="M38 14l8 8-8 8"
              />
            </g>

            {/* Courier racing the escape path once assembled */}
            <circle className="splash-courier" r="3.4" fill="#96eefb">
              <animateMotion
                path="M14 46 H24 V36 H34 V26 H44 V18"
                dur="0.85s"
                begin="1.05s"
                fill="freeze"
                calcMode="spline"
                keyTimes="0;1"
                keySplines="0.22 1 0.36 1"
              />
            </circle>
          </svg>

          <span className="splash-spark s1" />
          <span className="splash-spark s2" />
          <span className="splash-spark s3" />
          <span className="splash-spark s4" />
        </div>

        <div className="splash-copy">
          <p className="splash-title">
            {letters.map((ch, i) => (
              <span key={`${ch}-${i}`} style={{ '--i': i } as CSSProperties}>
                {ch === ' ' ? '\u00a0' : ch}
              </span>
            ))}
          </p>
          <p className="splash-sub">{subtitle}</p>
        </div>

        <div className="splash-bar" role="presentation">
          <span />
        </div>
      </div>
    </div>
  )
}
