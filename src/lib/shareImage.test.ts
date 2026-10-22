import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  FALLBACK_PALETTE,
  SHARE_IMAGE_SIZE,
  drawShareImage,
  fitLine,
  limitLines,
  readPalette,
  renderShareImage,
  wrapText,
  type DrawingContext,
  type ShareImageSpec,
} from './shareImage'

/** Ten pixels per character, whatever the font: easy to reason about. */
const measure = (text: string) => text.length * 10

describe('wrapText', () => {
  it('breaks at spaces so no line exceeds the width', () => {
    const lines = wrapText(measure, 'one two three four five six', 100)
    expect(lines).toEqual(['one two', 'three four', 'five six'])
    expect(lines.every((l) => measure(l) <= 100)).toBe(true)
  })
  it('keeps a word that is too long on its own line instead of splitting it', () => {
    expect(wrapText(measure, 'a supercalifragilistic b', 100)).toEqual([
      'a',
      'supercalifragilistic',
      'b',
    ])
  })
  it('handles empty text and extra spaces', () => {
    expect(wrapText(measure, '   ', 100)).toEqual([])
    expect(wrapText(measure, 'a    b', 100)).toEqual(['a b'])
  })
})

describe('fitLine / limitLines', () => {
  it('leaves short text alone and shortens long text with an ellipsis that fits', () => {
    expect(fitLine(measure, 'short', 100)).toBe('short')
    const cut = fitLine(measure, 'a much longer sentence', 100)
    expect(cut.endsWith('…')).toBe(true)
    expect(measure(cut)).toBeLessThanOrEqual(100)
  })
  it('keeps the first lines and marks that more was cut', () => {
    const lines = ['one', 'two', 'three', 'four']
    expect(limitLines(measure, lines, 4, 200)).toEqual(lines)
    const limited = limitLines(measure, lines, 2, 200)
    expect(limited).toHaveLength(2)
    expect(limited[0]).toBe('one')
    expect(limited[1]).toMatch(/…$/)
  })
})

/** Records what is drawn so layout can be checked without a real canvas. */
function recordingContext() {
  const texts: { text: string; x: number; y: number; align: string; font: string }[] = []
  const ctx = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    globalAlpha: 1,
    letterSpacing: '0px',
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    measureText: (text: string) => ({ width: measure(text) }),
    createRadialGradient: () => ({ addColorStop: vi.fn() }),
    fillText(text: string, x: number, y: number) {
      texts.push({ text, x, y, align: this.textAlign, font: this.font })
    },
  }
  return { ctx: ctx as unknown as DrawingContext & { letterSpacing: string }, texts, raw: ctx }
}

const spec: ShareImageSpec = {
  eyebrow: 'Recommended',
  title: 'Ember & Orchard',
  subtitle: 'Uptown · $$$ · Wood-fired American',
  highlight: 'Worked for everyone in 3 of 3 visits.',
  rowsHeading: 'How it works for each diet',
  rows: [
    { label: 'Vegan options', value: '4.7 / 5' },
    { label: 'Steak / meat', value: '4.7 / 5' },
  ],
  listHeading: 'Order these',
  list: ['Charred cauliflower steak', '12oz dry-aged ribeye'],
  footerRight: 'Recommended by Summer',
}

const draw = (s: ShareImageSpec, measureFn = measure) => {
  const rec = recordingContext()
  rec.raw.measureText = (t: string) => ({ width: measureFn(t) })
  drawShareImage(rec.ctx, s)
  return rec
}

