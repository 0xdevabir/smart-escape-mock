README.md [111L]
# Smart Scrap: Interactive Evacuation Route Simulator
AI DevFest Vibe Coding (practice / mock test). A **frontend-only** web app that shows a building map and finds the lowest-cost route from a chosen start to an open exit. The route updates immediately when the user changes the simulated hazards. It works in **English and Bangla (বাংলা)**.
... [lean-ctx: omitted 5 lines]
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
... [lean-ctx: omitted 2 lines]
4. **Reset** restores the file's original `initial_state`. **বাংলা / English** switches the language. **↶ / ↷** undo and redo hazard changes.
... [lean-ctx: omitted 1 lines]
## Main features (mandatory tasks)
- **Import and map.** Strict validation of every rule in §3.1: required fields, 2–60 nodes, 1–150 edges, unique case-sensitive IDs, valid types, numeric coordinates, positive integer costs, no self-loops or repeated pairs in either direction, and `initial_state` IDs that exist and match their category. A rejected file shows a bilingual list of every problem, and the current map is kept. Nodes are drawn at the supplied coordinates (auto-fitted, aspect ratio preserved) with readable labels. Each node type has its own shape (room = circle, junction = diamond, exit = green rounded square), and every corridor shows its cost.
... [lean-ctx: omitted 2 lines]
- **Update and reset.** The route is recalculated synchronously after every change. Reset restores the file's `initial_state` without re-importing.
... [lean-ctx: omitted 2 lines]
- **Animations.** Brief and readable: the route line is drawn in (0.45 s), colours transition when hazards change, the start location pulses once, and the status card fades in. All of these respect `prefers-reduced-motion`.
### Routing rules (§3.3) in `src/lib/route.ts`
1. Remove blocked nodes, closed exits, blocked edges and every edge that touches a removed node. A closed exit is never used, even as an intermediate node.
... [lean-ctx: omitted 1 lines]
3. Pick the reachable open exit with the lowest cost. On a tie, pick the lexicographically smallest exit ID (plain case-sensitive code-unit order).
4. To return the lexicographically smallest node sequence among the equal-cost paths, run a second Dijkstra from the chosen exit. Then walk greedily from the start: at each node, take the smallest-ID neighbour `v` with `dist(start,u) + w(u,v) + dist(v,exit) = total`.
... [lean-ctx: omitted 1 lines]
**Tie example in the official data:** with C2 blocked, R1 → C1 → C3 → C4 → E2 and R1 → R2 → C3 → C4 → E2 both cost 11. The app picks the one through **C1**, because `C1` < `R2` at the first point where the two paths differ. The *Why this path?* section lists both paths and marks the chosen one.
### Sample checks (§4.1), verified by unit tests and in the browser
| Scenario | Result |
... [lean-ctx: omitted 3 lines]
| Select R1, close E1 and E2 | No route available |
... [lean-ctx: omitted 1 lines]
| Select R1, then block R1 | Starting location blocked |
## Advanced and extra features
- **Why this path?** The cost breakdown (e.g. `2 + 3 + 2 = 7`), why this exit won (cheapest, only one, or tie → smallest ID), and, when paths tie, every equal-cost path with the chosen one marked.
... [lean-ctx: omitted 8 lines]
- **Keyboard shortcuts:** R reset, E language, S/H mode, arrow keys move the start, P play, Ctrl/⌘ Z / ⇧Z undo and redo, + − 0 zoom, ? help.
- **Judge mode:** when the official sample is loaded, a panel runs the five §4.1 checks through the real engine (5/5). It ticks each one you reproduce by hand, and **Run all 5 checks** plays them as a demo. The panel stays hidden for other buildings.
- **Accessible / high contrast:** a high-contrast toggle; the map and hazard switches work with the keyboard (Tab, then Enter or Space); ARIA labels and live status; automatic dark mode; `prefers-reduced-motion` is respected.
... [lean-ctx: omitted 1 lines]
- **Saving progress:** the dataset, hazards, start, language and contrast are kept in `localStorage` and re-validated on load.
- Drag-and-drop import, a bilingual first-use coach bubble, and a responsive layout down to phone width.
... [lean-ctx: omitted 1 lines]
## Screenshots
| Baseline (R1 → E1, cost 7) | After blocking C2 (R1 → E2, cost 11) |
... [lean-ctx: omitted 1 lines]
| ![Baseline](screenshots/01-baseline-R1.png) | ![Reroute after blocking C2](screenshots/02-reroute-after-blocking-C2.png) |
... [lean-ctx: omitted 2 lines]
| ![Tie proof](screenshots/07-why-this-path-tie.png) | ![Judge mode](screenshots/09-judge-mode.png) |
More in [`screenshots/`](screenshots): no route, blocked start, Bangla mode, invalid file, help.
## Known issues
- Very dense graphs (close to 60 nodes at nearly the same coordinates) can have overlapping labels, because nodes are drawn exactly at the supplied coordinates.
- The PNG export uses system fonts for text, so it may look slightly different from the on-screen web font.
## Tech
React 19, TypeScript and Vite. The map is plain SVG with no chart or graph library and there are no runtime dependencies besides React. Tests use Vitest. Everything runs in the browser: no backend, no external APIs and no API keys.
## AI tools used
- Claude Code (Claude Opus): planning, implementation, tests and end-to-end browser verification.
... [lean-ctx: omitted 1 lines]
> "Read the Smart Scrap problem statement and the rulebook, then make an A-to-Z plan and implement it. Only the frontend, but everything must work perfectly: strict validation, exact tie-breaking rules, Bangla + English, animations, and the five sample checks."
See [`docs/PLAN.md`](docs/PLAN.md) for the build plan and timeline.

