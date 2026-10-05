const PROPS = [
  'fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-opacity', 'stroke-linecap',
  'opacity', 'font-family', 'font-size', 'font-weight', 'text-anchor', 'dominant-baseline', 'paint-order',
] as const

/** Render the live map SVG (with its computed CSS colours inlined) to a PNG download. */
export async function exportSvgAsPng(svg: SVGSVGElement, fileName: string, scale = 2) {
  const clone = svg.cloneNode(true) as SVGSVGElement
  const src = [svg, ...svg.querySelectorAll('*')]
  const dst = [clone, ...clone.querySelectorAll('*')]
  src.forEach((el, i) => {
    const cs = getComputedStyle(el)
    const target = dst[i] as SVGElement
    for (const p of PROPS) target.style.setProperty(p, cs.getPropertyValue(p))
    target.style.setProperty('animation', 'none')
    target.style.setProperty('transition', 'none')
    // The route "draw" animation uses a dash offset; export the finished line.
    if (el.classList.contains('route-line')) target.style.setProperty('stroke-dashoffset', '0')
  })
  // Hidden hit areas and pulses are interaction-only.
  clone.querySelectorAll('.edge-hit, .start-pulse').forEach((n) => n.remove())

  const vb = svg.viewBox.baseVal
  clone.setAttribute('width', String(vb.width))
  clone.setAttribute('height', String(vb.height))
  const xml = new XMLSerializer().serializeToString(clone)
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const img = new Image()
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = url })
    const canvas = document.createElement('canvas')
    canvas.width = vb.width * scale
    canvas.height = vb.height * scale
    const ctx = canvas.getContext('2d')!
    ctx.scale(scale, scale)
    ctx.drawImage(img, 0, 0)
    const a = document.createElement('a')
    a.download = fileName
    a.href = canvas.toDataURL('image/png')
    a.click()
  } finally {
    URL.revokeObjectURL(url)
  }
}
