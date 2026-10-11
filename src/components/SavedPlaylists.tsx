import type { SavedPlaylist } from '../types'

interface SavedPlaylistsProps {
  playlists: SavedPlaylist[]
  onOpen: (playlist: SavedPlaylist) => void
  onDelete: (playlist: SavedPlaylist) => void
}

export function SavedPlaylists({ playlists, onOpen, onDelete }: SavedPlaylistsProps) {
  if (playlists.length === 0) return null
  return (
    <section className="panel" aria-labelledby="saved-heading">
      <h2 id="saved-heading">Saved playlists</h2>
      <ul className="saved">
        {playlists.map((playlist) => (
          <li key={playlist.id} className="saved__item">
            <div className="saved__info">
              <h3 className="saved__name">{playlist.name}</h3>
              <p className="track__meta">
                {playlist.tracks.length} {playlist.tracks.length === 1 ? 'track' : 'tracks'}
              </p>
            </div>
            <button
              type="button"
              className="button button--ghost button--small"
              aria-label={`Open ${playlist.name}`}
              onClick={() => onOpen(playlist)}
            >
              Open
            </button>
            <button
              type="button"
              className="button button--ghost button--small"
              aria-label={`Delete ${playlist.name}`}
              onClick={() => onDelete(playlist)}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
