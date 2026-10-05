import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { FocusEvent, KeyboardEvent, PointerEvent, ReactNode } from 'react'
import type { BEdge, BNode, Building, Hazards, Step } from '../lib/types'
import { formatNum, type Lang } from '../lib/i18n'
import { FIT, MAX_ZOOM, zoomBy, type View } from '../lib/view'

interface Props {
  building: Building
  hazards: Hazards
  start: string | null
  routePath: string[]
  steps: Step[]
  ghostPath: string[]
  previewPath: string[]
  walkIndex: number | null
  trapped: Set<string>
  distances: Map<string, number> | null
  mode: 'start' | 'hazard'
  view: View
  lang: Lang
  t: (k: string, p?: Record<string, string | number>) => string
  onView: (v: View) => void
  onNode: (n: BNode) => void
  onEdge: (e: BEdge) => void
  children?: ReactNode
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

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

type Tip = { x: number; y: number; lines: string[] }

const ZOOM_MS = 260
const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Eases from the displayed view to the target one; snaps while dragging or with reduced motion. */
function useTweenedView(target: View, drag: { current: unknown }) {
  const [shown, setShown] = useState(target)
  const cur = useRef(target)
  useEffect(() => {
    const from = cur.current
    if (from.k === target.k && from.cx === target.cx && from.cy === target.cy) return
    if (drag.current || reducedMotion()) {
      cur.current = target
      setShown(target)
      return
    }
    const t0 = performance.now()
    let raf = 0
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / ZOOM_MS)
      const e = 1 - (1 - p) ** 3
      const v = { k: from.k + (target.k - from.k) * e, cx: from.cx + (target.cx - from.cx) * e, cy: from.cy + (target.cy - from.cy) * e }
      cur.current = p === 1 ? target : v
      setShown(cur.current)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, drag])
  return shown
}

