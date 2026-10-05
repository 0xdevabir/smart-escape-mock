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
      /** Cheapest route to every other reachable open exit, sorted by cost then exit ID. */
      alternatives: { exit: string; cost: number; path: string[] }[]
    }
