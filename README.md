# Smart Escape: Interactive Evacuation Route Simulator

AI DevFest Vibe Coding (practice / mock test). A **frontend-only** web app that shows a building map and finds the lowest-cost route from a chosen start to an open exit. The route updates immediately when the user changes the simulated hazards. It works in **English and Bangla (বাংলা)**.

> Educational simulation only. This is not a certified real-world evacuation planning tool.

| | |
|---|---|
| **Name** | `<your full name>` |
| **Registration number** | `<your registration number>` |
| **Live link (HTTPS)** | `https://<github-user>.github.io/devfest-<registration-number>/` |
| **Repository** | `https://github.com/<github-user>/devfest-<registration-number>` |

## How to run

```bash
npm install
npm run dev       # local dev server at http://localhost:5173
npm test          # 40 unit tests: sample checks, tie-breaking, ranked routes, validation, i18n
npm run build     # static production build in dist/
npm run preview   # serve the production build locally
```

Requires Node 20.19+ (or 22.12+). The build is fully static (`base: './'`), so `dist/` can be hosted on GitHub Pages, Netlify, Vercel or Cloudflare Pages without any configuration. `.github/workflows/deploy.yml` deploys to GitHub Pages on every push to `main`. In the repo, enable **Settings → Pages → Source: GitHub Actions**.

## How to use

1. The official sample building (East Annex, `public/building.json`) loads automatically. Use **Import JSON** (or drag and drop a file anywhere on the page) to load your own `building.json`.
2. With **Select start** on, click a room or junction, or pick one from the *Starting location* list. The route, exit and total cost appear right away.
3. Switch to **Toggle hazards**, then click a room or junction to block it, an exit to close it, or a corridor (or its cost label) to block it. Click again to undo. The *Hazards* panel has the same switches and works with the keyboard.
4. **Reset** restores the file's original `initial_state`. **বাংলা / English** switches the language. **↶ / ↷** undo and redo hazard changes.
5. Press **?** for keyboard shortcuts, the routing rules and the validation catalog.

## Main features (mandatory tasks)

- **Import and map.** Strict validation of every rule in §3.1: required fields, 2–60 nodes, 1–150 edges, unique case-sensitive IDs, valid types, numeric coordinates, positive integer costs, no self-loops or repeated pairs in either direction, and `initial_state` IDs that exist and match their category. A rejected file shows a bilingual list of every problem, and the current map is kept. Nodes are drawn at the supplied coordinates (auto-fitted, aspect ratio preserved) with readable labels. Each node type has its own shape (room = circle, junction = diamond, exit = green rounded square), and every corridor shows its cost.
- **Select and calculate.** The lowest-cost route is highlighted on the map and shown as a node sequence, the exit and the total cost.
- **Change conditions.** You can block or unblock rooms, junctions and corridors, and close or reopen exits. Each state looks different: a blocked node is red with a cross, a closed exit is grey and dashed with a cross, a blocked corridor is red and dashed with ✕, and corridors made unusable by a blocked endpoint are dotted.
- **Update and reset.** The route is recalculated synchronously after every change. Reset restores the file's `initial_state` without re-importing.
- **Failure cases.** The app shows **No route available** and **Starting location blocked** (in Bangla: *কোনো পথ পাওয়া যায়নি* / *শুরুর স্থান অবরুদ্ধ*).
- **Two languages.** All labels, buttons, statuses, errors, instructions and the walkthrough are translated. Numbers use Bangla digits in Bangla mode. Dataset labels and IDs stay unchanged.
- **Animations.** Brief and readable: the route line is drawn in (0.45 s), colours transition when hazards change, the start location pulses once, and the status card fades in. All of these respect `prefers-reduced-motion`.

### Routing rules (§3.3) in `src/lib/route.ts`
1. Remove blocked nodes, closed exits, blocked edges and every edge that touches a removed node. A closed exit is never used, even as an intermediate node.
2. Run Dijkstra from the start using the **sum of edge costs**. Coordinates and hop counts are never used.
3. Pick the reachable open exit with the lowest cost. On a tie, pick the lexicographically smallest exit ID (plain case-sensitive code-unit order).
4. To return the lexicographically smallest node sequence among the equal-cost paths, run a second Dijkstra from the chosen exit. Then walk greedily from the start: at each node, take the smallest-ID neighbour `v` with `dist(start,u) + w(u,v) + dist(v,exit) = total`.

Nothing is hard-coded: routes, IDs and positions all come from the imported file, so any file with the same schema works.

