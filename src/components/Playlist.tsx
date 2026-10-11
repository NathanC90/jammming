import type { FormEvent } from 'react'
import type { Track } from '../types'
import { Tracklist } from './Tracklist'

interface PlaylistProps {
  name: string
  tracks: Track[]
  /** True when editing a playlist that was already saved. */
  isEditing: boolean
  onNameChange: (name: string) => void
  onRemove: (track: Track) => void
  onSave: () => void
  onNew: () => void
}

export function Playlist({
  name,
  tracks,
  isEditing,
  onNameChange,
  onRemove,
  onSave,
  onNew,
}: PlaylistProps) {
  const canSave = tracks.length > 0 && name.trim() !== ''

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
        <div className="playlist__actions">
          <button type="submit" className="button" disabled={!canSave}>
            {isEditing ? 'Save changes' : 'Save playlist'}
          </button>
          {isEditing && (
            <button type="button" className="button button--ghost" onClick={onNew}>
              New playlist
            </button>
          )}
        </div>
      </form>
    </section>
  )
}
