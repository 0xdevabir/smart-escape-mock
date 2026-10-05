import type { Building, Hazards, RankedRoute, RouteResult } from '../lib/types'
import { formatNum, type Lang } from '../lib/i18n'
import { Select } from './Select'

export type Change = { kind: 'delta'; from: number; to: number } | { kind: 'lost'; from: number } | null

interface Props {
  building: Building
  hazards: Hazards
  route: RouteResult
  ranked: RankedRoute[]
  regions: { nodes: string[]; exits: string[] }[]
  trapped: string[]
  change: Change
  start: string | null
  walkIndex: number | null
  lang: Lang
  t: (k: string, p?: Record<string, string | number>) => string
  onStart: (id: string | null) => void
  onPlay: () => void
  onPreview: (path: string[]) => void
}

export function ChangeBadge({ change, lang, t }: { change: Change; lang: Lang; t: Props['t'] }) {
  if (!change) return null
  if (change.kind === 'lost') return <span className="badge-change lost">{t('change.lost', { from: change.from })}</span>
  const up = change.to > change.from
  return (
    <span className={`badge-change ${up ? 'up' : 'down'}`} title={t('change.title')}>
      {formatNum(change.from, lang)} → {formatNum(change.to, lang)} ({up ? '+' : '−'}{formatNum(Math.abs(change.to - change.from), lang)})
    </span>
  )
}

