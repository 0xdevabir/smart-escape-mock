import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import RiskRibbon from '../components/RiskRibbon'
import { PageHead, Panel, RiskBadge, Stat, StatusPill, TYP_COLOR, TYPOLOGIES, TypologyTag } from '../components/ui'
import { daysCovered } from '../engine/pipeline'
import { bstDayStart, DAY } from '../engine/time'
import { useAlerts } from '../lib/useAlerts'
import { go, useApp } from '../state'

export default function Overview() {
  const { i18n, dataset, evaluation, config } = useApp()
  const { t } = i18n
  const alerts = useAlerts()
  const ds = dataset!
  const open = alerts.filter((a) => a.status === 'open')
  const reviewed = alerts.length - open.length
  const start = ds.txs[0]?.ts ?? 0
  const end = ds.txs[ds.txs.length - 1]?.ts ?? 0

  const byType = useMemo(
    () => TYPOLOGIES.map((typ) => ({ typ, n: alerts.filter((a) => a.s.typology === typ).length, amt: alerts.filter((a) => a.s.typology === typ).reduce((x, a) => x + a.tx.amount, 0) })).filter((r) => r.n),
    [alerts],
  )
  const maxN = Math.max(1, ...byType.map((r) => r.n))

  const daily = useMemo(() => {
    const m = new Map<number, number>()
    for (let d = bstDayStart(start); d <= end; d += DAY) m.set(d, 0)
    for (const a of alerts) {
      const d = bstDayStart(a.tx.ts)
      m.set(d, (m.get(d) ?? 0) + 1)
    }
    return [...m.entries()].map(([d, n]) => ({ d, label: i18n.day(d), n }))
  }, [alerts, start, end, i18n])

  return (
    <>
      <PageHead
        title={t('ov.title')}
        lede={t('ov.lede', { n: ds.txs.length, d: daysCovered(ds), src: t(ds.source === 'synthetic' ? 'ov.src.synthetic' : 'ov.src.import') })}
      />

      <section className="panel mb-5 grid grid-cols-2 gap-x-6 gap-y-5 p-5 md:grid-cols-3 xl:grid-cols-5">
        <Stat label={t('ov.kpi.tx')} value={i18n.num(ds.txs.length)} />
        <Stat label={t('ov.kpi.alerts')} value={i18n.num(open.length)} sub={`${i18n.t('md.threshold')} ${i18n.num(config.threshold)}`} />
        <Stat label={t('ov.kpi.atRisk')} value={i18n.money(open.reduce((x, a) => x + a.tx.amount, 0))} />
        <Stat label={t('ov.kpi.reviewed')} value={i18n.num(reviewed)} sub={alerts.length ? i18n.pct(reviewed / alerts.length) : undefined} />
        <Stat
          label={t('ov.kpi.caught')}
          value={evaluation ? i18n.pct(evaluation.at.recall) : '–'}
          sub={evaluation ? `${i18n.money(evaluation.at.caughtAmount)} / ${i18n.money(evaluation.at.fraudAmount)}` : undefined}
        />
      </section>

      <Panel title={t('ov.ribbon')} hint={t('ov.ribbonHint')} className="mb-5">
        {alerts.length ? (
          <RiskRibbon points={alerts.map((a) => ({ tx: a.tx, s: a.s, reviewed: a.status !== 'open' }))} start={start} end={end} threshold={config.threshold} />
        ) : (
          <p className="text-ink-2">{t('ov.noAlerts')}</p>
        )}
      </Panel>

      <div className="mb-5 grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <Panel title={t('ov.byType')}>
          <ul className="space-y-3.5">
            {byType.map((r) => (
              <li key={r.typ}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-[0.9rem]">
                  <TypologyTag typ={r.typ} />
                  <span className="num text-ink-2">
                    <b className="text-ink">{i18n.num(r.n)}</b> · {i18n.money(r.amt)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-surface-3">
                  <div className="h-full rounded-full" style={{ width: `${(r.n / maxN) * 100}%`, background: TYP_COLOR[r.typ] }} />
                </div>
              </li>
            ))}
            {!byType.length && <li className="text-ink-2">{t('ov.noAlerts')}</li>}
          </ul>
        </Panel>
        <Panel title={t('ov.daily')}>
          <div className="h-[210px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--grid)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted)' }} tickLine={false} axisLine={false} tickFormatter={(v) => i18n.num(v)} />
                <Tooltip
                  cursor={{ fill: 'var(--surface-2)' }}
                  contentStyle={{ background: 'var(--glass-strong)', backdropFilter: 'blur(20px)', border: 0, borderRadius: 12, boxShadow: 'var(--shadow-float)', fontSize: 13 }}
                  labelStyle={{ color: 'var(--ink)', fontWeight: 600 }}
                  formatter={(v) => [i18n.num(Number(v)), t('ov.kpi.alerts')]}
                />
                <Bar dataKey="n" fill="var(--c-ato)" radius={[6, 6, 6, 6]} maxBarSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <Panel
        title={t('ov.topAlerts')}
        pad={false}
        actions={
          <a href="#/alerts" className="btn btn-primary no-underline">
            {t('ov.viewQueue')}
          </a>
        }
      >
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>{t('al.col.tx')}</th>
                <th>{t('al.col.pattern')}</th>
                <th className="text-right">{t('al.col.amount')}</th>
                <th>{t('al.col.score')}</th>
                <th>{t('al.col.status')}</th>
              </tr>
            </thead>
            <tbody>
              {open.slice(0, 6).map((a) => (
                <tr key={a.tx.id} className="row-link" onClick={() => go(`alerts/${encodeURIComponent(a.tx.id)}`)}>
                  <td>
                    <a href={`#/alerts/${encodeURIComponent(a.tx.id)}`} className="font-semibold text-link no-underline hover:underline" onClick={(e) => e.stopPropagation()}>
                      {a.tx.id}
                    </a>
                    <div className="num text-[0.8rem] text-muted">{i18n.date(a.tx.ts)}</div>
                  </td>
                  <td>
                    <TypologyTag typ={a.s.typology} />
                  </td>
                  <td className="num text-right font-medium">{i18n.money(a.tx.amount)}</td>
                  <td>
                    <RiskBadge s={a.s} />
                  </td>
                  <td>
                    <StatusPill status={a.status} />
                  </td>
                </tr>
              ))}
              {!open.length && (
                <tr>
                  <td colSpan={5} className="text-ink-2">
                    {t('ov.noAlerts')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}
