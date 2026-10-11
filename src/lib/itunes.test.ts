import { afterEach, describe, expect, it, vi } from 'vitest'
import { searchTracks, SearchError } from './itunes'

/** The JSONP script the last search appended; jsdom never loads it, so tests answer for it. */
function pendingRequest() {
  const script = document.head.querySelector<HTMLScriptElement>('script[src*="itunes.apple.com"]')
  if (!script) throw new Error('no pending search')
  const url = new URL(script.src)
  const respond = (data: unknown) =>
    (window as unknown as Record<string, (d: unknown) => void>)[url.searchParams.get('callback')!](
      data,
    )
  return { script, url, respond }
}

afterEach(() => {
  vi.useRealTimers()
  document.head.innerHTML = ''
})

describe('searchTracks', () => {
  it('requests songs and maps the results', async () => {
    const search = searchTracks('  neil young ')
    const { url, respond } = pendingRequest()

    expect(url.origin + url.pathname).toBe('https://itunes.apple.com/search')
    expect(url.searchParams.get('term')).toBe('neil young')
    expect(url.searchParams.get('entity')).toBe('song')

    respond({
      results: [
        {
          wrapperType: 'track',
          kind: 'song',
          trackId: 42,
          trackName: 'Harvest Moon',
          artistName: 'Neil Young',
          collectionName: 'Harvest Moon',
          artworkUrl100: 'https://example.com/art.jpg',
          previewUrl: 'https://example.com/preview.m4a',
          trackViewUrl: 'https://music.apple.com/track/42',
        },
        { wrapperType: 'track', kind: 'music-video', trackId: 7, trackName: 'Video' },
        { wrapperType: 'collection', trackId: 8, trackName: 'Album' },
      ],
    })

    expect(await search).toEqual([
      {
        id: '42',
        name: 'Harvest Moon',
        artist: 'Neil Young',
        album: 'Harvest Moon',
        artworkUrl: 'https://example.com/art.jpg',
        previewUrl: 'https://example.com/preview.m4a',
        storeUrl: 'https://music.apple.com/track/42',
      },
    ])
    expect(document.head.querySelector('script')).toBeNull()
  })

  it('does not search for a blank term', async () => {
    expect(await searchTracks('   ')).toEqual([])
    expect(document.head.querySelector('script')).toBeNull()
  })

  it('rejects when the request fails to load', async () => {
    const search = searchTracks('neil')
    pendingRequest().script.dispatchEvent(new Event('error'))

    await expect(search).rejects.toBeInstanceOf(SearchError)
  })

  it('times out, and tolerates the response arriving afterwards', async () => {
    vi.useFakeTimers()
    const search = searchTracks('neil')
    const { respond } = pendingRequest()
    vi.advanceTimersByTime(10_000)

    await expect(search).rejects.toThrow('timed out')
    expect(() => respond({ results: [] })).not.toThrow()
  })
})
