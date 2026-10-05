import { useMemo, useState } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'
import { RULES, featureImportance } from '../engine/pipeline'
import { PageHead, Panel, Stat, toast } from '../components/ui'
import { useApp } from '../state'

export default function ModelPage() {
  const { i18n, result, evaluation, config, setConfig, retrain } = useApp()
  const { t } = i18n
  const importance = useMemo(() => (result ? featureImportance(result.artifacts).slice(0, 10) : []), [result])
  const [dim, setDim] = useState('segment')

  if (!result) return null

  const mode = result.artifacts.mode
  const fair = evaluation?.fairness.filter((f) => f.dimension === dim) ?? []
  const overallFpr = evaluation?.at.fpr ?? 0

  return (
    <>
      <PageHead
        title={t('md.title')}
        lede={t('md.lede')}
        actions={
          <button
            type="button"
            className="btn"
            onClick={() => {
              const n = retrain()
              toast(t('md.retrained', { n }))
            }}
          >
            {t('md.retrain')}
          </button>
        }
      />

      <p className="mb-5 text-[0.95rem] text-ink-2">
        {mode === 'supervised'
          ? t('md.mode.supervised', { n: result.artifacts.trainRows, p: i18n.num(result.artifacts.trainPositives) })
          : t('md.mode.transfer', { n: result.artifacts.trainRows })}
      </p>

      {!evaluation ? (
        <Panel>
          <p className="text-ink-2">{t('md.noEval')}</p>
        </Panel>
      ) : (
        <>
          <section className="panel mb-5 grid grid-cols-2 gap-x-6 gap-y-5 p-5 md:grid-cols-4">
            <Stat label={t('md.aucHybrid')} value={i18n.num(evaluation.aucHybrid, 3)} sub={t('md.auc')} />
            <Stat label={t('md.aucModel')} value={i18n.num(evaluation.aucModel, 3)} />
            <Stat label={t('md.aucRules')} value={i18n.num(evaluation.aucRules, 3)} />
            <Stat label={t('md.threshold')} value={i18n.num(config.threshold)} sub={t('md.thresholdHint')} />
          </section>

          <div className="mb-5">
            <label className="lbl" htmlFor="threshold">{t('md.threshold')}</label>
            <input
              id="threshold"
              type="range"
              min={20}
              max={90}
              value={config.threshold}
              className="w-full"
              onChange={(e) => setConfig({ threshold: Number(e.target.value) })}
            />
          </div>

          <div className="mb-5 grid gap-5 lg:grid-cols-2">
            <Panel title={t('md.impact')}>
              <dl className="space-y-3 text-[0.95rem]">
                <div className="flex justify-between gap-3"><dt className="text-muted">{t('md.caught')}</dt><dd className="num font-medium">{i18n.money(evaluation.at.caughtAmount)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted">{t('md.missed')}</dt><dd className="num font-medium">{i18n.money(evaluation.at.fraudAmount - evaluation.at.caughtAmount)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted">{t('md.falseAlerts')}</dt><dd className="num font-medium">{i18n.num(evaluation.at.fp)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted">{t('md.hours')}</dt><dd className="num font-medium">{t('md.hoursVal', { h: i18n.num(((evaluation.at.tp + evaluation.at.fp) * 4) / 60, 1) })}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted">{t('md.precision')}</dt><dd className="num font-medium" title={t('md.precisionHint')}>{i18n.pct(evaluation.at.precision, 1)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted">{t('md.recall')}</dt><dd className="num font-medium" title={t('md.recallHint')}>{i18n.pct(evaluation.at.recall, 1)}</dd></div>
              </dl>
              <div className="mt-4 grid grid-cols-2 gap-2 text-center text-[0.85rem]">
                <div className="rounded-lg bg-surface-2 p-3"><div className="text-muted">{t('md.tp')}</div><div className="num text-lg font-bold">{i18n.num(evaluation.at.tp)}</div></div>
                <div className="rounded-lg bg-surface-2 p-3"><div className="text-muted">{t('md.fp')}</div><div className="num text-lg font-bold">{i18n.num(evaluation.at.fp)}</div></div>
                <div className="rounded-lg bg-surface-2 p-3"><div className="text-muted">{t('md.fn')}</div><div className="num text-lg font-bold">{i18n.num(evaluation.at.fn)}</div></div>
                <div className="rounded-lg bg-surface-2 p-3"><div className="text-muted">{t('md.tn')}</div><div className="num text-lg font-bold">{i18n.num(evaluation.at.tn)}</div></div>
              </div>
            </Panel>

            <Panel title={t('md.curve')}>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={evaluation.curve}>
                    <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" />
                    <XAxis dataKey="t" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="precision" stroke="var(--signal)" dot={false} name={t('md.precision')} />
                    <Line type="monotone" dataKey="recall" stroke="var(--accent)" dot={false} name={t('md.recall')} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>

          <div className="mb-5 grid gap-5 lg:grid-cols-2">
            <Panel title={t('md.importance')} hint={t('md.importanceHint')}>
              <ul className="space-y-2.5">
                {importance.map((f) => (
                  <li key={f.key} className="flex items-center gap-3 text-[0.9rem]">
                    <span className="w-28 truncate text-muted">{f.key}</span>
                    <div className="h-2 flex-1 rounded-full bg-surface-3">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, Math.abs(f.weight) * 40)}%`,
                          background: f.weight >= 0 ? 'var(--signal)' : 'var(--accent)',
                          marginLeft: f.weight < 0 ? 'auto' : undefined,
                        }}
                      />
                    </div>
                    <span className="num w-14 text-right text-ink-2">{i18n.num(f.weight, 2)}</span>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel title={t('md.fairness')} hint={t('md.fairnessHint')}>
              <div className="mb-3 flex flex-wrap gap-2">
                {(['segment', 'region', 'age'] as const).map((d) => (
                  <button key={d} type="button" className={`btn ${dim === d ? 'btn-primary' : ''}`} onClick={() => setDim(d)}>
                    {t(`md.dim.${d}`)}
                  </button>
                ))}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[0.9rem]">
                  <thead className="text-[0.78rem] text-muted">
                    <tr>
                      <th className="py-2 font-medium">{t('md.fair.group')}</th>
                      <th className="py-2 font-medium">{t('md.fair.n')}</th>
                      <th className="py-2 font-medium">{t('md.fair.fpr')}</th>
                      <th className="py-2 font-medium">{t('md.fair.flag')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fair.map((f) => {
                      const flagged = overallFpr > 0 && f.fpr > overallFpr * 1.5
                      return (
                        <tr key={f.group} className="border-t border-line">
                          <td className="py-2">{f.group}</td>
                          <td className="num py-2">{i18n.num(f.n)}</td>
                          <td className="num py-2">{i18n.pct(f.fpr, 1)}</td>
                          <td className="py-2">{flagged ? t('md.fair.flag') : t('md.fair.ok')}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        </>
      )}

      <Panel title={t('md.rules')} hint={t('md.rulesHint')}>
        <ul className="space-y-3">
          {RULES.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 text-[0.95rem]">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={config.rules[r.id] !== false}
                  onChange={(e) => setConfig({ rules: { ...config.rules, [r.id]: e.target.checked } })}
                />
                <span>{r.id}</span>
              </label>
              <span className="num text-muted">{t('md.floor', { n: r.floor })}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  )
}
