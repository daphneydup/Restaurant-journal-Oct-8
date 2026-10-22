/**
 * The photographs used for atmosphere. Each lives in public/images as `<file>-800.jpg` and
 * `<file>-1600.jpg`. They are free to use under the Unsplash License; the credits below are shown
 * on the Rewards page. The pictures are decorative mood, never a claim about a particular
 * restaurant in the app (those are fictional demo spots).
 */
export interface PhotoInfo {
  file: string
  photographer: string
  /** The photo's page on Unsplash. */
  url: string
}

export const PHOTOS = {
  loungeLamps: {
    file: 'lounge-lamps',
    photographer: 'Leonardo Ziaja',
    url: 'https://unsplash.com/photos/Ph7Y42lXzyw',
  },
  chefPlating: {
    file: 'chef-plating',
    photographer: 'Urban Gyllström',
    url: 'https://unsplash.com/photos/MaWMfm-HCqQ',
  },
  tableWine: {
    file: 'table-wine',
    photographer: 'Jay Wennington',
    url: 'https://unsplash.com/photos/N_Y88TWmGwA',
  },
  eveningTables: {
    file: 'evening-tables',
    photographer: 'Dmitry Spravko',
    url: 'https://unsplash.com/photos/FMPVmNPB7jE',
  },
  diningRoomWood: {
    file: 'dining-room-wood',
    photographer: 'Tanja Tepavac',
    url: 'https://unsplash.com/photos/jSH-7IjJVsQ',
  },
} as const satisfies Record<string, PhotoInfo>

export type PhotoName = keyof typeof PHOTOS

/** `/images/lounge-lamps-800.jpg`, honouring the app's base path. */
export function photoUrl(name: PhotoName, width: 800 | 1600): string {
  return `${import.meta.env.BASE_URL}images/${PHOTOS[name].file}-${width}.jpg`
}
