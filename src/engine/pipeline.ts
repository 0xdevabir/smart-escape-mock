import { FeatureBuilder, type FeatureContext } from './features'
import { CASH_OUT_LIMIT, DEFAULT_GEN, generateDataset, URBAN } from './generator'
import { IsolationForest, LogisticModel, Scaler } from './models'
import { DAY } from './time'
import {
  FEATURE_KEYS, type Account, type Dataset, type FeatureVector, type Reason, type RuleHit, type Scored, type Tx, type Typology,
} from './types'

// ---------------------------------------------------------------------------
// Business rules are kept separate from the ML model: they are explicit,
// auditable policies an analyst can switch off, and each enforces a score floor.
// ---------------------------------------------------------------------------
export interface Rule {
  id: string
  floor: number
  test: (f: FeatureVector, tx: Tx, ctx: FeatureContext) => boolean
}

export const RULES: Rule[] = [
  { id: 'ato_combo', floor: 82, test: (f) => !!f.newDevice && !!(f.nightHour || f.newLocation) && !!f.newRecipient && f.amtZ > 1.5 },
  { id: 'mule_cashout', floor: 78, test: (f) => !!f.isCashOut && f.passThrough >= 0.6 },
  { id: 'fanin_burst', floor: 66, test: (f, _t, c) => !!f.isSend && !!f.newRecipient && c.fanIn >= 5 },
  { id: 'velocity', floor: 62, test: (f) => !!f.isSend && f.velocity1h >= 3 },
  { id: 'near_limit_night', floor: 64, test: (f, tx) => !!f.isCashOut && !!f.nightHour && tx.amount >= CASH_OUT_LIMIT * 0.96 },
]

export interface EngineConfig {
  threshold: number
  rules: Record<string, boolean>
  /** blend weight of the ML probability vs the anomaly signal */
  modelWeight: number
}

export const DEFAULT_CONFIG: EngineConfig = {
  threshold: 60,
  rules: Object.fromEntries(RULES.map((r) => [r.id, true])),
  modelWeight: 0.8,
}

export interface Artifacts {
  scaler: Scaler
  model: LogisticModel
  forest: IsolationForest
  mode: 'supervised' | 'transfer'
  trainRows: number
  trainPositives: number
  testStart: number
}

export interface EngineResult {
  scored: Scored[]
  byId: Map<string, number>
  contexts: FeatureContext[]
  features: FeatureVector[]
  labels: (0 | 1 | undefined)[]
  artifacts: Artifacts
  builder: FeatureBuilder
  accounts: Map<string, Account>
  ms: number
}

const vec = (f: FeatureVector) => FEATURE_KEYS.map((k) => f[k])

function featurize(ds: Dataset) {
  const builder = new FeatureBuilder(ds.accounts)
  const features: FeatureVector[] = []
  const contexts: FeatureContext[] = []
  for (const tx of ds.txs) {
    const { f, ctx } = builder.compute(tx)
    features.push(f)
    contexts.push(ctx)
    builder.commit(tx)
  }
  return { builder, features, contexts }
}

let transferCache: { scaler: Scaler; model: LogisticModel; pos: number; n: number } | null = null

/** When imported data has too few labels, reuse a model trained on our synthetic ledger. */
function transferModel() {
  if (transferCache) return transferCache
  const ds = generateDataset(DEFAULT_GEN)
  const { features } = featurize(ds)
  const X = features.map(vec)
  const y = ds.txs.map((t) => t.label ?? 0)
  const scaler = new Scaler().fit(X)
  const model = new LogisticModel().fit(X.map((x) => scaler.transform(x)), y)
  transferCache = { scaler, model, pos: y.reduce((a, b) => a + b, 0), n: X.length }
  return transferCache
}

export function typologyOf(f: FeatureVector, hits: RuleHit[], score: number): Typology {
  const has = (id: string) => hits.some((h) => h.id === id)
  if (has('ato_combo') || (f.newDevice && (f.nightHour || f.newLocation) && score >= 40)) return 'ato'
  if (has('mule_cashout') || (f.isCashOut && f.passThrough >= 0.5)) return 'mule'
  if (has('near_limit_night')) return 'agent'
  if (f.isSend && f.newRecipient && (f.amtZ > 1.5 || has('fanin_burst'))) return score >= 40 ? 'scam' : 'normal'
  return score >= 40 ? 'other' : 'normal'
}

