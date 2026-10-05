import type { BEdge, BNode, Building, NodeType } from './types'

/** A validation problem expressed as an i18n key plus interpolation params. */
export interface ValidationError {
  key: string
  params?: Record<string, string | number>
}

export type ValidationResult =
  | { ok: true; data: Building }
  | { ok: false; errors: ValidationError[] }

const NODE_TYPES: NodeType[] = ['room', 'junction', 'exit']
const HAZARD_KEYS = ['blocked_nodes', 'blocked_edges', 'closed_exits'] as const

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const isNonEmptyStr = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const isFiniteNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

export function parseBuildingText(text: string): ValidationResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (e) {
    return { ok: false, errors: [{ key: 'err.json', params: { msg: (e as Error).message } }] }
  }
  return validateBuilding(raw)
}

export function validateBuilding(raw: unknown): ValidationResult {
  const errors: ValidationError[] = []
  const err = (key: string, params?: ValidationError['params']) => errors.push({ key, params })

  if (!isObj(raw)) return { ok: false, errors: [{ key: 'err.root' }] }

  if (!isNonEmptyStr(raw.building)) err('err.building')

  // ---- nodes
  const nodes: BNode[] = []
  const nodeById = new Map<string, BNode>()
  if (!Array.isArray(raw.nodes)) {
    err('err.nodesArray')
  } else {
    if (raw.nodes.length < 2 || raw.nodes.length > 60) err('err.nodesCount', { n: raw.nodes.length })
    raw.nodes.forEach((n, i) => {
      const at = i + 1
      if (!isObj(n)) return err('err.nodeObj', { i: at })
      let good = true
      if (!isNonEmptyStr(n.id)) { err('err.nodeId', { i: at }); good = false }
      else if (nodeById.has(n.id)) { err('err.nodeDup', { id: n.id }); good = false }
      if (!isNonEmptyStr(n.label)) { err('err.nodeLabel', { i: at, id: String(n.id ?? '?') }); good = false }
      if (!NODE_TYPES.includes(n.type as NodeType)) {
        err('err.nodeType', { i: at, id: String(n.id ?? '?'), type: String(n.type) }); good = false
      }
      if (!isFiniteNum(n.x) || !isFiniteNum(n.y)) { err('err.nodeXY', { i: at, id: String(n.id ?? '?') }); good = false }
      if (good) {
        const node: BNode = { id: n.id as string, label: n.label as string, type: n.type as NodeType, x: n.x as number, y: n.y as number }
        nodes.push(node)
        nodeById.set(node.id, node)
      } else if (isNonEmptyStr(n.id) && !nodeById.has(n.id)) {
        // Remember the ID anyway so edge checks don't cascade into misleading errors.
        nodeById.set(n.id, { id: n.id, label: '', type: 'room', x: 0, y: 0 })
      }
    })
    if (!nodes.some((n) => n.type !== 'exit')) err('err.needRoom')
    if (!nodes.some((n) => n.type === 'exit')) err('err.needExit')
  }

  // ---- edges
  const edges: BEdge[] = []
  const edgeIds = new Set<string>()
  const pairs = new Set<string>()
  if (!Array.isArray(raw.edges)) {
    err('err.edgesArray')
  } else {
    if (raw.edges.length < 1 || raw.edges.length > 150) err('err.edgesCount', { n: raw.edges.length })
    raw.edges.forEach((e, i) => {
      const at = i + 1
      if (!isObj(e)) return err('err.edgeObj', { i: at })
      const id = String(e.id ?? '?')
      let good = true
      if (!isNonEmptyStr(e.id)) { err('err.edgeId', { i: at }); good = false }
      else if (edgeIds.has(e.id)) { err('err.edgeDup', { id: e.id }); good = false }
      else edgeIds.add(e.id)
      for (const end of ['from', 'to'] as const) {
        const v = e[end]
        if (!isNonEmptyStr(v) || !nodeById.has(v)) { err('err.edgeEnd', { id, end, ref: String(v) }); good = false }
      }
      if (good && e.from === e.to) { err('err.edgeLoop', { id }); good = false }
      if (typeof e.cost !== 'number' || !Number.isInteger(e.cost) || e.cost <= 0) {
        err('err.edgeCost', { id, cost: String(e.cost) }); good = false
      }
      if (isNonEmptyStr(e.from) && isNonEmptyStr(e.to) && e.from !== e.to) {
        const key = [e.from, e.to].sort().join('\u0000')
        if (pairs.has(key)) { err('err.edgePair', { id, a: e.from, b: e.to }); good = false }
        pairs.add(key)
      }
      if (good) edges.push({ id: e.id as string, from: e.from as string, to: e.to as string, cost: e.cost as number })
    })
  }

  // ---- initial_state
  const hazards = { blocked_nodes: [] as string[], blocked_edges: [] as string[], closed_exits: [] as string[] }
  if (!isObj(raw.initial_state)) {
    err('err.state')
  } else {
    const st = raw.initial_state
    for (const k of HAZARD_KEYS) {
      const arr = st[k]
      if (!Array.isArray(arr)) { err('err.stateArray', { field: k }); continue }
      for (const ref of arr) {
        if (typeof ref !== 'string') { err('err.stateId', { field: k, ref: String(ref) }); continue }
        let fits: boolean
        if (k === 'blocked_edges') fits = edgeIds.has(ref)
        else {
          const n = nodeById.get(ref)
          fits = !!n && (k === 'closed_exits' ? n.type === 'exit' : n.type !== 'exit')
        }
        if (!fits) err(edgeIds.has(ref) || nodeById.has(ref) ? 'err.stateKind' : 'err.stateId', { field: k, ref })
        else if (!hazards[k].includes(ref)) hazards[k].push(ref)
      }
    }
  }

  if (errors.length) return { ok: false, errors }
  return { ok: true, data: { building: (raw.building as string).trim(), nodes, edges, initial_state: hazards } }
}
