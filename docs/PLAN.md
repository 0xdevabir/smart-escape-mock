# Smart Escape: build plan (90-minute budget)

## 0. Constraints from the rulebook
- Frontend only (no backend, serverless functions or remote DB). Browser storage is fine.
- Bangla and English for all labels, buttons, statuses, errors and instructions.
- Public HTTPS deploy by T+90 that works in the latest Chrome without login.
- Public repo `devfest-<registration-number>`, ≥3 commits, at least one every 30 min. Every message says what changed **and** the AI prompt used (or `Manual edit`). No history rewriting and no secrets.
- Repo needs README.md (identity, live link, how to run, features, bonus, known issues, AI tools, best prompt), an MIT LICENSE, and `screenshots/` showing the baseline route and the reroute after C2 is blocked.

## 1. Architecture
| Layer | File | Responsibility |
|---|---|---|
| Types | `src/lib/types.ts` | `Building`, `Node`, `Edge`, `Hazards`, `RouteResult` |
| Validation | `src/lib/validate.ts` | Strict schema and consistency checks. Returns all errors as i18n keys and params |
| Routing | `src/lib/route.ts` | Dijkstra plus deterministic tie-breaking. Pure function, no UI |
| i18n | `src/lib/i18n.ts` | `en` / `bn` dictionaries, `t(key, params)`, Bangla digits |
| Sample | `public/building.json` | Sample dataset (also bundled for "Load sample") |
| UI | `src/App.tsx`, `src/components/*` | Import, SVG map, hazard controls, route panel |
| Tests | `src/lib/*.test.ts` | Sample checks 4.1, ties, disconnected graphs, invalid input |

## 2. Routing rules (3.3)
1. Usable graph = nodes minus blocked nodes minus closed exits; edges minus blocked edges minus edges that touch a removed node.
2. If the start is blocked → `Starting location blocked`.
3. Dijkstra from the start (sum of integer edge costs; coordinates are never used).
4. Among reachable open exits, pick the lowest cost. On a tie, pick the smallest exit ID (plain code-unit string compare, case-sensitive).
5. For that exit, run Dijkstra from the exit and walk greedily from the start. At each step, take the smallest neighbor ID `v` with `dS[u] + w(u,v) + dE[v] == D`. This gives the lexicographically smallest node sequence among all minimum-cost paths.
6. If no exit is reachable → `No route available`.

## 3. Validation (3.1)
Object root. `building` is a non-empty string. `nodes` has 2–60 entries, each with a unique non-empty string `id`, a non-empty `label`, a `type` of room/junction/exit, and finite numeric `x`/`y`. There is at least one room or junction and at least one exit. `edges` has 1–150 entries, each with a unique `id`, `from`/`to` that exist, no self-loop, no repeated unordered pair, and a positive integer `cost`. `initial_state` contains all three arrays. Their IDs must exist and match a category: blocked_nodes are rooms or junctions, blocked_edges are edges, and closed_exits are exits. If anything fails, the file is rejected with a bilingual list of errors and the previously loaded map stays.

## 4. UI / UX
- Header: app name, language toggle (EN/বাংলা), high-contrast toggle, import, load sample, reset, PNG export.
- Map (SVG): auto-fitted to the supplied coordinates. Shape and colour show the type (room = circle, junction = small diamond, exit = rounded square in green). Cost labels sit on every corridor.
  - States: blocked node (red with a cross), closed exit (grey with a lock), blocked corridor (red dashed), start (blue ring), route (thick blue animated stroke).
- Modes: **Select start** or **Toggle hazards** (clicking a node or corridor toggles it). Everything is also reachable from list controls in the side panel, for keyboard and accessibility.
- Route panel: status banner, node sequence chips, exit, total cost, step-by-step walkthrough, and the cheapest route to each other exit (alternatives).
- Animations: brief transitions on state colours, a route "draw" on change and a start pulse. All respect `prefers-reduced-motion`.
- Persistence: the last dataset, hazards, start, language and contrast are saved in localStorage.

## 5. Timeline (contest day)
| Time | Work | Commit |
|---|---|---|
| T+0–10 | Read the problem, ask questions, scaffold with create-vite | #1 scaffold |
| T+10–35 | types, validation, routing and tests (sample checks green) | #2 engine |
| T+35–65 | SVG map, controls, route panel, i18n | #3 UI |
| T+65–75 | animations, bonus, README, LICENSE, screenshots | #4 docs |
| T+75–85 | deploy (GitHub Pages action / Netlify drop), verify live in Chrome | #5 deploy |
| T+85–90 | submit form: repo URL, commit hash, live link | n/a |
