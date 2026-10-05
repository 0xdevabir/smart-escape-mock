import type { Building, Hazards, RouteResult, Step } from './types'

interface Adj {
  to: string
  edgeId: string
  cost: number
}

/** Plain code-unit comparison: IDs are case-sensitive and "lexicographic" means exactly this. */
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/** Build the usable graph: drops blocked nodes, closed exits, blocked edges and any edge touching a dropped node. */
function usableGraph(b: Building, h: Hazards) {
  const dead = new Set([...h.blocked_nodes, ...h.closed_exits])
  const blockedEdges = new Set(h.blocked_edges)
  const adj = new Map<string, Adj[]>()
  for (const n of b.nodes) if (!dead.has(n.id)) adj.set(n.id, [])
  for (const e of b.edges) {
    if (blockedEdges.has(e.id) || !adj.has(e.from) || !adj.has(e.to)) continue
    adj.get(e.from)!.push({ to: e.to, edgeId: e.id, cost: e.cost })
    adj.get(e.to)!.push({ to: e.from, edgeId: e.id, cost: e.cost })
  }
  // Sorting neighbours by ID makes the greedy reconstruction below pick the smallest ID first.
  for (const list of adj.values()) list.sort((x, y) => cmp(x.to, y.to))
  return adj
}

/** Dijkstra over at most 60 nodes, so a linear-scan priority selection is plenty fast. */
function dijkstra(adj: Map<string, Adj[]>, src: string) {
  const dist = new Map<string, number>([[src, 0]])
  const done = new Set<string>()
  for (;;) {
    let u: string | null = null
    let best = Infinity
    for (const [id, d] of dist) if (!done.has(id) && d < best) { best = d; u = id }
    if (u === null) break
    done.add(u)
    for (const { to, cost } of adj.get(u)!) {
      const nd = best + cost
      if (nd < (dist.get(to) ?? Infinity)) dist.set(to, nd)
    }
  }
  return dist
}

/**
 * Lexicographically smallest minimum-cost path from `start` to `exit`.
 * At each node take the smallest-ID neighbour that still lies on some shortest path
 * (dS[u] + w + dE[v] === total). Costs are positive, so this always terminates.
 */
function smallestShortestPath(adj: Map<string, Adj[]>, dS: Map<string, number>, start: string, exit: string) {
  const dE = dijkstra(adj, exit)
  const total = dS.get(exit)!
  const path = [start]
  const steps: Step[] = []
  let u = start
  while (u !== exit) {
    const du = dS.get(u)!
    const next = adj.get(u)!.find((a) => {
      const de = dE.get(a.to)
      return de !== undefined && du + a.cost + de === total
    })!
    steps.push({ from: u, to: next.to, edgeId: next.edgeId, cost: next.cost })
    path.push(next.to)
    u = next.to
  }
  return { path, steps }
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
  const { path, steps } = smallestShortestPath(adj, dS, start, best.exit)
  return {
    status: 'ok',
    path,
    exit: best.exit,
    cost: best.cost,
    steps,
    alternatives: others.map((o) => ({ ...o, path: smallestShortestPath(adj, dS, start, o.exit).path })),
  }
}
