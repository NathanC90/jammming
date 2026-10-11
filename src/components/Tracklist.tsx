import { useRef } from 'react'
import type { Track as TrackData } from '../types'
import { Track } from './Track'

interface TracklistProps {
  tracks: TrackData[]
  action: 'add' | 'remove'
  onAction: (track: TrackData) => void
}

export function Tracklist({ tracks, action, onAction }: TracklistProps) {
  const listRef = useRef<HTMLUListElement>(null)

  function handleAction(track: TrackData, index: number) {
    onAction(track)
    // The clicked row leaves this list, taking keyboard focus with it. Hand focus to
    // whichever row now sits in its place once React has re-rendered.
    requestAnimationFrame(() => {
      const buttons = listRef.current?.querySelectorAll('button')
      if (buttons?.length) buttons[Math.min(index, buttons.length - 1)].focus()
    })
  }

  return (
    <ul className="tracklist" ref={listRef}>
      {tracks.map((track, index) => (
        <Track
          key={track.id}
          track={track}
          action={action}
          onAction={(t) => handleAction(t, index)}
        />
      ))}
    </ul>
  )
}
