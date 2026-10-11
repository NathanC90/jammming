export interface Track {
  id: string
  name: string
  artist: string
  album: string
  artworkUrl?: string
  /** 30-second preview clip, when Apple provides one. */
  previewUrl?: string
  /** The track's page on Apple Music / iTunes. */
  storeUrl?: string
}

export interface SavedPlaylist {
  id: string
  name: string
  tracks: Track[]
  savedAt: string
}
