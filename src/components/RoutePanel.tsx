import type { Building, Hazards, RouteResult } from '../lib/types'
import { formatNum, type Lang } from '../lib/i18n'

interface Props {
  building: Building
  hazards: Hazards
  route: RouteResult
  start: string | null
  lang: Lang
  t: (k: string, p?: Record<string, string | number>) => string
  onStart: (id: string | null) => void
}

export function RoutePanel({ building, hazards, route, start, lang, t, onStart }: Props) {
  const labelOf = (id: string) => building.nodes.find((n) => n.id === id)?.label ?? id
  const starts = building.nodes.filter((n) => n.type !== 'exit')
  // Re-keying on the outcome replays the brief "updated" animation whenever the route changes.
  const outcomeKey = route.status === 'ok' ? `${route.path.join('>')}|${route.cost}` : route.status

  return (
    <section className="card route-card">
      <h2>{t('panel.route')}</h2>

      <label className="field">
        <span>{t('panel.start')}</span>
        <div className="row">
          <select value={start ?? ''} onChange={(e) => onStart(e.target.value || null)}>
            <option value="">{t('panel.startPlaceholder')}</option>
            {starts.map((n) => {
              const blocked = hazards.blocked_nodes.includes(n.id)
              return (
                <option key={n.id} value={n.id} disabled={blocked && n.id !== start}>
                  {n.id} · {n.label}
                  {blocked ? ` (${t('state.blocked')})` : ''}
                </option>
              )
            })}
          </select>
          {start && <button className="btn small" onClick={() => onStart(null)}>{t('btn.clearStart')}</button>}
        </div>
      </label>

      <div key={outcomeKey} className={`status status-${route.status}`} role="status" aria-live="polite">
        {route.status === 'ok' ? (
          <>
            <div className="status-title">{t('status.ok')}</div>
            <dl className="stats">
              <div>
                <dt>{t('route.exit')}</dt>
                <dd>{route.exit} <small>{labelOf(route.exit)}</small></dd>
              </div>
              <div>
                <dt>{t('route.cost')}</dt>
                <dd className="big">{formatNum(route.cost, lang)}</dd>
              </div>
            </dl>
            <div className="seq-title">
              {t('route.sequence')} <span className="muted">({t('route.corridors', { n: route.steps.length })})</span>
            </div>
            <ol className="seq" aria-label={t('route.sequence')}>
              {route.path.map((id, i) => (
                <li key={`${i}-${id}`} style={{ animationDelay: `${i * 40}ms` }} title={labelOf(id)}>{id}</li>
              ))}
            </ol>
            <p className="seq-text">{route.path.join(' → ')}</p>
          </>
        ) : (
          <>
            <div className="status-title">
              {t(route.status === 'no-start' ? 'status.noStart' : route.status === 'no-route' ? 'status.noRoute' : 'status.startBlocked')}
            </div>
            <p>
              {t(route.status === 'no-start' ? 'status.noStartHint' : route.status === 'no-route' ? 'status.noRouteHint' : 'status.startBlockedHint')}
            </p>
          </>
        )}
      </div>

      {route.status === 'ok' && (
        <>
          <details className="sub" open>
            <summary>{t('route.walkthrough')}</summary>
            <ol className="steps">
              {route.steps.map((s, i) => (
                <li key={i}>
                  {t('route.step', { from: `${s.from} (${labelOf(s.from)})`, to: `${s.to} (${labelOf(s.to)})`, edge: s.edgeId, cost: s.cost })}
                </li>
              ))}
            </ol>
          </details>
          <details className="sub">
            <summary>{t('route.otherExits')}</summary>
            {route.otherExits.length ? (
              <ul className="alts">
                {route.otherExits.map((a) => (
                  <li key={a.exit}>
                    <strong>{a.exit}</strong> · {t('route.cost')} {formatNum(a.cost, lang)}
                    <div className="muted">{a.path.join(' → ')}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">{t('route.noAlternatives')}</p>
            )}
          </details>
        </>
      )}
    </section>
  )
}
