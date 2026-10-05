import { useEffect, useMemo, useState } from 'react'
import { PageHead, Panel, RiskBadge, ScoreMeter, StatusPill, TypologyTag, toast } from '../components/ui'
import type { CaseStatus } from '../engine/types'
import { evidenceFor, nextSteps, reasonText } from '../lib/explain'
import { summarize } from '../lib/ai'
import { go, useApp } from '../state'

const STATUSES: CaseStatus[] = ['open', 'escalated', 'confirmed', 'dismissed']

export default function AlertDetail({ id }: { id: string }) {
  const { i18n, dataset, result, config, decisions, decide, audit, ai } = useApp()
  const { t } = i18n
  const idx = result?.byId.get(id)
  const tx = idx !== undefined ? dataset?.txs[idx] : undefined
  const s = idx !== undefined ? result?.scored[idx] : undefined
  const ctx = idx !== undefined ? result?.contexts[idx] : undefined
  const decision = decisions[id]
  const [note, setNote] = useState(decision?.note ?? '')
  const [status, setStatus] = useState<CaseStatus>(decision?.status ?? 'open')
  const [aiText, setAiText] = useState<string | null>(null)
  const [aiBusy, setAiBusy] = useState(false)

  useEffect(() => {
    setNote(decision?.note ?? '')
    setStatus(decision?.status ?? 'open')
    setAiText(null)
  }, [id, decision?.note, decision?.status])

  const related = useMemo(() => {
    if (!dataset || !result || !tx) return []
    return dataset.txs
      .map((row, i) => ({ tx: row, s: result.scored[i] }))
      .filter((r) => r.tx.sender === tx.sender && r.tx.id !== tx.id)
      .sort((a, b) => b.tx.ts - a.tx.ts)
      .slice(0, 8)
  }, [dataset, result, tx])

  const history = useMemo(() => audit.filter((a) => a.txId === id).sort((a, b) => b.at - a.at), [audit, id])

  if (!tx || !s || !ctx) {
    return (
      <>
        <PageHead title={t('dt.title', { id })} />
        <p className="text-ink-2">{t('dt.notFound', { id })}</p>
        <button type="button" className="btn mt-4" onClick={() => go('alerts')}>{t('dt.back')}</button>
      </>
    )
  }

  const evidence = evidenceFor(tx, s, ctx, i18n)
  const template = [
    t('dt.happened', {
      sender: tx.sender,
      amount: i18n.money(tx.amount),
      receiver: tx.receiver,
      type: tx.type,
      date: i18n.date(tx.ts),
      channel: tx.channel,
      device: tx.device,
      location: tx.location,
    }),
    t('dt.baseline', { n: ctx.history, typical: i18n.money(ctx.typicalAmount) }),
    ...s.reasons.map((r) => reasonText(r, tx, ctx, i18n)),
    ...nextSteps(s.typology, i18n),
  ].join('\n\n')

  const save = () => {
    decide(id, status, note)
    toast(t('dt.saved', { s: t(`status.${status}`) }))
  }

  const runAi = async () => {
    if (!ai.key) {
      toast(t('dt.aiNoKey'))
      return
    }
    setAiBusy(true)
    try {
      const text = await summarize(ai, evidence, i18n.lang)
      setAiText(text)
    } catch (err) {
      toast(t('dt.aiError', { msg: err instanceof Error ? err.message : String(err) }))
    } finally {
      setAiBusy(false)
    }
  }

  return (
    <>
      <PageHead
        title={t('dt.title', { id })}
        lede={<span className="inline-flex flex-wrap items-center gap-2"><RiskBadge s={s} size="lg" /><TypologyTag typ={s.typology} /><StatusPill status={decision?.status ?? 'open'} /></span>}
        actions={<button type="button" className="btn" onClick={() => go('alerts')}>{t('dt.back')}</button>}
      />

      <div className="mb-5 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Panel title={t('dt.q1')}>
          <p className="text-[0.95rem] leading-relaxed text-ink-2">
            {t('dt.happened', {
              sender: tx.sender,
              amount: i18n.money(tx.amount),
              receiver: tx.receiver,
              type: tx.type,
              date: i18n.date(tx.ts),
              channel: tx.channel,
              device: tx.device,
              location: tx.location,
            })}
          </p>
          <p className="mt-3 text-[0.9rem] text-muted">{t('dt.baseline', { n: ctx.history, typical: i18n.money(ctx.typicalAmount) })}</p>
        </Panel>

        <Panel title={t('dt.scoreParts')}>
          <ScoreMeter score={s.score} threshold={config.threshold} band={s.band} />
          <dl className="mt-4 space-y-2 text-[0.9rem]">
            <div className="flex justify-between gap-3"><dt className="text-muted">{t('dt.part.model')}</dt><dd className="num font-medium">{i18n.pct(s.mlProb, 1)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">{t('dt.part.anomaly')}</dt><dd className="num font-medium">{i18n.pct(s.anomaly, 1)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">{t('dt.part.rules')}</dt><dd className="num font-medium">{s.rules.length ? s.rules.map((r) => r.id).join(', ') : t('dt.noRules')}</dd></div>
          </dl>
        </Panel>
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Panel title={t('dt.q2')}>
          <ul className="space-y-2.5 text-[0.95rem] leading-relaxed text-ink-2">
            {s.reasons.map((r) => (
              <li key={`${r.kind}-${r.key}`} className="flex gap-2">
                <span aria-hidden className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-signal" />
                {reasonText(r, tx, ctx, i18n)}
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title={t('dt.q3')}>
          <ul className="space-y-2.5 text-[0.95rem] leading-relaxed text-ink-2">
            {nextSteps(s.typology, i18n).map((step) => (
              <li key={step} className="flex gap-2">
                <span aria-hidden className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-accent" />
                {step}
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title={t('dt.decision')} hint={t('dt.decisionHint')} className="mb-5">
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((st) => (
            <button key={st} type="button" className={`btn ${status === st ? 'btn-primary' : ''}`} aria-pressed={status === st} onClick={() => setStatus(st)}>
              {t(`status.${st}`)}
            </button>
          ))}
        </div>
        <label className="lbl mt-4" htmlFor="case-note">{t('dt.note')}</label>
        <textarea id="case-note" className="field min-h-[88px]" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('dt.notePh')} />
        <button type="button" className="btn btn-primary mt-3" onClick={save}>{t('dt.saved', { s: t(`status.${status}`) }).split(':')[0]}</button>
      </Panel>

      <Panel
        title={t('dt.ai')}
        className="mb-5"
        actions={
          <button type="button" className="btn" disabled={aiBusy} onClick={runAi}>
            {t('dt.aiRun')}
          </button>
        }
      >
        <p className="mb-3 text-[0.85rem] font-medium text-muted">{t('dt.aiTemplate')}</p>
        <pre className="whitespace-pre-wrap rounded-lg bg-surface-2 p-4 text-[0.9rem] leading-relaxed text-ink-2">{template}</pre>
        {aiText && (
          <>
            <p className="mt-4 mb-2 text-[0.85rem] text-muted">{t('dt.aiDisclaimer')}</p>
            <pre className="whitespace-pre-wrap rounded-lg border border-line p-4 text-[0.95rem] leading-relaxed">{aiText}</pre>
          </>
        )}
        {!ai.key && <p className="mt-3 text-[0.9rem] text-muted">{t('dt.aiNoKey')}</p>}
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title={t('dt.history')}>
          {history.length ? (
            <ul className="space-y-3 text-[0.9rem]">
              {history.map((h, i) => (
                <li key={`${h.at}-${i}`} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2 last:border-0">
                  <span>
                    {h.action === 'note' || h.action === 'ai_summary' ? (
                      <span className="text-ink">{h.action}</span>
                    ) : (
                      <StatusPill status={h.action} />
                    )}{' '}
                    <span className="text-muted">{h.analyst}</span>
                  </span>
                  <span className="num text-muted">{i18n.date(h.at)}</span>
                  {h.note && <p className="w-full text-ink-2">{h.note}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-2">{t('dt.noHistory')}</p>
          )}
        </Panel>
        <Panel title={t('dt.related')}>
          {related.length ? (
            <ul className="divide-y divide-line">
              {related.map((r) => (
                <li key={r.tx.id}>
                  <button type="button" className="flex w-full items-center justify-between gap-3 py-2.5 text-left text-[0.9rem] hover:text-ink" onClick={() => go(`alerts/${encodeURIComponent(r.tx.id)}`)}>
                    <span className="truncate">{r.tx.type} → {r.tx.receiver}</span>
                    <span className="num flex-none text-muted">{i18n.money(r.tx.amount)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-2">—</p>
          )}
        </Panel>
      </div>
    </>
  )
}
