import { useCallback, useEffect, useState } from 'react'
import { Playlist } from './components/Playlist'
import { SearchBar } from './components/SearchBar'
import { SearchResults } from './components/SearchResults'
import * as spotify from './lib/spotify'
import type { Track } from './types'

const DEFAULT_PLAYLIST_NAME = 'New Playlist'
const DRAFT_KEY = 'jammming.draft'
// Set when a search triggered sign-in, so it can resume after the redirect back. Kept
// apart from the draft so routine draft saves can't clobber it.
const PENDING_SEARCH_KEY = 'jammming.pending-search'

interface Draft {
  term: string
  playlistName: string
  playlistTracks: Track[]
}

type Status = { kind: 'error' | 'success'; text: string } | null

function readDraft(): Draft {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    if (raw) return JSON.parse(raw) as Draft
  } catch {
    // A missing or corrupt draft just means starting fresh.
  }
  return { term: '', playlistName: DEFAULT_PLAYLIST_NAME, playlistTracks: [] }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong. Please try again.'
}

export default function App() {
  const [draft] = useState(readDraft)
  const [term, setTerm] = useState(draft.term)
  const [results, setResults] = useState<Track[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [playlistName, setPlaylistName] = useState(draft.playlistName)
  const [playlistTracks, setPlaylistTracks] = useState(draft.playlistTracks)
  const [loggedIn, setLoggedIn] = useState(spotify.isLoggedIn)
  const [isSearching, setIsSearching] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [status, setStatus] = useState<Status>(null)

  // Keep the draft in sessionStorage so signing in (a full-page redirect) loses nothing.
  useEffect(() => {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ term, playlistName, playlistTracks }))
  }, [term, playlistName, playlistTracks])

  const handleError = useCallback((err: unknown) => {
    if (err instanceof spotify.SpotifyError && err.status === 401) setLoggedIn(false)
    setStatus({ kind: 'error', text: errorMessage(err) })
  }, [])

  // The draft is written here too, not only by the effect above: login() can navigate
  // away before a pending effect gets to run.
  const signIn = useCallback(
    (draftToKeep: Draft, resumeSearch = false) => {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draftToKeep))
      if (resumeSearch) sessionStorage.setItem(PENDING_SEARCH_KEY, '1')
      spotify.login().catch(handleError)
    },
    [handleError],
  )

  const search = useCallback(
    async (query: string) => {
      setTerm(query)
      if (!spotify.isLoggedIn()) {
        signIn({ term: query, playlistName, playlistTracks }, true)
        return
      }
      setIsSearching(true)
      setStatus(null)
      try {
        setResults(await spotify.searchTracks(query))
        setHasSearched(true)
      } catch (err) {
        handleError(err)
      } finally {
        setIsSearching(false)
      }
    },
    [signIn, handleError, playlistName, playlistTracks],
  )

  // Finish the sign-in redirect, then resume the search that started it. Runs once on
  // mount: `draft` is the snapshot saved before the redirect, so no other deps matter.
  useEffect(() => {
    const resumeSearch = sessionStorage.getItem(PENDING_SEARCH_KEY) !== null
    sessionStorage.removeItem(PENDING_SEARCH_KEY)
    spotify
      .completeLogin()
      .then((justLoggedIn) => {
        if (!justLoggedIn) return
        setLoggedIn(true)
        if (resumeSearch && draft.term) void search(draft.term)
      })
      .catch(handleError)
  }, []) // oxlint-disable-line react/exhaustive-deps

  function addTrack(track: Track) {
    setPlaylistTracks((tracks) =>
      tracks.some((t) => t.id === track.id) ? tracks : [...tracks, track],
    )
  }

  function removeTrack(track: Track) {
    setPlaylistTracks((tracks) => tracks.filter((t) => t.id !== track.id))
  }

  async function save() {
    if (!spotify.isLoggedIn()) {
      signIn({ term, playlistName, playlistTracks })
      return
    }
    setIsSaving(true)
    setStatus(null)
    try {
      const name = playlistName.trim()
      await spotify.savePlaylist(
        name,
        playlistTracks.map((t) => t.uri),
      )
      setStatus({ kind: 'success', text: `Saved “${name}” to your Spotify account.` })
      setPlaylistName(DEFAULT_PLAYLIST_NAME)
      setPlaylistTracks([])
    } catch (err) {
      handleError(err)
    } finally {
      setIsSaving(false)
    }
  }

  function signOut() {
    spotify.logout()
    setLoggedIn(false)
    setResults([])
    setHasSearched(false)
    setStatus(null)
  }

  // Tracks already in the playlist are hidden from the results.
  const visibleResults = results.filter((r) => !playlistTracks.some((t) => t.id === r.id))

  return (
    <>
      <header className="header">
        <h1>
          Ja<span className="accent">mmm</span>ing
        </h1>
        {spotify.isConfigured && (
          <button
            type="button"
            className="button button--ghost"
            onClick={loggedIn ? signOut : () => signIn({ term, playlistName, playlistTracks })}
          >
            {loggedIn ? 'Log out' : 'Log in with Spotify'}
          </button>
        )}
      </header>

      <main className="main">
        {!spotify.isConfigured && (
          <p className="status status--error" role="alert">
            Set <code>VITE_SPOTIFY_CLIENT_ID</code> in <code>.env.local</code> to connect to
            Spotify. See the README for setup.
          </p>
        )}
        {status && (
          <p
            className={`status status--${status.kind}`}
            role={status.kind === 'error' ? 'alert' : 'status'}
          >
            {status.text}
          </p>
        )}

        <SearchBar initialTerm={term} isSearching={isSearching} onSearch={search} />

        <div className="columns">
          <SearchResults tracks={visibleResults} hasSearched={hasSearched} onAdd={addTrack} />
          <Playlist
            name={playlistName}
            tracks={playlistTracks}
            isSaving={isSaving}
            onNameChange={setPlaylistName}
            onRemove={removeTrack}
            onSave={save}
          />
        </div>
      </main>
    </>
  )
}
