export type NodeType = 'room' | 'junction' | 'exit'

export interface BNode {
  id: string
  label: string
  type: NodeType
  x: number
  y: number
}

export interface BEdge {
  id: string
  from: string
  to: string
  cost: number
}

export interface Hazards {
  blocked_nodes: string[]
  blocked_edges: string[]
  closed_exits: string[]
}

export interface Building {
  building: string
  nodes: BNode[]
  edges: BEdge[]
  initial_state: Hazards
}

export interface Step {
  from: string
  to: string
  edgeId: string
  cost: number
}

export interface RankedRoute {
  path: string[]
  exit: string
  cost: number
}

export type RouteResult =
  | { status: 'no-start' }
  | { status: 'start-blocked' }
  | { status: 'no-route' }
  | {
      status: 'ok'
      path: string[]
      exit: string
      cost: number
      steps: Step[]
      /** Open exits that tie with the chosen one on cost (the chosen exit included), sorted by ID. */
      tiedExits: string[]
      /** Equal-cost paths to the chosen exit in lexicographic order (capped), and how many exist. */
      tiedPaths: string[][]
      tiedPathCount: number
      /** Cheapest route to every other reachable open exit, sorted by cost then exit ID. */
      otherExits: RankedRoute[]
      /** Shortest distance from the start to every reachable node. */
      distances: Map<string, number>
    }
