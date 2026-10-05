import { BookOpen, Database, FlaskConical, LayoutDashboard, Menu, Moon, Network, Scale, Settings, ShieldAlert, Sun, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Toast } from './components/ui'
import type { Key } from './i18n'
import About from './pages/About'
import AlertDetail from './pages/AlertDetail'
import Alerts from './pages/Alerts'
import DataPage from './pages/Data'
import ModelPage from './pages/Model'
import NetworkPage from './pages/Network'
import Overview from './pages/Overview'
import SettingsPage from './pages/Settings'
import Simulator from './pages/Simulator'
import { useApp, useHashRoute } from './state'

const NAV: { path: string; key: Key; icon: typeof LayoutDashboard }[] = [
  { path: 'overview', key: 'nav.overview', icon: LayoutDashboard },
  { path: 'alerts', key: 'nav.alerts', icon: ShieldAlert },
  { path: 'network', key: 'nav.network', icon: Network },
  { path: 'simulator', key: 'nav.simulator', icon: FlaskConical },
  { path: 'model', key: 'nav.model', icon: Scale },
  { path: 'data', key: 'nav.data', icon: Database },
  { path: 'settings', key: 'nav.settings', icon: Settings },
  { path: 'about', key: 'nav.about', icon: BookOpen },
]

function Wordmark() {
  const { i18n } = useApp()
  return (
    <a href="#/overview" className="flex items-center gap-2.5 no-underline">
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="8" fill="var(--ink)" />
        <circle cx="14" cy="14" r="7" fill="none" stroke="var(--signal)" strokeWidth="3" />
        <path d="M19 19l6 6" stroke="var(--signal)" strokeWidth="3.2" strokeLinecap="round" />
      </svg>
      <span className="text-[1.15rem] font-extrabold tracking-tight text-ink">{i18n.t('appName')}</span>
    </a>
  )
}

function NavList({ current, alerts, onNavigate }: { current: string; alerts: number; onNavigate?: () => void }) {
  const { i18n } = useApp()
  return (
    <nav aria-label="Main">
      <ul className="space-y-0.5">
        {NAV.map(({ path, key, icon: Icon }) => {
          const active = current === path
          return (
            <li key={path}>
              <a
                href={`#/${path}`}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className={`relative flex items-center gap-3 rounded-md px-3 py-2 text-[0.93rem] font-medium no-underline ${active ? 'bg-surface-2 text-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink'}`}
              >
                {active && <span aria-hidden className="absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-full bg-signal" />}
                <Icon size={17} strokeWidth={2} aria-hidden />
                <span className="flex-1">{i18n.t(key)}</span>
                {path === 'alerts' && alerts > 0 && <span className="num rounded-full bg-ink px-1.5 text-[0.72rem] font-bold text-bg">{i18n.num(alerts)}</span>}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

function Controls() {
  const { i18n, prefs, setPrefs } = useApp()
  return (
    <div className="flex items-center gap-2">
      <button
        className="btn min-h-[34px] px-3"
        onClick={() => setPrefs({ lang: prefs.lang === 'en' ? 'bn' : 'en' })}
        lang={prefs.lang === 'en' ? 'bn' : 'en'}
        aria-label={prefs.lang === 'en' ? 'বাংলায় দেখুন' : 'Switch to English'}
      >
        {i18n.t('langSwitch')}
      </button>
      <button
        className="btn min-h-[34px] px-2.5"
        onClick={() => setPrefs({ theme: prefs.theme === 'dark' ? 'light' : 'dark' })}
        aria-label={prefs.theme === 'dark' ? i18n.t('themeLight') : i18n.t('themeDark')}
        title={prefs.theme === 'dark' ? i18n.t('themeLight') : i18n.t('themeDark')}
      >
        {prefs.theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </button>
    </div>
  )
}

export default function App() {
  const { i18n, result, busy, decisions, config } = useApp()
  const route = useHashRoute()
  const [menu, setMenu] = useState(false)
  useEffect(() => setMenu(false), [route[0]])

  const openAlerts = result ? result.scored.filter((s) => s.score >= config.threshold && (decisions[s.txId]?.status ?? 'open') === 'open').length : 0

  let page
  if (!result) page = null
  else if (route[0] === 'alerts' && route[1]) page = <AlertDetail id={decodeURIComponent(route[1])} />
  else
    page = {
      overview: <Overview />,
      alerts: <Alerts />,
      network: <NetworkPage />,
      simulator: <Simulator />,
      model: <ModelPage />,
      data: <DataPage />,
      settings: <SettingsPage />,
      about: <About />,
    }[route[0]] ?? <Overview />

  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
        {i18n.t('skipToContent')}
      </a>

      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-line bg-surface px-3 py-5 lg:flex">
        <div className="px-2">
          <Wordmark />
          <p className="mt-2 text-[0.78rem] leading-snug text-muted">{i18n.t('tagline')}</p>
        </div>
        <div className="mt-6 flex-1">
          <NavList current={route[0]} alerts={openAlerts} />
        </div>
        <p className="px-2 text-[0.75rem] text-muted">{i18n.t('prototypeNote')}</p>
      </aside>

      {/* top bar */}
      <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur lg:ml-60">
        <div className="mx-auto flex h-14 max-w-[1240px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2 lg:hidden">
            <button className="btn min-h-[34px] px-2" onClick={() => setMenu(true)} aria-label="Menu" aria-expanded={menu}>
              <Menu size={18} />
            </button>
            <Wordmark />
          </div>
          <div className="hidden text-[0.85rem] text-muted lg:block">{busy ? i18n.t('loading') : ''}</div>
          <Controls />
        </div>
      </header>

      {/* mobile drawer */}
      {menu && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <button className="absolute inset-0 bg-black/40" aria-label="Close" onClick={() => setMenu(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto bg-surface px-3 py-4 shadow-xl">
            <div className="mb-5 flex items-center justify-between px-2">
              <Wordmark />
              <button className="btn min-h-[32px] px-2" onClick={() => setMenu(false)} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <NavList current={route[0]} alerts={openAlerts} onNavigate={() => setMenu(false)} />
            <p className="mt-6 px-2 text-[0.75rem] text-muted">{i18n.t('prototypeNote')}</p>
          </div>
        </div>
      )}

      <main id="main" className="lg:ml-60">
        <div className="mx-auto max-w-[1240px] px-4 py-7 sm:px-6 lg:py-9">
          {page ?? (
            <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-ink-2" role="status">
              <div className="h-1 w-48 overflow-hidden rounded-full bg-line">
                <div className="h-full w-1/3 animate-pulse rounded-full bg-signal" />
              </div>
              {i18n.t('loading')}
            </div>
          )}
        </div>
      </main>
      <Toast />
    </div>
  )
}
