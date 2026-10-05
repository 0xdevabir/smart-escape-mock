import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { MapView } from './components/MapView'
import { RoutePanel } from './components/RoutePanel'
import { HazardPanel } from './components/HazardPanel'
import { exportSvgAsPng } from './lib/exportPng'
import { translate, type Lang } from './lib/i18n'
import { computeRoute } from './lib/route'
import type { BEdge, BNode, Building, Hazards } from './lib/types'
import { parseBuildingText, validateBuilding, type ValidationError } from './lib/validate'

const STORE_KEY = 'smart-escape:v1'
const SAMPLE_URL = `${import.meta.env.BASE_URL}building.json`
const MAX_ERRORS = 12

interface Saved {
  building: Building
  hazards: Hazards
  start: string | null
  lang: Lang
  contrast: boolean
}

type Toast = { key: string; params?: Record<string, string | number>; id: number }

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

export default function App() {
  const [saved] = useState(loadSaved)
  const [lang, setLang] = useState<Lang>(saved?.lang === 'bn' ? 'bn' : 'en')
  const [contrast, setContrast] = useState(!!saved?.contrast)
  const [building, setBuilding] = useState<Building | null>(saved?.building ?? null)
  const [hazards, setHazards] = useState<Hazards>(saved?.hazards ?? { blocked_nodes: [], blocked_edges: [], closed_exits: [] })
  const [start, setStart] = useState<string | null>(saved?.start ?? null)
  const [mode, setMode] = useState<'start' | 'hazard'>('start')
  const [errors, setErrors] = useState<ValidationError[] | null>(null)
  const [toast, setToast] = useState<Toast | null>(saved?.building ? { key: 'msg.restored', id: 0 } : null)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(lang, key, params),
    [lang],
  )
  const notify = (key: string, params?: Toast['params']) => setToast({ key, params, id: Date.now() })

  // Recomputed synchronously on every start or hazard change.
  const route = useMemo(
    () => (building ? computeRoute(building, hazards, start) : ({ status: 'no-start' } as const)),
    [building, hazards, start],
  )

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
    const id = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(id)
  }, [toast])

  const accept = useCallback((text: string) => {
    const res = parseBuildingText(text)
    if (!res.ok) return setErrors(res.errors)
    const b = res.data
    setErrors(null)
    setBuilding(b)
    setHazards(cloneHazards(b.initial_state))
    setStart(null)
    setMode('start')
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

  const chooseStart = (id: string | null) => {
    if (!building || id === null) return setStart(null)
    const n = building.nodes.find((x) => x.id === id)
    if (!n) return
    if (n.type === 'exit') return notify('msg.exitNotStart')
    if (hazards.blocked_nodes.includes(id)) return notify('msg.startBlockedPick', { id })
    setStart(id)
  }

  const toggleNode = (n: BNode) =>
    setHazards((h) =>
      n.type === 'exit'
        ? { ...h, closed_exits: toggle(h.closed_exits, n.id) }
        : { ...h, blocked_nodes: toggle(h.blocked_nodes, n.id) },
    )
  const toggleEdge = (e: BEdge) => setHazards((h) => ({ ...h, blocked_edges: toggle(h.blocked_edges, e.id) }))

  const onMapNode = (n: BNode) => (mode === 'start' ? chooseStart(n.id) : toggleNode(n))

  const reset = () => {
    if (!building) return
    setHazards(cloneHazards(building.initial_state))
    notify('msg.reset')
  }

  const exportPng = () => {
    if (svgRef.current && building) {
      void exportSvgAsPng(svgRef.current, `smart-escape-${building.building.replace(/[^\w-]+/g, '_')}.png`)
    }
  }

  const routeEdges = route.status === 'ok' ? route.steps.map((s) => s.edgeId) : []
  const routePath = route.status === 'ok' ? route.path : []
  const hazardCount = hazards.blocked_nodes.length + hazards.blocked_edges.length + hazards.closed_exits.length

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
          <button className="btn" onClick={exportPng} disabled={!building}>{t('btn.png')}</button>
          <span className="divider" aria-hidden="true" />
          <button className="btn ghost" onClick={() => setContrast((c) => !c)} aria-pressed={contrast}>
            {t(contrast ? 'contrast.on' : 'contrast.off')}
          </button>
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
              <div className="segmented" role="radiogroup" aria-label={t('mode.label')}>
                <span className="seg-label">{t('mode.label')}</span>
                {(['start', 'hazard'] as const).map((m) => (
                  <button key={m} role="radio" aria-checked={mode === m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
                    {t(`mode.${m}`)}
                  </button>
                ))}
              </div>
            </div>
            <p className="help">{t(mode === 'start' ? 'help.start' : 'help.hazard')}</p>
            <div className="map-wrap">
              <MapView
                ref={svgRef}
                building={building}
                hazards={hazards}
                start={start}
                routePath={routePath}
                routeEdges={routeEdges}
                mode={mode}
                lang={lang}
                t={t}
                onNode={onMapNode}
                onEdge={toggleEdge}
              />
            </div>
            <Legend t={t} />
            <p className="disclaimer">{t('app.disclaimer')}</p>
          </section>

          <aside className="side">
            <RoutePanel building={building} route={route} start={start} hazards={hazards} lang={lang} t={t} onStart={chooseStart} />
            <HazardPanel building={building} hazards={hazards} lang={lang} t={t} onNode={toggleNode} onEdge={toggleEdge} />
          </aside>
        </main>
      )}

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
      <li><svg viewBox="-12 -12 24 24"><circle className="lg-blocked" r="9" />{x}</svg>{t('state.blocked')}</li>
      <li><svg viewBox="-12 -12 24 24"><rect className="lg-closed" x="-11" y="-8" width="22" height="16" rx="5" />{x}</svg>{t('state.closed')}</li>
      <li><svg viewBox="-12 -12 24 24"><line className="lg-bedge" x1="-11" y1="0" x2="11" y2="0" /></svg>{t('state.blockedCorridor')}</li>
      <li className="muted">{t('legend.cost')}</li>
    </ul>
  )
}
