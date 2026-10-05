import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { computeRoute, rankedRoutes, trappedNodes } from './route'
import type { Building, Hazards } from './types'
import { parseBuildingText, validateBuilding } from './validate'

const sampleText = readFileSync(new URL('../../public/building.json', import.meta.url), 'utf8')
const parsed = parseBuildingText(sampleText)
if (!parsed.ok) throw new Error('sample invalid')
const sample = parsed.data
const base: Hazards = { blocked_nodes: [], blocked_edges: [], closed_exits: [] }
const h = (p: Partial<Hazards>): Hazards => ({ ...base, ...p })

describe('sample checks (4.1)', () => {
  it('baseline R1 -> E1 cost 7', () => {
    const r = computeRoute(sample, base, 'R1')
    expect(r).toMatchObject({ status: 'ok', path: ['R1', 'C1', 'C2', 'E1'], cost: 7, exit: 'E1' })
  })
  it('blocked junction C2 reroutes via C3, C4 to E2 cost 11', () => {
    const r = computeRoute(sample, h({ blocked_nodes: ['C2'] }), 'R1')
    expect(r).toMatchObject({ status: 'ok', path: ['R1', 'C1', 'C3', 'C4', 'E2'], cost: 11 })
  })
  it('both exits closed -> no route', () => {
    expect(computeRoute(sample, h({ closed_exits: ['E1', 'E2'] }), 'R1').status).toBe('no-route')
  })
  it('different start R2 -> E2 cost 7', () => {
    const r = computeRoute(sample, base, 'R2')
    expect(r).toMatchObject({ status: 'ok', path: ['R2', 'C3', 'C4', 'E2'], cost: 7 })
  })
  it('blocked start', () => {
    expect(computeRoute(sample, h({ blocked_nodes: ['R1'] }), 'R1').status).toBe('start-blocked')
  })
})

const mk = (nodes: [string, string][], edges: [string, string, number][], st: Partial<Hazards> = {}): Building => ({
  building: 'T',
  nodes: nodes.map(([id, type], i) => ({ id, label: id, type: type as 'room', x: i, y: 0 })),
  edges: edges.map(([from, to, cost], i) => ({ id: `e${i}`, from, to, cost })),
  initial_state: h(st),
})

