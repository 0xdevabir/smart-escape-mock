import { DAY } from './time'
import type { Dataset, Tx } from './types'

export interface MuleCandidate {
  id: string
  senders: number
  inflow: number
  cashOut: number
  ratio: number
  windowStart: number
  hoursToCashOut: number
  inbound: Tx[]
  outbound: Tx[]
}

/**
 * Graph signal: wallets that collect money from many unrelated senders inside 24h
 * and push most of it out as cash shortly after (fan-in → cash-out).
 */
export function findMuleCandidates(ds: Dataset, minSenders = 5): MuleCandidate[] {
  const inbound = new Map<string, Tx[]>()
  const outbound = new Map<string, Tx[]>()
  for (const t of ds.txs) {
    if (t.type === 'send_money') {
      if (!inbound.has(t.receiver)) inbound.set(t.receiver, [])
      inbound.get(t.receiver)!.push(t)
    } else if (t.type === 'cash_out') {
      if (!outbound.has(t.sender)) outbound.set(t.sender, [])
      outbound.get(t.sender)!.push(t)
    }
  }
  const out: MuleCandidate[] = []
  for (const [id, list] of inbound) {
    if (list.length < minSenders) continue
    let best: { start: number; end: number; senders: number } | null = null
    let lo = 0
    const counts = new Map<string, number>()
    for (let hi = 0; hi < list.length; hi++) {
      counts.set(list[hi].sender, (counts.get(list[hi].sender) ?? 0) + 1)
      while (list[hi].ts - list[lo].ts > DAY) {
        const c = counts.get(list[lo].sender)! - 1
        if (c) counts.set(list[lo].sender, c)
        else counts.delete(list[lo].sender)
        lo++
      }
      if (!best || counts.size > best.senders) best = { start: lo, end: hi, senders: counts.size }
    }
    if (!best || best.senders < minSenders) continue
    const win = list.slice(best.start, best.end + 1)
    const from = win[0].ts
    const lastIn = win[win.length - 1].ts
    const outs = (outbound.get(id) ?? []).filter((t) => t.ts >= from && t.ts <= lastIn + 2 * DAY)
    const inflow = win.reduce((a, t) => a + t.amount, 0)
    const cashOut = outs.reduce((a, t) => a + t.amount, 0)
    out.push({
      id,
      senders: best.senders,
      inflow,
      cashOut,
      ratio: inflow ? cashOut / inflow : 0,
      windowStart: from,
      hoursToCashOut: outs.length ? (outs[0].ts - lastIn) / 3_600_000 : NaN,
      inbound: win,
      outbound: outs,
    })
  }
  return out.sort((a, b) => b.ratio * b.senders - a.ratio * a.senders)
}

export interface GraphNode {
  id: string
  role: 'mule' | 'sender' | 'agent'
  value: number
}
export interface GraphLink {
  source: string
  target: string
  amount: number
}

export function graphFor(cands: MuleCandidate[]) {
  const nodes = new Map<string, GraphNode>()
  const links = new Map<string, GraphLink>()
  const add = (id: string, role: GraphNode['role'], v: number) => {
    const n = nodes.get(id)
    if (n) {
      n.value += v
      if (role === 'mule') n.role = 'mule'
    } else nodes.set(id, { id, role, value: v })
  }
  const link = (s: string, t: string, a: number) => {
    const k = `${s}>${t}`
    const l = links.get(k)
    if (l) l.amount += a
    else links.set(k, { source: s, target: t, amount: a })
  }
  for (const c of cands) {
    add(c.id, 'mule', c.inflow)
    for (const t of c.inbound) {
      add(t.sender, 'sender', t.amount)
      link(t.sender, c.id, t.amount)
    }
    for (const t of c.outbound) {
      add(t.receiver, 'agent', t.amount)
      link(c.id, t.receiver, t.amount)
    }
  }
  return { nodes: [...nodes.values()], links: [...links.values()] }
}
