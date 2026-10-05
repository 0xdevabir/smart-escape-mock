import { PageHead, Panel } from '../components/ui'
import { useApp } from '../state'

export default function About() {
  const { i18n } = useApp()
  const { t, list } = i18n

  return (
    <>
      <PageHead title={t('ab.title')} />

      <ol className="panel mb-5 grid gap-3 p-5 sm:grid-cols-5">
        {list('ab.flow').map((step, i) => (
          <li key={step} className="flex gap-3 text-[0.9rem] leading-snug text-ink-2">
            <span className="num flex h-7 w-7 flex-none items-center justify-center rounded-full bg-surface-3 text-[0.8rem] font-bold text-ink">{i + 1}</span>
            {step}
          </li>
        ))}
      </ol>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title={t('ab.problem')}>
          <p className="text-[0.95rem] leading-relaxed text-ink-2">{t('ab.problemText')}</p>
        </Panel>
        <Panel title={t('ab.ai')}>
          <p className="text-[0.95rem] leading-relaxed text-ink-2">{t('ab.aiText')}</p>
        </Panel>
        <Panel title={t('ab.responsible')}>
          <ul className="space-y-2.5 text-[0.95rem] leading-relaxed text-ink-2">
            {list('ab.resp').map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-signal" />
                {item}
              </li>
            ))}
          </ul>
        </Panel>
        <div className="space-y-5">
          <Panel title={t('ab.scale')}>
            <p className="text-[0.95rem] leading-relaxed text-ink-2">{t('ab.scaleText')}</p>
          </Panel>
          <Panel title={t('ab.limits')}>
            <p className="text-[0.95rem] leading-relaxed text-ink-2">{t('ab.limitsText')}</p>
          </Panel>
        </div>
      </div>
    </>
  )
}
