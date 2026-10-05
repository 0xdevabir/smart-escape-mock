import { Download, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHead, Panel, RiskBadge, StatusPill, TYPOLOGIES, TypologyTag } from '../components/ui'
import type { CaseStatus, Typology } from '../engine/types'
import { toCsv } from '../lib/csv'
import { download, local } from '../lib/storage'
import { useAlerts } from '../lib/useAlerts'
import { go, useApp } from '../state'

const STATUSES: CaseStatus[] = ['open', 'escalated', 'confirmed', 'dismissed']
const PAGE = 50

export default function Alerts() {
  const { i18n, config } = useApp()
  const { t } = i18n
  const all = useAlerts()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<CaseStatus | 'all'>(() => local.get('tl.f.status', 'open'))
  const [typ, setTyp] = useState<Typology | 'all'>('all')
  const [limit, setLimit] = useState(PAGE)

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return all.filter(
      (a) =>
        (status === 'all' || a.status === status) &&
        (typ === 'all' || a.s.typology === typ) &&
        (!needle || a.tx.id.toLowerCase().includes(needle) || a.tx.sender.toLowerCase().includes(needle) || a.tx.receiver.toLowerCase().includes(needle)),
    )
  }, [all, q, status, typ])

  const exportCsv = () =>
    download(
      `trustlens-alerts-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(
        rows.map((a) => ({
          id: a.tx.id, time: new Date(a.tx.ts).toISOString(), sender: a.tx.sender, receiver: a.tx.receiver, type: a.tx.type, amount: a.tx.amount,
          score: a.s.score, band: a.s.band, pattern: a.s.typology, status: a.status, rules: a.s.rules.map((r) => r.id).join(' '),
        })),
      ),
    )

  return (
    <>
      <PageHead
        title={t('al.title')}
        lede={t('al.lede', { t: config.threshold })}
        actions={
          <button className="btn" onClick={exportCsv} disabled={!rows.length}>
            <Download size={16} aria-hidden />
            {t('al.export')}
          </button>
        }
      />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" aria-hidden />
          <input className="field pl-9" value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE) }} placeholder={t('al.search')} aria-label={t('al.search')} />
        </div>
        <div>
          <label className="lbl" htmlFor="f-status">{t('al.filter.status')}</label>
          <select id="f-status" className="field" value={status} onChange={(e) => { const v = e.target.value as CaseStatus | 'all'; setStatus(v); local.set('tl.f.status', v); setLimit(PAGE) }}>
            <option value="all">{t('al.filter.all')}</option>
            {STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
          </select>
        </div>
        <div>
          <label className="lbl" htmlFor="f-typ">{t('al.filter.pattern')}</label>
          <select id="f-typ" className="field" value={typ} onChange={(e) => { setTyp(e.target.value as Typology | 'all'); setLimit(PAGE) }}>
            <option value="all">{t('al.filter.all')}</option>
            {TYPOLOGIES.map((p) => <option key={p} value={p}>{t(`typ.${p}`)}</option>)}
          </select>
        </div>
      </div>

      <Panel pad={false}>
        <div className="flex items-center justify-between border-b border-line px-5 py-3 text-[0.88rem] text-ink-2">
          <span className="num">{t('al.count', { n: rows.length })}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>{t('al.col.tx')}</th>
                <th>{t('al.col.type')}</th>
                <th className="text-right">{t('al.col.amount')}</th>
                <th>{t('al.col.pattern')}</th>
                <th>{t('al.col.score')}</th>
                <th>{t('al.col.status')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map((a) => (
                <tr key={a.tx.id} className="row-link" onClick={() => go(`alerts/${encodeURIComponent(a.tx.id)}`)}>
                  <td>
                    <a href={`#/alerts/${encodeURIComponent(a.tx.id)}`} className="font-semibold text-link no-underline hover:underline" onClick={(e) => e.stopPropagation()}>{a.tx.id}</a>
                    <div className="num text-[0.8rem] text-muted">{i18n.date(a.tx.ts)} · {a.tx.sender} → {a.tx.receiver}</div>
                  </td>
                  <td className="whitespace-nowrap">{t(`tx.${a.tx.type}`)}</td>
                  <td className="num text-right font-medium">{i18n.money(a.tx.amount)}</td>
                  <td><TypologyTag typ={a.s.typology} /></td>
                  <td><RiskBadge s={a.s} /></td>
                  <td><StatusPill status={a.status} /></td>
                </tr>
              ))}
              {!rows.length && (
                <tr><td colSpan={6} className="py-10 text-center text-ink-2">{t('al.empty')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {rows.length > limit && (
          <div className="border-t border-line p-3 text-center">
            <button className="btn" onClick={() => setLimit((l) => l + PAGE)}>{t('al.more', { n: Math.min(PAGE, rows.length - limit) })}</button>
          </div>
        )}
      </Panel>
    </>
  )
}
