import { logNormal, mulberry32, normal, pick, poisson, shuffle } from './rng'
import { bstTime, DAY, HOUR } from './time'
import type { Account, Channel, Dataset, Pattern, Segment, Tx, TxType } from './types'

export const DISTRICTS = [
  'Dhaka', 'Chattogram', 'Gazipur', 'Narayanganj', 'Sylhet', 'Rajshahi',
  'Khulna', 'Barishal', 'Rangpur', 'Mymensingh', 'Cumilla', 'Bogura',
] as const
export const URBAN = new Set(['Dhaka', 'Chattogram', 'Gazipur', 'Narayanganj'])
export const CASH_OUT_LIMIT = 25_000

export interface GenOptions {
  seed: number
  customers: number
  days: number
  /** multiplier on the number of injected fraud scenarios */
  fraudIntensity: number
}

export const DEFAULT_GEN: GenOptions = { seed: 2026, customers: 500, days: 45, fraudIntensity: 1 }

// The generator never creates 'unknown' wallets; that segment only appears in imported files.
type GenSegment = Exclude<Segment, 'unknown'>
const SEG_MEDIAN: Record<GenSegment, number> = { student: 700, salaried: 2800, rural: 1300, business: 5500 }
const SEG_RATE: Record<GenSegment, number> = { student: 0.7, salaried: 0.9, rural: 0.45, business: 1.4 }

interface Profile {
  acc: Account
  device: string
  hourCenter: number
  friends: string[]
  merchants: string[]
  agents: string[]
}

/**
 * Builds a clearly synthetic MFS ledger. Normal behaviour follows per-customer habits
 * (devices, hours, recipients, amounts); fraud typologies are injected on top and labelled.
 * Every assumption is documented on the Data page.
 */