export function RoutePanel(p: Props) {
  const { building, hazards, route, ranked, regions, trapped, change, start, walkIndex, lang, t, onStart, onPlay, onPreview } = p
  const labelOf = (id: string) => building.nodes.find((n) => n.id === id)?.label ?? id
  const starts = building.nodes.filter((n) => n.type !== 'exit')
  const list = (ids: string[]) => ids.join(', ')
  // Re-keying on the outcome replays the brief "updated" animation whenever the route changes.
  const outcomeKey = route.status === 'ok' ? `${route.path.join('>')}|${route.cost}` : route.status
  const myRegion = start ? regions.find((r) => r.nodes.includes(start)) : undefined
  const escapeRegions = regions.filter((r) => r.exits.length)
  const preview = (path: string[]) => ({
    onMouseEnter: () => onPreview(path),
    onMouseLeave: () => onPreview([]),
    onFocus: () => onPreview(path),
    onBlur: () => onPreview([]),
  })

  return (
    <section className="card route-card">
      <h2>{t('panel.route')}</h2>

      <label className="field">
        <span>{t('panel.start')}</span>
        <div className="row">
          <Select
            value={start ?? ''}
            placeholder={t('panel.startPlaceholder')}
            ariaLabel={t('panel.start')}
            onChange={(v) => onStart(v || null)}
            options={starts.map((n) => {
              const blocked = hazards.blocked_nodes.includes(n.id)
              return {
                value: n.id,
                label: `${n.id} · ${n.label}`,
                disabled: blocked && n.id !== start,
                hint: blocked ? t('state.blocked') : undefined,
              }
            })}
          />
          {start && <button className="btn small" onClick={() => onStart(null)}>{t('btn.clearStart')}</button>}
        </div>
      </label>

      <div key={outcomeKey} className={`status status-${route.status}`} role="status" aria-live="polite">
        {route.status === 'ok' ? (
          <>
            <div className="status-title">
              {t('status.ok')} <ChangeBadge change={change} lang={lang} t={t} />
            </div>
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
                <li key={`${i}-${id}`} className={walkIndex === i ? 'is-now' : undefined} style={{ animationDelay: `${i * 40}ms` }} title={labelOf(id)}>
                  {id}
                </li>
              ))}
            </ol>
            <p className="seq-text">{route.path.join(' → ')}</p>
            <div className="breakdown" aria-label={t('why.sum')}>
              {route.steps.map((s, i) => (
                <span key={i}>
                  {i > 0 && <span className="op">+</span>}
                  <span className="chip" title={`${s.edgeId}: ${s.from}–${s.to}`}>{formatNum(s.cost, lang)}</span>
                </span>
              ))}
              <span className="op">=</span>
              <span className="chip total">{formatNum(route.cost, lang)}</span>
            </div>
            <button className="btn small play" onClick={onPlay} aria-pressed={walkIndex !== null}>
              {walkIndex !== null ? t('btn.stop') : t('btn.play')}
            </button>
          </>
        ) : (
          <>
            <div className="status-title">
              {t(route.status === 'no-start' ? 'status.noStart' : route.status === 'no-route' ? 'status.noRoute' : 'status.startBlocked')}{' '}
              <ChangeBadge change={change} lang={lang} t={t} />
            </div>
            <p>
              {t(route.status === 'no-start' ? 'status.noStartHint' : route.status === 'no-route' ? 'status.noRouteHint' : 'status.startBlockedHint')}
            </p>
            {route.status === 'no-route' && myRegion && (
              <div className="escape">
                <p>{t('escape.mine', { nodes: list(myRegion.nodes) })}</p>
                {escapeRegions.length ? (
                  <ul>
                    {escapeRegions.map((r) => (
                      <li key={r.nodes.join()}>{t('escape.region', { nodes: list(r.nodes), exits: list(r.exits) })}</li>
                    ))}
                  </ul>
                ) : (
                  <p>{t('escape.none')}</p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {trapped.length > 0 && route.status !== 'no-route' && (
        <p className="trapped-note">{t('trapped.note', { nodes: list(trapped) })}</p>
      )}

      {route.status === 'ok' && (
        <>
          <details className="sub why">
            <summary>{t('why.title')}</summary>
            <p>
              <strong>{t('why.sum')}:</strong>{' '}
              {route.steps.map((s) => `${s.edgeId} (${formatNum(s.cost, lang)})`).join(' + ')} = {formatNum(route.cost, lang)}
            </p>
            <p>
              <strong>{t('why.exitRule')}:</strong>{' '}
              {route.tiedExits.length > 1
                ? t('why.exitTie', { exits: list(route.tiedExits), cost: route.cost, exit: route.exit })
                : route.otherExits.length
                  ? t('why.exitCheapest', { exit: route.exit, next: route.otherExits[0].exit, cost: route.otherExits[0].cost })
                  : t('why.exitOnly', { exit: route.exit })}
            </p>
            <p>
              <strong>{t('why.pathRule')}:</strong>{' '}
              {route.tiedPathCount > 1
                ? t('why.pathTie', { n: route.tiedPathCount, exit: route.exit, cost: route.cost })
                : t('why.pathUnique', { exit: route.exit })}
            </p>
            {route.tiedPathCount > 1 && (
              <ol className="tied">
                {route.tiedPaths.map((tp, i) => (
                  <li key={tp.join()} className={i === 0 ? 'chosen' : undefined} tabIndex={0} {...preview(tp)}>
                    {tp.join(' → ')} {i === 0 && <span className="pill">{t('why.chosen')}</span>}
                  </li>
                ))}
                {route.tiedPathCount > route.tiedPaths.length && (
                  <li className="muted">{t('why.more', { n: route.tiedPathCount - route.tiedPaths.length })}</li>
                )}
              </ol>
            )}
          </details>

          <details className="sub" open>
            <summary>{t('route.walkthrough')}</summary>
            <ol className="steps">
              {route.steps.map((s, i) => (
                <li key={i} className={walkIndex === i + 1 ? 'is-now' : undefined}>
                  {t('route.step', { from: `${s.from} (${labelOf(s.from)})`, to: `${s.to} (${labelOf(s.to)})`, edge: s.edgeId, cost: s.cost })}
                </li>
              ))}
            </ol>
          </details>

          <details className="sub">
            <summary>{t('route.ranked')}</summary>
            <ol className="alts">
              {ranked.map((a, i) => (
                <li key={a.path.join()} tabIndex={0} {...preview(a.path)}>
                  <strong>#{formatNum(i + 1, lang)}</strong> · {a.exit} · {t('route.cost')} {formatNum(a.cost, lang)}
                  {i > 0 && <span className="muted"> (+{formatNum(a.cost - route.cost, lang)})</span>}
                  <div className="muted">{a.path.join(' → ')}</div>
                </li>
              ))}
            </ol>
            {ranked.length < 2 && <p className="muted">{t('route.noRanked')}</p>}
          </details>

          <details className="sub">
            <summary>{t('route.alternatives')}</summary>
            {route.otherExits.length ? (
              <ul className="alts">
                {route.otherExits.map((a) => (
                  <li key={a.exit} tabIndex={0} {...preview(a.path)}>
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

