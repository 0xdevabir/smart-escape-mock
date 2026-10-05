import { DEFAULT_MODELS, type Provider } from '../lib/ai'
import { PageHead, Panel } from '../components/ui'
import type { Lang } from '../i18n'
import { useApp } from '../state'

export default function SettingsPage() {
  const { i18n, prefs, setPrefs, ai, setAi } = useApp()
  const { t } = i18n

  return (
    <>
      <PageHead title={t('st.title')} />

      <div className="mx-auto grid max-w-2xl gap-5">
        <Panel title={t('st.analyst')}>
          <input
            className="field"
            value={prefs.analyst}
            onChange={(e) => setPrefs({ analyst: e.target.value })}
            aria-label={t('st.analyst')}
          />
        </Panel>

        <Panel title={t('st.language')}>
          <div className="flex flex-wrap gap-2">
            {(['en', 'bn'] as Lang[]).map((lang) => (
              <button
                key={lang}
                type="button"
                className={`btn ${prefs.lang === lang ? 'btn-primary' : ''}`}
                aria-pressed={prefs.lang === lang}
                onClick={() => setPrefs({ lang })}
              >
                {lang === 'en' ? 'English' : 'বাংলা'}
              </button>
            ))}
          </div>
          <label className="mt-4 flex items-start gap-3 text-[0.9rem] text-ink-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={prefs.bnDigits}
              onChange={(e) => setPrefs({ bnDigits: e.target.checked })}
            />
            {t('st.digits')}
          </label>
        </Panel>

        <Panel title={t('st.theme')}>
          <div className="flex flex-wrap gap-2">
            {(['light', 'dark'] as const).map((theme) => (
              <button
                key={theme}
                type="button"
                className={`btn ${prefs.theme === theme ? 'btn-primary' : ''}`}
                aria-pressed={prefs.theme === theme}
                onClick={() => setPrefs({ theme })}
              >
                {theme === 'light' ? 'Light' : 'Dark'}
              </button>
            ))}
          </div>
        </Panel>

        <Panel title={t('st.ai')} hint={t('st.aiHint')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="lbl" htmlFor="ai-provider">{t('st.provider')}</label>
              <select
                id="ai-provider"
                className="field"
                value={ai.provider}
                onChange={(e) => {
                  const provider = e.target.value as Provider
                  setAi({ provider, model: DEFAULT_MODELS[provider] })
                }}
              >
                <option value="anthropic">Anthropic</option>
                <option value="openai">OpenAI</option>
                <option value="gemini">Gemini</option>
              </select>
            </div>
            <div>
              <label className="lbl" htmlFor="ai-model">{t('st.model')}</label>
              <input
                id="ai-model"
                className="field"
                value={ai.model}
                onChange={(e) => setAi({ model: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="lbl" htmlFor="ai-key">{t('st.key')}</label>
            <input
              id="ai-key"
              className="field"
              type="password"
              autoComplete="off"
              placeholder={t('st.keyPh')}
              value={ai.key}
              onChange={(e) => setAi({ key: e.target.value })}
            />
          </div>
          <label className="mt-4 flex items-start gap-3 text-[0.9rem] text-ink-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={ai.remember}
              onChange={(e) => setAi({ remember: e.target.checked })}
            />
            {t('st.remember')}
          </label>
          <p className="mt-3 text-[0.85rem] leading-relaxed text-muted">{t('st.keyWarn')}</p>
        </Panel>
      </div>
    </>
  )
}
