import { mulberry32 } from './rng'

/** Z-score standardiser fitted on the training split only. */
export class Scaler {
  mean: number[] = []
  std: number[] = []
  fit(X: number[][]) {
    const d = X[0].length
    this.mean = new Array(d).fill(0)
    this.std = new Array(d).fill(0)
    for (const x of X) for (let j = 0; j < d; j++) this.mean[j] += x[j] / X.length
    for (const x of X) for (let j = 0; j < d; j++) this.std[j] += (x[j] - this.mean[j]) ** 2 / X.length
    this.std = this.std.map((v) => Math.sqrt(v) || 1)
    return this
  }
  transform(x: number[]) {
    return x.map((v, j) => (v - this.mean[j]) / this.std[j])
  }
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))))

/**
 * Class-weighted L2 logistic regression trained with Adam.
 * Chosen over a tree ensemble because every prediction decomposes exactly into
 * per-feature contributions (weight × standardised value) — explanations are faithful, not approximated.
 */
export class LogisticModel {
  w: number[] = []
  b = 0
  fit(X: number[][], y: number[], { epochs = 250, lr = 0.05, l2 = 1e-3 } = {}) {
    const d = X[0].length
    const n = X.length
    const pos = y.reduce((a, v) => a + v, 0)
    const posW = Math.min(25, (n - pos) / Math.max(pos, 1))
    this.w = new Array(d).fill(0)
    this.b = 0
    const m = new Array(d + 1).fill(0)
    const v = new Array(d + 1).fill(0)
    const b1 = 0.9
    const b2 = 0.999
    for (let ep = 1; ep <= epochs; ep++) {
      const g = new Array(d + 1).fill(0)
      let wsum = 0
      for (let i = 0; i < n; i++) {
        const wt = y[i] ? posW : 1
        const err = (this.predictRaw(X[i]) - y[i]) * wt
        for (let j = 0; j < d; j++) g[j] += err * X[i][j]
        g[d] += err
        wsum += wt
      }
      for (let j = 0; j <= d; j++) {
        const grad = g[j] / wsum + (j < d ? l2 * this.w[j] : 0)
        m[j] = b1 * m[j] + (1 - b1) * grad
        v[j] = b2 * v[j] + (1 - b2) * grad * grad
        const step = (lr * (m[j] / (1 - b1 ** ep))) / (Math.sqrt(v[j] / (1 - b2 ** ep)) + 1e-8)
        if (j < d) this.w[j] -= step
        else this.b -= step
      }
    }
    return this
  }
  predictRaw(x: number[]) {
    let z = this.b
    for (let j = 0; j < x.length; j++) z += this.w[j] * x[j]
    return sigmoid(z)
  }
  contributions(x: number[]) {
    return x.map((v, j) => v * this.w[j])
  }
}

interface INode {
  size: number
  feat?: number
  split?: number
  left?: INode
  right?: INode
}

const cFactor = (n: number) => (n <= 1 ? 0 : 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1)) / n)

/** Isolation Forest (Liu et al. 2008): catches unusual behaviour the labels never showed us. */
export class IsolationForest {
  trees: INode[] = []
  sampleSize = 256
  sorted: number[] = []
  fit(X: number[][], { trees = 100, seed = 7 } = {}) {
    const r = mulberry32(seed)
    const psi = Math.min(this.sampleSize, X.length)
    this.sampleSize = psi
    const maxDepth = Math.ceil(Math.log2(psi))
    const build = (rows: number[][], depth: number): INode => {
      if (depth >= maxDepth || rows.length <= 1) return { size: rows.length }
      const d = rows[0].length
      for (let attempt = 0; attempt < 6; attempt++) {
        const f = Math.floor(r() * d)
        let lo = Infinity
        let hi = -Infinity
        for (const x of rows) {
          if (x[f] < lo) lo = x[f]
          if (x[f] > hi) hi = x[f]
        }
        if (hi - lo < 1e-9) continue
        const split = lo + r() * (hi - lo)
        const L: number[][] = []
        const R: number[][] = []
        for (const x of rows) (x[f] < split ? L : R).push(x)
        return { size: rows.length, feat: f, split, left: build(L, depth + 1), right: build(R, depth + 1) }
      }
      return { size: rows.length }
    }
    this.trees = []
    for (let t = 0; t < trees; t++) {
      const sample: number[][] = []
      for (let i = 0; i < psi; i++) sample.push(X[Math.floor(r() * X.length)])
      this.trees.push(build(sample, 0))
    }
    this.sorted = X.map((x) => this.rawScore(x)).sort((a, b) => a - b)
    return this
  }
  private pathLength(x: number[], node: INode, depth: number): number {
    if (node.feat === undefined) return depth + cFactor(node.size)
    return this.pathLength(x, x[node.feat] < node.split! ? node.left! : node.right!, depth + 1)
  }
  rawScore(x: number[]) {
    const avg = this.trees.reduce((a, t) => a + this.pathLength(x, t, 0), 0) / this.trees.length
    return 2 ** (-avg / cFactor(this.sampleSize))
  }
  /** Percentile of this anomaly score among training rows (0–1). */
  percentile(x: number[]) {
    const s = this.rawScore(x)
    let lo = 0
    let hi = this.sorted.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (this.sorted[mid] < s) lo = mid + 1
      else hi = mid
    }
    return lo / Math.max(1, this.sorted.length)
  }
}
