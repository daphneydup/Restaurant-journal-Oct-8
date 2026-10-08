export function PhotoGallery({ photos, name }: { photos: readonly string[]; name: string }) {
  return (
    <ul aria-label={`Photos from ${name}`} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {photos.map((src, index) => (
        <li key={index}>
          <img
            src={src}
            alt={`Snapshot ${index + 1} from ${name}`}
            loading="lazy"
            className="aspect-square w-full rounded-md object-cover"
          />
        </li>
      ))}
    </ul>
  )
}
