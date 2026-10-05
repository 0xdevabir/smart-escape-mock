import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { MapView } from './components/MapView'
import { ChangeBadge, RoutePanel, type Change } from './components/RoutePanel'
import { HazardPanel } from './components/HazardPanel'
import { HelpDialog } from './components/HelpDialog'
import { SelfCheck } from './components/SelfCheck'
import { SplashIntro } from './components/SplashIntro'
import { exportSvgAsPng } from './lib/exportPng'
import { formatNum, translate, type Lang } from './lib/i18n'
import { computeRoute, rankedRoutes, regions as findRegions, trappedNodes } from './lib/route'
import { isSampleGraph, runScenario, sameHazards, SCENARIOS, type Scenario } from './lib/selfCheck'
import type { BEdge, BNode, Building, Hazards } from './lib/types'
import { FIT, zoomBy, type View } from './lib/view'
import { parseBuildingText, validateBuilding, type ValidationError } from './lib/validate'

const STORE_KEY = 'smart-escape:v1'
const SAMPLE_URL = `${import.meta.env.BASE_URL}building.json`
const MAX_ERRORS = 12
const MAX_HISTORY = 100
const WALK_MS = 650
const DEMO_MS = 1800

interface Saved {
  building: Building
  hazards: Hazards
  start: string | null
  lang: Lang
  contrast: boolean
}

type Toast = { key: string; params?: Record<string, string | number>; id: number }

const MAX_FILE_BYTES = 2 * 1024 * 1024

const EMPTY: Hazards = { blocked_nodes: [], blocked_edges: [], closed_exits: [] }
const cloneHazards = (h: Hazards): Hazards => ({
  blocked_nodes: [...h.blocked_nodes],
  blocked_edges: [...h.blocked_edges],
  closed_exits: [...h.closed_exits],
})
const toggle = (arr: string[], id: string) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id])

function loadSaved(): Partial<Saved> | null {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as Partial<Saved>
    // Never trust storage blindly: re-validate the building and drop stale hazard IDs.
    const v = s.building ? validateBuilding(s.building) : null
    if (!v?.ok) return { lang: s.lang, contrast: s.contrast }
    const b = v.data
    const typeOf = (id: string) => b.nodes.find((n) => n.id === id)?.type
    const edgeIds = new Set(b.edges.map((e) => e.id))
    const h = s.hazards
    const hazards: Hazards =
      h && Array.isArray(h.blocked_nodes) && Array.isArray(h.blocked_edges) && Array.isArray(h.closed_exits)
        ? {
            blocked_nodes: h.blocked_nodes.filter((id) => typeOf(id) === 'room' || typeOf(id) === 'junction'),
            blocked_edges: h.blocked_edges.filter((id) => edgeIds.has(id)),
            closed_exits: h.closed_exits.filter((id) => typeOf(id) === 'exit'),
          }
        : cloneHazards(b.initial_state)
    const st = s.start && (typeOf(s.start) === 'room' || typeOf(s.start) === 'junction') ? s.start : null
    return { building: b, hazards, start: st, lang: s.lang, contrast: s.contrast }
  } catch {
    return null
  }
}

/** Typing in a form control must never trigger a single-letter shortcut. */
const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName))

