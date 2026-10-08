/** DOM ids the error summary links to, so each message can focus the field it describes. */
export const FIELD_IDS = {
  restaurant: 'field-restaurant',
  neighborhood: 'field-neighborhood',
  date: 'field-date',
  lenses: 'field-lenses',
  worked: 'field-worked',
  note: 'field-note',
  photos: 'field-photos',
} as const

export const ratingFieldId = (lensId: string) => `field-rating-${lensId}`
