import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  codeChallenge,
  completeLogin,
  isLoggedIn,
  savePlaylist,
  searchTracks,
  SpotifyError,
} from './spotify'

const fetchMock = vi.fn<typeof fetch>()

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), { status: 200, ...init })
}

function signIn(expiresInMs = 3_600_000, refreshToken?: string) {
  localStorage.setItem(
    'jammming.token',
    JSON.stringify({ accessToken: 'token-1', refreshToken, expiresAt: Date.now() + expiresInMs }),
  )
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

describe('codeChallenge', () => {
  it('matches the RFC 7636 appendix B example', async () => {
    expect(await codeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    )
  })
})

describe('completeLogin', () => {
  it('returns false when the URL is not an auth redirect', async () => {
    expect(await completeLogin()).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('exchanges the code for a token and cleans the URL', async () => {
    sessionStorage.setItem('jammming.pkce-verifier', 'verifier')
    sessionStorage.setItem('jammming.pkce-state', 'state-1')
    window.history.replaceState(null, '', '/?code=abc&state=state-1')
    fetchMock.mockResolvedValueOnce(
      json({ access_token: 'new', refresh_token: 'refresh', expires_in: 3600 }),
    )

    expect(await completeLogin()).toBe(true)

    const body = fetchMock.mock.calls[0][1]?.body as URLSearchParams
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(body.get('code')).toBe('abc')
    expect(body.get('code_verifier')).toBe('verifier')
    expect(window.location.search).toBe('')
    expect(isLoggedIn()).toBe(true)
  })

  it('rejects a redirect whose state does not match', async () => {
    sessionStorage.setItem('jammming.pkce-verifier', 'verifier')
    sessionStorage.setItem('jammming.pkce-state', 'expected')
    window.history.replaceState(null, '', '/?code=abc&state=forged')

    await expect(completeLogin()).rejects.toBeInstanceOf(SpotifyError)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(isLoggedIn()).toBe(false)
  })
})

describe('searchTracks', () => {
  it('maps Spotify tracks and skips null items', async () => {
    signIn()
    fetchMock.mockResolvedValueOnce(
      json({
        tracks: {
          items: [
            {
              id: '1',
              name: 'Song',
              uri: 'spotify:track:1',
              artists: [{ name: 'A' }, { name: 'B' }],
              album: { name: 'Album' },
            },
            null,
          ],
        },
      }),
    )

    expect(await searchTracks('  song ')).toEqual([
      { id: '1', name: 'Song', artist: 'A, B', album: 'Album', uri: 'spotify:track:1' },
    ])
    const url = new URL(fetchMock.mock.calls[0][0] as string)
    expect(url.searchParams.get('q')).toBe('song')
    expect(url.searchParams.get('limit')).toBe('10')
  })

  it('does not call Spotify for a blank term', async () => {
    expect(await searchTracks('   ')).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refreshes an expired token before searching', async () => {
    signIn(-1, 'refresh-1')
    fetchMock
      .mockResolvedValueOnce(json({ access_token: 'token-2', expires_in: 3600 }))
      .mockResolvedValueOnce(json({ tracks: { items: [] } }))

    await searchTracks('song')

    const headers = fetchMock.mock.calls[1][1]?.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer token-2')
    // The refresh response had no new refresh token, so the old one must be kept.
    expect(JSON.parse(localStorage.getItem('jammming.token')!).refreshToken).toBe('refresh-1')
  })

  it('signs the user out on 401', async () => {
    signIn()
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }))

    await expect(searchTracks('song')).rejects.toMatchObject({ status: 401 })
    expect(isLoggedIn()).toBe(false)
  })
})

describe('savePlaylist', () => {
  it('creates the playlist and adds items in batches of 100', async () => {
    signIn()
    const uris = Array.from({ length: 150 }, (_, i) => `spotify:track:${i}`)
    fetchMock
      .mockResolvedValueOnce(json({ id: 'pl1' }))
      .mockResolvedValueOnce(json({ snapshot_id: 's1' }))
      .mockResolvedValueOnce(json({ snapshot_id: 's2' }))

    expect(await savePlaylist(' Road trip ', uris)).toBe('pl1')

    const [create, first, second] = fetchMock.mock.calls
    expect(create[0]).toBe('https://api.spotify.com/v1/me/playlists')
    expect(JSON.parse(create[1]?.body as string).name).toBe('Road trip')
    expect(first[0]).toBe('https://api.spotify.com/v1/playlists/pl1/items')
    expect(JSON.parse(first[1]?.body as string).uris).toHaveLength(100)
    expect(JSON.parse(second[1]?.body as string).uris).toHaveLength(50)
  })
})
