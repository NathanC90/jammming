import type { Track } from '../types'

const AUTH_URL = 'https://accounts.spotify.com/authorize'
const TOKEN_URL = 'https://accounts.spotify.com/api/token'
const API_URL = 'https://api.spotify.com/v1'
const SCOPES = 'playlist-modify-public playlist-modify-private'

// Development-mode apps may request at most 10 search results (Feb 2026 API change).
const SEARCH_LIMIT = 10
// Spotify accepts at most 100 URIs per "add items" request.
const ADD_ITEMS_BATCH = 100

const TOKEN_KEY = 'jammming.token'
const VERIFIER_KEY = 'jammming.pkce-verifier'
const STATE_KEY = 'jammming.pkce-state'

interface StoredToken {
  accessToken: string
  refreshToken?: string
  expiresAt: number
}

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
}

interface SpotifyTrack {
  id: string
  name: string
  uri: string
  artists: { name: string }[]
  album: { name: string }
}

export class SpotifyError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'SpotifyError'
    this.status = status
  }
}

const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined

export const isConfigured = Boolean(clientId)

function redirectUri(): string {
  return new URL(import.meta.env.BASE_URL, window.location.origin).href
}

function randomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

/** RFC 7636 S256 code challenge: base64url(sha256(verifier)) without padding. */
export async function codeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function readToken(): StoredToken | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY)
    return raw ? (JSON.parse(raw) as StoredToken) : null
  } catch {
    return null
  }
}

function storeToken(response: TokenResponse, previous?: StoredToken | null): StoredToken {
  const token: StoredToken = {
    accessToken: response.access_token,
    // Spotify may omit a new refresh token on refresh; keep the old one then.
    refreshToken: response.refresh_token ?? previous?.refreshToken,
    // Refresh a minute early so a request never goes out with a token about to expire.
    expiresAt: Date.now() + (response.expires_in - 60) * 1000,
  }
  localStorage.setItem(TOKEN_KEY, JSON.stringify(token))
  return token
}

export function logout(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export function isLoggedIn(): boolean {
  return readToken() !== null
}

async function requestToken(params: Record<string, string>): Promise<TokenResponse> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId ?? '', ...params }),
  })
  if (!response.ok) {
    throw new SpotifyError('Could not sign in to Spotify. Please try again.', response.status)
  }
  return (await response.json()) as TokenResponse
}

/** Sends the browser to Spotify's consent screen. Never resolves: the page navigates away. */
export async function login(): Promise<void> {
  if (!clientId) throw new SpotifyError('Spotify client ID is not configured.', 0)
  const verifier = randomString(64)
  const state = randomString(16)
  sessionStorage.setItem(VERIFIER_KEY, verifier)
  sessionStorage.setItem(STATE_KEY, state)

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: SCOPES,
    redirect_uri: redirectUri(),
    code_challenge_method: 'S256',
    code_challenge: await codeChallenge(verifier),
    state,
  })
  window.location.assign(`${AUTH_URL}?${params}`)
}

/**
 * Completes the PKCE flow if the current URL is Spotify's redirect back to us.
 * Returns true when a token was obtained. Always strips the auth params from the URL.
 */
export async function completeLogin(): Promise<boolean> {
  const url = new URL(window.location.href)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')
  if (!code && !error) return false

  window.history.replaceState(null, '', url.pathname + url.hash)
  const verifier = sessionStorage.getItem(VERIFIER_KEY)
  const expectedState = sessionStorage.getItem(STATE_KEY)
  sessionStorage.removeItem(VERIFIER_KEY)
  sessionStorage.removeItem(STATE_KEY)

  if (error) throw new SpotifyError('Spotify sign-in was cancelled.', 0)
  if (!code || !verifier || state !== expectedState) {
    throw new SpotifyError('Spotify sign-in could not be verified. Please try again.', 0)
  }

  storeToken(
    await requestToken({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
      code_verifier: verifier,
    }),
  )
  return true
}

async function accessToken(): Promise<string> {
  const token = readToken()
  if (!token) throw new SpotifyError('Please log in to Spotify.', 401)
  if (Date.now() < token.expiresAt) return token.accessToken
  if (!token.refreshToken) {
    logout()
    throw new SpotifyError('Your Spotify session expired. Please log in again.', 401)
  }
  try {
    const refreshed = await requestToken({
      grant_type: 'refresh_token',
      refresh_token: token.refreshToken,
    })
    return storeToken(refreshed, token).accessToken
  } catch (err) {
    logout()
    throw err
  }
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })
  if (response.status === 401) {
    logout()
    throw new SpotifyError('Your Spotify session expired. Please log in again.', 401)
  }
  if (response.status === 429) {
    const wait = response.headers.get('Retry-After')
    throw new SpotifyError(
      `Spotify is rate limiting requests. Try again${wait ? ` in ${wait} seconds` : ' shortly'}.`,
      429,
    )
  }
  if (!response.ok) {
    throw new SpotifyError(`Spotify request failed (${response.status}).`, response.status)
  }
  return (await response.json()) as T
}

function toTrack(track: SpotifyTrack): Track {
  return {
    id: track.id,
    name: track.name,
    artist: track.artists.map((a) => a.name).join(', '),
    album: track.album.name,
    uri: track.uri,
  }
}

export async function searchTracks(term: string): Promise<Track[]> {
  const query = term.trim()
  if (!query) return []
  const params = new URLSearchParams({ q: query, type: 'track', limit: String(SEARCH_LIMIT) })
  const data = await api<{ tracks?: { items: (SpotifyTrack | null)[] } }>(`/search?${params}`)
  return (data.tracks?.items ?? []).filter((t): t is SpotifyTrack => t !== null).map(toTrack)
}

/** Creates a private playlist on the user's account and fills it. Returns the new playlist's id. */
export async function savePlaylist(name: string, trackUris: string[]): Promise<string> {
  const playlist = await api<{ id: string }>('/me/playlists', {
    method: 'POST',
    body: JSON.stringify({
      name: name.trim(),
      public: false,
      description: 'Created with Jammming',
    }),
  })
  for (let i = 0; i < trackUris.length; i += ADD_ITEMS_BATCH) {
    await api(`/playlists/${playlist.id}/items`, {
      method: 'POST',
      body: JSON.stringify({ uris: trackUris.slice(i, i + ADD_ITEMS_BATCH) }),
    })
  }
  return playlist.id
}
