import { bn, en, type Key } from './strings'

export type Lang = 'en' | 'bn'
export type { Key }

const dict = { en, bn }

export function makeT(lang: Lang, bnDigits: boolean) {
  const locale = lang === 'bn' && bnDigits ? 'bn-BD' : 'en-IN'
  const nf = new Intl.NumberFormat(locale)
  const digits = (s: string) => (locale === 'bn-BD' ? s.replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[+d]) : s)

  const num = (n: number, max = 0) => (Number.isFinite(n) ? new Intl.NumberFormat(locale, { maximumFractionDigits: max }).format(n) : '–')
  const t = (key: Key, vars?: Record<string, string | number>) => {
    let s: string = dict[lang][key] ?? en[key] ?? key
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, typeof v === 'number' ? nf.format(v) : v)
    return s
  }
  return {
    lang,
    locale,
    t,
    /** Pipe-separated lists in the dictionary become arrays. */
    list: (key: Key) => t(key).split('|'),
    num,
    money: (n: number) => `৳${num(Math.round(n))}`,
    pct: (x: number, max = 0) => (Number.isFinite(x) ? `${num(x * 100, max)}%` : '–'),
    digits,
    date: (ts: number) =>
      new Intl.DateTimeFormat(lang === 'bn' ? (bnDigits ? 'bn-BD' : 'bn-BD-u-nu-latn') : 'en-GB', {
        timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
      }).format(ts),
    day: (ts: number) =>
      new Intl.DateTimeFormat(lang === 'bn' ? (bnDigits ? 'bn-BD' : 'bn-BD-u-nu-latn') : 'en-GB', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short' }).format(ts),
  }
}

export type I18n = ReturnType<typeof makeT>