describe('drawShareImage', () => {
  it('writes every part of the card, with the brand in the footer', () => {
    const { texts } = draw(spec)
    const all = texts.map((t) => t.text)
    expect(all).toContain('RECOMMENDED')
    expect(all).toContain('Ember & Orchard')
    expect(all).toContain('Uptown · $$$ · Wood-fired American')
    expect(all).toContain('Worked for everyone in 3 of 3 visits.')
    expect(all).toContain('Vegan options')
    expect(all).toContain('4.7 / 5')
    expect(all).toContain('Charred cauliflower steak')
    expect(all).toContain('Table for Everyone')
    expect(all).toContain('Recommended by Summer')
  })

  it('draws nothing outside the canvas, however long the text is', () => {
    const long: ShareImageSpec = {
      ...spec,
      title: 'An Extraordinarily Long Restaurant Name That Would Never Fit On A Single Line At All',
      subtitle: 'A subtitle '.repeat(30),
      highlight: 'A very long highlight sentence. '.repeat(10),
      rows: Array.from({ length: 12 }, (_, i) => ({
        label: `Diet number ${i}`.repeat(5),
        value: '4 / 5',
      })),
      list: Array.from({ length: 12 }, (_, i) => `Dish ${i} `.repeat(12)),
      footerRight: 'Recommended by someone with a really long name indeed',
    }
    const { texts } = draw(long)
    for (const t of texts) {
      expect(t.y, t.text).toBeLessThanOrEqual(SHARE_IMAGE_SIZE.height)
      expect(t.y, t.text).toBeGreaterThan(0)
      expect(t.x, t.text).toBeGreaterThanOrEqual(0)
      expect(t.x, t.text).toBeLessThanOrEqual(SHARE_IMAGE_SIZE.width)
      // Left-aligned text must also end inside the right margin.
      if (t.align === 'left' && t.text !== '•') {
        expect(t.x + measure(t.text), t.text).toBeLessThanOrEqual(SHARE_IMAGE_SIZE.width)
      }
    }
  })

  it('limits the title to three lines, ending in an ellipsis when it is cut', () => {
    const { texts } = draw({ ...spec, title: 'word '.repeat(60) })
    const titleLines = texts.filter((t) => t.font.startsWith('500 104px'))
    expect(titleLines).toHaveLength(3)
    expect(titleLines[2]!.text.endsWith('…')).toBe(true)
  })

  it('shows at most six diet rows, and at most four list items', () => {
    const rowsOnly = draw({
      ...spec,
      list: undefined,
      rows: Array.from({ length: 10 }, (_, i) => ({ label: `Diet ${i}`, value: '4' })),
    })
    expect(rowsOnly.texts.filter((t) => /^Diet \d$/.test(t.text))).toHaveLength(6)

    const listOnly = draw({
      ...spec,
      rows: [],
      list: Array.from({ length: 10 }, (_, i) => `Dish ${i}`),
    })
    expect(listOnly.texts.filter((t) => /^Dish \d$/.test(t.text))).toHaveLength(4)
  })

  it('drops rows that would run into the footer when the heading text is as tall as it gets', () => {
    const tall = draw({
      ...spec,
      title: 'word '.repeat(60),
      highlight: 'A very long highlight sentence. '.repeat(10),
      rows: Array.from({ length: 6 }, (_, i) => ({ label: `Diet ${i}`, value: '4' })),
      list: undefined,
    })
    const footerY = tall.texts.find((t) => t.text === 'Table for Everyone')!.y
    const rows = tall.texts.filter((t) => /^Diet \d$/.test(t.text))
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.length).toBeLessThan(6)
    for (const t of rows) expect(t.y).toBeLessThan(footerY - 50)
  })

  it('drops list items that would run into the footer rather than overlap it', () => {
    const crowded = draw({
      ...spec,
      rows: Array.from({ length: 6 }, (_, i) => ({ label: `Diet ${i}`, value: '4' })),
      list: Array.from({ length: 4 }, (_, i) => `Dish ${i}`),
    })
    const footerY = crowded.texts.find((t) => t.text === 'Table for Everyone')!.y
    for (const t of crowded.texts.filter((x) => /^(Diet|Dish) \d$/.test(x.text))) {
      expect(t.y).toBeLessThan(footerY - 50)
    }
  })

  it('leaves out sections that have no content', () => {
    const { texts } = draw({
      eyebrow: 'Order again',
      title: 'Soup',
      subtitle: 'at Spot',
      rows: [],
      footerRight: 'Skipped by Summer',
    })
    const all = texts.map((t) => t.text)
    expect(all).not.toContain('HOW IT WORKS FOR EACH DIET')
    expect(all).toContain('Soup')
  })

  it('right-aligns values and resets alignment and letter spacing afterwards', () => {
    const { texts, raw } = draw(spec)
    expect(texts.find((t) => t.text === '4.7 / 5')?.align).toBe('right')
    expect(raw.textAlign).toBe('left')
    expect(raw.letterSpacing).toBe('0px')
  })

  it('uses the palette it is given', () => {
    const rec = recordingContext()
    const fills: unknown[] = []
    Object.defineProperty(rec.raw, 'fillStyle', { set: (v) => fills.push(v), get: () => '' })
    drawShareImage(rec.ctx, spec, { ...FALLBACK_PALETTE, canvas: '#123456', ink: '#abcdef' })
    expect(fills).toContain('#123456')
    expect(fills).toContain('#abcdef')
  })
})

describe('readPalette', () => {
  afterEach(() => document.documentElement.removeAttribute('style'))

  it('reads the design tokens from the page so the image matches the screens', () => {
    document.documentElement.style.setProperty('--color-canvas', ' #010203 ')
    document.documentElement.style.setProperty('--color-primary', '#a0b0c0')
    const palette = readPalette()
    expect(palette.canvas).toBe('#010203')
    expect(palette.gold).toBe('#a0b0c0')
  })
  it('falls back to the built-in colours when the tokens are not defined', () => {
    expect(readPalette().ink).toBe(FALLBACK_PALETTE.ink)
  })
})

describe('renderShareImage', () => {
  afterEach(() => vi.restoreAllMocks())

  it('draws on a 1080 x 1350 canvas and returns the PNG', async () => {
    const { ctx } = recordingContext()
    const png = new Blob(['png'], { type: 'image/png' })
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(ctx as unknown as CanvasRenderingContext2D)
    let size = ''
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      callback,
      type,
    ) {
      size = `${this.width}x${this.height} ${type}`
      callback(png)
    })
    expect(await renderShareImage(spec)).toBe(png)
    expect(size).toBe('1080x1350 image/png')
    expect(getContext).toHaveBeenCalledWith('2d')
  })

  it('rejects when the browser cannot draw', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    await expect(renderShareImage(spec)).rejects.toThrow(/can’t draw/)
  })

  it('rejects when the canvas produces no image', async () => {
    const { ctx } = recordingContext()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(null))
    await expect(renderShareImage(spec)).rejects.toThrow(/Couldn’t create/)
  })
})
