import { del, get, set } from 'idb-keyval'

/** Browser-only persistence. Every call is guarded: private windows or blocked storage must never break the app. */
export const local = {
  get<T>(key: string, fallback: T): T {
    try {
      const v = localStorage.getItem(key)
      return v === null ? fallback : (JSON.parse(v) as T)
    } catch {
      return fallback
    }
  },
  set(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* storage full or blocked */
    }
  },
  remove(key: string) {
    try {
      localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  },
}

export const session = {
  get(key: string) {
    try {
      return sessionStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key: string, value: string) {
    try {
      sessionStorage.setItem(key, value)
    } catch {
      /* ignore */
    }
  },
  remove(key: string) {
    try {
      sessionStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  },
}

export const idb = {
  async get<T>(key: string): Promise<T | undefined> {
    try {
      return await get<T>(key)
    } catch {
      return undefined
    }
  },
  async set(key: string, value: unknown) {
    try {
      await set(key, value)
    } catch {
      /* ignore */
    }
  },
  async del(key: string) {
    try {
      await del(key)
    } catch {
      /* ignore */
    }
  },
}

export function download(filename: string, content: string, type = 'text/csv;charset=utf-8') {
  // BOM so Excel opens Bangla text correctly
  const blob = new Blob([type.startsWith('text/csv') ? '﻿' + content : content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
