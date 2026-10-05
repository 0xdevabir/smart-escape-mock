import { describe, expect, it } from 'vitest'
import { generateDataset, DEFAULT_GEN } from './generator'
import { auc, DEFAULT_CONFIG, evaluate, runEngine } from './pipeline'

describe('risk engine', () => {
  const ds = generateDataset(DEFAULT_GEN)
  const res = runEngine(ds, DEFAULT_CONFIG)
  const ev = evaluate(ds, res, DEFAULT_CONFIG.threshold)!

  it('generates a reproducible, labelled ledger', () => {
    const again = generateDataset(DEFAULT_GEN)
    expect(again.txs.length).toBe(ds.txs.length)
    expect(again.txs[100]).toEqual(ds.txs[100])
    const fraud = ds.txs.filter((t) => t.label === 1).length
    console.log('txs', ds.txs.length, 'fraud', fraud, 'engine ms', res.ms)
    expect(fraud / ds.txs.length).toBeGreaterThan(0.005)
    expect(fraud / ds.txs.length).toBeLessThan(0.08)
  })

  it('separates fraud from normal on the held-out test set', () => {
    console.log('AUC hybrid/model/rules', ev.aucHybrid.toFixed(3), ev.aucModel.toFixed(3), ev.aucRules.toFixed(3))
    console.log('at threshold', DEFAULT_CONFIG.threshold, JSON.stringify({ p: ev.at.precision.toFixed(2), r: ev.at.recall.toFixed(2), tp: ev.at.tp, fp: ev.at.fp, fn: ev.at.fn }))
    console.log('fairness', JSON.stringify(ev.fairness.map((f) => [f.group, f.n, f.fpr.toFixed(3), f.recall.toFixed(2)])))
    expect(res.artifacts.mode).toBe('supervised')
    expect(ev.aucHybrid).toBeGreaterThan(0.9)
    expect(ev.at.recall).toBeGreaterThan(0.6)
  })

  it('computes AUC correctly', () => {
    expect(auc([0.1, 0.4, 0.35, 0.8], [0, 0, 1, 1])).toBeCloseTo(0.75)
  })

  it('falls back to the transfer model when data has no labels', () => {
    const unlabelled = { ...ds, txs: ds.txs.slice(0, 3000).map(({ label: _l, pattern: _p, ...t }) => t) }
    const r = runEngine(unlabelled, DEFAULT_CONFIG)
    expect(r.artifacts.mode).toBe('transfer')
    expect(evaluate(unlabelled, r, 60)).toBeNull()
  })
})
