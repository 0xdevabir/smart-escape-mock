# Smart Escape
### Interactive evacuation route simulator — pick a start, toggle hazards, watch the lowest-cost exit path update instantly in English and বাংলা

![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-40%20tests%20green-729B1B?style=for-the-badge&logo=vitest&logoColor=white)
![i18n](https://img.shields.io/badge/i18n-English%20%2B%20বাংলা-0EA5E9?style=for-the-badge)
![Frontend only](https://img.shields.io/badge/frontend%20only-no%20backend-success?style=for-the-badge)

[Quick start](#-run-it-in-3-commands) · [How it works](#-how-it-works) · [Sample checks](#-sample-checks--41) · [Feature tour](#-feature-tour) · [Two-minute demo](#-two-minute-demo) · [What this is not](#%EF%B8%8F-what-this-is-not)

**AI DevFest Vibe Coding** · practice / mock test · frontend-only

> **Why is this hard?** An evacuation map is only useful while the building keeps changing. A blocked corridor, a closed exit, a room that just became unsafe — the “best” path a second ago may be wrong now. Hard-coding paths fails the moment the hazard map moves.

> **Smart Escape answers one question, on every click:** *from this start, through the current hazards, what is the lowest-cost route to an open exit — and why that path, not another with the same cost?*

| 8 nodes · 9 corridors East Annex sample | 5 / 5 §4.1 sample checks | 40 / 40 unit tests | EN + বাংলা full UI | 0 backend calls everything local |
| --------------------------------------- | ------------------------ | ------------------ | ------------------ | -------------------------------- |

| | |
|---|---|
| **Name** | `<your full name>` |
| **Registration number** | `261-15-001` |
| **Live link (HTTPS)** | https://0xdevabir.github.io/smart-scape-mock/ |
| **Repository** | https://github.com/0xdevabir/smart-scape-mock |

---

## 🎯 The problem and how we answer it

| The problem | What Smart Escape does | Where to see it |
| --- | --- | --- |
| Paths go stale the moment a hazard changes | Dijkstra recalculates **synchronously** after every toggle | Map highlight · Route panel |
| Ties between equal-cost paths are ambiguous | Lexicographically smallest exit ID, then smallest node sequence | *Why this path?* · Tie screenshot |
| Invalid building files crash or silently lie | Strict §3.1 validation; bilingual error list; current map kept | Invalid-file screenshot |
| Judges need to verify §4.1 without a checklist | Built-in **Judge mode** runs the five sample checks through the real engine | Judge mode panel |
| Bangla users get English-only tools | Every label, status, error and walkthrough is translated; Bangla digits in BN mode | Bangla screenshot |

**Hero workflow:** open the app → East Annex loads → click **R1** → see `R1 → C1 → C2 → E1` (cost 7) → block **C2** → the route flips to `R1 → C1 → C3 → C4 → E2` (cost 11) with a `7 → 11 (+4)` badge and a faint ghost of the old path.

---

## 🔁 How it works

### One click, start to finish

```mermaid
flowchart LR
    A["📂 building.json<br/>import or sample"] --> B["✅ Validate §3.1"]
    B -- reject --> X["❌ Bilingual error list<br/>keep current map"]
    B -- ok --> C["🗺️ Draw map<br/>rooms · junctions · exits · costs"]
    C --> D["👆 Pick start<br/>or toggle a hazard"]
    D --> E["🧮 usableGraph<br/>drop blocked / closed"]
    E --> F["⚡ Dijkstra<br/>sum of edge costs"]
    F --> G{"Open exits<br/>reachable?"}
    G -- no --> H["🚫 No route / start blocked"]
    G -- yes --> I["🏁 Best exit<br/>then lex-smallest path"]
    I --> J["✨ Highlight + explain<br/>top-3 · walkthrough · ghost"]
```

### What the user sees when a hazard flips

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant UI as Smart Escape UI
    participant E as Route engine
    U->>UI: Block corridor / close exit / pick start
    UI->>UI: Push hazard history (undo stack)
    UI->>E: computeRoute(building, hazards, start)
    E->>E: usableGraph → Dijkstra → best exit → lex path
    alt ok
        E-->>UI: path · exit · cost · ties · other exits
        UI-->>U: Map highlight + status + Why this path?
    else no-route / start-blocked
        E-->>UI: failure status
        UI-->>U: Clear status + trapped / reachable hints
    end
```

### Routing rules (§3.3) in `src/lib/route.ts`

1. Remove blocked nodes, closed exits, blocked edges, and every edge that touches a removed node. A closed exit is never used, even as an intermediate.
2. Run Dijkstra from the start using the **sum of edge costs**. Coordinates and hop counts are never used.
3. Pick the reachable open exit with the lowest cost. On a tie, pick the lexicographically smallest exit ID.
4. Among equal-cost paths to that exit, return the lexicographically smallest node sequence (second Dijkstra from the exit, then greedy walk preferring the smallest-ID neighbour on a shortest path).

Nothing is hard-coded: routes, IDs and positions all come from the imported file.

---

## ✅ Sample checks (§4.1)

Verified by unit tests **and** in the browser Judge mode.

| Scenario | Result |
| --- | --- |
| Select **R1** | `R1 → C1 → C2 → E1`, cost **7** |
| Select **R1**, block **C2** | `R1 → C1 → C3 → C4 → E2`, cost **11** |
| Select **R1**, close **E1** and **E2** | **No route available** |
| Select **R2** | `R2 → C3 → C4 → E2`, cost **7** |
| Select **R1**, then block **R1** | **Starting location blocked** |

**Tie example:** with C2 blocked, `R1 → C1 → C3 → C4 → E2` and `R1 → R2 → C3 → C4 → E2` both cost 11. The app picks the one through **C1**, because `C1` < `R2` at the first differing hop. *Why this path?* lists both and marks the chosen one.

```mermaid
xychart-beta
    title "Sample-check route cost (lower is better; failures shown as 0)"
    x-axis ["R1 baseline", "R1 + block C2", "R1 exits closed", "R2 baseline", "R1 start blocked"]
    y-axis "Cost" 0 --> 12
    bar [7, 11, 0, 7, 0]
```

---

## 🖥️ Feature tour

| [Baseline: R1 → E1 cost 7](screenshots/01-baseline-R1.png)**Baseline.** Pick R1 and the cheapest exit lights up: `R1 → C1 → C2 → E1`, cost 7. | [Reroute after blocking C2](screenshots/02-reroute-after-blocking-C2.png)**Live reroute.** Block C2 and the path flips to E2 at cost 11, with a cost-delta badge. |
| --- | --- |
| [No route when exits are closed](screenshots/03-no-route-exits-closed.png)**No route.** Close E1 and E2 — status becomes *No route available* / *কোনো পথ পাওয়া যায়নি*. | [Start blocked](screenshots/04-start-blocked.png)**Start blocked.** Block the starting room — clear bilingual failure, not a silent empty map. |
| [Bangla UI](screenshots/05-bangla.png)**বাংলা.** Full UI translation, including statuses, errors, help and Bangla digits. | [Invalid import](screenshots/06-invalid-file.png)**Strict import.** A bad `building.json` shows every §3.1 violation; the current map stays. |
| [Why this path / tie](screenshots/07-why-this-path-tie.png)**Why this path?** Cost breakdown, exit-tie reason, and every equal-cost alternative marked. | [Help & shortcuts](screenshots/08-help-shortcuts.png)**Help.** Keyboard map, routing rules and validation catalog behind **?**. |
| [Judge mode 5/5](screenshots/09-judge-mode.png)**Judge mode.** The five §4.1 checks run through the real engine — **Run all 5** plays them as a demo. | |

### Also built in

| Surface | What it does |
| --- | --- |
| **Top 3 routes** | Yen-style k-shortest across open exits; hover/focus previews the path |
| **Walkthrough + Play** | Step list and a marker that walks the route |
| **What changed** | Previous route stays as a faint ghost; badge shows `7 → 11 (+4)` or *Route lost* |
| **Dead ends** | Nodes with no reachable exit get a dashed ring; panel names reachable areas |
| **Map HUD** | Start → exit · cost overlay; zoom/pan (`+` `−` `0`, Ctrl/⌘+wheel, drag) |
| **Undo / redo** | Hazard history; Reset restores `initial_state` and can itself be undone |
| **Accessibility** | High-contrast toggle, keyboard map + hazard switches, ARIA live status, `prefers-reduced-motion` |
| **PNG export / print** | Full map with the current route, even when zoomed |
| **Persistence** | Dataset, hazards, start, language and contrast in `localStorage` (re-validated on load) |

---

## 🏗️ Architecture

```mermaid
flowchart TB
    subgraph UI["React UI"]
      App --> MapView
      App --> RoutePanel
      App --> HazardPanel
      App --> SelfCheck
      App --> HelpDialog
    end
    subgraph Engine["src/lib — pure functions"]
      validate["validate.ts · §3.1"]
      route["route.ts · Dijkstra + ties + top-3"]
      selfCheck["selfCheck.ts · five §4.1 scenarios"]
      i18n["i18n.ts · EN + বাংলা"]
    end
    App --> validate
    App --> route
    SelfCheck --> selfCheck
    selfCheck --> route
    UI --> i18n
```

```
smart-escape/
├── public/building.json     # East Annex sample
├── screenshots/             # feature tour images
├── src/
│   ├── App.tsx              # state, shortcuts, persistence
│   ├── components/          # MapView · RoutePanel · HazardPanel · SelfCheck · Help
│   └── lib/
│       ├── route.ts         # Dijkstra, ties, ranked routes, regions
│       ├── validate.ts      # strict building.json rules
│       ├── selfCheck.ts     # §4.1 scenarios
│       ├── i18n.ts          # English + Bangla
│       └── *.test.ts        # 40 unit tests
├── docs/PLAN.md
└── .github/workflows/deploy.yml
```

---

## ⚡ Run it in 3 commands

**Requirements:** Node 20.19+ (or 22.12+).

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # 40 unit tests
```

```bash
npm run build     # static production build in dist/
npm run preview   # serve dist/ locally
```

The build is fully static (`base: './'`). Host `dist/` on GitHub Pages, Netlify, Vercel or Cloudflare Pages with no config. `.github/workflows/deploy.yml` deploys to GitHub Pages on every push to `main` — enable **Settings → Pages → Source: GitHub Actions**.

---

## 🎮 How to use

1. East Annex (`public/building.json`) loads automatically. **Import JSON** or drop a file anywhere to load your own.
2. With **Select start** on, click a room/junction or pick from the list — route, exit and cost appear immediately.
3. Switch to **Toggle hazards**: click a room/junction to block it, an exit to close it, or a corridor (or its cost label) to block it. Click again to undo. The Hazards panel mirrors the same switches for keyboard use.
4. **Reset** restores the file’s `initial_state`. **বাংলা / English** switches language. **↶ / ↷** undo and redo.
5. Press **?** for shortcuts, routing rules and the validation catalog.

**Keyboard:** `R` reset · `E` language · `S`/`H` mode · arrows move start (map focused) · `P` play · `Ctrl/⌘ Z` / `⇧Z` undo/redo · `+` `−` `0` zoom · `?` help.

---

## 🎬 Two-minute demo

| Time | Beat |
| --- | --- |
| **0:00** | Open the live link — East Annex loads, brand and map fill the first viewport. |
| **0:20** | Click **R1** → route `R1 → C1 → C2 → E1`, cost 7. |
| **0:40** | Block **C2** → reroute to E2 at cost 11; show ghost path + delta badge. |
| **1:00** | Open *Why this path?* — cost breakdown and the C1-vs-R2 tie. |
| **1:20** | Switch to **বাংলা** — statuses and panel labels flip; digits become Bangla. |
| **1:35** | **Judge mode → Run all 5** — five §4.1 checks pass through the real engine. |
| **1:50** | Close: frontend-only, bilingual, explained routes that update on every hazard. |

---

## ⚠️ What this is not

> Educational simulation only. **Not** a certified real-world evacuation planning tool.

- No backend, no accounts, no telemetry — everything runs in the browser.
- Dataset labels and IDs stay as authored; only the UI chrome is translated.
- Judge mode appears only when the official East Annex sample graph is loaded.

---

## 🙏 Acknowledgments

Built for **AI DevFest Vibe Coding** (practice / mock test). Routing follows the published §3.3 rules; sample checks follow §4.1. Inspiration for this README’s structure: [FraudLens](https://github.com/0xdevabir/FraudLens) and [Emberfall / runtime-terrors](https://github.com/0xdevabir/runtime-terrors).
