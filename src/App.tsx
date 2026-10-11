import { useEffect, useState } from 'react'
import { Playlist } from './components/Playlist'
import { SavedPlaylists } from './components/SavedPlaylists'
import { SearchBar } from './components/SearchBar'
import { SearchResults } from './components/SearchResults'
import { searchTracks } from './lib/itunes'
import * as playlists from './lib/playlists'
import type { SavedPlaylist, Track } from './types'

const DEFAULT_PLAYLIST_NAME = 'New Playlist'
const DRAFT_KEY = 'jammming.draft'

interface Draft {
  name: string
  tracks: Track[]
  /** Id of the saved playlist being edited, if any. */
  editingId?: string
}

type Status = { kind: 'error' | 'success'; text: string } | null

const emptyDraft: Draft = { name: DEFAULT_PLAYLIST_NAME, tracks: [] }

function readDraft(): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (raw) return JSON.parse(raw) as Draft
  } catch {
    // A missing or corrupt draft just means starting fresh.
  }
  return emptyDraft
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong. Please try again.'
}

export default function App() {
  const [results, setResults] = useState<Track[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [draft, setDraft] = useState(readDraft)
  const [saved, setSaved] = useState(playlists.loadPlaylists)
  const [status, setStatus] = useState<Status>(null)

  // Keep the playlist being built across reloads. Losing it is only an inconvenience,
  // so a storage failure here is ignored.
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    } catch {
      // Storage full or disabled.
    }
  }, [draft])

  async function search(term: string) {
    setIsSearching(true)
    setStatus(null)
    try {
      setResults(await searchTracks(term))
      setHasSearched(true)
    } catch (err) {
      setStatus({ kind: 'error', text: errorMessage(err) })
    } finally {
      setIsSearching(false)
    }
  }

  function addTrack(track: Track) {
    setDraft((d) =>
      d.tracks.some((t) => t.id === track.id) ? d : { ...d, tracks: [...d.tracks, track] },
    )
  }

  function removeTrack(track: Track) {
    setDraft((d) => ({ ...d, tracks: d.tracks.filter((t) => t.id !== track.id) }))
  }

  function save() {
    try {
      const next = playlists.savePlaylist(draft.name, draft.tracks, draft.editingId)
      setSaved(next)
      setDraft(emptyDraft)
      setStatus({ kind: 'success', text: `Saved “${next[0].name}”.` })
    } catch (err) {
      setStatus({ kind: 'error', text: errorMessage(err) })
    }
  }

  function open(playlist: SavedPlaylist) {
    setDraft({ name: playlist.name, tracks: playlist.tracks, editingId: playlist.id })
    setStatus(null)
  }

  function remove(playlist: SavedPlaylist) {
    if (!window.confirm(`Delete “${playlist.name}”? This can't be undone.`)) return
    try {
      setSaved(playlists.deletePlaylist(playlist.id))
      // Deleting the playlist being edited turns the editor's copy into a new, unsaved one.
      if (draft.editingId === playlist.id) setDraft((d) => ({ ...d, editingId: undefined }))
      setStatus({ kind: 'success', text: `Deleted “${playlist.name}”.` })
    } catch (err) {
      setStatus({ kind: 'error', text: errorMessage(err) })
    }
  }

  // Tracks already in the playlist are hidden from the results.
  const visibleResults = results.filter((r) => !draft.tracks.some((t) => t.id === r.id))

  return (
    <>
      <header className="header">
        <h1>
          Ja<span className="accent">mmm</span>ing
        </h1>
      </header>

      <main className="main">
        {status && (
          <p
            className={`status status--${status.kind}`}
            role={status.kind === 'error' ? 'alert' : 'status'}
          >
            {status.text}
          </p>
        )}

        <SearchBar isSearching={isSearching} onSearch={search} />

        <div className="columns">
          <SearchResults tracks={visibleResults} hasSearched={hasSearched} onAdd={addTrack} />
          <div className="stack">
            <Playlist
              name={draft.name}
              tracks={draft.tracks}
              isEditing={draft.editingId !== undefined}
              onNameChange={(name) => setDraft((d) => ({ ...d, name }))}
              onRemove={removeTrack}
              onSave={save}
              onNew={() => setDraft(emptyDraft)}
            />
            <SavedPlaylists playlists={saved} onOpen={open} onDelete={remove} />
          </div>
        </div>
      </main>

      <footer className="footer">
        Music data from the{' '}
        <a href="https://performance-partners.apple.com/search-api">iTunes Search API</a>. Playlists
        are saved in this browser only.
      </footer>
    </>
  )
}
