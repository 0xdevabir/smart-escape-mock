/** Zoom level k (1 = whole building) and the view centre as a fraction of the full map. */
export interface View {
  k: number
  cx: number
  cy: number
}
export const FIT: View = { k: 1, cx: 0.5, cy: 0.5 }
export const MAX_ZOOM = 4
export const zoomBy = (v: View, f: number): View => ({ ...v, k: Math.min(MAX_ZOOM, Math.max(1, v.k * f)) })
