import { BookOpen, ChevronRight, Database, Ellipsis, FlaskConical, LayoutDashboard, Moon, Network, Scale, Settings, ShieldAlert, Sun } from 'lucide-react'
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

type NavItem = { path: string; key: Key; tab?: Key; icon: typeof LayoutDashboard }

const NAV: NavItem[] = [
  { path: 'overview', key: 'nav.overview', tab: 'tab.overview', icon: LayoutDashboard },
  { path: 'alerts', key: 'nav.alerts', tab: 'tab.alerts', icon: ShieldAlert },
  { path: 'network', key: 'nav.network', tab: 'tab.network', icon: Network },
  { path: 'simulator', key: 'nav.simulator', tab: 'tab.simulator', icon: FlaskConical },
  { path: 'model', key: 'nav.model', icon: Scale },
  { path: 'data', key: 'nav.data', icon: Database },
  { path: 'settings', key: 'nav.settings', icon: Settings },
  { path: 'about', key: 'nav.about', icon: BookOpen },
]
// Items with a short `tab` label get a slot in the phone tab bar; the rest live behind "More".
const TABS = NAV.filter((n) => n.tab)
const MORE = NAV.filter((n) => !n.tab)

function Wordmark() {
  const { i18n } = useApp()
  return (
    <a href="#/overview" className="flex items-center gap-2.5 no-underline">
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="9" fill="var(--tile)" />
        <circle cx="14" cy="14" r="7" fill="none" stroke="var(--accent)" strokeWidth="3" />
        <path d="M19 19l6 6" stroke="var(--accent)" strokeWidth="3.2" strokeLinecap="round" />
      </svg>
      <span className="text-[1.12rem] font-bold tracking-tight text-ink">{i18n.t('appName')}</span>
    </a>
  )
}

function Badge({ n }: { n: number }) {
  const { i18n } = useApp()
  return <span className="num min-w-[20px] rounded-full bg-high px-1.5 text-center text-[0.72rem] leading-5 font-semibold text-white">{i18n.num(n)}</span>
}

/** iPadOS-style sidebar list. */
function SidebarNav({ current, alerts }: { current: string; alerts: number }) {
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
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-[10px] px-3 py-2 text-[0.93rem] no-underline transition-colors duration-200 ${active ? 'bg-accent-wash font-semibold text-ink' : 'font-medium text-ink-2 hover:bg-surface-2 hover:text-ink'}`}
              >
                <Icon size={18} strokeWidth={active ? 2.3 : 2} className={active ? 'text-accent-ink' : 'text-muted'} aria-hidden />
                <span className="flex-1">{i18n.t(key)}</span>
                {path === 'alerts' && alerts > 0 && <Badge n={alerts} />}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/** iOS tab bar for phones; the last slot opens the "More" sheet. */
function TabBar({ current, alerts, onMore, moreOpen }: { current: string; alerts: number; onMore: () => void; moreOpen: boolean }) {
  const { i18n } = useApp()
  const moreActive = moreOpen || MORE.some((n) => n.path === current)
  const cls = (active: boolean) => `relative flex flex-1 flex-col items-center gap-0.5 pt-2 pb-1.5 text-[0.68rem] font-medium no-underline transition-colors ${active ? 'text-ink' : 'text-muted'}`
  return (
    <nav aria-label="Tabs" className="glass hairline-t pb-safe fixed inset-x-0 bottom-0 z-30 lg:hidden">
      <ul className="mx-auto flex max-w-xl">
        {TABS.map(({ path, tab, icon: Icon }) => {
          const active = current === path
          return (
            <li key={path} className="flex flex-1">
              <a href={`#/${path}`} aria-current={active ? 'page' : undefined} className={cls(active)}>
                <span className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors duration-200 ${active ? 'bg-accent-wash' : ''}`}>
                  <Icon size={21} strokeWidth={active ? 2.3 : 1.9} aria-hidden />
                </span>
                {i18n.t(tab!)}
                {path === 'alerts' && alerts > 0 && (
                  <span className="absolute top-1 left-1/2 ml-2">
                    <Badge n={alerts} />
                  </span>
                )}
              </a>
            </li>
          )
        })}
        <li className="flex flex-1">
          <button onClick={onMore} aria-expanded={moreOpen} className={`${cls(moreActive)} border-0 bg-transparent`}>
            <span className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors duration-200 ${moreActive ? 'bg-accent-wash' : ''}`}>
              <Ellipsis size={21} strokeWidth={moreActive ? 2.3 : 1.9} aria-hidden />
            </span>
            {i18n.t('nav.more')}
          </button>
        </li>
      </ul>
    </nav>
  )
}