export default function App() {
  const [saved] = useState(loadSaved)
  const [lang, setLang] = useState<Lang>(saved?.lang === 'bn' ? 'bn' : 'en')
  const [contrast, setContrast] = useState(!!saved?.contrast)
  const [building, setBuilding] = useState<Building | null>(saved?.building ?? null)
  const [hazards, setHazards] = useState<Hazards>(saved?.hazards ?? EMPTY)
  const [past, setPast] = useState<Hazards[]>([])
  const [future, setFuture] = useState<Hazards[]>([])
  const [start, setStart] = useState<string | null>(saved?.start ?? null)
  const [mode, setMode] = useState<'start' | 'hazard'>('start')
  const [errors, setErrors] = useState<ValidationError[] | null>(null)
  const [toast, setToast] = useState<Toast | null>(saved?.building ? { key: 'msg.restored', id: 0 } : null)
  const [dragging, setDragging] = useState(false)
  const [ghost, setGhost] = useState<{ path: string[]; cost: number } | null>(null)
  const [walk, setWalk] = useState<{ key: string; i: number } | null>(null)
  const [preview, setPreview] = useState<string[]>([])
  const [view, setView] = useState<View>(FIT)
  const [help, setHelp] = useState(false)
  const [splash, setSplash] = useState(true)
  const [demo, setDemo] = useState<number | null>(null)
  const [seen, setSeen] = useState<Set<string>>(() => new Set())
  const fileRef = useRef<HTMLInputElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(lang, key, params),
    [lang],
  )
  const notify = (key: string, params?: Toast['params']) => setToast({ key, params, id: Date.now() })

  // Everything below is recomputed synchronously on every start or hazard change.
  const route = useMemo(
    () => (building ? computeRoute(building, hazards, start) : ({ status: 'no-start' } as const)),
    [building, hazards, start],
  )
  const ranked = useMemo(
    () => (building && start && route.status === 'ok' ? rankedRoutes(building, hazards, start, 3) : []),
    [building, hazards, start, route.status],
  )
  const trapped = useMemo(() => (building ? trappedNodes(building, hazards) : []), [building, hazards])
  const trappedSet = useMemo(() => new Set(trapped), [trapped])
  const regions = useMemo(() => (building ? findRegions(building, hazards) : []), [building, hazards])
  const sampleGraph = useMemo(() => !!building && isSampleGraph(building), [building])

  const routeKey = route.status === 'ok' ? route.path.join('>') : ''
  const walkIndex = walk && walk.key === routeKey ? walk.i : null
  const change: Change = !ghost
    ? null
    : route.status === 'ok'
      ? route.cost !== ghost.cost ? { kind: 'delta', from: ghost.cost, to: route.cost } : null
      : route.status === 'no-start' ? null : { kind: 'lost', from: ghost.cost }

  // Judge mode auto-tick: mark a sample check as seen once the live state reproduces it with the expected result.
  if (sampleGraph && building && start) {
    const hit = SCENARIOS.find((s) => s.start === start && sameHazards(s.hazards, hazards) && runScenario(building, s).pass)
    if (hit && !seen.has(hit.id)) setSeen(new Set(seen).add(hit.id))
  }

  useEffect(() => {
    document.documentElement.lang = lang
    document.title = `${t('app.title')} · ${t('app.subtitle')}`
  }, [lang, t])

  useEffect(() => {
    document.documentElement.dataset.contrast = contrast ? 'high' : 'normal'
  }, [contrast])

  useEffect(() => {
    try {
      const data: Partial<Saved> = { lang, contrast, ...(building ? { building, hazards, start } : {}) }
      localStorage.setItem(STORE_KEY, JSON.stringify(data))
    } catch {
      /* storage full or disabled: the app still works without it */
    }
  }, [lang, contrast, building, hazards, start])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), toast.key === 'msg.restored' ? 8000 : 4000)
    return () => clearTimeout(id)
  }, [toast])

  // Walkthrough: move the marker one node per tick, then stop shortly after reaching the exit.
  const pathLen = route.status === 'ok' ? route.path.length : 0
  useEffect(() => {
    if (walkIndex === null) return
    const id = setTimeout(
      () => setWalk((w) => (w && w.i < pathLen - 1 ? { ...w, i: w.i + 1 } : null)),
      walkIndex === pathLen - 1 ? WALK_MS * 2 : WALK_MS,
    )
    return () => clearTimeout(id)
  }, [walkIndex, pathLen])

  const accept = useCallback((text: string) => {
    const res = parseBuildingText(text)
    if (!res.ok) return setErrors(res.errors)
    const b = res.data
    setErrors(null)
    setBuilding(b)
    setHazards(cloneHazards(b.initial_state))
    setPast([])
    setFuture([])
    setGhost(null)
    setStart(null)
    setMode('start')
    setView(FIT)
    setDemo(null)
    setSeen(new Set())
    setToast({ key: 'msg.loaded', params: { name: b.building, nodes: b.nodes.length, edges: b.edges.length }, id: Date.now() })
  }, [])

  const loadSample = useCallback(async () => {
    try {
      const r = await fetch(SAMPLE_URL)
      if (!r.ok) throw new Error(String(r.status))
      accept(await r.text())
    } catch {
      setErrors([{ key: 'err.fetch' }])
    }
  }, [accept])

  // First visit: show the sample so the map is never empty.
  useEffect(() => {
    if (!saved?.building) void loadSample()
  }, [saved, loadSample])

  const readFile = (file: File | undefined) => {
    if (!file) return
    // A floor plan is a few KB; refuse huge files instead of freezing the tab parsing them.
    if (file.size > MAX_FILE_BYTES) return setErrors([{ key: 'err.size' }])
    file.text().then(accept, () => setErrors([{ key: 'err.read' }]))
  }
  const onFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    readFile(e.target.files?.[0])
    e.target.value = '' // allow re-importing the same file after fixing it
  }
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    readFile(e.dataTransfer.files?.[0])
  }

  /** Every hazard change goes through here so it can be undone and the previous route can be ghosted. */
  const commitHazards = (next: Hazards) => {
    if (sameHazards(next, hazards)) return
    if (route.status === 'ok') setGhost({ path: route.path, cost: route.cost })
    setPast((p) => [...p.slice(-MAX_HISTORY + 1), hazards])
    setFuture([])
    setHazards(next)
  }
  const undo = () => {
    if (!past.length) return
    if (route.status === 'ok') setGhost({ path: route.path, cost: route.cost })
    setFuture((f) => [hazards, ...f])
    setHazards(past[past.length - 1])
    setPast((p) => p.slice(0, -1))
  }
  const redo = () => {
    if (!future.length) return
    if (route.status === 'ok') setGhost({ path: route.path, cost: route.cost })
    setPast((p) => [...p, hazards])
    setHazards(future[0])
    setFuture((f) => f.slice(1))
  }

  const setStartFresh = (id: string | null) => {
    setStart(id)
    setGhost(null)
    setWalk(null)
  }
  const chooseStart = (id: string | null) => {
    if (!building || id === null) return setStartFresh(null)
    const n = building.nodes.find((x) => x.id === id)
    if (!n) return
    if (n.type === 'exit') return notify('msg.exitNotStart')
    if (hazards.blocked_nodes.includes(id)) return notify('msg.startBlockedPick', { id })
    if (id !== start) setStartFresh(id)
  }

  const toggleNode = (n: BNode) =>
    commitHazards(
      n.type === 'exit'
        ? { ...hazards, closed_exits: toggle(hazards.closed_exits, n.id) }
        : { ...hazards, blocked_nodes: toggle(hazards.blocked_nodes, n.id) },
    )
  const toggleEdge = (e: BEdge) => commitHazards({ ...hazards, blocked_edges: toggle(hazards.blocked_edges, e.id) })

  const onMapNode = (n: BNode) => (mode === 'start' ? chooseStart(n.id) : toggleNode(n))

  const reset = () => {
    if (!building) return
    commitHazards(cloneHazards(building.initial_state))
    notify('msg.reset')
  }

  const exportPng = () => {
    if (svgRef.current && building) {
      void exportSvgAsPng(svgRef.current, `smart-escape-${building.building.replace(/[^\w-]+/g, '_')}.png`)
    }
  }

  const play = () => setWalk(walkIndex !== null || route.status !== 'ok' ? null : { key: routeKey, i: 0 })

  const showScenario = (s: Scenario) => {
    if (!building) return
    commitHazards(cloneHazards(s.hazards))
    if (s.start !== start) {
      setStart(s.start)
      setWalk(null)
    }
  }
  // Seeded demo: step through all five sample checks, then report the score.
  const applyDemo = (i: number) => {
    setHazards(cloneHazards(SCENARIOS[i].hazards))
    setStart(SCENARIOS[i].start)
    setWalk(null)
    setDemo(i)
  }
  useEffect(() => {
    if (demo === null || !building) return
    const id = setTimeout(() => {
      if (demo + 1 < SCENARIOS.length) return applyDemo(demo + 1)
      setDemo(null)
      const n = SCENARIOS.filter((x) => runScenario(building, x).pass).length
      setToast({ key: 'msg.demoDone', params: { n, total: SCENARIOS.length }, id: Date.now() })
    }, DEMO_MS)
    return () => clearTimeout(id)
  }, [demo, building])
  const runDemo = () => {
    if (demo !== null) return setDemo(null)
    setPast((p) => [...p, hazards])
    setFuture([])
    setGhost(null)
    applyDemo(0)
  }

  /** Arrow keys move the start to the nearest usable location in that direction (data coordinates). */
  const moveStart = (key: string) => {
    if (!building) return
    const usable = building.nodes.filter((n) => n.type !== 'exit' && !hazards.blocked_nodes.includes(n.id))
    const cur = building.nodes.find((n) => n.id === start)
    if (!cur) return usable[0] && chooseStart([...usable].sort((a, b) => (a.id < b.id ? -1 : 1))[0].id)
    const [ux, uy] = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[key]!
    let best: BNode | null = null
    let bestScore = Infinity
    for (const n of usable) {
      const dx = n.x - cur.x, dy = n.y - cur.y
      const along = dx * ux + dy * uy
      const across = Math.abs(dx * uy - dy * ux)
      if (n.id === cur.id || along <= 0) continue
      const score = along + 2 * across
      if (score < bestScore) { bestScore = score; best = n }
    }
    if (best) chooseStart(best.id)
  }

  // One global listener; the ref always points at the latest handler so it sees current state.
  const onKey = useRef<(e: KeyboardEvent) => void>(() => {})
  useEffect(() => {
    onKey.current = (e: KeyboardEvent) => {
      if (help || isTyping(e.target)) return
      const mod = e.ctrlKey || e.metaKey
      const k = e.key.toLowerCase()
      if (mod && k === 'z') { e.preventDefault(); return e.shiftKey ? redo() : undo() }
      if (mod && k === 'y') { e.preventDefault(); return redo() }
      if (mod || e.altKey) return
      if (e.key === '?') return setHelp(true)
      if (e.key === 'Escape') { setWalk(null); setPreview([]); return setDemo(null) }
      if (k === 'e') return setLang((l) => (l === 'en' ? 'bn' : 'en'))
      if (!building) return
      if (k === 'r') return reset()
      if (k === 's') return setMode('start')
      if (k === 'h') return setMode('hazard')
      if (k === 'p') return play()
      if (e.key === '+' || e.key === '=') return setView((v) => zoomBy(v, 1.4))
      if (e.key === '-') return setView((v) => zoomBy(v, 1 / 1.4))
      if (e.key === '0') return setView(FIT)
      // Arrow keys only steer the start while the map has focus, so they never hijack page scrolling.
      if (e.key.startsWith('Arrow') && e.target instanceof Element && e.target.closest('.map-card')) {
        e.preventDefault()
        moveStart(e.key)
      }
    }
  })
  useEffect(() => {
    const h = (e: KeyboardEvent) => onKey.current(e)
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const hazardCount = hazards.blocked_nodes.length + hazards.blocked_edges.length + hazards.closed_exits.length
  const both = (key: string) => `${translate('en', key)} · ${translate('bn', key)}`

  return (
    <div
      className="app"
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(e) => {
        if (!e.relatedTarget) setDragging(false)
      }}
      onDrop={onDrop}
    >
      {splash && (
        <SplashIntro title={t('app.title')} subtitle={t('app.subtitle')} onDone={() => setSplash(false)} />
      )}
      <header className="topbar">
        <div className="brand">
          <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
            <rect x="2" y="2" width="28" height="28" rx="8" />
            <path d="M8 23h6v-6h5v-6h5" />
            <path d="M20 7l4 4-4 4" />
          </svg>
          <div>
            <h1>{t('app.title')}</h1>
            <p>{t('app.subtitle')}</p>
          </div>
        </div>
        <div className="toolbar">
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={onFileInput} />
          <button className="btn primary" onClick={() => fileRef.current?.click()}>{t('btn.import')}</button>
          <button className="btn" onClick={loadSample}>{t('btn.sample')}</button>
          <button className="btn" onClick={reset} disabled={!building} title={t('btn.resetTitle')}>{t('btn.reset')}</button>
          <button className="btn icon" onClick={undo} disabled={!past.length} aria-label={t('btn.undo')} title={`${t('btn.undo')} (Ctrl/⌘ Z)`}>↶</button>
          <button className="btn icon" onClick={redo} disabled={!future.length} aria-label={t('btn.redo')} title={`${t('btn.redo')} (Ctrl/⌘ ⇧ Z)`}>↷</button>
          <button className="btn" onClick={exportPng} disabled={!building}>{t('btn.png')}</button>
          <span className="divider" aria-hidden="true" />
          <button className="btn ghost" onClick={() => setContrast((c) => !c)} aria-pressed={contrast}>
            {t(contrast ? 'contrast.on' : 'contrast.off')}
          </button>
          <button className="btn icon" onClick={() => setHelp(true)} aria-label={t('help.title')} title={`${t('help.title')} (?)`}>?</button>
          <button
            className="btn lang"
            onClick={() => setLang((l) => (l === 'en' ? 'bn' : 'en'))}
            aria-label={t('lang.switchLabel')}
          >
            {t('lang.switch')}
          </button>
        </div>
      </header>

      {errors && (
        <section className="error-box" role="alert">
          <div>
            <h2>{t('err.title')}</h2>
            {building && <p>{t('err.keep')}</p>}
            <ul>
              {errors.slice(0, MAX_ERRORS).map((e, i) => <li key={i}>{t(e.key, e.params)}</li>)}
              {errors.length > MAX_ERRORS && <li>{t('err.more', { n: errors.length - MAX_ERRORS })}</li>}
            </ul>
          </div>
          <button className="btn" onClick={() => setErrors(null)}>{t('btn.dismiss')}</button>
        </section>
      )}

      {!building ? (
        <section className="empty">
          <h2>{t('drop.title')}</h2>
          <p>{t('drop.body')}</p>
          <div className="row">
            <button className="btn primary" onClick={() => fileRef.current?.click()}>{t('btn.import')}</button>
            <button className="btn" onClick={loadSample}>{t('btn.sample')}</button>
          </div>
        </section>
      ) : (
        <main className="layout">
          <section className="card map-card">
            <div className="map-head">
              <div>
                <h2>{building.building}</h2>
                <p className="muted">
                  {t('panel.summary', { nodes: building.nodes.length, edges: building.edges.length })}
                  {hazardCount > 0 && (
                    <>
                      {' · '}
                      <span className="warn">{t('panel.hazards')}: {t('panel.active', { n: hazardCount })}</span>
                    </>
                  )}
                </p>
              </div>
              <div className="mode-pick">
                <span className="seg-label">{t('mode.label')}</span>
                <div className="segmented" role="radiogroup" aria-label={t('mode.label')} data-active={mode}>
                  <span className="seg-thumb" aria-hidden="true" />
                  {(['start', 'hazard'] as const).map((m) => (
                    <button key={m} role="radio" aria-checked={mode === m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
                      {t(`mode.${m}`)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <p className="help">{t(mode === 'start' ? 'help.start' : 'help.hazard')}</p>
            <MapView
              ref={svgRef}
              building={building}
              hazards={hazards}
              start={start}
              routePath={route.status === 'ok' ? route.path : []}
              steps={route.status === 'ok' ? route.steps : []}
              ghostPath={ghost?.path ?? []}
              previewPath={preview}
              walkIndex={walkIndex}
              trapped={trappedSet}
              distances={route.status === 'ok' ? route.distances : null}
              mode={mode}
              view={view}
              lang={lang}
              t={t}
              onView={setView}
              onNode={onMapNode}
              onEdge={toggleEdge}
            >
              {route.status === 'no-start' ? (
                <div className="coach" role="note">{both('coach.select')}</div>
              ) : (
                <div className={`hud hud-${route.status}`} aria-hidden="true"
                  title={route.status === 'ok' ? `${route.steps.map((s) => s.cost).join(' + ')} = ${route.cost}` : undefined}>
                  {route.status === 'ok' ? (
                    <>
                      <span>{start} → <strong>{route.exit}</strong></span>
                      <span className="hud-cost">{t('hud.cost')} <strong>{formatNum(route.cost, lang)}</strong></span>
                    </>
                  ) : (
                    <strong>{t(route.status === 'no-route' ? 'status.noRoute' : 'status.startBlocked')}</strong>
                  )}
                  <ChangeBadge change={change} lang={lang} t={t} />
                </div>
              )}
            </MapView>
            <Legend t={t} />
            <p className="disclaimer">{t('app.disclaimer')}</p>
          </section>

          <aside className="side">
            <RoutePanel
              building={building}
              route={route}
              ranked={ranked}
              regions={regions}
              trapped={trapped}
              change={change}
              start={start}
              walkIndex={walkIndex}
              hazards={hazards}
              lang={lang}
              t={t}
              onStart={chooseStart}
              onPlay={play}
              onPreview={setPreview}
            />
            <HazardPanel building={building} hazards={hazards} lang={lang} t={t} onNode={toggleNode} onEdge={toggleEdge} />
            {sampleGraph && (
              <SelfCheck building={building} seen={seen} demoIndex={demo} lang={lang} t={t} onShow={showScenario} onDemo={runDemo} />
            )}
          </aside>
        </main>
      )}

      {help && <HelpDialog t={t} onClose={() => setHelp(false)} />}
      {dragging && <div className="drop-overlay">{t('drop.here')}</div>}
      <div className="toast-region" aria-live="polite">
        {toast && <div key={toast.id} className="toast">{t(toast.key, toast.params)}</div>}
      </div>
    </div>
  )
}

function Legend({ t }: { t: (k: string) => string }) {
  const x = <path className="lg-x" d="M-5-5 5 5M-5 5 5-5" />
  return (
    <ul className="legend" aria-label={t('panel.legend')}>
      <li><svg viewBox="-12 -12 24 24"><circle className="lg-room" r="9" /></svg>{t('type.room')}</li>
      <li><svg viewBox="-12 -12 24 24"><rect className="lg-junction" x="-7" y="-7" width="14" height="14" rx="2" transform="rotate(45)" /></svg>{t('type.junction')}</li>
      <li><svg viewBox="-12 -12 24 24"><rect className="lg-exit" x="-11" y="-8" width="22" height="16" rx="5" /></svg>{t('type.exit')}</li>
      <li><svg viewBox="-12 -12 24 24"><circle className="lg-start" r="9" /></svg>{t('state.start')}</li>
      <li><svg viewBox="-12 -12 24 24"><line className="lg-route" x1="-11" y1="0" x2="11" y2="0" /></svg>{t('state.route')}</li>
      <li><svg viewBox="-12 -12 24 24"><line className="lg-ghost" x1="-11" y1="0" x2="11" y2="0" /></svg>{t('state.ghost')}</li>
      <li><svg viewBox="-12 -12 24 24"><circle className="lg-blocked" r="9" />{x}</svg>{t('state.blocked')}</li>
      <li><svg viewBox="-12 -12 24 24"><rect className="lg-closed" x="-11" y="-8" width="22" height="16" rx="5" />{x}</svg>{t('state.closed')}</li>
      <li><svg viewBox="-12 -12 24 24"><line className="lg-bedge" x1="-11" y1="0" x2="11" y2="0" /></svg>{t('state.blockedCorridor')}</li>
      <li><svg viewBox="-12 -12 24 24"><circle className="lg-trapped" r="9" /></svg>{t('state.trapped')}</li>
      <li className="muted">{t('legend.cost')}</li>
    </ul>
  )
}
