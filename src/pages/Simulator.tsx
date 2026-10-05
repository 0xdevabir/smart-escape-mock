import { useMemo, useState } from 'react'
import { TX_TYPES } from '../engine/generator'
import { scoreOne } from '../engine/pipeline'
import { bstHour } from '../engine/time'
import type { Channel, Tx, TxType } from '../engine/types'
import { PageHead, Panel, RiskBadge, ScoreMeter, TypologyTag } from '../components/ui'
import { reasonText } from '../lib/explain'
import { useApp } from '../state'

type Form = {
  sender: string
  type: TxType
  amount: number
  hour: number
  newDevice: boolean
  newRecipient: boolean
  newLocation: boolean
  fanIn: number
}

const PRESETS: Record<string, Partial<Form>> = {
  normal: { type: 'payment', amount: 450, hour: 14, newDevice: false, newRecipient: false, newLocation: false, fanIn: 1 },
  ato: { type: 'send_money', amount: 18000, hour: 2, newDevice: true, newRecipient: true, newLocation: true, fanIn: 1 },
  scam: { type: 'send_money', amount: 25000, hour: 11, newDevice: false, newRecipient: true, newLocation: false, fanIn: 1 },
}

export default function Simulator() {
  const { i18n, dataset, result, config } = useApp()
  const { t } = i18n
  const wallets = useMemo(
    () => (dataset ? dataset.accounts.filter((a) => a.kind === 'customer').map((a) => a.id).slice(0, 80) : []),
    [dataset],
  )
  const [form, setForm] = useState<Form>(() => ({
    sender: wallets[0] ?? 'CU00001',
    type: 'send_money',
    amount: 5000,
    hour: 14,
    newDevice: false,
    newRecipient: true,
    newLocation: false,
    fanIn: 1,
  }))

  const scored = useMemo(() => {
    if (!dataset || !result) return null
    const senderTxs = dataset.txs.filter((tx) => tx.sender === form.sender)
    const last = senderTxs[senderTxs.length - 1]
    const baseTs = last?.ts ?? dataset.txs[dataset.txs.length - 1]?.ts ?? Date.now()
    const day = new Date(baseTs)
    day.setUTCHours(0, 0, 0, 0)
    // rebuild hour in BST via offsetting from a known tx hour
    const sample = last ?? dataset.txs[0]
    const sampleHour = sample ? bstHour(sample.ts) : 12
    const ts = (sample?.ts ?? baseTs) + (form.hour - sampleHour) * 3_600_000

    const tx: Tx = {
      id: 'SIM-LIVE',
      ts,
      sender: form.sender,
      receiver: form.newRecipient ? 'SIM-NEW-RCV' : last?.receiver ?? 'MR00001',
      type: form.type,
      amount: form.amount,
      device: form.newDevice ? 'SIM-NEW-DEVICE' : last?.device ?? `D-${form.sender.slice(2)}`,
      location: form.newLocation ? 'Khulna' : last?.location ?? 'Dhaka',
      channel: 'app' as Channel,
    }

    // clone builder state by replaying sender history through a fresh compute on synthetic overrides
    const { builder, artifacts } = result
    // Use featurize path: mutate a copy of features via compute on a synthetic tx against current builder.
    // FeatureBuilder is stateful — clone via compute on builder after copying states is hard; instead overlay flags.
    const { f, ctx } = builder.compute(tx)
    const overridden = {
      ...f,
      newDevice: form.newDevice ? 1 : f.newDevice,
      newRecipient: form.newRecipient ? 1 : 0,
      newLocation: form.newLocation ? 1 : f.newLocation,
      nightHour: form.hour < 5 ? 1 : 0,
      recvFanIn24h: Math.log1p(Math.max(form.fanIn, 1)),
      isCashOut: form.type === 'cash_out' ? 1 : 0,
      isSend: form.type === 'send_money' ? 1 : 0,
    }
    const ctx2 = { ...ctx, hour: form.hour, fanIn: Math.max(form.fanIn, ctx.fanIn) }
    const s = scoreOne(overridden, tx, ctx2, artifacts, config)
    return { s, tx, ctx: ctx2, history: ctx.history, typical: ctx.typicalAmount }
  }, [dataset, result, form, config])

  if (!dataset || !result) return null

  return (
    <>
      <PageHead title={t('sm.title')} lede={t('sm.lede')} />

      <div className="mb-4 flex flex-wrap gap-2">
        <span className="self-center text-[0.85rem] text-muted">{t('sm.presets')}</span>
        {(['normal', 'ato', 'scam'] as const).map((key) => (
          <button
            key={key}
            type="button"
            className="btn"
            onClick={() => setForm((f) => ({ ...f, ...PRESETS[key] }))}
          >
            {t(`sm.preset.${key}`)}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <Panel>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="lbl" htmlFor="sm-wallet">{t('sm.wallet')}</label>
              <select
                id="sm-wallet"
                className="field"
                value={form.sender}
                onChange={(e) => setForm((f) => ({ ...f, sender: e.target.value }))}
              >
                {wallets.map((id) => (
                  <option key={id} value={id}>{id}</option>
                ))}
              </select>
              {scored && (
                <p className="mt-1.5 text-[0.85rem] text-muted">
                  {t('sm.walletHistory', { n: scored.history, typical: i18n.money(scored.typical) })}
                </p>
              )}
            </div>
            <div>
              <label className="lbl" htmlFor="sm-type">{t('sm.type')}</label>
              <select id="sm-type" className="field" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as TxType }))}>
                {TX_TYPES.map((ty) => <option key={ty} value={ty}>{ty}</option>)}
              </select>
            </div>
            <div>
              <label className="lbl" htmlFor="sm-amount">{t('sm.amount')}</label>
              <input id="sm-amount" className="field" type="number" min={10} value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) || 0 }))} />
            </div>
            <div>
              <label className="lbl" htmlFor="sm-hour">{t('sm.hour')}</label>
              <input id="sm-hour" className="field" type="number" min={0} max={23} value={form.hour} onChange={(e) => setForm((f) => ({ ...f, hour: Math.min(23, Math.max(0, Number(e.target.value) || 0)) }))} />
            </div>
            <div>
              <label className="lbl" htmlFor="sm-fanin">{t('sm.fanIn')}</label>
              <input id="sm-fanin" className="field" type="number" min={1} max={30} value={form.fanIn} onChange={(e) => setForm((f) => ({ ...f, fanIn: Number(e.target.value) || 1 }))} />
            </div>
          </div>
          <div className="mt-4 space-y-2 text-[0.9rem] text-ink-2">
            <label className="flex items-center gap-3"><input type="checkbox" checked={form.newDevice} onChange={(e) => setForm((f) => ({ ...f, newDevice: e.target.checked }))} />{t('sm.newDevice')}</label>
            <label className="flex items-center gap-3"><input type="checkbox" checked={form.newRecipient} onChange={(e) => setForm((f) => ({ ...f, newRecipient: e.target.checked }))} />{t('sm.newRecipient')}</label>
            <label className="flex items-center gap-3"><input type="checkbox" checked={form.newLocation} onChange={(e) => setForm((f) => ({ ...f, newLocation: e.target.checked }))} />{t('sm.newLocation')}</label>
          </div>
        </Panel>

        {scored && (
          <Panel title={t('sm.result')}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <RiskBadge s={scored.s} size="lg" />
              <TypologyTag typ={scored.s.typology} />
            </div>
            <ScoreMeter score={scored.s.score} threshold={config.threshold} band={scored.s.band} />
            <p className="mt-4 text-[0.95rem] text-ink-2">
              {scored.s.band === 'high'
                ? t('sm.decision.high')
                : scored.s.score >= config.threshold
                  ? t('sm.decision.medium', { t: config.threshold })
                  : t('sm.decision.low')}
            </p>
            <ul className="mt-4 space-y-2 text-[0.9rem] text-ink-2">
              {scored.s.reasons.map((r) => (
                <li key={`${r.kind}-${r.key}`} className="flex gap-2">
                  <span aria-hidden className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-signal" />
                  {reasonText(r, scored.tx, scored.ctx, i18n)}
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </>
  )
}