/** Bottom sheet with a grouped inset list of the remaining sections. */
function MoreSheet({ current, onClose }: { current: string; onClose: () => void }) {
  const { i18n } = useApp()
  useEffect(() => {
    const on = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label={i18n.t('nav.more')}>
      <button className="anim-fade absolute inset-0 border-0 bg-black/35" aria-label="Close" onClick={onClose} />
      <div className="anim-sheet glass-strong pb-safe absolute inset-x-0 bottom-0 rounded-t-[22px] px-4 pt-2 pb-6 shadow-[var(--shadow-float)]">
        <div aria-hidden className="mx-auto mb-3 h-[5px] w-9 rounded-full bg-line-strong" />
        <div className="mb-3 flex items-center justify-between px-1">
          <h2 className="text-[1.2rem] font-bold tracking-tight">{i18n.t('nav.more')}</h2>
          <Controls />
        </div>
        <ul className="overflow-hidden rounded-[var(--radius)] bg-surface">
          {MORE.map(({ path, key, icon: Icon }, i) => (
            <li key={path}>
              <a
                href={`#/${path}`}
                onClick={onClose}
                aria-current={current === path ? 'page' : undefined}
                className="flex items-center gap-3 pl-4 text-[0.98rem] text-ink no-underline active:bg-surface-2"
              >
                <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[8px] bg-[var(--tile)] text-accent">
                  <Icon size={17} aria-hidden />
                </span>
                <span className={`flex flex-1 items-center gap-2 py-3 pr-4 ${i ? 'shadow-[inset_0_0.5px_0_var(--line-strong)]' : ''}`}>
                  <span className={`flex-1 ${current === path ? 'font-semibold' : ''}`}>{i18n.t(key)}</span>
                  <ChevronRight size={18} className="text-muted" aria-hidden />
                </span>
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-4 px-1 text-center text-[0.75rem] text-muted">{i18n.t('prototypeNote')}</p>
      </div>
    </div>
  )
}

function Controls() {
  const { i18n, prefs, setPrefs } = useApp()
  return (
    <div className="flex items-center gap-2">
      <div className="seg" role="group" aria-label="Language">
        <button aria-pressed={prefs.lang === 'en'} onClick={() => setPrefs({ lang: 'en' })} lang="en">
          EN
        </button>
        <button aria-pressed={prefs.lang === 'bn'} onClick={() => setPrefs({ lang: 'bn' })} lang="bn">
          বাং
        </button>
      </div>
      <button
        className="btn btn-icon min-h-[34px] w-[34px]"
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
  const [more, setMore] = useState(false)
  useEffect(() => setMore(false), [route[0]])

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
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-full focus:bg-surface focus:px-4 focus:py-2">
        {i18n.t('skipToContent')}
      </a>

      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col px-3 py-5 shadow-[inset_-0.5px_0_0_var(--line-strong)] lg:flex">
        <div className="px-2">
          <Wordmark />
          <p className="mt-2 text-[0.78rem] leading-snug text-muted">{i18n.t('tagline')}</p>
        </div>
        <div className="mt-6 flex-1">
          <SidebarNav current={route[0]} alerts={openAlerts} />
        </div>
        <p className="px-2 text-[0.75rem] text-muted">{i18n.t('prototypeNote')}</p>
      </aside>

      {/* frosted navigation bar */}
      <header className="glass hairline-b sticky top-0 z-30 lg:ml-64">
        <div className="mx-auto flex h-14 max-w-[1240px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="lg:hidden">
            <Wordmark />
          </div>
          <div className="hidden items-center gap-2 text-[0.85rem] text-muted lg:flex">
            {busy && <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-accent" />}
            {busy ? i18n.t('loading') : ''}
          </div>
          {/* on phones these live in the More sheet */}
          <div className="hidden sm:block">
            <Controls />
          </div>
        </div>
      </header>

      <main id="main" className="pb-24 lg:ml-64 lg:pb-0">
        <div key={route.join('/')} className="anim-page mx-auto max-w-[1240px] px-4 py-6 sm:px-6 lg:py-9">
          {page ?? (
            <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-ink-2" role="status">
              <span aria-hidden className="h-7 w-7 animate-spin rounded-full border-[2.5px] border-line-strong border-t-ink" />
              {i18n.t('loading')}
            </div>
          )}
        </div>
      </main>

      <TabBar current={route[0]} alerts={openAlerts} onMore={() => setMore(true)} moreOpen={more} />
      {more && <MoreSheet current={route[0]} onClose={() => setMore(false)} />}
      <Toast />
    </div>
  )
}
