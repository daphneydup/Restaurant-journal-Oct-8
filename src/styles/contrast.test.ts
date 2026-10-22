import { describe, expect, it } from 'vitest'
import css from './tokens.css?raw'

/**
 * Reads the real design tokens and checks the colour pairings the UI uses against WCAG AA:
 * 4.5:1 for text, 3:1 for large text and UI components (borders, focus rings, icons).
 */
const colors: Record<string, string> = { white: '#ffffff' }
for (const [, name, hex] of css.matchAll(/--color-([a-z-]+):\s*(#[0-9a-fA-F]{6})/g)) {
  colors[name!] = hex!
}

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(r!) + 0.7152 * lin(g!) + 0.0722 * lin(b!)
}

function contrast(fg: string, bg: string) {
  const [a, b] = [luminance(colors[fg]!), luminance(colors[bg]!)]
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

// [foreground, background, where it is used]
const TEXT: [string, string, string][] = [
  ['ink', 'canvas', 'body text'],
  ['ink', 'surface', 'text on cards'],
  ['ink', 'surface-sunken', 'text on rating rows and tracks'],
  ['ink-muted', 'canvas', 'secondary text'],
  ['ink-muted', 'surface', 'secondary text on cards'],
  ['ink-muted', 'surface-sunken', 'secondary text on sunken areas'],
  ['on-primary', 'primary', 'primary buttons, rank badges'],
  ['on-primary', 'primary-hover', 'primary button hover'],
  ['primary-strong', 'surface-sunken', 'secondary button text, info toasts'],
  ['primary-strong', 'primary-soft', 'secondary button hover'],
  ['primary-strong', 'primary-soft', 'go-back badge, active tab'],
  ['primary-strong', 'surface', 'go-back message, links'],
  ['primary-strong', 'canvas', 'tab label, links on the page'],
  ['white', 'basil', 'share card header (dish), success toasts'],
  ['basil-strong', 'basil-soft', 'selected chips, diet-fit badges'],
  ['basil-strong', 'surface', '"worked for everyone" badge'],
  ['saffron-strong', 'saffron-soft', 'companion chips'],
  ['saffron-strong', 'surface', '"mixed" badge'],
  ['danger', 'canvas', 'error text on the page'],
  ['danger', 'surface', 'error text on cards'],
  ['danger', 'surface-sunken', 'error text on rating rows'],
  ['danger', 'danger-soft', 'remove-spot hover'],
  ['ink', 'danger-soft', 'error summary text'],
  ['white', 'danger-solid', 'danger buttons, error toasts'],
  ['white', 'danger-solid-hover', 'danger button hover'],
  ['ink', 'surface-sunken', 'info toasts, skip card header'],
]

const UI: [string, string, string][] = [
  ['line-strong', 'canvas', 'input borders on the page'],
  ['line-strong', 'surface', 'input borders on cards'],
  ['focus', 'canvas', 'focus ring on the page'],
  ['focus', 'surface', 'focus ring on cards'],
  // The ring is drawn 2px outside the control (outline-offset), so it never touches a button's
  // fill; what it sits on is the page, a card, or the sunken tracks inside segmented controls.
  ['focus', 'surface-sunken', 'focus ring on segmented controls and rating rows'],
  ['ink-muted', 'surface-sunken', 'star outlines'],
  ['basil', 'surface', 'switch track when on'],
]

describe('design tokens: WCAG AA contrast', () => {
  it('found every colour the pairings need', () => {
    for (const [fg, bg] of [...TEXT, ...UI]) {
      expect(colors[fg], `token ${fg}`).toBeDefined()
      expect(colors[bg], `token ${bg}`).toBeDefined()
    }
  })

  it.each(TEXT)('%s on %s (%s) is at least 4.5:1', (fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5)
  })

  it.each(UI)('%s against %s (%s) is at least 3:1', (fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(3)
  })
})