**Tie example in the official data:** with C2 blocked, R1 → C1 → C3 → C4 → E2 and R1 → R2 → C3 → C4 → E2 both cost 11. The app picks the one through **C1**, because `C1` < `R2` at the first point where the two paths differ. The *Why this path?* section lists both paths and marks the chosen one.

### Sample checks (§4.1), verified by unit tests and in the browser
| Scenario | Result |
|---|---|
| Select R1 | R1 → C1 → C2 → E1, cost 7 |
| Select R1, block C2 | R1 → C1 → C3 → C4 → E2, cost 11 |
| Select R1, close E1 and E2 | No route available |
| Select R2 | R2 → C3 → C4 → E2, cost 7 |
| Select R1, then block R1 | Starting location blocked |

## Advanced and extra features

- **Why this path?** The cost breakdown (e.g. `2 + 3 + 2 = 7`), why this exit won (cheapest, only one, or tie → smallest ID), and, when paths tie, every equal-cost path with the chosen one marked.
- **Top 3 routes** (Yen's k-shortest paths across all open exits), with the extra cost of each. Hover or focus a row to preview that path on the map.
- **Other reachable exits:** the cheapest route to each one.
- **Walkthrough:** a step list, plus a **Play** animation where a marker walks the route and the current step is highlighted.
- **What changed:** after a hazard change, the previous route stays as a faint line, and a badge shows the cost change (`7 → 11 (+4)`) or *Route lost*.
- **Dead ends:** nodes with no reachable exit get a dashed ring. When there is no route, the panel says which nodes you can still reach and which areas still have open exits.
- **Map HUD and zoom/pan:** a start → exit · cost overlay; **+ / − / ⤢** buttons, Ctrl/⌘ + wheel, and drag to pan.
- **Tooltips** on every node and corridor (type, cost, state, cost from start).
- **Undo / redo** for hazard changes, and Reset can be undone.
- **Keyboard shortcuts:** R reset, E language, S/H mode, arrow keys move the start, P play, Ctrl/⌘ Z / ⇧Z undo and redo, + − 0 zoom, ? help.
- **Judge mode:** when the official sample is loaded, a panel runs the five §4.1 checks through the real engine (5/5). It ticks each one you reproduce by hand, and **Run all 5 checks** plays them as a demo. The panel stays hidden for other buildings.
- **Accessible / high contrast:** a high-contrast toggle; the map and hazard switches work with the keyboard (Tab, then Enter or Space); ARIA labels and live status; automatic dark mode; `prefers-reduced-motion` is respected.
- **PNG export** of the full map with the route (even when zoomed), and a clean **print** layout.
- **Saving progress:** the dataset, hazards, start, language and contrast are kept in `localStorage` and re-validated on load.
- Drag-and-drop import, a bilingual first-use coach bubble, and a responsive layout down to phone width.

The optional AI helper was deliberately left out. The app is fully usable offline with no API keys, as the rulebook requires.

## Screenshots

| Baseline (R1 → E1, cost 7) | After blocking C2 (R1 → E2, cost 11) |
|---|---|
| ![Baseline](screenshots/01-baseline-R1.png) | ![Reroute after blocking C2](screenshots/02-reroute-after-blocking-C2.png) |

| Why this path? (tie proof) | Judge mode |
|---|---|
| ![Tie proof](screenshots/07-why-this-path-tie.png) | ![Judge mode](screenshots/09-judge-mode.png) |

More in [`screenshots/`](screenshots): no route, blocked start, Bangla mode, invalid file, help.

## Known issues

- Very dense graphs (close to 60 nodes at nearly the same coordinates) can have overlapping labels, because nodes are drawn exactly at the supplied coordinates.
- The PNG export uses system fonts for text, so it may look slightly different from the on-screen web font.

## Tech

React 19, TypeScript and Vite. The map is plain SVG with no chart or graph library and there are no runtime dependencies besides React. Tests use Vitest. Everything runs in the browser: no backend, no external APIs and no API keys.

## AI tools used

- Claude Code (Claude Opus): planning, implementation, tests and end-to-end browser verification.

**Most useful prompt:**
> "Read the Smart Escape problem statement and the rulebook, then make an A-to-Z plan and implement it. Only the frontend, but everything must work perfectly: strict validation, exact tie-breaking rules, Bangla + English, animations, and the five sample checks."

See [`docs/PLAN.md`](docs/PLAN.md) for the build plan and timeline.
