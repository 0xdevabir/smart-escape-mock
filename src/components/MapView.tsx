import { forwardRef, useMemo } from 'react'
import type { KeyboardEvent } from 'react'
import type { BEdge, BNode, Building, Hazards } from '../lib/types'
import { formatNum, type Lang } from '../lib/i18n'

interface Props {
  building: Building
  hazards: Hazards
  start: string | null
  routePath: string[]
  routeEdges: string[]
  mode: 'start' | 'hazard'
  lang: Lang
  t: (k: string, p?: Record<string, string | number>) => string
  onNode: (n: BNode) => void
  onEdge: (e: BEdge) => void
}

const PAD = 70
const SPAN = 860
const R = 22

/** Fit the supplied display coordinates into a fixed-size SVG space while keeping their aspect ratio. */
function useLayout(nodes: BNode[]) {
  return useMemo(() => {
    const xs = nodes.map((n) => n.x)
    const ys = nodes.map((n) => n.y)
    const minX = Math.min(...xs), minY = Math.min(...ys)
    const dx = Math.max(...xs) - minX, dy = Math.max(...ys) - minY
    const s = SPAN / Math.max(dx, dy, 1)
    const pos = new Map(nodes.map((n) => [n.id, { x: PAD + (n.x - minX) * s, y: PAD + (n.y - minY) * s }]))
    return { pos, width: dx * s + PAD * 2, height: dy * s + PAD * 2 + 16 }
  }, [nodes])
}

const activate = (fn: () => void) => (e: KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn() }
}

export const MapView = forwardRef<SVGSVGElement, Props>(function MapView(
  { building, hazards, start, routePath, routeEdges, mode, lang, t, onNode, onEdge }, ref,
) {
  const { pos, width, height } = useLayout(building.nodes)
  const blockedNodes = new Set(hazards.blocked_nodes)
  const closedExits = new Set(hazards.closed_exits)
  const blockedEdges = new Set(hazards.blocked_edges)
  const onRouteNodes = new Set(routePath)
  const onRouteEdges = new Set(routeEdges)
  const routeKey = routePath.join('>')
  const dead = (id: string) => blockedNodes.has(id) || closedExits.has(id)

  return (
    <svg
      ref={ref}
      className={`map mode-${mode}`}
      viewBox={`0 0 ${width} ${height}`}
      role="group"
      aria-label={building.building}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect className="map-bg" x={0} y={0} width={width} height={height} />

      {/* Corridors */}
      <g>
        {building.edges.map((e) => {
          const a = pos.get(e.from)!, b = pos.get(e.to)!
          const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
          const blocked = blockedEdges.has(e.id)
          const unusable = !blocked && (dead(e.from) || dead(e.to))
          const cls = ['edge', blocked && 'is-blocked', unusable && 'is-unusable', onRouteEdges.has(e.id) && 'is-route']
            .filter(Boolean).join(' ')
          const label = `${e.id}: ${e.from}–${e.to}, ${formatNum(e.cost, lang)}. ${t(blocked ? 'act.unblock' : 'act.block', { id: e.id })}`
          const interactive = mode === 'hazard'
          return (
            <g
              key={e.id}
              className={cls}
              onClick={interactive ? () => onEdge(e) : undefined}
              onKeyDown={interactive ? activate(() => onEdge(e)) : undefined}
              tabIndex={interactive ? 0 : -1}
              role={interactive ? 'button' : undefined}
              aria-label={label}
              aria-pressed={interactive ? blocked : undefined}
            >
              <title>{label}</title>
              <line className="edge-hit" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
              <line className="edge-line" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
              {blocked && (
                <g className="edge-x" transform={`translate(${mx} ${my - 20})`}>
                  <line x1={-5} y1={-5} x2={5} y2={5} />
                  <line x1={-5} y1={5} x2={5} y2={-5} />
                </g>
              )}
            </g>
          )
        })}
      </g>

      {/* Highlighted route, drawn on top of corridors; re-keyed so the draw animation replays on change */}
      {routePath.length > 1 && (
        <polyline
          key={routeKey}
          className="route-line"
          pathLength={1}
          points={routePath.map((id) => `${pos.get(id)!.x},${pos.get(id)!.y}`).join(' ')}
        />
      )}

      {/* Corridor costs sit above the route so they stay readable */}
      <g aria-hidden="true">
        {building.edges.map((e) => {
          const a = pos.get(e.from)!, b = pos.get(e.to)!
          const cls = ['cost', blockedEdges.has(e.id) && 'is-blocked', onRouteEdges.has(e.id) && 'is-route',
            mode === 'hazard' && 'is-clickable'].filter(Boolean).join(' ')
          const w = 16 + String(e.cost).length * 8
          return (
            <g key={e.id} className={cls} transform={`translate(${(a.x + b.x) / 2} ${(a.y + b.y) / 2})`}
              onClick={mode === 'hazard' ? () => onEdge(e) : undefined}>
              <rect x={-w / 2} y={-10} width={w} height={20} rx={10} />
              <text dy="0.35em">{formatNum(e.cost, lang)}</text>
            </g>
          )
        })}
      </g>

      {/* Locations */}
      <g>
        {building.nodes.map((n) => {
          const p = pos.get(n.id)!
          const blocked = blockedNodes.has(n.id)
          const closed = closedExits.has(n.id)
          const isStart = n.id === start
          const cls = ['node', `type-${n.type}`, blocked && 'is-blocked', closed && 'is-closed',
            onRouteNodes.has(n.id) && 'is-route', isStart && 'is-start'].filter(Boolean).join(' ')
          const stateText = blocked ? t('state.blocked') : closed ? t('state.closed') : isStart ? t('state.start') : ''
          const action = mode === 'start'
            ? (n.type === 'exit' ? '' : t('mode.start'))
            : n.type === 'exit'
              ? t(closed ? 'act.reopen' : 'act.close', { id: n.id })
              : t(blocked ? 'act.unblock' : 'act.block', { id: n.id })
          const label = `${n.id}, ${n.label}, ${t(`type.${n.type}`)}${stateText ? `, ${stateText}` : ''}${action ? `. ${action}` : ''}`
          const interactive = !(mode === 'start' && n.type === 'exit')
          return (
            <g
              key={n.id}
              className={cls}
              transform={`translate(${p.x} ${p.y})`}
              onClick={() => onNode(n)}
              onKeyDown={interactive ? activate(() => onNode(n)) : undefined}
              tabIndex={interactive ? 0 : -1}
              role="button"
              aria-label={label}
            >
              <title>{label}</title>
              {isStart && <circle key={`pulse-${start}`} className="start-pulse" r={R + 6} />}
              <g className="node-body">
                {n.type === 'room' && <circle className="shape" r={R} />}
                {n.type === 'junction' && <rect className="shape" x={-17} y={-17} width={34} height={34} rx={4} transform="rotate(45)" />}
                {n.type === 'exit' && <rect className="shape" x={-R - 2} y={-R + 2} width={(R + 2) * 2} height={(R - 2) * 2} rx={9} />}
                <text className="node-id" dy="0.35em">{n.id}</text>
              </g>
              {(blocked || closed) && (
                <g className="node-x">
                  <line x1={-R + 4} y1={-R + 4} x2={R - 4} y2={R - 4} />
                  <line x1={-R + 4} y1={R - 4} x2={R - 4} y2={-R + 4} />
                </g>
              )}
              <text className="node-label" y={R + 18}>{n.label}</text>
            </g>
          )
        })}
      </g>
    </svg>
  )
})
