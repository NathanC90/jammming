import type { SavedPlaylist, Track } from '../types'

const STORAGE_KEY = 'jammming.playlists'

export function loadPlaylists(): SavedPlaylist[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as SavedPlaylist[]) : []
  } catch {
    return []
  }
}

function write(playlists: SavedPlaylist[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(playlists))
  } catch {
    // Quota exceeded, or storage disabled (e.g. some private-browsing modes).
    throw new Error('Could not save: your browser storage is full or unavailable.')
  }
}

/**
 * Saves a playlist and returns the updated list, newest first. Passing the id of an existing
 * playlist updates it in place instead of creating a copy.
 */
export function savePlaylist(name: string, tracks: Track[], id?: string): SavedPlaylist[] {
  const playlist: SavedPlaylist = {
    id: id ?? crypto.randomUUID(),
    name: name.trim(),
    tracks,
    savedAt: new Date().toISOString(),
  }
  const next = [playlist, ...loadPlaylists().filter((p) => p.id !== playlist.id)]
  write(next)
  return next
}

export function deletePlaylist(id: string): SavedPlaylist[] {
  const next = loadPlaylists().filter((p) => p.id !== id)
  write(next)
  return next
}