export const MapView = forwardRef<SVGSVGElement, Props>(function MapView(
  { building, hazards, start, routePath, steps, ghostPath, previewPath, walkIndex, trapped, distances, mode, view, lang, t,
    onView, onNode, onEdge, children }, ref,
) {
  const { pos, width, height } = useLayout(building.nodes)
  const wrapRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; view: View; moved: boolean } | null>(null)
  const [tip, setTip] = useState<Tip | null>(null)
  const tipRef = useRef<HTMLDivElement>(null)

  // Keep the tooltip fully inside the map frame: clamp horizontally, and flip below the pointer near the top edge.
  // Written straight to the DOM so following the pointer never re-renders the map.
  const positionTip = (x: number, y: number) => {
    const el = tipRef.current, wrap = wrapRef.current
    if (!el || !wrap) return
    const m = 8, gap = 14
    const w = el.offsetWidth, h = el.offsetHeight
    const left = Math.max(m, Math.min(x - w / 2, wrap.clientWidth - w - m))
    const above = y - h - gap
    const top = above >= m ? above : Math.max(m, Math.min(y + gap + 6, wrap.clientHeight - h - m))
    el.style.transform = `translate3d(${left}px, ${top}px, 0)`
  }
  useLayoutEffect(() => {
    if (tip) positionTip(tip.x, tip.y)
  }, [tip])

  // Zoom changes glide to the new viewBox instead of jumping; dragging stays 1:1 with the pointer.
  const shown = useTweenedView(view, drag)

  const blockedNodes = new Set(hazards.blocked_nodes)
  const closedExits = new Set(hazards.closed_exits)
  const blockedEdges = new Set(hazards.blocked_edges)
  const onRouteNodes = new Set(routePath)
  const onRouteEdges = new Set(steps.map((s) => s.edgeId))
  const stepEdge = walkIndex ? steps[walkIndex - 1]?.edgeId : undefined
  const routeKey = routePath.join('>')
  const dead = (id: string) => blockedNodes.has(id) || closedExits.has(id)
  const degree = useMemo(() => {
    const d = new Map<string, number>()
    for (const e of building.edges) for (const id of [e.from, e.to]) d.set(id, (d.get(id) ?? 0) + 1)
    return d
  }, [building])

  // Current viewBox derived from the zoom level, clamped so the map never leaves the frame.
  const vw = width / shown.k, vh = height / shown.k
  const vx = clamp(shown.cx * width - vw / 2, 0, width - vw)
  const vy = clamp(shown.cy * height - vh / 2, 0, height - vh)

  // Ctrl/⌘ + wheel (and trackpad pinch, which the browser reports the same way) zooms; a plain wheel still scrolls the page.
  const viewRef = useRef(view)
  useEffect(() => {
    viewRef.current = view
  }, [view])
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      onView(zoomBy(viewRef.current, e.deltaY < 0 ? 1.15 : 1 / 1.15))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [onView])

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (view.k === 1 || !(e.target as Element).classList.contains('map-bg')) return
    drag.current = { x: e.clientX, y: e.clientY, view, moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const d = drag.current
    if (!d) return
    const scale = vw / e.currentTarget.getBoundingClientRect().width
    d.moved = true
    onView({
      ...d.view,
      cx: clamp(d.view.cx - ((e.clientX - d.x) * scale) / width, 0, 1),
      cy: clamp(d.view.cy - ((e.clientY - d.y) * scale) / height, 0, 1),
    })
  }
  const endDrag = () => { drag.current = null }

  const showTip = (lines: string[]) => ({
    onPointerEnter: (e: PointerEvent) => place(e.clientX, e.clientY, lines),
    onPointerMove: (e: PointerEvent) => {
      const r = wrapRef.current?.getBoundingClientRect()
      if (tipRef.current && r) positionTip(e.clientX - r.left, e.clientY - r.top)
      else place(e.clientX, e.clientY, lines)
    },
    onPointerLeave: () => setTip(null),
    onFocus: (e: FocusEvent) => {
      const r = e.currentTarget.getBoundingClientRect()
      place(r.left + r.width / 2, r.top, lines)
    },
    onBlur: () => setTip(null),
  })
  const place = (clientX: number, clientY: number, lines: string[]) => {
    const r = wrapRef.current?.getBoundingClientRect()
    if (r) setTip({ x: clientX - r.left, y: clientY - r.top, lines })
  }

  const nodeState = (n: BNode) =>
    blockedNodes.has(n.id) ? t('state.blocked') : closedExits.has(n.id) ? t('state.closed')
      : trapped.has(n.id) ? t('state.trapped') : t('state.open')
  const distLine = (id: string) => {
    if (!start || !distances || id === start) return null
    const d = distances.get(id)
    return d === undefined ? t('tip.unreachable') : t('tip.distance', { d })
  }

  const line = (path: string[]) => path.map((id) => `${pos.get(id)!.x},${pos.get(id)!.y}`).join(' ')
  const walker = walkIndex !== null ? pos.get(routePath[walkIndex]) : undefined

  return (
    <div className="map-wrap" ref={wrapRef}>
      <svg
        ref={ref}
        className={`map mode-${mode}${view.k > 1 ? ' is-zoomed' : ''}`}
        viewBox={`${vx} ${vy} ${vw} ${vh}`}
        data-full={`${width} ${height}`}
        role="group"
        aria-label={building.building}
        xmlns="http://www.w3.org/2000/svg"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <defs>
          <pattern id="map-dots" width={24} height={24} patternUnits="userSpaceOnUse">
            <circle className="map-dot" cx={12} cy={12} r={1.3} />
          </pattern>
        </defs>
        <rect className="map-bg" x={0} y={0} width={width} height={height} />
        <rect className="map-dots" x={0} y={0} width={width} height={height} fill="url(#map-dots)" />

        {/* Corridors */}
        <g>
          {building.edges.map((e) => {
            const a = pos.get(e.from)!, b = pos.get(e.to)!
            const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
            const blocked = blockedEdges.has(e.id)
            const unusable = !blocked && (dead(e.from) || dead(e.to))
            const cls = ['edge', blocked && 'is-blocked', unusable && 'is-unusable', onRouteEdges.has(e.id) && 'is-route',
              stepEdge === e.id && 'is-step'].filter(Boolean).join(' ')
            const label = `${e.id}: ${e.from}–${e.to}, ${formatNum(e.cost, lang)}. ${t(blocked ? 'act.unblock' : 'act.block', { id: e.id })}`
            const interactive = mode === 'hazard'
            const tipLines = [
              `${e.id} · ${e.from} – ${e.to}`,
              `${t('tip.cost')}: ${formatNum(e.cost, lang)}`,
              `${t('tip.state')}: ${blocked ? t('state.blocked') : unusable ? t('state.unusable') : t('state.open')}`,
              ...(interactive ? [t(blocked ? 'act.unblock' : 'act.block', { id: e.id })] : []),
            ]
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
                {...showTip(tipLines)}
              >
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

        {/* Previous route, faded, so the change is visible at a glance */}
        {ghostPath.length > 1 && ghostPath.join('>') !== routeKey && (
          <polyline key={`ghost-${ghostPath.join('>')}`} className="ghost-line" points={line(ghostPath)} />
        )}

        {/* Highlighted route, drawn on top of corridors; re-keyed so the draw animation replays on change */}
        {routePath.length > 1 && <polyline key={routeKey} className="route-line" pathLength={1} points={line(routePath)} />}
        {/* Dots flowing from the start towards the exit, so the direction of travel is obvious */}
        {routePath.length > 1 && <polyline key={`flow-${routeKey}`} className="route-flow" points={line(routePath)} />}

        {previewPath.length > 1 && <polyline className="preview-line" points={line(previewPath)} />}

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
              onRouteNodes.has(n.id) && 'is-route', isStart && 'is-start', trapped.has(n.id) && 'is-trapped']
              .filter(Boolean).join(' ')
            const stateText = blocked ? t('state.blocked') : closed ? t('state.closed') : isStart ? t('state.start') : ''
            const action = mode === 'start'
              ? (n.type === 'exit' ? '' : t('mode.start'))
              : n.type === 'exit'
                ? t(closed ? 'act.reopen' : 'act.close', { id: n.id })
                : t(blocked ? 'act.unblock' : 'act.block', { id: n.id })
            const label = `${n.id}, ${n.label}, ${t(`type.${n.type}`)}${stateText ? `, ${stateText}` : ''}${action ? `. ${action}` : ''}`
            const interactive = !(mode === 'start' && n.type === 'exit')
            const dl = distLine(n.id)
            const tipLines = [
              `${n.id} · ${n.label}`,
              `${t('tip.type')}: ${t(`type.${n.type}`)} · ${t('tip.degree')}: ${formatNum(degree.get(n.id) ?? 0, lang)}`,
              `${t('tip.state')}: ${nodeState(n)}${isStart ? ` · ${t('state.start')}` : ''}`,
              ...(dl ? [dl] : []),
              ...(action ? [action] : []),
            ]
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
                {...showTip(tipLines)}
              >
                {isStart && <circle key={`pulse-${start}`} className="start-pulse" r={R + 6} />}
                {trapped.has(n.id) && <circle className="trap-ring" r={R + 7} />}
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

        {walker && (
          <g className="walker" style={{ transform: `translate(${walker.x}px, ${walker.y}px)` }} aria-hidden="true">
            <circle r={11} />
          </g>
        )}
      </svg>

      {children}

      <div className="zoom" role="group" aria-label={t('zoom.label')} onPointerEnter={() => setTip(null)}>
        <button className="btn icon" onClick={() => onView(zoomBy(view, 1.4))} disabled={view.k >= MAX_ZOOM} aria-label={t('zoom.in')} title={t('zoom.in')}>+</button>
        <button className="btn icon" onClick={() => onView(zoomBy(view, 1 / 1.4))} disabled={view.k <= 1} aria-label={t('zoom.out')} title={t('zoom.out')}>−</button>
        <button className="btn icon" onClick={() => onView(FIT)} disabled={view.k === 1} aria-label={t('zoom.fit')} title={t('zoom.fit')}>⤢</button>
      </div>

      {tip && (
        <div ref={tipRef} className="tip" role="tooltip">
          {tip.lines.map((l, i) => <div key={i} className={i === 0 ? 'tip-head' : undefined}>{l}</div>)}
        </div>
      )}
    </div>
  )
})
