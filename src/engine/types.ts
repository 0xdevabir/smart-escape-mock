export type TxType = 'send_money' | 'cash_out' | 'cash_in' | 'payment' | 'mobile_recharge' | 'bill_pay'
export type Channel = 'app' | 'ussd' | 'agent'
export type AccountKind = 'customer' | 'merchant' | 'agent'
export type Segment = 'student' | 'salaried' | 'rural' | 'business'
export type Pattern = 'normal' | 'ato' | 'mule' | 'scam' | 'agent'

export interface Account {
  id: string
  kind: AccountKind
  district: string
  segment: Segment
  createdAt: number
}

export interface Tx {
  id: string
  ts: number
  sender: string
  receiver: string
  type: TxType
  amount: number
  channel: Channel
  device: string
  location: string
  /** 1 = known fraud, 0 = known legit, undefined = unknown */
  label?: 0 | 1
  /** Generator ground truth, only present in synthetic data */
  pattern?: Pattern
}

export interface Dataset {
  name: string
  source: 'synthetic' | 'import'
  createdAt: number
  accounts: Account[]
  txs: Tx[]
}

export const FEATURE_KEYS = [
  'amtLog',
  'amtZ',
  'nightHour',
  'hourDev',
  'newDevice',
  'newRecipient',
  'newLocation',
  'velocity1h',
  'spend24hRatio',
  'recvFanIn24h',
  'passThrough',
  'acctAgeLog',
  'isCashOut',
  'isSend',
] as const
export type FeatureKey = (typeof FEATURE_KEYS)[number]
export type FeatureVector = Record<FeatureKey, number>

export interface RuleHit {
  id: string
  /** minimum final score this rule enforces */
  floor: number
}

export interface Reason {
  key: FeatureKey | string
  kind: 'model' | 'rule' | 'anomaly'
  weight: number
  value?: number
}

export interface Scored {
  txId: string
  score: number
  mlProb: number
  anomaly: number
  rules: RuleHit[]
  reasons: Reason[]
  band: 'low' | 'medium' | 'high'
  typology: Pattern
}

export type CaseStatus = 'open' | 'escalated' | 'confirmed' | 'dismissed'

export interface CaseDecision {
  txId: string
  status: CaseStatus
  note: string
  analyst: string
  at: number
}

export interface AuditEntry {
  at: number
  analyst: string
  txId: string
  action: CaseStatus | 'note' | 'ai_summary'
  note?: string
}
