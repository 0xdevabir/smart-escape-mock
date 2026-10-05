import { bstHour, DAY, HOUR } from './time'
import type { Account, FeatureVector, Tx } from './types'

const OUTGOING = new Set(['send_money', 'payment', 'cash_out', 'bill_pay', 'mobile_recharge'])

interface Flow {
  ts: number
  amount: number
  party: string
}

/** Rolling behavioural memory for one wallet, built only from its past transactions. */
export interface AccountState {
  n: number
  sumL: number
  sumSqL: number
  firstTs: number
  devices: Set<string>
  recipients: Set<string>
  locations: Map<string, number>
  hours: number[]
  totalOut: number
  out: Flow[]
  inflow: Flow[]
}

const newState = (ts: number): AccountState => ({
  n: 0, sumL: 0, sumSqL: 0, firstTs: ts, devices: new Set(), recipients: new Set(),
  locations: new Map(), hours: new Array(24).fill(0), totalOut: 0, out: [], inflow: [],
})

const prune = (list: Flow[], since: number) => {
  let i = 0
  while (i < list.length && list[i].ts < since) i++
  if (i) list.splice(0, i)
}

/** Population prior so new wallets aren't judged on 1–2 transactions. */
const PRIOR_MEAN = Math.log1p(1500)
const PRIOR_VAR = 1.1
const PRIOR_K = 3

/**
 * Streams transactions in time order and derives point-in-time features:
 * each transaction only sees history that existed before it (no leakage).
 */
export class FeatureBuilder {
  states = new Map<string, AccountState>()
  private accounts: Map<string, Account>

  constructor(accounts: Account[]) {
    this.accounts = new Map(accounts.map((a) => [a.id, a]))
  }

  state(id: string, ts: number) {
    let s = this.states.get(id)
    if (!s) {
      s = newState(ts)
      this.states.set(id, s)
    }
    return s
  }

  compute(tx: Tx): { f: FeatureVector; ctx: FeatureContext } {
    const s = this.state(tx.sender, tx.ts)
    const rcv = this.state(tx.receiver, tx.ts)
    const L = Math.log1p(tx.amount)
    const mean = (s.sumL + PRIOR_K * PRIOR_MEAN) / (s.n + PRIOR_K)
    const variance = (s.sumSqL + PRIOR_K * (PRIOR_VAR + PRIOR_MEAN ** 2)) / (s.n + PRIOR_K) - mean ** 2
    const amtZ = Math.max(-4, Math.min(8, (L - mean) / Math.max(Math.sqrt(Math.max(variance, 0)), 0.35)))

    const h = bstHour(tx.ts)
    const near = s.hours[(h + 23) % 24] + s.hours[h] + s.hours[(h + 1) % 24]
    const hourDev = s.n >= 5 ? 1 - near / s.n : 0.5

    prune(s.out, tx.ts - DAY)
    prune(s.inflow, tx.ts - DAY)
    prune(rcv.inflow, tx.ts - DAY)
    const velocity1h = s.out.filter((f) => f.ts >= tx.ts - HOUR).length
    const spent24 = s.out.reduce((a, f) => a + f.amount, 0) + tx.amount
    const acc = this.accounts.get(tx.sender)
    const createdAt = Math.min(acc?.createdAt ?? s.firstTs, s.firstTs)
    const ageDays = Math.max(1, (tx.ts - createdAt) / DAY)
    const avgDaily = s.totalOut / Math.max(ageDays, 7) || 500
    const fanIn = new Set(rcv.inflow.map((f) => f.party))
    fanIn.add(tx.sender)

    const recent = s.inflow.filter((f) => f.ts >= tx.ts - 12 * HOUR)
    const recv12 = recent.reduce((a, f) => a + f.amount, 0)
    const distinct12 = new Set(recent.map((f) => f.party)).size
    const passThrough = recv12 > 0 ? Math.min(1, recv12 / tx.amount) * Math.min(1, distinct12 / 3) : 0

    const locCount = s.locations.get(tx.location) ?? 0
    const ctx: FeatureContext = {
      typicalAmount: Math.round(Math.expm1(mean)),
      history: s.n,
      hour: h,
      fanIn: fanIn.size,
      recv12: Math.round(recv12),
      senders12: distinct12,
      ageDays: Math.round(ageDays),
    }
    const f: FeatureVector = {
      amtLog: L,
      amtZ,
      nightHour: h < 5 ? 1 : 0,
      hourDev,
      newDevice: s.n >= 1 && !s.devices.has(tx.device) ? 1 : 0,
      newRecipient: s.n >= 1 && OUTGOING.has(tx.type) && !['MNO', 'BILLER'].includes(tx.receiver) && !s.recipients.has(tx.receiver) ? 1 : 0,
      newLocation: s.n >= 3 && locCount / s.n < 0.05 ? 1 : 0,
      velocity1h,
      spend24hRatio: Math.min(5, Math.log1p(spent24 / avgDaily)),
      recvFanIn24h: Math.log1p(fanIn.size),
      passThrough,
      acctAgeLog: Math.log1p(ageDays),
      isCashOut: tx.type === 'cash_out' ? 1 : 0,
      isSend: tx.type === 'send_money' ? 1 : 0,
    }
    return { f, ctx }
  }

  commit(tx: Tx) {
    const s = this.state(tx.sender, tx.ts)
    const L = Math.log1p(tx.amount)
    s.n++
    s.sumL += L
    s.sumSqL += L * L
    s.devices.add(tx.device)
    s.recipients.add(tx.receiver)
    s.locations.set(tx.location, (s.locations.get(tx.location) ?? 0) + 1)
    s.hours[bstHour(tx.ts)]++
    s.totalOut += tx.amount
    s.out.push({ ts: tx.ts, amount: tx.amount, party: tx.receiver })
    this.state(tx.receiver, tx.ts).inflow.push({ ts: tx.ts, amount: tx.amount, party: tx.sender })
  }
}

/** Human-readable facts behind the features, used in explanations. */
export interface FeatureContext {
  typicalAmount: number
  history: number
  hour: number
  fanIn: number
  recv12: number
  senders12: number
  ageDays: number
}
