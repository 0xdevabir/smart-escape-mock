App.tsx 549L cognitive
// /Users/mdabirhossain/Documents/WebDevelopment/hackathon/mock/src/App.tsx
§ function loadSaved (L41-L49)
function loadSaved(): Partial<Saved> | null {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as Partial<Saved>
    // Never trust storage blindly: re-validate the building and drop stale hazard IDs.
    const v = s.building ? validateBuilding(s.building) : null
    if (!v?.ok) return { lang: s.lang, contrast: s.contrast }
    const b = v.data
// ... 162 lines omitted
§ function function (L212-L218)
  const commitHazards = (next: Hazards) => {
    if (sameHazards(next, hazards)) return
    if (route.status === 'ok') setGhost({ path: route.path, cost: route.cost })
    setPast((p) => [...p.slice(-MAX_HISTORY + 1), hazards])
    setFuture([])
    setHazards(next)
  }
// ... 20 lines omitted
§ function function (L239-L246)
  const chooseStart = (id: string | null) => {
    if (!building || id === null) return setStartFresh(null)
    const n = building.nodes.find((x) => x.id === id)
    if (!n) return
    if (n.type === 'exit') return notify('msg.exitNotStart')
    if (hazards.blocked_nodes.includes(id)) return notify('msg.startBlockedPick', { id })
    if (id !== start) setStartFresh(id)
  }
// ... 17 lines omitted
§ function function (L264-L268)
  const exportPng = () => {
    if (svgRef.current && building) {
      void exportSvgAsPng(svgRef.current, `smart-scrap-${building.building.replace(/[^\w-]+/g, '_')}.png`)
    }
  }
// ... 3 lines omitted
§ function function (L272-L279)
  const showScenario = (s: Scenario) => {
    if (!building) return
    commitHazards(cloneHazards(s.hazards))
    if (s.start !== start) {
      setStart(s.start)
      setWalk(null)
    }
  }
// ... 26 lines omitted
§ function function (L306-L323)
  const moveStart = (key: string) => {
    if (!building) return
    const usable = building.nodes.filter((n) => n.type !== 'exit' && !hazards.blocked_nodes.includes(n.id))
    const cur = building.nodes.find((n) => n.id === start)
    if (!cur) return usable[0] && chooseStart([...usable].sort((a, b) => (a.id < b.id ? -1 : 1))[0].id)
    const [ux, uy] = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[key]!
    let best: BNode | null = null
    let bestScore = Infinity
    for (const n of usable) {
      const dx = n.x - cur.x, dy = n.y - cur.y
      const along = dx * ux + dy * uy
      const across = Math.abs(dx * uy - dy * ux)
      if (n.id === cur.id || along <= 0) continue
      const score = along + 2 * across
      if (score < bestScore) { bestScore = score; best = n }
    }
    if (best) chooseStart(best.id)
  }
§ block block (L324-L352)

  // One global listener; the ref always points at the latest handler so it sees current state.
  const onKey = useRef<(e: KeyboardEvent) => void>(() => {})
  useEffect(() => {
    onKey.current = (e: KeyboardEvent) => {
      if (help || isTyping(e.target)) return
      const mod = e.ctrlKey || e.metaKey
      const k = e.key.toLowerCase()
      if (mod && k === 'z') { e.preventDefault(); return e.shiftKey ? redo() : undo() }
      if (mod && k === 'y') { e.preventDefault(); return redo() }
      if (mod || e.altKey) return
      if (e.key === '?') return setHelp(true)
      if (e.key === 'Escape') { setWalk(null); setPreview([]); return setDemo(null) }
      if (k === 'e') return setLang((l) => (l === 'en' ? 'bn' : 'en'))
      if (!building) return
      if (k === 'r') return reset()
      if (k === 's') return setMode('start')
      if (k === 'h') return setMode('hazard')
      if (k === 'p') return play()
      if (e.key === '+' || e.key === '=') return setView((v) => zoomBy(v, 1.4))
      if (e.key === '-') return setView((v) => zoomBy(v, 1 / 1.4))
      if (e.key === '0') return setView(FIT)
      if (e.key.startsWith('Arrow')) {
        e.preventDefault()
        moveStart(e.key)
      }
    }
  })
  useEffect(() => {
7/42 chunks shown (1063 tokens)
[lean-ctx] full source: read "/Users/mdabirhossain/Documents/WebDevelopment/hackathon/mock/src/App.tsx" directly (no MCP)  ·  or ctx_read("/Users/mdabirhossain/Documents/WebDevelopment/hackathon/mock/src/App.tsx", mode="full")
