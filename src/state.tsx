import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { DEFAULT_GEN, generateDataset, type GenOptions } from './engine/generator'
import { DEFAULT_CONFIG, evaluate, runEngine, type EngineConfig, type EngineResult, type Evaluation } from './engine/pipeline'
import type { AuditEntry, CaseDecision, CaseStatus, Dataset } from './engine/types'
import { makeT, type I18n, type Lang } from './i18n'
import { DEFAULT_MODELS, type AiSettings } from './lib/ai'
import { idb, local, session } from './lib/storage'

type Theme = 'light' | 'dark'

interface Prefs {
  lang: Lang
  theme: Theme
  bnDigits: boolean
  analyst: string
}

interface AppState {
  i18n: I18n
  prefs: Prefs
  setPrefs: (p: Partial<Prefs>) => void
  dataset: Dataset | null
  setDataset: (d: Dataset) => void
  generate: (o: GenOptions) => void
  config: EngineConfig
  setConfig: (c: Partial<EngineConfig>) => void
  result: EngineResult | null
  evaluation: Evaluation | null
  busy: boolean
  decisions: Record<string, CaseDecision>
  decide: (txId: string, status: CaseStatus, note: string) => void
  audit: AuditEntry[]
  logAudit: (e: Omit<AuditEntry, 'at' | 'analyst'>) => void
  retrain: () => number
  ai: AiSettings & { remember: boolean }
  setAi: (a: Partial<AiSettings & { remember: boolean }>) => void
  resetAll: () => Promise<void>
}

const Ctx = createContext<AppState | null>(null)

