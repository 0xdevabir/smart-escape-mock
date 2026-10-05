import { useMemo } from 'react'
import type { CaseStatus, Scored, Tx } from '../engine/types'
import { useApp } from '../state'

export interface AlertRow {
  tx: Tx
  s: Scored
  status: CaseStatus
}

/** Transactions at or above the alert threshold, highest risk first, with their case status. */
export function useAlerts(): AlertRow[] {
  const { dataset, result, config, decisions } = useApp()
  return useMemo(() => {
    if (!dataset || !result) return []
    const rows: AlertRow[] = []
    result.scored.forEach((s, i) => {
      if (s.score >= config.threshold) rows.push({ tx: dataset.txs[i], s, status: decisions[s.txId]?.status ?? 'open' })
    })
    return rows.sort((a, b) => b.s.score - a.s.score || b.tx.amount - a.tx.amount)
  }, [dataset, result, config.threshold, decisions])
}
