import type { ReactNode } from 'react'
import type { BEdge, BNode, Building, Hazards } from '../lib/types'
import { formatNum, type Lang } from '../lib/i18n'

interface Props {
  building: Building
  hazards: Hazards
  lang: Lang
  t: (k: string, p?: Record<string, string | number>) => string
  onNode: (n: BNode) => void
  onEdge: (e: BEdge) => void
}

/** Keyboard-friendly list controls mirroring the map's click-to-toggle behaviour. */
export function HazardPanel({ building, hazards, lang, t, onNode, onEdge }: Props) {
  const locations = building.nodes.filter((n) => n.type !== 'exit')
  const exits = building.nodes.filter((n) => n.type === 'exit')

  return (
    <section className="card hazard-card">
      <h2>{t('panel.hazards')}</h2>

      <Group title={t('panel.locations')} count={hazards.blocked_nodes.length} t={t}>
        {locations.map((n) => {
          const on = hazards.blocked_nodes.includes(n.id)
          return (
            <Toggle key={n.id} on={on} onChange={() => onNode(n)} label={`${n.id} · ${n.label}`}
              state={on ? t('state.blocked') : t(`type.${n.type}`)} kind="block" />
          )
        })}
      </Group>

      <Group title={t('panel.corridors')} count={hazards.blocked_edges.length} t={t}>
        {building.edges.map((e) => {
          const on = hazards.blocked_edges.includes(e.id)
          return (
            <Toggle key={e.id} on={on} onChange={() => onEdge(e)}
              label={`${e.id} · ${e.from}–${e.to} (${formatNum(e.cost, lang)})`}
              state={on ? t('state.blocked') : t('state.open')} kind="block" />
          )
        })}
      </Group>

      <Group title={t('panel.exits')} count={hazards.closed_exits.length} t={t}>
        {exits.map((n) => {
          const on = hazards.closed_exits.includes(n.id)
          return (
            <Toggle key={n.id} on={on} onChange={() => onNode(n)} label={`${n.id} · ${n.label}`}
              state={on ? t('state.closed') : t('state.open')} kind="close" />
          )
        })}
      </Group>
    </section>
  )
}

function Group({ title, count, t, children }: { title: string; count: number; t: Props['t']; children: ReactNode }) {
  return (
    <details className="sub" open>
      <summary>
        {title}
        {count > 0 && <span className="badge">{t('panel.active', { n: count })}</span>}
      </summary>
      <ul className="toggles">{children}</ul>
    </details>
  )
}

function Toggle({ on, onChange, label, state, kind }: { on: boolean; onChange: () => void; label: string; state: string; kind: 'block' | 'close' }) {
  return (
    <li>
      <label className={`toggle ${on ? `is-${kind}` : ''}`}>
        <input type="checkbox" checked={on} onChange={onChange} />
        <span className="switch" aria-hidden="true" />
        <span className="toggle-label">{label}</span>
        <span className="toggle-state">{state}</span>
      </label>
    </li>
  )
}