const initialTheme = (): Theme => {
  const saved = local.get<Theme | null>('tl.theme', null)
  if (saved) return saved
  try {
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

function loadAi(): AiSettings & { remember: boolean } {
  const saved = local.get<Partial<AiSettings> & { remember?: boolean }>('tl.ai', {})
  const provider = saved.provider ?? 'anthropic'
  const key = saved.remember ? local.get<string>('tl.aiKey', '') : (session.get('tl.aiKey') ?? '')
  return { provider, model: saved.model || DEFAULT_MODELS[provider], key, remember: !!saved.remember }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefsState] = useState<Prefs>(() => ({
    lang: local.get<Lang>('tl.lang', 'en'),
    theme: initialTheme(),
    bnDigits: local.get('tl.bnDigits', true),
    analyst: local.get('tl.analyst', 'Analyst 1'),
  }))
  const [dataset, setDatasetState] = useState<Dataset | null>(null)
  const [config, setConfigState] = useState<EngineConfig>(() => ({ ...DEFAULT_CONFIG, ...local.get<Partial<EngineConfig>>('tl.config', {}) }))
  const [result, setResult] = useState<EngineResult | null>(null)
  const [busy, setBusy] = useState(true)
  const [decisions, setDecisions] = useState<Record<string, CaseDecision>>({})
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [feedback, setFeedback] = useState<Map<string, 0 | 1>>(new Map())
  const [ai, setAiState] = useState(loadAi)

  // hydrate from IndexedDB, or create the default synthetic ledger
  useEffect(() => {
    let alive = true
    ;(async () => {
      const [ds, dec, aud] = await Promise.all([idb.get<Dataset>('tl.dataset'), idb.get<Record<string, CaseDecision>>('tl.decisions'), idb.get<AuditEntry[]>('tl.audit')])
      if (!alive) return
      setDecisions(dec ?? {})
      setAudit(aud ?? [])
      if (ds?.txs?.length) setDatasetState(ds)
      else {
        await new Promise((r) => setTimeout(r, 20))
        const fresh = generateDataset(DEFAULT_GEN)
        setDatasetState(fresh)
        idb.set('tl.dataset', fresh)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  // re-score whenever data, rules, blend or training labels change (threshold alone needs no re-score)
  const rulesKey = JSON.stringify(config.rules) + config.modelWeight
  useEffect(() => {
    if (!dataset) return
    setBusy(true)
    const id = setTimeout(() => {
      setResult(runEngine(dataset, config, feedback))
      setBusy(false)
    }, 30)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset, rulesKey, feedback])

  const evaluation = useMemo(() => (dataset && result ? evaluate(dataset, result, config.threshold) : null), [dataset, result, config.threshold])

  useEffect(() => {
    document.documentElement.dataset.theme = prefs.theme
    document.documentElement.lang = prefs.lang
  }, [prefs.theme, prefs.lang])

  const setPrefs = useCallback((p: Partial<Prefs>) => {
    setPrefsState((prev) => {
      const next = { ...prev, ...p }
      local.set('tl.lang', next.lang)
      local.set('tl.theme', next.theme)
      local.set('tl.bnDigits', next.bnDigits)
      local.set('tl.analyst', next.analyst)
      return next
    })
  }, [])

  const setDataset = useCallback((d: Dataset) => {
    setDatasetState(d)
    setFeedback(new Map())
    setDecisions({})
    idb.set('tl.dataset', d)
    idb.set('tl.decisions', {})
  }, [])

  const generate = useCallback((o: GenOptions) => {
    setBusy(true)
    setTimeout(() => setDataset(generateDataset(o)), 20)
  }, [setDataset])

  const setConfig = useCallback((c: Partial<EngineConfig>) => {
    setConfigState((prev) => {
      const next = { ...prev, ...c }
      local.set('tl.config', next)
      return next
    })
  }, [])

  const logAudit = useCallback((e: Omit<AuditEntry, 'at' | 'analyst'>) => {
    setAudit((prev) => {
      const next = [{ ...e, at: Date.now(), analyst: prefs.analyst }, ...prev].slice(0, 2000)
      idb.set('tl.audit', next)
      return next
    })
  }, [prefs.analyst])

  const decide = useCallback((txId: string, status: CaseStatus, note: string) => {
    setDecisions((prev) => {
      const next = { ...prev, [txId]: { txId, status, note, analyst: prefs.analyst, at: Date.now() } }
      idb.set('tl.decisions', next)
      return next
    })
    logAudit({ txId, action: status, note: note || undefined })
  }, [prefs.analyst, logAudit])

  const retrain = useCallback(() => {
    const fb = new Map<string, 0 | 1>()
    for (const d of Object.values(decisions)) {
      if (d.status === 'confirmed') fb.set(d.txId, 1)
      else if (d.status === 'dismissed') fb.set(d.txId, 0)
    }
    setFeedback(fb)
    return fb.size
  }, [decisions])

  const setAi = useCallback((a: Partial<AiSettings & { remember: boolean }>) => {
    setAiState((prev) => {
      const next = { ...prev, ...a }
      if (a.provider && a.provider !== prev.provider && !a.model) next.model = DEFAULT_MODELS[a.provider]
      local.set('tl.ai', { provider: next.provider, model: next.model, remember: next.remember })
      if (next.remember) {
        local.set('tl.aiKey', next.key)
        session.remove('tl.aiKey')
      } else {
        local.remove('tl.aiKey')
        if (next.key) session.set('tl.aiKey', next.key)
        else session.remove('tl.aiKey')
      }
      return next
    })
  }, [])

  const resetAll = useCallback(async () => {
    await Promise.all([idb.del('tl.dataset'), idb.del('tl.decisions'), idb.del('tl.audit')])
    local.remove('tl.config')
    setConfigState(DEFAULT_CONFIG)
    setAudit([])
    setDataset(generateDataset(DEFAULT_GEN))
  }, [setDataset])

  const i18n = useMemo(() => makeT(prefs.lang, prefs.bnDigits), [prefs.lang, prefs.bnDigits])

  const value: AppState = {
    i18n, prefs, setPrefs, dataset, setDataset, generate, config, setConfig, result, evaluation, busy,
    decisions, decide, audit, logAudit, retrain, ai, setAi, resetAll,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp outside AppProvider')
  return v
}

export function useHashRoute() {
  const read = () => (location.hash.replace(/^#\/?/, '') || 'overview').split('/')
  const [parts, setParts] = useState(read)
  useEffect(() => {
    const on = () => {
      setParts(read())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return parts
}

export const go = (path: string) => {
  location.hash = `#/${path}`
}
