import type { Track } from '../types'
import { Tracklist } from './Tracklist'

interface SearchResultsProps {
  tracks: Track[]
  hasSearched: boolean
  onAdd: (track: Track) => void
}

export function SearchResults({ tracks, hasSearched, onAdd }: SearchResultsProps) {
  return (
    <section className="panel" aria-labelledby="results-heading">
      <h2 id="results-heading">Results</h2>
      {tracks.length > 0 ? (
        <Tracklist tracks={tracks} action="add" onAction={onAdd} />
      ) : (
        <p className="panel__empty">
          {hasSearched ? 'No new tracks found.' : 'Search for a song to get started.'}
        </p>
      )}
    </section>
  )
}
