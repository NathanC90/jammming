import type { FormEvent } from 'react'
import type { Track } from '../types'
import { Tracklist } from './Tracklist'

interface PlaylistProps {
  name: string
  tracks: Track[]
  isSaving: boolean
  onNameChange: (name: string) => void
  onRemove: (track: Track) => void
  onSave: () => void
}

export function Playlist({
  name,
  tracks,
  isSaving,
  onNameChange,
  onRemove,
  onSave,
}: PlaylistProps) {
  const canSave = tracks.length > 0 && name.trim() !== '' && !isSaving

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (canSave) onSave()
  }

  return (
    <section className="panel" aria-labelledby="playlist-heading">
      <h2 id="playlist-heading" className="visually-hidden">
        Playlist
      </h2>
      <form className="playlist" onSubmit={handleSubmit}>
        <label htmlFor="playlist-name" className="visually-hidden">
          Playlist name
        </label>
        <input
          id="playlist-name"
          className="playlist__name"
          value={name}
          maxLength={100}
          onChange={(event) => onNameChange(event.target.value)}
        />
        {tracks.length > 0 ? (
          <Tracklist tracks={tracks} action="remove" onAction={onRemove} />
        ) : (
          <p className="panel__empty">Add tracks from the results.</p>
        )}
        <button type="submit" className="button" disabled={!canSave}>
          {isSaving ? 'Saving…' : 'Save to Spotify'}
        </button>
      </form>
    </section>
  )
}
