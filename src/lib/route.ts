import type { Building, Hazards, RankedRoute, RouteResult, Step } from './types'

interface Adj {
  to: string
  edgeId: string
  cost: number
}
type Graph = Map<string, Adj[]>
type Skip = { nodes?: Set<string>; edges?: Set<string> }

/** Plain code-unit comparison: IDs are case-sensitive and "lexicographic" means exactly this. */
export const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
export const cmpSeq = (a: string[], b: string[]) => {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const c = cmp(a[i], b[i])
    if (c) return c
  }
  return a.length - b.length
}

/** Build the usable graph: drops blocked nodes, closed exits, blocked edges and any edge touching a dropped node. */
function usableGraph(b: Building, h: Hazards): Graph {
  const dead = new Set([...h.blocked_nodes, ...h.closed_exits])
  const blockedEdges = new Set(h.blocked_edges)
  const adj: Graph = new Map()
  for (const n of b.nodes) if (!dead.has(n.id)) adj.set(n.id, [])
  for (const e of b.edges) {
    if (blockedEdges.has(e.id) || !adj.has(e.from) || !adj.has(e.to)) continue
    adj.get(e.from)!.push({ to: e.to, edgeId: e.id, cost: e.cost })
    adj.get(e.to)!.push({ to: e.from, edgeId: e.id, cost: e.cost })
  }
  // Sorting neighbours by ID makes every greedy walk below pick the smallest ID first.
  for (const list of adj.values()) list.sort((x, y) => cmp(x.to, y.to))
  return adj
}

/** Dijkstra over at most ~60 nodes, so a linear-scan priority selection is plenty fast. */
function dijkstra(adj: Graph, src: string, skip: Skip = {}) {
  const dist = new Map<string, number>([[src, 0]])
  const done = new Set<string>()
  for (;;) {
    let u: string | null = null
    let best = Infinity
    for (const [id, d] of dist) if (!done.has(id) && d < best) { best = d; u = id }
    if (u === null) break
    done.add(u)
    for (const { to, cost, edgeId } of adj.get(u)!) {
      if (skip.nodes?.has(to) || skip.edges?.has(edgeId)) continue
      const nd = best + cost
      if (nd < (dist.get(to) ?? Infinity)) dist.set(to, nd)
    }
  }
  return dist
}

/** Edges of the shortest-path DAG from src to dst: (u,v) with dS[u] + w + dT[v] === total. */
function onShortest(adj: Graph, dS: Map<string, number>, dT: Map<string, number>, total: number, u: string, skip: Skip) {
  return adj.get(u)!.filter((a) => {
    if (skip.nodes?.has(a.to) || skip.edges?.has(a.edgeId)) return false
    const de = dT.get(a.to)
    return de !== undefined && dS.get(u)! + a.cost + de === total
  })
}

/**
 * Lexicographically smallest minimum-cost path from src to dst (or null).
 * At each node take the smallest-ID neighbour that still lies on some shortest path.
 * Costs are positive, so the walk always terminates.
 */
function bestPath(adj: Graph, src: string, dst: string, skip: Skip = {}) {
  const dS = dijkstra(adj, src, skip)
  const total = dS.get(dst)
  if (total === undefined) return null
  const dT = dijkstra(adj, dst, skip)
  const path = [src]
  const steps: Step[] = []
  let u = src
  while (u !== dst) {
    const next = onShortest(adj, dS, dT, total, u, skip)[0]
    steps.push({ from: u, to: next.to, edgeId: next.edgeId, cost: next.cost })
    path.push(next.to)
    u = next.to
  }
  return { path, steps, cost: total, dS, dT }
}

const SINK = '\u0000sink'

/** Usable graph plus a virtual sink joined to every open exit at zero cost, so "any exit" becomes one target. */
function withSink(b: Building, h: Hazards) {
  const adj = usableGraph(b, h)
  const sinkAdj: Adj[] = []
  for (const n of b.nodes) {
    if (n.type !== 'exit' || !adj.has(n.id)) continue
    adj.get(n.id)!.push({ to: SINK, edgeId: `${SINK}${n.id}`, cost: 0 })
    sinkAdj.push({ to: n.id, edgeId: `${SINK}${n.id}`, cost: 0 })
  }
  adj.set(SINK, sinkAdj.sort((x, y) => cmp(x.to, y.to)))
  return adj
}

/**
 * Yen's algorithm: the k cheapest loop-free evacuation routes to any open exit,
 * ordered by cost, then exit ID, then node sequence (the same rule as the main route).
 * Index 0 is always the main route.
 */
