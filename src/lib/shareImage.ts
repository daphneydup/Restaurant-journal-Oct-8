/**
 * The picture people post: a 4:5 portrait card (1080 x 1350) that works in every feed. It is
 * drawn onto a canvas, so the layout lives in plain functions that take a drawing context. That
 * keeps them testable with a recording fake, and `renderShareImage` is the thin browser wrapper.
 */

export const SHARE_IMAGE_SIZE = { width: 1080, height: 1350 } as const

export interface ShareImageSpec {
  /** Small caps line above the title, e.g. "Recommended". */
  eyebrow: string
  title: string
  /** e.g. "Uptown · $$$ · Wood-fired American". */
  subtitle: string
  /** One sentence worth highlighting, e.g. "Worked for everyone in 3 of 3 visits." */
  highlight?: string | undefined
  /** Label and value pairs, e.g. a diet and its average rating. */
  rows: readonly { label: string; value: string }[]
  rowsHeading?: string | undefined
  /** A short bulleted list, e.g. dishes to order. */
  listHeading?: string | undefined
  list?: readonly string[] | undefined
  /** Left of the footer: the brand. Right: who shared it. */
  footerRight: string
}

export interface Palette {
  canvas: string
  surface: string
  ink: string
  inkMuted: string
  gold: string
  goldSoft: string
}

/** Used when the page's CSS variables can't be read (tests, or a very old browser). */
export const FALLBACK_PALETTE: Palette = {
  canvas: '#0f0d0b',
  surface: '#1a1714',
  ink: '#f5efe3',
  inkMuted: '#bdb09b',
  gold: '#c9a45c',
  goldSoft: '#e6cc92',
}

/** The same colours the screens use, read from the design tokens so the two can't drift apart. */
export function readPalette(root: Element = document.documentElement): Palette {
  const style = getComputedStyle(root)
  const read = (name: string, fallback: string) =>
    style.getPropertyValue(`--color-${name}`).trim() || fallback
  return {
    canvas: read('canvas', FALLBACK_PALETTE.canvas),
    surface: read('surface', FALLBACK_PALETTE.surface),
    ink: read('ink', FALLBACK_PALETTE.ink),
    inkMuted: read('ink-muted', FALLBACK_PALETTE.inkMuted),
    gold: read('primary', FALLBACK_PALETTE.gold),
    goldSoft: read('primary-strong', FALLBACK_PALETTE.goldSoft),
  }
}

/** The parts of CanvasRenderingContext2D the layout uses, so a fake can stand in for tests. */
export interface DrawingContext {
  fillStyle: string | CanvasGradient | CanvasPattern
  strokeStyle: string | CanvasGradient | CanvasPattern
  lineWidth: number
  font: string
  textAlign: CanvasTextAlign
  textBaseline: CanvasTextBaseline
  letterSpacing?: string
  globalAlpha: number
  fillRect(x: number, y: number, w: number, h: number): void
  strokeRect(x: number, y: number, w: number, h: number): void
  fillText(text: string, x: number, y: number): void
  measureText(text: string): { width: number }
  beginPath(): void
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  stroke(): void
  createRadialGradient(
    x0: number,
    y0: number,
    r0: number,
    x1: number,
    y1: number,
    r1: number,
  ): { addColorStop(offset: number, color: string): void }
}

export const DISPLAY_FONT = '"Cormorant Garamond Variable", "Cormorant Garamond", Georgia, serif'
export const BODY_FONT = '"Inter Variable", Inter, system-ui, sans-serif'

const MARGIN = 96
const MAX_TITLE_LINES = 3
const MAX_ROWS = 6
const MAX_LIST = 4

/** Greedy word wrap. A single word wider than the line is kept whole rather than split. */
export function wrapText(
  measure: (text: string) => number,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (current && measure(candidate) > maxWidth) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
  }
  if (current) lines.push(current)
  return lines
}

