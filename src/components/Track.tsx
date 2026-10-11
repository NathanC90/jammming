import { usePreview } from '../lib/preview'
import type { Track as TrackData } from '../types'

interface TrackProps {
  track: TrackData
  action: 'add' | 'remove'
  onAction: (track: TrackData) => void
}

function PlayIcon({ playing }: { playing: boolean }) {
  return (
    <svg className="track__icon" viewBox="0 0 24 24" aria-hidden="true">
      {playing ? <path d="M7 5h4v14H7zM13 5h4v14h-4z" /> : <path d="M8 5v14l11-7z" />}
    </svg>
  )
}

export function Track({ track, action, onAction }: TrackProps) {
  const { playingId, toggle } = usePreview()
  const isPlaying = playingId === track.id
  const label =
    action === 'add' ? `Add ${track.name} to playlist` : `Remove ${track.name} from playlist`
  const artwork = track.artworkUrl && (
    <img className="track__art" src={track.artworkUrl} alt="" width="48" height="48" />
  )

  return (
    <li className={isPlaying ? 'track track--playing' : 'track'}>
      {track.previewUrl ? (
        <button
          type="button"
          className="track__preview"
          aria-label={`${isPlaying ? 'Pause' : 'Play'} preview of ${track.name}`}
          title={isPlaying ? 'Pause preview' : 'Play 30-second preview'}
          onClick={() => toggle(track)}
        >
          {artwork}
          <PlayIcon playing={isPlaying} />
        </button>
      ) : (
        artwork
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