export function generateDataset(opts: GenOptions = DEFAULT_GEN): Dataset {
  const r = mulberry32(opts.seed)
  const start = Date.UTC(2026, 7, 1) - 6 * HOUR // 1 Aug 2026 00:00 BST
  const accounts: Account[] = []
  const txs: Omit<Tx, 'id'>[] = []
  let seq = 0
  const newId = (p: string) => `${p}${String(++seq).padStart(5, '0')}`

  const agents: Account[] = []
  for (let i = 0; i < 30; i++) {
    const a: Account = { id: newId('AG'), kind: 'agent', district: DISTRICTS[i % DISTRICTS.length], segment: 'business', createdAt: start - (400 + i * 20) * DAY }
    agents.push(a)
    accounts.push(a)
  }
  const merchants: Account[] = []
  for (let i = 0; i < 40; i++) {
    const m: Account = { id: newId('MR'), kind: 'merchant', district: pick(r, DISTRICTS), segment: 'business', createdAt: start - (200 + i * 15) * DAY }
    merchants.push(m)
    accounts.push(m)
  }

  const segments: GenSegment[] = ['student', 'salaried', 'rural', 'business']
  const profiles: Profile[] = []
  for (let i = 0; i < opts.customers; i++) {
    const segment = pick(r, segments)
    const district = segment === 'rural' ? pick(r, DISTRICTS.slice(4)) : r() < 0.6 ? pick(r, DISTRICTS.slice(0, 4)) : pick(r, DISTRICTS)
    const acc: Account = { id: newId('CU'), kind: 'customer', district, segment, createdAt: start - Math.floor(30 + r() * 900) * DAY }
    accounts.push(acc)
    const local = agents.filter((a) => a.district === district)
    profiles.push({
      acc,
      device: `D-${acc.id.slice(2)}`,
      hourCenter: 9 + r() * 12,
      friends: [],
      merchants: shuffle(r, merchants).slice(0, 2 + Math.floor(r() * 3)).map((m) => m.id),
      agents: (local.length ? local : agents).slice(0, 2).map((a) => a.id),
    })
  }
  for (const p of profiles) p.friends = shuffle(r, profiles).slice(0, 3 + Math.floor(r() * 4)).filter((f) => f !== p).map((f) => f.acc.id)

  const push = (t: Omit<Tx, 'id'>) => txs.push({ ...t, amount: Math.max(10, Math.round(t.amount)) })
  const hourFor = (p: Profile) => Math.min(23.9, Math.max(6, normal(r, p.hourCenter, 2.6)))

  // ---- normal behaviour -------------------------------------------------
  for (const p of profiles) {
    const seg = p.acc.segment as GenSegment
    const median = SEG_MEDIAN[seg]
    const switchDay = r() < 0.03 ? Math.floor(r() * opts.days) : -1 // legit phone change
    const bigDay = r() < 0.02 ? Math.floor(r() * opts.days) : -1 // legit large family transfer
    for (let d = 0; d < opts.days; d++) {
      const device = switchDay >= 0 && d >= switchDay ? `D-${p.acc.id.slice(2)}b` : p.device
      const n = poisson(r, SEG_RATE[seg])
      for (let k = 0; k < n; k++) {
        const ts = bstTime(start, d, hourFor(p))
        const location = r() < 0.93 ? p.acc.district : pick(r, DISTRICTS)
        const channel: Channel = r() < 0.72 ? 'app' : 'ussd'
        const roll = r()
        const base = { ts, device, location, channel, label: 0 as const, pattern: 'normal' as Pattern }
        if (roll < 0.34) push({ ...base, sender: p.acc.id, receiver: pick(r, p.friends), type: 'send_money', amount: logNormal(r, median, 0.7) })
        else if (roll < 0.58) push({ ...base, sender: p.acc.id, receiver: pick(r, p.merchants), type: 'payment', amount: logNormal(r, median * 0.6, 0.8) })
        else if (roll < 0.72) push({ ...base, sender: p.acc.id, receiver: pick(r, p.agents), type: 'cash_out', channel: 'agent', amount: Math.min(CASH_OUT_LIMIT, logNormal(r, median * 1.4, 0.6)) })
        else if (roll < 0.87) push({ ...base, sender: p.acc.id, receiver: 'MNO', type: 'mobile_recharge', amount: pick(r, [20, 50, 100, 149, 199, 299, 499]) })
        else if (roll < 0.93) push({ ...base, sender: p.acc.id, receiver: 'BILLER', type: 'bill_pay', amount: logNormal(r, 900, 0.5) })
        else push({ ...base, sender: pick(r, p.agents), receiver: p.acc.id, type: 'cash_in', channel: 'agent', device: 'AGENT-POS', amount: logNormal(r, median * 2, 0.6) })
      }
      if (d === bigDay) {
        push({ ts: bstTime(start, d, hourFor(p)), sender: p.acc.id, receiver: pick(r, profiles).acc.id, type: 'send_money', amount: logNormal(r, median * 7, 0.3), channel: 'app', device, location: p.acc.district, label: 0, pattern: 'normal' })
      }
    }
  }

  const intensity = opts.fraudIntensity
  const freshAccount = (d: number, district: string): Account => {
    const a: Account = { id: newId('CU'), kind: 'customer', district, segment: 'student', createdAt: start + Math.max(0, d - 3) * DAY + r() * DAY }
    accounts.push(a)
    return a
  }

  // ---- account takeover: new device, odd hour, other district, drain to new recipients
  for (let i = 0; i < Math.round(35 * intensity); i++) {
    const v = pick(r, profiles)
    const d = 3 + Math.floor(r() * (opts.days - 3))
    const t0 = bstTime(start, d, 1 + r() * 3)
    const loc = pick(r, DISTRICTS.filter((x) => x !== v.acc.district))
    const dev = `X-${(1000 + i).toString(16)}`
    const drops = 2 + Math.floor(r() * 3)
    for (let k = 0; k < drops; k++) {
      const mule = freshAccount(d, loc)
      push({ ts: t0 + k * (3 + r() * 8) * 60_000, sender: v.acc.id, receiver: mule.id, type: 'send_money', amount: logNormal(r, SEG_MEDIAN[v.acc.segment as GenSegment] * 5, 0.35), channel: 'app', device: dev, location: loc, label: 1, pattern: 'ato' })
    }
  }

  // ---- scam-funded mule rings: many victims -> one wallet -> rapid cash-out
  for (let ring = 0; ring < Math.round(5 * intensity); ring++) {
    const d = 2 + Math.floor(r() * (opts.days - 4))
    const mule = freshAccount(d, pick(r, DISTRICTS))
    const victims = shuffle(r, profiles).slice(0, 7 + Math.floor(r() * 8))
    let received = 0
    let last = 0
    for (const v of victims) {
      const ts = bstTime(start, d, 10 + r() * 7)
      const amount = 2000 + r() * 12000
      received += amount
      last = Math.max(last, ts)
      push({ ts, sender: v.acc.id, receiver: mule.id, type: 'send_money', amount, channel: v.device.startsWith('D') && r() < 0.7 ? 'app' : 'ussd', device: v.device, location: v.acc.district, label: 1, pattern: 'scam' })
    }
    let remaining = received * (0.85 + r() * 0.1)
    let t = last + (1 + r() * 4) * HOUR
    while (remaining > 500) {
      const amt = Math.min(CASH_OUT_LIMIT - Math.floor(r() * 400), remaining)
      push({ ts: t, sender: mule.id, receiver: pick(r, agents).id, type: 'cash_out', amount: amt, channel: 'agent', device: `M-${mule.id.slice(2)}`, location: mule.district, label: 1, pattern: 'mule' })
      remaining -= amt
      t += (10 + r() * 50) * 60_000
    }
  }

  // ---- one-off social-engineering scams: unusual amount to a brand-new recipient
  for (let i = 0; i < Math.round(40 * intensity); i++) {
    const v = pick(r, profiles)
    const d = Math.floor(r() * opts.days)
    const scammer = freshAccount(d, pick(r, DISTRICTS))
    push({ ts: bstTime(start, d, hourFor(v)), sender: v.acc.id, receiver: scammer.id, type: 'send_money', amount: logNormal(r, SEG_MEDIAN[v.acc.segment as GenSegment] * 5.5, 0.4), channel: 'app', device: v.device, location: v.acc.district, label: 1, pattern: 'scam' })
  }

  // ---- colluding agent: night-time near-limit cash-outs from fresh wallets
  for (let g = 0; g < Math.max(1, Math.round(2 * intensity)); g++) {
    const agent = agents[(g * 7 + 3) % agents.length]
    for (let night = 0; night < 2; night++) {
      const d = 5 + Math.floor(r() * (opts.days - 6))
      for (let k = 0; k < 6 + Math.floor(r() * 6); k++) {
        const w = freshAccount(d, agent.district)
        const h = 23 + r() * 4
        push({ ts: bstTime(start, d, h), sender: w.id, receiver: agent.id, type: 'cash_out', amount: CASH_OUT_LIMIT - Math.floor(r() * 900), channel: 'agent', device: `W-${w.id.slice(2)}`, location: agent.district, label: 1, pattern: 'agent' })
      }
    }
  }

  txs.sort((a, b) => a.ts - b.ts)
  return {
    name: `Synthetic seed ${opts.seed}`,
    source: 'synthetic',
    createdAt: Date.now(),
    accounts,
    txs: txs.map((t, i) => ({ ...t, id: `TX${String(i + 1).padStart(6, '0')}` })),
  }
}

export const TX_TYPES: TxType[] = ['send_money', 'cash_out', 'cash_in', 'payment', 'mobile_recharge', 'bill_pay']