export function scoreOne(f: FeatureVector, tx: Tx, ctx: FeatureContext, a: Artifacts, cfg: EngineConfig): Scored {
  const x = a.scaler.transform(vec(f))
  const mlProb = a.model.predictRaw(x)
  const anomaly = a.forest.percentile(x)
  const anomTerm = Math.max(0, (anomaly - 0.8) / 0.2)
  const blended = 100 * (cfg.modelWeight * mlProb + (1 - cfg.modelWeight) * anomTerm)
  const rules: RuleHit[] = RULES.filter((r) => cfg.rules[r.id] !== false && r.test(f, tx, ctx)).map((r) => ({ id: r.id, floor: r.floor }))
  const score = Math.round(Math.min(100, Math.max(blended, ...rules.map((r) => r.floor))))

  const contrib = a.model.contributions(x)
  const reasons: Reason[] = [
    ...rules.map((r) => ({ key: r.id, kind: 'rule' as const, weight: r.floor / 100 })),
    ...FEATURE_KEYS.map((k, j) => ({ key: k, kind: 'model' as const, weight: contrib[j], value: f[k] }))
      .filter((r) => r.weight > 0.25 && r.key !== 'amtLog')
      .sort((p, q) => q.weight - p.weight)
      .slice(0, 4),
  ]
  if (anomaly > 0.97) reasons.push({ key: 'anomaly', kind: 'anomaly', weight: anomaly, value: anomaly })
  const band = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low'
  return { txId: tx.id, score, mlProb, anomaly, rules, reasons, band, typology: typologyOf(f, rules, score) }
}

export function runEngine(ds: Dataset, cfg: EngineConfig, feedback: Map<string, 0 | 1> = new Map()): EngineResult {
  const t0 = performance.now()
  const { builder, features, contexts } = featurize(ds)
  const labels = ds.txs.map((t) => feedback.get(t.id) ?? t.label)
  const X = features.map(vec)

  // Time-based split: the last 30% of the timeline is a clean test set never used for training.
  const testStart = ds.txs.length ? ds.txs[Math.floor(ds.txs.length * 0.7)].ts : 0
  const trainIdx = ds.txs.map((t, i) => (t.ts < testStart ? i : -1)).filter((i) => i >= 0)
  const labelled = trainIdx.filter((i) => labels[i] !== undefined)
  const pos = labelled.filter((i) => labels[i] === 1).length

  let scaler: Scaler
  let model: LogisticModel
  let mode: Artifacts['mode']
  let trainRows: number
  let trainPositives: number
  if (pos >= 15 && labelled.length - pos >= 100) {
    scaler = new Scaler().fit(labelled.map((i) => X[i]))
    model = new LogisticModel().fit(labelled.map((i) => scaler.transform(X[i])), labelled.map((i) => labels[i]!))
    mode = 'supervised'
    trainRows = labelled.length
    trainPositives = pos
  } else {
    const tm = transferModel()
    ;({ scaler, model } = tm)
    mode = 'transfer'
    trainRows = tm.n
    trainPositives = tm.pos
  }
  const forestRows = (trainIdx.length >= 50 ? trainIdx : X.map((_, i) => i)).map((i) => scaler.transform(X[i]))
  const forest = new IsolationForest().fit(forestRows.length ? forestRows : [new Array(FEATURE_KEYS.length).fill(0)])

  const artifacts: Artifacts = { scaler, model, forest, mode, trainRows, trainPositives, testStart }
  const scored = ds.txs.map((tx, i) => scoreOne(features[i], tx, contexts[i], artifacts, cfg))
  return {
    scored,
    byId: new Map(ds.txs.map((t, i) => [t.id, i])),
    contexts,
    features,
    labels,
    artifacts,
    builder,
    accounts: new Map(ds.accounts.map((a) => [a.id, a])),
    ms: Math.round(performance.now() - t0),
  }
}

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------
export function auc(scores: number[], labels: number[]) {
  const pairs = scores.map((s, i) => [s, labels[i]] as const).sort((a, b) => a[0] - b[0])
  let rank = 1
  let sumPos = 0
  let nPos = 0
  for (let i = 0; i < pairs.length; ) {
    let j = i
    while (j < pairs.length && pairs[j][0] === pairs[i][0]) j++
    const avg = (rank + rank + (j - i) - 1) / 2
    for (let k = i; k < j; k++) if (pairs[k][1]) {
      sumPos += avg
      nPos++
    }
    rank += j - i
    i = j
  }
  const nNeg = pairs.length - nPos
  return nPos && nNeg ? (sumPos - (nPos * (nPos + 1)) / 2) / (nPos * nNeg) : NaN
}

