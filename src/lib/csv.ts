import Papa from 'papaparse'
import type { Account, Channel, Dataset, Tx, TxType } from '../engine/types'

export const FIELDS = ['id', 'ts', 'sender', 'receiver', 'type', 'amount', 'device', 'location', 'channel', 'label'] as const
export type Field = (typeof FIELDS)[number]
export const REQUIRED: Field[] = ['id', 'ts', 'sender', 'receiver', 'type', 'amount']
export type Mapping = Partial<Record<Field, string>>

const SYNONYMS: Record<Field, string[]> = {
  id: ['id', 'txid', 'transactionid', 'trxid', 'txnid', 'reference', 'ref', 'transaction'],
  ts: ['timestamp', 'time', 'datetime', 'date', 'createdat', 'ts', 'txtime', 'transactiontime'],
  sender: ['sender', 'from', 'source', 'payer', 'fromaccount', 'senderid', 'senderwallet', 'customerid', 'accountid', 'wallet', 'nameorig'],
  receiver: ['receiver', 'to', 'destination', 'payee', 'toaccount', 'receiverid', 'recipient', 'recipientid', 'receiverwallet', 'merchantid', 'namedest'],
  type: ['type', 'txtype', 'transactiontype', 'txntype', 'category', 'service'],
  amount: ['amount', 'amt', 'value', 'txamount', 'amountbdt', 'taka'],
  device: ['device', 'deviceid', 'devicefingerprint'],
  location: ['location', 'district', 'city', 'area', 'region', 'division'],
  channel: ['channel', 'medium'],
  label: ['label', 'isfraud', 'fraud', 'target', 'class', 'isfraudulent'],
}
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

export function autoMap(headers: string[]): Mapping {
  const m: Mapping = {}
  const used = new Set<string>()
  for (const f of FIELDS) {
    const hit = headers.find((h) => !used.has(h) && SYNONYMS[f].includes(norm(h))) ?? headers.find((h) => !used.has(h) && SYNONYMS[f].some((s) => s.length > 3 && norm(h).includes(s)))
    if (hit) {
      m[f] = hit
      used.add(hit)
    }
  }
  return m
}

export function parseCsvFile(file: File): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (r) => resolve({ headers: r.meta.fields ?? [], rows: r.data }),
      error: (e) => reject(e),
    })
  })
}

export function normalizeType(raw: string): TxType {
  const s = raw.toLowerCase().replace(/[\s_-]+/g, '')
  if (s.includes('cashout') || s.includes('withdraw')) return 'cash_out'
  if (s.includes('cashin') || s.includes('deposit') || s.includes('addmoney')) return 'cash_in'
  if (s.includes('recharge') || s.includes('topup') || s.includes('airtime')) return 'mobile_recharge'
  if (s.includes('bill') || s.includes('utility')) return 'bill_pay'
  if (s.includes('send') || s.includes('transfer') || s.includes('p2p')) return 'send_money'
  return 'payment'
}

export function parseTime(raw: string): number {
  const v = raw.trim()
  if (/^\d+(\.\d+)?$/.test(v)) {
    const n = Number(v)
    return n < 1e11 ? n * 1000 : n // seconds or ms epoch
  }
  const hasZone = /(z|[+-]\d{2}:?\d{2})$/i.test(v)
  const iso = v.includes('T') ? v : v.replace(' ', 'T')
  const t = Date.parse(hasZone ? iso : `${iso.length === 10 ? iso + 'T00:00' : iso}+06:00`)
  return Number.isFinite(t) ? t : Date.parse(v)
}

const parseLabel = (raw?: string): 0 | 1 | undefined => {
  if (raw === undefined) return undefined
  const s = raw.trim().toLowerCase()
  if (['1', 'true', 'yes', 'y', 'fraud', 'scam'].includes(s)) return 1
  if (['0', 'false', 'no', 'n', 'legit', 'normal', 'genuine'].includes(s)) return 0
  return undefined
}

const parseChannel = (raw?: string): Channel => {
  const s = (raw ?? '').toLowerCase()
  return s.includes('ussd') || s.includes('*') ? 'ussd' : s.includes('agent') ? 'agent' : 'app'
}

export function rowsToDataset(rows: Record<string, string>[], m: Mapping, name: string): { dataset: Dataset; skipped: number } {
  const txs: Tx[] = []
  let skipped = 0
  const val = (r: Record<string, string>, f: Field) => (m[f] ? (r[m[f]!] ?? '').toString().trim() : '')
  rows.forEach((r, i) => {
    const ts = parseTime(val(r, 'ts'))
    const amount = Number(val(r, 'amount').replace(/[,৳\s]/g, ''))
    const sender = val(r, 'sender')
    const receiver = val(r, 'receiver')
    if (!Number.isFinite(ts) || !Number.isFinite(amount) || amount <= 0 || !sender || !receiver) {
      skipped++
      return
    }
    txs.push({
      id: val(r, 'id') || `ROW${i + 1}`,
      ts,
      sender,
      receiver,
      type: normalizeType(val(r, 'type')),
      amount,
      channel: parseChannel(val(r, 'channel')),
      device: val(r, 'device') || `DEV-${sender}`,
      location: val(r, 'location') || 'Unknown',
      label: m.label ? parseLabel(val(r, 'label')) : undefined,
    })
  })
  txs.sort((a, b) => a.ts - b.ts)

  const kind = new Map<string, Account['kind']>()
  const first = new Map<string, number>()
  const locs = new Map<string, Map<string, number>>()
  for (const t of txs) {
    if (t.type === 'cash_out') kind.set(t.receiver, 'agent')
    else if (t.type === 'payment' && !kind.has(t.receiver)) kind.set(t.receiver, 'merchant')
    for (const id of [t.sender, t.receiver]) if (!first.has(id)) first.set(id, t.ts)
    if (!locs.has(t.sender)) locs.set(t.sender, new Map())
    const lm = locs.get(t.sender)!
    lm.set(t.location, (lm.get(t.location) ?? 0) + 1)
  }
  const accounts: Account[] = [...first.entries()].map(([id, ts]) => {
    const lm = locs.get(id)
    const district = lm ? [...lm.entries()].sort((a, b) => b[1] - a[1])[0][0] : 'Unknown'
    return { id, kind: kind.get(id) ?? 'customer', district, segment: 'unknown', createdAt: ts }
  })
  return { dataset: { name, source: 'import', createdAt: Date.now(), accounts, txs }, skipped }
}

export const toCsv = (rows: Record<string, unknown>[]) => Papa.unparse(rows)
