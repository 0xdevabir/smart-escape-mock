import { computeRoute } from './route'
import type { Building, Hazards } from './types'

/** The five sample checks from §4.1 of the problem statement, written as data. */
export interface Scenario {
  id: string
  start: string
  hazards: Hazards
  expect: { path: string[]; cost: number } | 'no-route' | 'start-blocked'
}

const hz = (p: Partial<Hazards> = {}): Hazards => ({ blocked_nodes: [], blocked_edges: [], closed_exits: [], ...p })

export const SCENARIOS: Scenario[] = [
  { id: 'baseline', start: 'R1', hazards: hz(), expect: { path: ['R1', 'C1', 'C2', 'E1'], cost: 7 } },
  { id: 'blockC2', start: 'R1', hazards: hz({ blocked_nodes: ['C2'] }), expect: { path: ['R1', 'C1', 'C3', 'C4', 'E2'], cost: 11 } },
  { id: 'closeExits', start: 'R1', hazards: hz({ closed_exits: ['E1', 'E2'] }), expect: 'no-route' },
  { id: 'startR2', start: 'R2', hazards: hz(), expect: { path: ['R2', 'C3', 'C4', 'E2'], cost: 7 } },
  { id: 'blockStart', start: 'R1', hazards: hz({ blocked_nodes: ['R1'] }), expect: 'start-blocked' },
]

/** Corridor list of the official practice file. The checks only make sense on that exact graph. */
const SAMPLE_EDGES = 'C1-C2:3 C1-C3:4 C1-R1:2 C2-C4:3 C2-E1:2 C3-C4:3 C3-R2:2 C4-E2:2 R1-R2:4'

const edgeSig = (b: Building) =>
  b.edges.map((e) => `${[e.from, e.to].sort().join('-')}:${e.cost}`).sort().join(' ')

const exitIds = (b: Building) => b.nodes.filter((n) => n.type === 'exit').map((n) => n.id).sort().join(' ')

export const isSampleGraph = (b: Building) => edgeSig(b) === SAMPLE_EDGES && exitIds(b) === 'E1 E2'

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x))
export const sameHazards = (a: Hazards, b: Hazards) =>
  sameSet(a.blocked_nodes, b.blocked_nodes) && sameSet(a.blocked_edges, b.blocked_edges) && sameSet(a.closed_exits, b.closed_exits)

/** Runs one scenario through the real engine and compares with the expected result. */
export function runScenario(b: Building, s: Scenario) {
  const r = computeRoute(b, s.hazards, s.start)
  const pass =
    typeof s.expect === 'string'
      ? r.status === s.expect
      : r.status === 'ok' && r.cost === s.expect.cost && r.path.join() === s.expect.path.join()
  return { result: r, pass }
}
