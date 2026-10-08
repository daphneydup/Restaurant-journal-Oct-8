/** Scales (width, height) down so the longest edge is at most `maxEdge`. Never scales up. */
export function fitWithin(width: number, height: number, maxEdge: number) {
  const longest = Math.max(width, height)
  if (longest <= maxEdge) return { width, height }
  const scale = maxEdge / longest
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

/**
 * Reads an image file and returns a downscaled JPEG data URL. Photos are stored in
 * localStorage by the mock layer, so they have to stay small (about 50 to 150 KB each).
 */
export async function fileToResizedDataUrl(
  file: File,
  maxEdge = 800,
  quality = 0.72,
): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('That file is not an image.')
  const bitmap = await createImageBitmap(file)
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, maxEdge)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not process that image.')
    context.drawImage(bitmap, 0, 0, width, height)
    return canvas.toDataURL('image/jpeg', quality)
  } finally {
    bitmap.close()
  }
}
