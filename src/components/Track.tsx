import type { Track as TrackData } from '../types'

interface TrackProps {
  track: TrackData
  action: 'add' | 'remove'
  onAction: (track: TrackData) => void
}

export function Track({ track, action, onAction }: TrackProps) {
  const label =
    action === 'add' ? `Add ${track.name} to playlist` : `Remove ${track.name} from playlist`
  return (
    <li className="track">
      {track.artworkUrl && (
        <img className="track__art" src={track.artworkUrl} alt="" width="48" height="48" />
      )}
      <div className="track__info">
        <h3 className="track__name">
          {track.storeUrl ? (
            <a href={track.storeUrl} target="_blank" rel="noreferrer">
              {track.name}
            </a>
          ) : (
            track.name
          )}
        </h3>
        <p className="track__meta">
          {track.artist}
          {track.album && ` · ${track.album}`}
        </p>
      </div>
      <button
        type="button"
        className="track__action"
        aria-label={label}
        title={label}
        onClick={() => onAction(track)}
      >
        {action === 'add' ? '+' : '−'}
      </button>
    </li>
  )
}
