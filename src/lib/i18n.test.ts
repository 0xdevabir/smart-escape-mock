import { describe, expect, it } from 'vitest'
import { dictionaries, formatNum, translate } from './i18n'

describe('i18n', () => {
  it('English and Bangla define exactly the same keys', () => {
    expect(Object.keys(dictionaries.bn).sort()).toEqual(Object.keys(dictionaries.en).sort())
  })
  it('every validation error key used by validate.ts is translated', async () => {
    const src = (await import('node:fs')).readFileSync(new URL('./validate.ts', import.meta.url), 'utf8')
    for (const [, key] of src.matchAll(/'(err\.\w+)'/g)) {
      expect(dictionaries.en[key], key).toBeTruthy()
      expect(dictionaries.bn[key], key).toBeTruthy()
    }
  })
  it('localizes numbers but not IDs', () => {
    expect(formatNum(11, 'bn')).toBe('১১')
    expect(translate('bn', 'route.step', { from: 'R1', to: 'C1', edge: 'K1', cost: 2 })).toContain('R1')
    expect(translate('bn', 'route.step', { from: 'R1', to: 'C1', edge: 'K1', cost: 2 })).toContain('২')
    expect(translate('en', 'status.noRoute')).toBe('No route available')
    expect(translate('en', 'status.startBlocked')).toBe('Starting location blocked')
  })
})
