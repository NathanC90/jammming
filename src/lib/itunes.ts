import type { Track } from '../types'

const SEARCH_URL = 'https://itunes.apple.com/search'
const SEARCH_LIMIT = 25
const TIMEOUT_MS = 10_000

interface ITunesResult {
  wrapperType: string
  kind?: string
  trackId: number
  trackName: string
  artistName: string
  collectionName?: string
  artworkUrl100?: string
  previewUrl?: string
  trackViewUrl?: string
}

export class SearchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SearchError'
  }
}

let callbackCount = 0

/**
 * Apple's Search API doesn't reliably send CORS headers, so fetch() from a static site can
 * be blocked. It does support JSONP: the response is a script that calls our callback.
 */
function jsonp<T>(url: URL): Promise<T> {
  return new Promise((resolve, reject) => {
    const callback = `jammmingSearch${Date.now()}_${callbackCount++}`
    const globals = window as unknown as Record<string, unknown>
    const script = document.createElement('script')

    const finish = (error: Error | null, data?: T) => {
      clearTimeout(timer)
      // A late response after a timeout must still find a function, or it throws.
      globals[callback] = () => {}
      script.remove()
      if (error) reject(error)
      else resolve(data as T)
    }
    const timer = setTimeout(
      () => finish(new SearchError('Search timed out. Please try again.')),
      TIMEOUT_MS,
    )

    globals[callback] = (data: T) => finish(null, data)
    // Apple answers a rate-limited request (about 20 a minute) with an error, which lands here.
    script.onerror = () =>
      finish(new SearchError('Search is unavailable right now. Please try again in a minute.'))
    url.searchParams.set('callback', callback)
    script.src = url.href
    document.head.append(script)
  })
}

function toTrack(result: ITunesResult): Track {
  return {
    id: String(result.trackId),
    name: result.trackName,
    artist: result.artistName,
    album: result.collectionName ?? '',
    artworkUrl: result.artworkUrl100,
    previewUrl: result.previewUrl,
    storeUrl: result.trackViewUrl,
  }
}

export async function searchTracks(term: string): Promise<Track[]> {
  const query = term.trim()
  if (!query) return []
  const url = new URL(SEARCH_URL)
  url.search = new URLSearchParams({
    term: query,
    media: 'music',
    entity: 'song',
    limit: String(SEARCH_LIMIT),
  }).toString()
  const data = await jsonp<{ results?: ITunesResult[] }>(url)
  return (data.results ?? [])
    .filter((r) => r.wrapperType === 'track' && r.kind === 'song')
    .map(toTrack)
}