describe('routing rules (3.3, 3.4)', () => {
  it('equal cost exits -> smallest exit ID', () => {
    const b = mk([['S', 'room'], ['Z', 'exit'], ['A', 'exit']], [['S', 'Z', 3], ['S', 'A', 3]])
    expect(computeRoute(b, base, 'S')).toMatchObject({ exit: 'A', cost: 3 })
  })
  it('exit ID comparison is case-sensitive code-unit order', () => {
    const b = mk([['S', 'room'], ['a', 'exit'], ['B', 'exit']], [['S', 'a', 1], ['S', 'B', 1]])
    expect(computeRoute(b, base, 'S')).toMatchObject({ exit: 'B' })
  })
  it('equal cost paths to same exit -> smallest node sequence', () => {
    const b = mk(
      [['S', 'room'], ['M', 'junction'], ['B', 'junction'], ['X', 'exit']],
      [['S', 'M', 1], ['M', 'X', 1], ['S', 'B', 1], ['B', 'X', 1]],
    )
    expect(computeRoute(b, base, 'S')).toMatchObject({ path: ['S', 'B', 'X'] })
  })
  it('sequence tie-break compares later positions too', () => {
    // S-A-Q-X and S-A-P-X both cost 3, S-B-X costs 3; expect S-A-P-X.
    const b = mk(
      [['S', 'room'], ['A', 'junction'], ['B', 'junction'], ['P', 'junction'], ['Q', 'junction'], ['X', 'exit']],
      [['S', 'A', 1], ['A', 'Q', 1], ['Q', 'X', 1], ['A', 'P', 1], ['P', 'X', 1], ['S', 'B', 1], ['B', 'X', 2]],
    )
    expect(computeRoute(b, base, 'S')).toMatchObject({ path: ['S', 'A', 'P', 'X'], cost: 3 })
  })
  it('uses edge cost, not hop count', () => {
    const b = mk(
      [['S', 'room'], ['A', 'junction'], ['B', 'junction'], ['X', 'exit']],
      [['S', 'X', 10], ['S', 'A', 1], ['A', 'B', 1], ['B', 'X', 1]],
    )
    expect(computeRoute(b, base, 'S')).toMatchObject({ path: ['S', 'A', 'B', 'X'], cost: 3 })
  })
  it('closed exit cannot be crossed as an intermediate node', () => {
    const b = mk([['S', 'room'], ['E1', 'exit'], ['E2', 'exit']], [['S', 'E1', 1], ['E1', 'E2', 1]])
    expect(computeRoute(b, h({ closed_exits: ['E1'] }), 'S').status).toBe('no-route')
  })
  it('blocked corridor removes only that connection', () => {
    const r = computeRoute(sample, h({ blocked_edges: ['L02'] }), 'R1')
    expect(r).toMatchObject({ status: 'ok', cost: 11, exit: 'E2', path: ['R1', 'C1', 'C3', 'C4', 'E2'] })
  })
  it('disconnected component -> no route', () => {
    const b = mk([['S', 'room'], ['T', 'room'], ['X', 'exit']], [['T', 'X', 1]])
    expect(computeRoute(b, base, 'S').status).toBe('no-route')
  })
  it('no start selected', () => {
    expect(computeRoute(sample, base, null).status).toBe('no-start')
  })
  it('other exits list the cheapest route to each remaining exit', () => {
    const r = computeRoute(sample, base, 'R1')
    expect(r.status === 'ok' && r.otherExits).toEqual([{ exit: 'E2', cost: 10, path: ['R1', 'C1', 'C2', 'C4', 'E2'] }])
  })
  it('blocking C2 ties two cost-11 paths; C1 < R2 wins and the tie is reported', () => {
    const r = computeRoute(sample, h({ blocked_nodes: ['C2'] }), 'R1')
    expect(r).toMatchObject({
      path: ['R1', 'C1', 'C3', 'C4', 'E2'],
      tiedExits: ['E2'],
      tiedPathCount: 2,
      tiedPaths: [['R1', 'C1', 'C3', 'C4', 'E2'], ['R1', 'R2', 'C3', 'C4', 'E2']],
    })
  })
  it('equal-cost exits are both reported as tied', () => {
    const b = mk([['S', 'room'], ['E2', 'exit'], ['E1', 'exit']], [['S', 'E2', 1], ['S', 'E1', 1]])
    expect(computeRoute(b, base, 'S')).toMatchObject({ exit: 'E1', tiedExits: ['E1', 'E2'] })
  })
})

describe('ranked routes and trapped nodes', () => {
  it('top 3 routes from R1 ordered by cost then sequence', () => {
    expect(rankedRoutes(sample, base, 'R1')).toEqual([
      { exit: 'E1', cost: 7, path: ['R1', 'C1', 'C2', 'E1'] },
      { exit: 'E2', cost: 10, path: ['R1', 'C1', 'C2', 'C4', 'E2'] },
      { exit: 'E2', cost: 11, path: ['R1', 'C1', 'C3', 'C4', 'E2'] },
    ])
  })
  it('first ranked route always equals the main route', () => {
    for (const s of ['R1', 'R2', 'C1', 'C2', 'C3', 'C4']) {
      for (const hz of [base, h({ blocked_nodes: ['C2'] }), h({ closed_exits: ['E1'] }), h({ blocked_edges: ['L03', 'L07'] })]) {
        const r = computeRoute(sample, hz, s)
        const top = rankedRoutes(sample, hz, s)[0]
        if (r.status === 'ok') expect(top).toEqual({ exit: r.exit, cost: r.cost, path: r.path })
        else expect(top).toBeUndefined()
      }
    }
  })
  it('routes never pass through one exit to reach another', () => {
    const b = mk([['S', 'room'], ['E1', 'exit'], ['E2', 'exit']], [['S', 'E1', 1], ['E1', 'E2', 1]])
    expect(rankedRoutes(b, base, 'S')).toEqual([{ exit: 'E1', cost: 1, path: ['S', 'E1'] }])
  })
  it('trapped nodes cannot reach any open exit', () => {
    expect(trappedNodes(sample, base)).toEqual([])
    expect(trappedNodes(sample, h({ blocked_nodes: ['C1', 'C3'] }))).toEqual(['R1', 'R2'])
    expect(trappedNodes(sample, h({ closed_exits: ['E1', 'E2'] }))).toEqual(['C1', 'C2', 'C3', 'C4', 'R1', 'R2'])
  })
})