/** Cuts text with an ellipsis until it fits. */
export function fitLine(measure: (text: string) => number, text: string, maxWidth: number): string {
  if (measure(text) <= maxWidth) return text
  let end = text.length
  while (end > 1 && measure(`${text.slice(0, end).trimEnd()}…`) > maxWidth) end--
  return `${text.slice(0, end).trimEnd()}…`
}

/** At most `max` lines; if there are more, the last kept line ends with an ellipsis. */
export function limitLines(
  measure: (text: string) => number,
  lines: string[],
  max: number,
  maxWidth: number,
): string[] {
  if (lines.length <= max) return lines
  const kept = lines.slice(0, max)
  kept[max - 1] = fitLine(measure, `${kept[max - 1]} …`, maxWidth)
  return kept
}

/** Draws the whole card. Everything stays inside the canvas whatever the text length. */
export function drawShareImage(
  ctx: DrawingContext,
  spec: ShareImageSpec,
  palette: Palette = FALLBACK_PALETTE,
  size: { width: number; height: number } = SHARE_IMAGE_SIZE,
): void {
  const { width, height } = size
  const contentWidth = width - MARGIN * 2
  const footerY = height - 110
  const measureWith = (font: string) => (text: string) => {
    ctx.font = font
    return ctx.measureText(text).width
  }
  const spaced = (px: string) => {
    if ('letterSpacing' in ctx) ctx.letterSpacing = px
  }

  // Background, with a soft glow in the corner.
  ctx.globalAlpha = 1
  ctx.fillStyle = palette.canvas
  ctx.fillRect(0, 0, width, height)
  const glow = ctx.createRadialGradient(width, 0, 0, width, 0, width * 0.9)
  glow.addColorStop(0, `${palette.gold}38`)
  glow.addColorStop(1, `${palette.gold}00`)
  ctx.fillStyle = glow as unknown as string
  ctx.fillRect(0, 0, width, height)

  // Hairline frame.
  ctx.strokeStyle = palette.gold
  ctx.lineWidth = 2
  ctx.globalAlpha = 0.55
  ctx.strokeRect(36, 36, width - 72, height - 72)
  ctx.globalAlpha = 1

  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  let y = 170

  // Eyebrow
  ctx.font = `600 30px ${BODY_FONT}`
  spaced('8px')
  ctx.fillStyle = palette.gold
  ctx.fillText(fitLine(measureWith(ctx.font), spec.eyebrow.toUpperCase(), contentWidth), MARGIN, y)
  spaced('0px')

  // Title
  const titleFont = `500 104px ${DISPLAY_FONT}`
  const titleMeasure = measureWith(titleFont)
  const titleLines = limitLines(
    titleMeasure,
    wrapText(titleMeasure, spec.title, contentWidth),
    MAX_TITLE_LINES,
    contentWidth,
  )
  y += 40
  ctx.font = titleFont
  ctx.fillStyle = palette.ink
  for (const line of titleLines) {
    y += 108
    ctx.fillText(line, MARGIN, y)
  }

  // Subtitle
  y += 62
  ctx.font = `400 36px ${BODY_FONT}`
  ctx.fillStyle = palette.inkMuted
  ctx.fillText(fitLine(measureWith(ctx.font), spec.subtitle, contentWidth), MARGIN, y)

  // Gold rule
  y += 56
  ctx.strokeStyle = palette.gold
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(MARGIN, y)
  ctx.lineTo(MARGIN + 140, y)
  ctx.stroke()

  // Highlight sentence
  if (spec.highlight) {
    const font = `500 46px ${DISPLAY_FONT}`
    const measure = measureWith(font)
    const lines = limitLines(
      measure,
      wrapText(measure, spec.highlight, contentWidth),
      2,
      contentWidth,
    )
    ctx.font = font
    ctx.fillStyle = palette.goldSoft
    y += 30
    for (const line of lines) {
      y += 56
      ctx.fillText(line, MARGIN, y)
    }
  }

  const room = () => footerY - 60 - y

  // Rows (label on the left, value on the right)
  const rows = spec.rows.slice(0, MAX_ROWS)
  if (rows.length > 0 && room() > 160) {
    y += 56
    if (spec.rowsHeading) {
      ctx.font = `600 24px ${BODY_FONT}`
      spaced('5px')
      ctx.fillStyle = palette.inkMuted
      ctx.fillText(spec.rowsHeading.toUpperCase(), MARGIN, y)
      spaced('0px')
      y += 14
    }
    for (const row of rows) {
      if (room() < 70) break
      y += 64
      ctx.font = `400 38px ${BODY_FONT}`
      ctx.fillStyle = palette.ink
      ctx.textAlign = 'left'
      ctx.fillText(fitLine(measureWith(ctx.font), row.label, contentWidth - 160), MARGIN, y)
      ctx.fillStyle = palette.goldSoft
      ctx.textAlign = 'right'
      ctx.fillText(row.value, width - MARGIN, y)
      ctx.textAlign = 'left'
      ctx.strokeStyle = palette.gold
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.25
      ctx.beginPath()
      ctx.moveTo(MARGIN, y + 20)
      ctx.lineTo(width - MARGIN, y + 20)
      ctx.stroke()
      ctx.globalAlpha = 1
    }
  }

  // List (e.g. dishes to order)
  const list = (spec.list ?? []).slice(0, MAX_LIST)
  if (list.length > 0 && room() > 150) {
    y += 70
    if (spec.listHeading) {
      ctx.font = `600 24px ${BODY_FONT}`
      spaced('5px')
      ctx.fillStyle = palette.inkMuted
      ctx.fillText(spec.listHeading.toUpperCase(), MARGIN, y)
      spaced('0px')
      y += 12
    }
    for (const item of list) {
      if (room() < 50) break
      y += 56
      ctx.font = `400 38px ${BODY_FONT}`
      ctx.fillStyle = palette.gold
      ctx.fillText('•', MARGIN, y)
      ctx.fillStyle = palette.ink
      ctx.fillText(fitLine(measureWith(ctx.font), item, contentWidth - 50), MARGIN + 50, y)
    }
  }

  // Footer
  ctx.strokeStyle = palette.gold
  ctx.lineWidth = 1
  ctx.globalAlpha = 0.4
  ctx.beginPath()
  ctx.moveTo(MARGIN, footerY - 50)
  ctx.lineTo(width - MARGIN, footerY - 50)
  ctx.stroke()
  ctx.globalAlpha = 1
  ctx.font = `500 40px ${DISPLAY_FONT}`
  ctx.fillStyle = palette.goldSoft
  ctx.textAlign = 'left'
  ctx.fillText('Table for Everyone', MARGIN, footerY)
  ctx.font = `400 28px ${BODY_FONT}`
  ctx.fillStyle = palette.inkMuted
  ctx.textAlign = 'right'
  ctx.fillText(
    fitLine(measureWith(ctx.font), spec.footerRight, contentWidth / 2),
    width - MARGIN,
    footerY,
  )
  ctx.textAlign = 'left'
}

/** Waits for the display and body fonts, so the first image isn't drawn in a fallback face. */
async function loadFonts() {
  if (!('fonts' in document)) return
  try {
    await Promise.all([
      document.fonts.load(`500 104px ${DISPLAY_FONT}`),
      document.fonts.load(`400 38px ${BODY_FONT}`),
    ])
  } catch {
    // Draw with whatever is available.
  }
}

/** Draws the card to a PNG. Rejects when canvas isn't available. */
export async function renderShareImage(spec: ShareImageSpec): Promise<Blob> {
  await loadFonts()
  const canvas = document.createElement('canvas')
  canvas.width = SHARE_IMAGE_SIZE.width
  canvas.height = SHARE_IMAGE_SIZE.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser can’t draw the share image.')
  drawShareImage(ctx as unknown as DrawingContext, spec, readPalette())
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Couldn’t create the share image.'))),
      'image/png',
    )
  })
}
