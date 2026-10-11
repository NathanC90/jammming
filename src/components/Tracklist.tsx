import type { Track as TrackData } from '../types'
import { Track } from './Track'

interface TracklistProps {
  tracks: TrackData[]
  action: 'add' | 'remove'
  onAction: (track: TrackData) => void
}

export function Tracklist({ tracks, action, onAction }: TracklistProps) {
  return (
    <ul className="tracklist">
      {tracks.map((track) => (
        <Track key={track.id} track={track} action={action} onAction={onAction} />
      ))}
    </ul>
  )
}
