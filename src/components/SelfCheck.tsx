import { formatNum, type Lang } from '../lib/i18n'
import { runScenario, SCENARIOS, type Scenario } from '../lib/selfCheck'
import type { Building } from '../lib/types'

interface Props {
  building: Building
  seen: Set<string>
  demoIndex: number | null
  lang: Lang
  t: (k: string, p?: Record<string, string | number>) => string
  onShow: (s: Scenario) => void
  onDemo: () => void
}

/** Judge mode: the five §4.1 checks run through the real engine; rows also tick when reproduced by hand. */
export function SelfCheck({ building, seen, demoIndex, lang, t, onShow, onDemo }: Props) {
  const results = SCENARIOS.map((s) => ({ s, ...runScenario(building, s) }))
  const passed = results.filter((r) => r.pass).length
  const expectText = (s: Scenario) =>
    typeof s.expect === 'string'
      ? t(s.expect === 'no-route' ? 'status.noRoute' : 'status.startBlocked')
      : `${s.expect.path.join(' → ')} · ${formatNum(s.expect.cost, lang)}`

  return (
    <section className="card check-card">
      <div className="check-head">
        <h2>{t('check.title')}</h2>
        <span className={`badge ${passed === SCENARIOS.length ? 'ok' : 'bad'}`}>
          {t('check.score', { n: passed, total: SCENARIOS.length })}
        </span>
      </div>
      <p className="muted">{t('check.hint')}</p>
      <ol className="checks">
        {results.map(({ s, pass }, i) => (
          <li key={s.id} className={demoIndex === i ? 'is-now' : undefined}>
            <span className={`tick ${pass ? 'ok' : 'bad'}`} aria-label={t(pass ? 'check.pass' : 'check.fail')}>{pass ? '✓' : '✗'}</span>
            <div>
              <div className="check-name">{t(`check.${s.id}`)}</div>
              <div className="muted">{t('check.expect')}: {expectText(s)}</div>
            </div>
            {seen.has(s.id) && <span className="pill" title={t('check.seenTitle')}>{t('check.seen')}</span>}
            <button className="btn small" onClick={() => onShow(s)}>{t('btn.show')}</button>
          </li>
        ))}
      </ol>
      <button className="btn primary small" onClick={onDemo}>{demoIndex !== null ? t('btn.stop') : t('btn.demo')}</button>
    </section>
  )
}
