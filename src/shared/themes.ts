import type { Settings, ThemeId } from './types'

export interface ThemeColors {
  ground: string
  dock: string
  surface: string
  column: string
  today: string
  drop: string
  ink: string
  muted: string
  line: string
  water: string
  waterBack: string
  accent: string
  accentInk: string
  event: string
  eventInk: string
}

export interface Theme {
  id: ThemeId
  name: string
  mode: 'light' | 'dark'
  font: string
  radius: number
  colors: ThemeColors
  list: string[]
}

const GROTESK = "'Familjen Grotesk Variable', system-ui, sans-serif"

export const THEMES: Record<ThemeId, Theme> = {
  tide: {
    id: 'tide',
    name: 'Tide',
    mode: 'light',
    font: GROTESK,
    radius: 7,
    colors: {
      ground: '#E7F0EC', dock: '#DCE9E4', surface: '#FFFFFF', column: '#DCE9E4', today: '#F7FBF9', drop: '#BFDAD3',
      ink: '#0C2F36', muted: '#34525A', line: '#A9C4BD',
      water: '#0F5C66', waterBack: '#8DBDB6', accent: '#D03C20', accentInk: '#FFFFFF', event: '#0F5C66', eventInk: '#F4FBF9'
    },
    list: ['#0F5C66', '#D03C20', '#8A6800', '#3E7B4F', '#A0436E', '#2F6FA8']
  },
  'chart-paper': {
    id: 'chart-paper',
    name: 'Chart Paper',
    mode: 'light',
    font: "'IBM Plex Sans', system-ui, sans-serif",
    radius: 6,
    colors: {
      ground: '#F7F7F5', dock: '#EFEFEC', surface: '#FFFFFF', column: '#FFFFFF', today: '#F3F7FD', drop: '#DCE8F8',
      ink: '#131313', muted: '#55585C', line: '#D1D1CD',
      water: '#1D5FBF', waterBack: '#BBD2F2', accent: '#1D5FBF', accentInk: '#FFFFFF', event: '#E6EEFA', eventInk: '#123F86'
    },
    list: ['#1D5FBF', '#B4481B', '#7A6A00', '#2F7D4F', '#A0436E', '#55585C']
  },
  almanac: {
    id: 'almanac',
    name: 'Almanac',
    mode: 'light',
    font: "'Archivo Variable', Helvetica, Arial, sans-serif",
    radius: 0,
    colors: {
      ground: '#FFFFFF', dock: '#F4F4F4', surface: '#FFFFFF', column: '#F4F4F4', today: '#FFFFFF', drop: '#FFD9DC',
      ink: '#0A0A0A', muted: '#555555', line: '#0A0A0A',
      water: '#0A0A0A', waterBack: '#BDBDBD', accent: '#D6000E', accentInk: '#FFFFFF', event: '#0A0A0A', eventInk: '#FFFFFF'
    },
    list: ['#0A0A0A', '#D6000E', '#7A6A00', '#1F7A4A', '#A0436E', '#1D5FBF']
  },
  'deep-water': {
    id: 'deep-water',
    name: 'Deep Water',
    mode: 'dark',
    font: GROTESK,
    radius: 9,
    colors: {
      ground: '#071A1C', dock: '#0D2527', surface: '#123033', column: '#0D2527', today: '#163A3D', drop: '#1F4A4C',
      ink: '#EAF6F3', muted: '#A9CAC5', line: '#2E5A5A',
      water: '#3FB8A4', waterBack: '#1F4F50', accent: '#FF7A59', accentInk: '#071A1C', event: '#6FD9C0', eventInk: '#071A1C'
    },
    list: ['#6FD9C0', '#FF7A59', '#F2C14E', '#9CCB6B', '#F28FB0', '#7FB2F0']
  },
  kelp: {
    id: 'kelp',
    name: 'Kelp',
    mode: 'dark',
    font: "'IBM Plex Sans', system-ui, sans-serif",
    radius: 4,
    colors: {
      ground: '#0F2A22', dock: '#0C231C', surface: '#21493A', column: '#163529', today: '#1C4033', drop: '#2A5C48',
      ink: '#EFF4EC', muted: '#BFD4C6', line: '#3D6655',
      water: '#4FA882', waterBack: '#265A47', accent: '#F2C14E', accentInk: '#12211B', event: '#CFE3D2', eventInk: '#12211B'
    },
    list: ['#CFE3F5', '#F7D9A8', '#D9EBC3', '#F4C9C0', '#E6C8E0', '#F2C14E']
  },
  terminal: {
    id: 'terminal',
    name: 'Terminal',
    mode: 'dark',
    font: "'JetBrains Mono Variable', ui-monospace, Menlo, monospace",
    radius: 0,
    colors: {
      ground: '#000000', dock: '#0A0A0A', surface: '#161616', column: '#0A0A0A', today: '#161616', drop: '#2B2110',
      ink: '#ECE9E2', muted: '#A8A49A', line: '#343434',
      water: '#FFB000', waterBack: '#5C4000', accent: '#FFB000', accentInk: '#000000', event: '#2B2110', eventInk: '#FFB000'
    },
    list: ['#FFB000', '#7FD4A0', '#7FB2F0', '#F28FB0', '#ECE9E2', '#C8A2E8']
  }
}

export function resolveTheme(settings: Settings, systemDark: boolean): Theme {
  if (settings.themeMode === 'fixed') return THEMES[settings.fixedTheme]
  return THEMES[systemDark ? settings.darkTheme : settings.lightTheme]
}

const luminance = (hex: string): number => {
  const channel = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

/** WCAG contrast ratio between two #RRGGBB colours. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
