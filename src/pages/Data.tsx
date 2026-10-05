import { useCallback, useState } from 'react'
import { DEFAULT_GEN, type GenOptions } from '../engine/generator'
import { daysCovered } from '../engine/pipeline'
import { PageHead, Panel, toast } from '../components/ui'
import { FIELDS, REQUIRED, autoMap, parseCsvFile, rowsToDataset, toCsv, type Mapping } from '../lib/csv'
import { download } from '../lib/storage'
import { useApp } from '../state'

const SAMPLE = `id,timestamp,sender,receiver,type,amount,device,location,channel,label
TX1,2026-08-02T10:15:00+06:00,CU00001,CU00002,send_money,1200,D-00001,Dhaka,app,0
TX2,2026-08-02T22:40:00+06:00,CU00001,AG00001,cash_out,9000,D-00001,Dhaka,agent,0
TX3,2026-08-03T02:10:00+06:00,CU00003,CU00099,send_money,18500,D-NEW,Khulna,app,1
`

export default function DataPage() {
  const { i18n, dataset, result, generate, setDataset, resetAll, audit, decisions, config } = useApp()
  const { t } = i18n
  const [opts, setOpts] = useState<GenOptions>({ ...DEFAULT_GEN })
  const [mapping, setMapping] = useState<Mapping | null>(null)
  const [rows, setRows] = useState<Record<string, string>[] | null>(null)
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])

  const onFile = useCallback(async (file: File) => {
    try {
      const parsed = await parseCsvFile(file)
      setFileName(file.name)
      setHeaders(parsed.headers)
      setRows(parsed.rows)
      setMapping(autoMap(parsed.headers))
    } catch (err) {
      toast(t('da.importErr', { msg: err instanceof Error ? err.message : String(err) }))
    }
  }, [t])

  const applyImport = () => {
    if (!rows || !mapping) return
    const missing = REQUIRED.filter((f) => !mapping[f])
    if (missing.length) {
      toast(t('da.missing', { c: missing.join(', ') }))
      return
    }
    const { dataset: ds, skipped } = rowsToDataset(rows, mapping, fileName)
    setDataset(ds)
    toast(t('da.imported', { n: ds.txs.length, file: fileName }) + (skipped ? ` ${t('da.skipped', { n: skipped })}` : ''))
    setRows(null)
    setMapping(null)
  }

  const fraud = dataset?.txs.filter((tx) => tx.label === 1).length ?? 0

  return (
    <>
      <PageHead title={t('da.title')} lede={t('da.lede')} />

      <Panel title={t('da.current')} className="mb-5">
        {dataset ? (
          <p className="text-[0.95rem] text-ink-2">
            {t('da.rows', { n: dataset.txs.length, a: dataset.accounts.length, f: fraud })}
            {' · '}
            {daysCovered(dataset)}d · {dataset.source}
          </p>
        ) : (
          <p className="text-ink-2">{t('loading')}</p>
        )}
      </Panel>

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Panel title={t('da.gen')} hint={t('da.genHint')}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="lbl" htmlFor="seed">{t('da.seed')}</label>
              <input id="seed" className="field" type="number" value={opts.seed} onChange={(e) => setOpts((o) => ({ ...o, seed: Number(e.target.value) || 0 }))} />
            </div>
            <div>
              <label className="lbl" htmlFor="customers">{t('da.customers')}</label>
              <input id="customers" className="field" type="number" min={50} max={2000} value={opts.customers} onChange={(e) => setOpts((o) => ({ ...o, customers: Number(e.target.value) || 50 }))} />
            </div>
            <div>
              <label className="lbl" htmlFor="days">{t('da.days')}</label>
              <input id="days" className="field" type="number" min={7} max={120} value={opts.days} onChange={(e) => setOpts((o) => ({ ...o, days: Number(e.target.value) || 7 }))} />
            </div>
            <div>
              <label className="lbl" htmlFor="intensity">{t('da.intensity')}</label>
              <input id="intensity" className="field" type="number" min={0.2} max={3} step={0.1} value={opts.fraudIntensity} onChange={(e) => setOpts((o) => ({ ...o, fraudIntensity: Number(e.target.value) || 1 }))} />
            </div>
          </div>
          <button type="button" className="btn btn-primary mt-4" onClick={() => generate(opts)}>{t('da.genBtn')}</button>
        </Panel>

        <Panel title={t('da.import')} hint={t('da.importHint')}>
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-line-strong bg-surface-2 px-4 py-8 text-center text-[0.9rem] text-ink-2">
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void onFile(f)
              }}
            />
            <span className="font-medium text-ink">{t('da.choose')}</span>
            <span className="mt-1 text-muted">{t('da.drop')}</span>
          </label>
          <button type="button" className="btn mt-3" onClick={() => download('trustlens-sample.csv', SAMPLE)}>{t('da.sample')}</button>

          {mapping && rows && (
            <div className="mt-4">
              <p className="mb-2 text-[0.85rem] font-medium text-muted">{t('da.mapping')}</p>
              <div className="grid gap-2">
                {FIELDS.map((f) => (
                  <div key={f} className="flex items-center gap-2 text-[0.85rem]">
                    <span className="w-24 font-medium">{f}{REQUIRED.includes(f) ? ' *' : ''}</span>
                    <select
                      className="field"
                      value={mapping[f] ?? ''}
                      onChange={(e) => setMapping((m) => ({ ...m, [f]: e.target.value || undefined }))}
                    >
                      <option value="">—</option>
                      {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <button type="button" className="btn btn-primary mt-3" onClick={applyImport}>{t('da.useImport')}</button>
            </div>
          )}
        </Panel>
      </div>

      <Panel title={t('da.export')} className="mb-5">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn"
            disabled={!dataset || !result}
            onClick={() => {
              if (!dataset || !result) return
              download(
                'trustlens-scored.csv',
                toCsv(
                  dataset.txs.map((tx, i) => ({
                    id: tx.id,
                    time: new Date(tx.ts).toISOString(),
                    sender: tx.sender,
                    receiver: tx.receiver,
                    type: tx.type,
                    amount: tx.amount,
                    score: result.scored[i].score,
                    band: result.scored[i].band,
                    pattern: result.scored[i].typology,
                    threshold: config.threshold,
                  })),
                ),
              )
            }}
          >
            {t('da.exportScored')}
          </button>
          <button
            type="button"
            className="btn"
            disabled={!result}
            onClick={() => {
              if (!dataset || !result) return
              const alerts = result.scored
                .map((s, i) => ({ tx: dataset.txs[i], s, status: decisions[s.txId]?.status ?? 'open' }))
                .filter((a) => a.s.score >= config.threshold)
              download(`trustlens-alerts.json`, JSON.stringify(alerts, null, 2), 'application/json')
            }}
          >
            {t('da.exportAlerts')}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() =>
              download(
                'trustlens-audit.csv',
                toCsv(audit.map((a) => ({ at: new Date(a.at).toISOString(), analyst: a.analyst, txId: a.txId, action: a.action, note: a.note ?? '' }))),
              )
            }
          >
            {t('da.exportAudit')}
          </button>
        </div>
      </Panel>

      <Panel title={t('da.assumptions')} className="mb-5">
        <ul className="space-y-2 text-[0.9rem] leading-relaxed text-ink-2">
          {i18n.list('da.assume').map((item) => (
            <li key={item} className="flex gap-2">
              <span aria-hidden className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-signal" />
              {item}
            </li>
          ))}
        </ul>
      </Panel>

      <button
        type="button"
        className="btn"
        onClick={() => {
          if (confirm(t('da.resetConfirm'))) {
            void resetAll().then(() => toast(t('da.cleared')))
          }
        }}
      >
        {t('da.reset')}
      </button>
    </>
  )
}
