import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../src/shared/planner'
import { contrast, resolveTheme, THEMES } from '../src/shared/themes'
import { THEME_IDS } from '../src/shared/types'

describe('contrast', () => {
  it('matches known WCAG values', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 1)
    expect(contrast('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5)
  })
})

describe('every theme', () => {
  it('exists for each id, with three light and three dark', () => {
    expect(Object.keys(THEMES).sort()).toEqual([...THEME_IDS].sort())
    expect(Object.values(THEMES).filter((t) => t.mode === 'dark')).toHaveLength(3)
  })
  describe.each(THEME_IDS.map((id) => [id, THEMES[id]] as const))('%s', (_, theme) => {
    const c = theme.colors
    it.each(['ground', 'dock', 'surface', 'column', 'today', 'drop'] as const)('ink and muted text read on %s', (bg) => {
      expect(contrast(c.ink, c[bg])).toBeGreaterThanOrEqual(4.5)
      expect(contrast(c.muted, c[bg])).toBeGreaterThanOrEqual(4.5)
    })
    it('labels read on their fills', () => {
      expect(contrast(c.eventInk, c.event)).toBeGreaterThanOrEqual(4.5)
      expect(contrast(c.accentInk, c.accent)).toBeGreaterThanOrEqual(4.5)
    })
    it('the tide stands out from the ground', () => {
      expect(contrast(c.water, c.ground)).toBeGreaterThanOrEqual(3)
    })
    it('has six list colours that stand out from a card', () => {
      expect(theme.list).toHaveLength(6)
      for (const colour of theme.list) expect(contrast(colour, c.surface)).toBeGreaterThanOrEqual(3)
    })
  })
})

describe('resolveTheme', () => {
  it('follows the system in system mode', () => {
    expect(resolveTheme(DEFAULT_SETTINGS, false).id).toBe('tide')
    expect(resolveTheme(DEFAULT_SETTINGS, true).id).toBe('deep-water')
  })
  it('ignores the system in fixed mode', () => {
    const settings = { ...DEFAULT_SETTINGS, themeMode: 'fixed', fixedTheme: 'terminal' } as const
    expect(resolveTheme(settings, false).id).toBe('terminal')
  })
})
