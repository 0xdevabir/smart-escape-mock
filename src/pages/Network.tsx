import { useMemo, useState } from 'react'
import { findMuleCandidates, graphFor } from '../engine/network'
import { PageHead, Panel } from '../components/ui'
import { useApp } from '../state'

const MIN = 5

export default function NetworkPage() {
  const { i18n, dataset } = useApp()
  const { t } = i18n
  const cands = useMemo(() => (dataset ? findMuleCandidates(dataset, MIN) : []), [dataset])
  const [sel, setSel] = useState<string | null>(null)
  const focused = useMemo(() => {
    if (!cands.length) return []
    if (sel) {
      const hit = cands.find((c) => c.id === sel)
      return hit ? [hit] : cands.slice(0, 6)
    }
    return cands.slice(0, 6)
  }, [cands, sel])
  const graph = useMemo(() => graphFor(focused), [focused])

  return (
    <>
      <PageHead title={t('nw.title')} lede={t('nw.lede', { min: MIN })} />

      {!cands.length ? (
        <Panel>
          <p className="text-ink-2">{t('nw.empty', { min: MIN })}</p>
        </Panel>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
          <Panel title={t('nw.col.wallet')} pad={false}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[0.9rem]">
                <thead className="text-[0.78rem] text-muted">
                  <tr>
                    <th className="px-5 py-2 font-medium">{t('nw.col.wallet')}</th>
                    <th className="px-3 py-2 font-medium">{t('nw.col.senders')}</th>
                    <th className="px-3 py-2 font-medium">{t('nw.col.inflow')}</th>
                    <th className="px-3 py-2 font-medium">{t('nw.col.cashout')}</th>
                    <th className="px-3 py-2 font-medium">{t('nw.col.ratio')}</th>
                    <th className="px-5 py-2 font-medium">{t('nw.col.speed')}</th>
                  </tr>
                </thead>
                <tbody>
                  {cands.map((c) => (
                    <tr
                      key={c.id}
                      className={`row-link ${sel === c.id ? 'bg-surface-2' : ''}`}
                      onClick={() => setSel((prev) => (prev === c.id ? null : c.id))}
                    >
                      <td className="px-5 py-2.5 font-medium">{c.id}</td>
                      <td className="num px-3 py-2.5">{i18n.num(c.senders)}</td>
                      <td className="num px-3 py-2.5">{i18n.money(c.inflow)}</td>
                      <td className="num px-3 py-2.5">{i18n.money(c.cashOut)}</td>
                      <td className="num px-3 py-2.5">{i18n.pct(c.ratio)}</td>
                      <td className="num px-5 py-2.5">{Number.isFinite(c.hoursToCashOut) ? i18n.num(c.hoursToCashOut, 1) : '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-5 py-3 text-[0.85rem] text-muted">
              <span>{sel ? t('nw.selectHint') : t('nw.showAll')}</span>
              {sel && (
                <button type="button" className="btn" onClick={() => setSel(null)}>
                  {t('nw.showAll')}
                </button>
              )}
            </div>
          </Panel>

          <Panel title={t('nw.graphHint')} hint={t('nw.selectHint')}>
            <svg viewBox="0 0 420 360" className="h-auto w-full" role="img" aria-label={t('nw.title')}>
              {graph.links.map((l) => {
                const s = graph.nodes.find((n) => n.id === (typeof l.source === 'string' ? l.source : l.source))
                const tNode = graph.nodes.find((n) => n.id === (typeof l.target === 'string' ? l.target : l.target))
                if (!s || !tNode) return null
                const si = graph.nodes.indexOf(s)
                const ti = graph.nodes.indexOf(tNode)
                const n = Math.max(graph.nodes.length, 1)
                const sx = 210 + Math.cos((si / n) * Math.PI * 2) * 130
                const sy = 180 + Math.sin((si / n) * Math.PI * 2) * 110
                const tx = 210 + Math.cos((ti / n) * Math.PI * 2) * 130
                const ty = 180 + Math.sin((ti / n) * Math.PI * 2) * 110
                return (
                  <line
                    key={`${s.id}-${tNode.id}`}
                    x1={sx}
                    y1={sy}
                    x2={tx}
                    y2={ty}
                    stroke="var(--line-strong)"
                    strokeWidth={Math.max(1, Math.min(6, l.amount / 8000))}
                    opacity={0.7}
                  />
                )
              })}
              {graph.nodes.map((n, i) => {
                const count = Math.max(graph.nodes.length, 1)
                const x = 210 + Math.cos((i / count) * Math.PI * 2) * 130
                const y = 180 + Math.sin((i / count) * Math.PI * 2) * 110
                const fill = n.role === 'mule' ? 'var(--signal)' : n.role === 'agent' ? 'var(--accent)' : 'var(--ink-2)'
                return (
                  <g key={n.id} transform={`translate(${x},${y})`}>
                    <circle r={n.role === 'mule' ? 10 : 6} fill={fill} />
                    <title>{`${n.id} (${n.role})`}</title>
                  </g>
                )
              })}
            </svg>
            <ul className="mt-3 flex flex-wrap gap-4 text-[0.8rem] text-muted">
              <li><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-[var(--ink-2)]" />{t('nw.legend.sender')}</li>
              <li><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-[var(--signal)]" />{t('nw.legend.mule')}</li>
              <li><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />{t('nw.legend.agent')}</li>
            </ul>
          </Panel>
        </div>
      )}
    </>
  )
}