export interface Confusion {
  tp: number
  fp: number
  fn: number
  tn: number
  precision: number
  recall: number
  f1: number
  fpr: number
  caughtAmount: number
  fraudAmount: number
  falseAlertAmount: number
}

export function confusion(scores: number[], labels: number[], amounts: number[], threshold: number): Confusion {
  let tp = 0, fp = 0, fn = 0, tn = 0, caught = 0, fraud = 0, falseAmt = 0
  scores.forEach((s, i) => {
    const flag = s >= threshold
    if (labels[i]) {
      fraud += amounts[i]
      if (flag) { tp++; caught += amounts[i] } else fn++
    } else if (flag) { fp++; falseAmt += amounts[i] } else tn++
  })
  const precision = tp + fp ? tp / (tp + fp) : 0
  const recall = tp + fn ? tp / (tp + fn) : 0
  return {
    tp, fp, fn, tn, precision, recall,
    f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0,
    fpr: fp + tn ? fp / (fp + tn) : 0,
    caughtAmount: caught, fraudAmount: fraud, falseAlertAmount: falseAmt,
  }
}

export interface Evaluation {
  testRows: number
  testPositives: number
  aucHybrid: number
  aucModel: number
  aucRules: number
  at: Confusion
  curve: { t: number; precision: number; recall: number; alerts: number }[]
  fairness: { dimension: string; group: string; n: number; alertRate: number; fpr: number; recall: number }[]
}

export const ageBand = (days: number) => (days < 90 ? 'new' : 'established')
export const regionOf = (district: string) => (URBAN.has(district) ? 'urban' : 'rural')

export function evaluate(ds: Dataset, res: EngineResult, threshold: number): Evaluation | null {
  const idx = ds.txs.map((t, i) => (t.ts >= res.artifacts.testStart && res.labels[i] !== undefined ? i : -1)).filter((i) => i >= 0)
  const y = idx.map((i) => res.labels[i]!)
  const pos = y.reduce((a, b) => a + b, 0)
  if (!idx.length || !pos || pos === y.length) return null
  const s = idx.map((i) => res.scored[i].score)
  const amounts = idx.map((i) => ds.txs[i].amount)
  const curve = []
  for (let t = 5; t <= 95; t += 5) {
    const c = confusion(s, y, amounts, t)
    curve.push({ t, precision: c.precision, recall: c.recall, alerts: c.tp + c.fp })
  }
  const groups = new Map<string, number[]>()
  idx.forEach((i) => {
    const acc = res.accounts.get(ds.txs[i].sender)
    const keys = [
      `segment|${acc?.segment ?? 'unknown'}`,
      `region|${regionOf(acc?.district ?? ds.txs[i].location)}`,
      `age|${ageBand(res.contexts[i].ageDays)}`,
    ]
    for (const k of keys) {
      if (!groups.has(k)) groups.set(k, [])
      groups.get(k)!.push(i)
    }
  })
  const fairness = [...groups.entries()].map(([k, ids]) => {
    const [dimension, group] = k.split('|')
    const c = confusion(ids.map((i) => res.scored[i].score), ids.map((i) => res.labels[i]!), ids.map((i) => ds.txs[i].amount), threshold)
    return { dimension, group, n: ids.length, alertRate: (c.tp + c.fp) / ids.length, fpr: c.fpr, recall: c.recall }
  }).sort((a, b) => a.dimension.localeCompare(b.dimension) || a.group.localeCompare(b.group))

  return {
    testRows: idx.length,
    testPositives: pos,
    aucHybrid: auc(s, y),
    aucModel: auc(idx.map((i) => res.scored[i].mlProb), y),
    aucRules: auc(idx.map((i) => Math.max(0, ...res.scored[i].rules.map((r) => r.floor))), y),
    at: confusion(s, y, amounts, threshold),
    curve,
    fairness,
  }
}

/** Global importance = |weight| of each standardised feature. */
export const featureImportance = (a: Artifacts) =>
  FEATURE_KEYS.map((k, j) => ({ key: k, weight: a.model.w[j] })).sort((p, q) => Math.abs(q.weight) - Math.abs(p.weight))

export const daysCovered = (ds: Dataset) => (ds.txs.length ? Math.max(1, Math.round((ds.txs[ds.txs.length - 1].ts - ds.txs[0].ts) / DAY)) : 0)