export function rankedRoutes(b: Building, h: Hazards, start: string, k = 3): RankedRoute[] {
  const adj = withSink(b, h)
  if (!adj.has(start) || start === SINK) return []
  const weight = new Map<string, Adj>()
  for (const [u, list] of adj) for (const a of list) weight.set(`${u}\u0001${a.to}`, a)
  const costOf = (p: string[]) => p.slice(1).reduce((s, v, i) => s + weight.get(`${p[i]}\u0001${v}`)!.cost, 0)
  const order = (x: string[], y: string[]) => costOf(x) - costOf(y) || cmp(x[x.length - 2], y[y.length - 2]) || cmpSeq(x, y)

  const first = bestPath(adj, start, SINK)
  if (!first) return []
  const exits = new Set(adj.get(SINK)!.map((a) => a.to))
  const A: string[][] = []
  const B: string[][] = []
  const key = (p: string[]) => p.join('\u0001')
  const seen = new Set<string>()
  const push = (p: string[]) => {
    // A route ends at the first exit it reaches; walking through one exit to another is not a real alternative.
    if (p.slice(0, -2).some((id) => exits.has(id)) || seen.has(key(p))) return
    seen.add(key(p))
    B.push(p)
  }
  push(first.path)
  // `first` follows the node-sequence rule only; seed the best path to every equal-cost exit so the exit-ID rule wins.
  for (const a of adj.get(SINK)!) {
    const p = bestPath(adj, start, a.to, { nodes: new Set([SINK]) }) // no shortcuts via the 0-cost sink
    if (p && p.cost === first.cost) push([...p.path, SINK])
  }

  while (A.length < k && B.length) {
    B.sort(order)
    const next = B.shift()!
    A.push(next)
    if (A.length === k) break
    for (let i = 0; i < next.length - 1; i++) {
      const spur = next[i]
      const root = next.slice(0, i + 1)
      const edges = new Set<string>()
      for (const p of A) {
        if (p.length > i + 1 && cmpSeq(p.slice(0, i + 1), root) === 0) edges.add(weight.get(`${p[i]}\u0001${p[i + 1]}`)!.edgeId)
      }
      const nodes = new Set(root.slice(0, -1))
      const spurPath = bestPath(adj, spur, SINK, { nodes, edges })
      if (spurPath) push([...root.slice(0, -1), ...spurPath.path])
    }
  }

  return A.map((p) => {
    const path = p.slice(0, -1)
    return { path, exit: path[path.length - 1], cost: costOf(p) }
  })
}

/** Rooms/junctions that are open but cannot reach any open exit under the current hazards. */
export function trappedNodes(b: Building, h: Hazards): string[] {
  const adj = withSink(b, h)
  const reach = dijkstra(adj, SINK)
  return b.nodes.filter((n) => n.type !== 'exit' && adj.has(n.id) && !reach.has(n.id)).map((n) => n.id).sort(cmp)
}

/** Connected parts of the usable building that contain a room or junction, each with its open exits. */
export function regions(b: Building, h: Hazards): { nodes: string[]; exits: string[] }[] {
  const adj = usableGraph(b, h)
  const type = new Map(b.nodes.map((n) => [n.id, n.type]))
  const seen = new Set<string>()
  const out: { nodes: string[]; exits: string[] }[] = []
  for (const id of [...adj.keys()].sort(cmp)) {
    if (seen.has(id)) continue
    const part: string[] = []
    const stack = [id]
    seen.add(id)
    while (stack.length) {
      const u = stack.pop()!
      part.push(u)
      for (const { to } of adj.get(u)!) if (!seen.has(to)) { seen.add(to); stack.push(to) }
    }
    const nodes = part.filter((x) => type.get(x) !== 'exit').sort(cmp)
    if (nodes.length) out.push({ nodes, exits: part.filter((x) => type.get(x) === 'exit').sort(cmp) })
  }
  return out
}

const MAX_TIED_PATHS = 5

/** Every minimum-cost path start→exit in lexicographic order (capped) plus the exact count. */
function tiedPaths(adj: Graph, dS: Map<string, number>, dT: Map<string, number>, total: number, start: string, exit: string) {
  const memo = new Map<string, number>()
  const count = (u: string): number => {
    if (u === exit) return 1
    if (memo.has(u)) return memo.get(u)!
    const c = onShortest(adj, dS, dT, total, u, {}).reduce((s, a) => s + count(a.to), 0)
    memo.set(u, c)
    return c
  }
  const out: string[][] = []
  const walk = (u: string, acc: string[]) => {
    if (out.length >= MAX_TIED_PATHS) return
    if (u === exit) return void out.push(acc)
    for (const a of onShortest(adj, dS, dT, total, u, {})) walk(a.to, [...acc, a.to])
  }
  walk(start, [start])
  return { paths: out, count: count(start) }
}

export function computeRoute(b: Building, h: Hazards, start: string | null): RouteResult {
  const startNode = b.nodes.find((n) => n.id === start)
  if (!start || !startNode || startNode.type === 'exit') return { status: 'no-start' }
  if (h.blocked_nodes.includes(start)) return { status: 'start-blocked' }

  const adj = usableGraph(b, h)
  const dS = dijkstra(adj, start)
  const exits = b.nodes
    .filter((n) => n.type === 'exit' && dS.has(n.id))
    .map((n) => ({ exit: n.id, cost: dS.get(n.id)! }))
    .sort((x, y) => x.cost - y.cost || cmp(x.exit, y.exit))

  if (!exits.length) return { status: 'no-route' }

  const [best, ...others] = exits
  const main = bestPath(adj, start, best.exit)!
  const tie = tiedPaths(adj, main.dS, main.dT, main.cost, start, best.exit)
  return {
    status: 'ok',
    path: main.path,
    exit: best.exit,
    cost: best.cost,
    steps: main.steps,
    tiedExits: exits.filter((e) => e.cost === best.cost).map((e) => e.exit),
    tiedPaths: tie.paths,
    tiedPathCount: tie.count,
    otherExits: others.map((o) => ({ ...o, path: bestPath(adj, start, o.exit)!.path })),
    distances: dS,
  }
}
