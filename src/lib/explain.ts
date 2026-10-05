import type { FeatureContext } from '../engine/features'
import type { Reason, Scored, Tx, Typology } from '../engine/types'
import type { I18n, Key } from '../i18n'

export function reasonText(r: Reason, tx: Tx, ctx: FeatureContext, i: I18n): string {
  const { t } = i
  switch (r.key) {
    case 'amtZ':
      return t('rs.amtZ', { x: i.num(tx.amount / Math.max(ctx.typicalAmount, 1), 1), typical: i.money(ctx.typicalAmount) })
    case 'nightHour':
      return t('rs.nightHour', { hour: i.num(ctx.hour) })
    case 'newLocation':
      return t('rs.newLocation', { loc: tx.location })
    case 'velocity1h':
      return t('rs.velocity1h', { n: r.value ?? 0 })
    case 'recvFanIn24h':
      return t('rs.recvFanIn24h', { n: ctx.fanIn })
    case 'passThrough':
      return t('rs.passThrough', { n: ctx.senders12, amt: i.money(ctx.recv12) })
    case 'acctAgeLog':
      return t('rs.acctAgeLog', { days: ctx.ageDays })
    case 'anomaly':
      return t('rs.anomaly', { pct: i.num((r.value ?? 0) * 100, 1) })
    default:
      return t(`rs.${r.key}` as Key)
  }
}

/** Structured, minimal evidence handed to an LLM — no free text from the customer, only computed facts. */
export function evidenceFor(tx: Tx, s: Scored, ctx: FeatureContext, i: I18n) {
  return {
    transaction: { id: tx.id, time_bst: i.date(tx.ts), type: tx.type, amount_bdt: tx.amount, channel: tx.channel, location: tx.location, sender_wallet: tx.sender, receiver_wallet: tx.receiver },
    sender_baseline: { earlier_transactions: ctx.history, usual_amount_bdt: ctx.typicalAmount, wallet_age_days: ctx.ageDays },
    risk: { score_0_100: s.score, band: s.band, likely_pattern: s.typology, ml_probability: +s.mlProb.toFixed(3), anomaly_percentile: +s.anomaly.toFixed(3), rules_fired: s.rules.map((r) => r.id) },
    signals: s.reasons.map((r) => reasonText(r, tx, ctx, i)),
  }
}

export const nextSteps = (typ: Typology, i: I18n) => i.list(`next.${typ}` as Key)