describe('validation (3.1)', () => {
  const good = () => JSON.parse(sampleText)
  const keys = (raw: unknown) => {
    const r = validateBuilding(raw)
    return r.ok ? [] : r.errors.map((e) => e.key)
  }
  it('accepts the sample', () => expect(keys(good())).toEqual([]))
  it('rejects bad JSON', () => expect(parseBuildingText('{oops').ok).toBe(false))
  it('rejects empty building name', () => expect(keys({ ...good(), building: '  ' })).toContain('err.building'))
  it('rejects duplicate node IDs', () => {
    const d = good(); d.nodes[1].id = 'R1'
    expect(keys(d)).toContain('err.nodeDup')
  })
  it('rejects unknown node type', () => {
    const d = good(); d.nodes[0].type = 'stairs'
    expect(keys(d)).toContain('err.nodeType')
  })
  it('rejects non-numeric coordinates', () => {
    const d = good(); d.nodes[0].x = '10'
    expect(keys(d)).toContain('err.nodeXY')
  })
  it('rejects non-positive or fractional cost', () => {
    const d = good(); d.edges[0].cost = 0; d.edges[1].cost = 1.5; d.edges[2].cost = '3'
    expect(keys(d).filter((k) => k === 'err.edgeCost')).toHaveLength(3)
  })
  it('rejects unknown edge endpoint', () => {
    const d = good(); d.edges[0].to = 'r1'
    expect(keys(d)).toContain('err.edgeEnd')
  })
  it('rejects self-loops and repeated pairs (either direction)', () => {
    const d = good()
    d.edges.push({ id: 'L', from: 'R1', to: 'R1', cost: 1 }, { id: 'P', from: 'C1', to: 'R1', cost: 1 })
    expect(keys(d)).toEqual(expect.arrayContaining(['err.edgeLoop', 'err.edgePair']))
  })
  it('rejects too few nodes / missing exit', () => {
    expect(keys({ ...good(), nodes: [good().nodes[0]] })).toContain('err.nodesCount')
    const d = good(); d.nodes = d.nodes.filter((n: { type: string }) => n.type !== 'exit')
    expect(keys(d)).toContain('err.needExit')
  })
  it('rejects missing initial_state arrays', () => {
    expect(keys({ ...good(), initial_state: { blocked_nodes: [], blocked_edges: [] } })).toContain('err.stateArray')
  })
  it('rejects initial_state IDs in the wrong category', () => {
    expect(keys({ ...good(), initial_state: { blocked_nodes: ['E1'], blocked_edges: [], closed_exits: ['R1'] } }))
      .toEqual(['err.stateKind', 'err.stateKind'])
    expect(keys({ ...good(), initial_state: { blocked_nodes: [], blocked_edges: ['nope'], closed_exits: [] } }))
      .toEqual(['err.stateId'])
  })
  it('accepts disconnected graphs', () => {
    const d = good(); d.edges = d.edges.slice(0, 1)
    expect(keys(d)).toEqual([])
  })
})
