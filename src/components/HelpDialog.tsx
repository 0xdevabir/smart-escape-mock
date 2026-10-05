import { useEffect, useRef } from 'react'

interface Props {
  t: (k: string, p?: Record<string, string | number>) => string
  onClose: () => void
}

const KEYS: [string, string][] = [
  ['R', 'key.reset'],
  ['E', 'key.lang'],
  ['S / H', 'key.mode'],
  ['← ↑ → ↓', 'key.arrows'],
  ['P', 'key.play'],
  ['Ctrl/⌘ Z', 'key.undo'],
  ['Ctrl/⌘ ⇧ Z · Ctrl Y', 'key.redo'],
  ['+ / − / 0', 'key.zoom'],
  ['Tab · Enter', 'key.tab'],
  ['?', 'key.help'],
  ['Esc', 'key.esc'],
]
const RULES = ['rules.1', 'rules.2', 'rules.3', 'rules.4', 'rules.5']
const CATALOG = ['cat.1', 'cat.2', 'cat.3', 'cat.4', 'cat.5', 'cat.6']

/** Keyboard shortcuts, the routing rules and the validation catalog in one modal. */
export function HelpDialog({ t, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal() // native modal: focus trap, Esc and backdrop for free
  }, [])

  return (
    <dialog ref={ref} className="help-dialog" aria-labelledby="help-title" onClose={onClose}
      onClick={(e) => { if (e.target === e.currentTarget) ref.current?.close() }}>
      <div className="help-body">
        <header>
          <h2 id="help-title">{t('help.title')}</h2>
          <button className="btn small" onClick={() => ref.current?.close()} autoFocus>{t('btn.close')}</button>
        </header>
        <section>
          <h3>{t('help.keys')}</h3>
          <dl className="keys">
            {KEYS.map(([k, d]) => (
              <div key={k}><dt><kbd>{k}</kbd></dt><dd>{t(d)}</dd></div>
            ))}
          </dl>
        </section>
        <section>
          <h3>{t('help.rules')}</h3>
          <ol>{RULES.map((k) => <li key={k}>{t(k)}</li>)}</ol>
        </section>
        <section>
          <h3>{t('help.catalog')}</h3>
          <ul>{CATALOG.map((k) => <li key={k}>{t(k)}</li>)}</ul>
        </section>
      </div>
    </dialog>
  )
}
