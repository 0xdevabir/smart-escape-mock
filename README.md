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
npm test          # 31 unit tests: sample checks, tie-breaking, validation, i18n
npm run build     # static production build in dist/
npm run preview   # serve the production build locally
```

Requires Node 20.19+ (or 22.12+). The build is fully static (`base: './'`), so `dist/` can be hosted on GitHub Pages, Netlify, Vercel or Cloudflare Pages without any configuration. `.github/workflows/deploy.yml` deploys to GitHub Pages on every push to `main`. In the repo, enable **Settings → Pages → Source: GitHub Actions**.

## How to use

1. The sample building loads automatically. Use **Import JSON** (or drag and drop a file anywhere on the page) to load your own `building.json`.
2. With **Select start** on, click a room or junction, or pick one from the *Starting location* list. The route, exit and total cost appear right away.
3. Switch to **Toggle hazards**, then click a room or junction to block it, an exit to close it, or a corridor (or its cost label) to block it. Click again to undo. The *Hazards* panel has the same switches and works with the keyboard.
4. **Reset** restores the file's original `initial_state`. **বাংলা / English** switches the language.

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

### Sample checks (§4.1), verified by unit tests and in the browser
| Scenario | Result |
|---|---|
| Select R1 | R1 → C1 → C2 → E1, cost 7 |
| Select R1, block C2 | R1 → C1 → C3 → C4 → E2, cost 11 |
| Select R1, close E1 and E2 | No route available |
| Select R2 | R2 → C3 → C4 → E2, cost 7 |
| Select R1, then block R1 | Starting location blocked |

## Bonus features

- **Alternative routes:** the cheapest route to every other reachable exit.
- **Step-by-step walkthrough:** each corridor, with its ID and cost.
- **Accessible / high-contrast controls:** a high-contrast toggle; keyboard-operable map (Tab, then Enter or Space) and hazard switches; ARIA labels and live status; automatic dark mode.
- **PNG export** of the current map, with the route.
- **Saving progress:** the dataset, hazards, start, language and contrast are stored in `localStorage` and re-validated on load.
- Drag-and-drop import and a responsive layout down to phone width.

## Screenshots

| Baseline (R1 → E1, cost 7) | After blocking C2 (R1 → E2, cost 11) |
|---|---|
| ![Baseline](screenshots/01-baseline-R1.png) | ![Reroute after blocking C2](screenshots/02-reroute-after-blocking-C2.png) |

More in [`screenshots/`](screenshots): no route, blocked start, Bangla mode, invalid file.

## Known issues

- The supplied `building.json` was reconstructed from the diagram in the problem statement, and its costs were chosen to reproduce every expected result in §4.1. Replace `public/building.json` with the official file if it differs.
- Very dense graphs (close to 60 nodes at nearly the same coordinates) can have overlapping labels, because nodes are drawn exactly at the supplied coordinates.
- The PNG export uses system fonts for text, so it may look slightly different from the on-screen web font.

## Tech

React 19, TypeScript and Vite. The map is plain SVG and there are no runtime dependencies besides React. Tests use Vitest. Everything runs in the browser: no backend, no external APIs and no API keys.

## AI tools used

- Claude Code (Claude Opus): planning, implementation, tests and end-to-end browser verification.

**Most useful prompt:**
> "Read the Smart Escape problem statement and the rulebook, then make an A-to-Z plan and implement it. Only the frontend, but everything must work perfectly: strict validation, exact tie-breaking rules, Bangla + English, animations, and the five sample checks."

See [`docs/PLAN.md`](docs/PLAN.md) for the build plan and timeline.
