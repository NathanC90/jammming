import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import * as spotify from './lib/spotify'
import type { Track } from './types'

vi.mock('./lib/spotify', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib/spotify')>()
  return {
    ...actual,
    isConfigured: true,
    isLoggedIn: vi.fn(() => true),
    login: vi.fn(() => Promise.resolve()),
    logout: vi.fn(),
    completeLogin: vi.fn(() => Promise.resolve(false)),
    searchTracks: vi.fn(),
    savePlaylist: vi.fn(),
  }
})

const tracks: Track[] = [
  { id: '1', name: 'Harvest Moon', artist: 'Neil Young', album: 'Harvest Moon', uri: 'spotify:track:1' },
  { id: '2', name: 'Heart of Gold', artist: 'Neil Young', album: 'Harvest', uri: 'spotify:track:2' },
]

async function searchFor(user: ReturnType<typeof userEvent.setup>, term: string) {
  await user.type(screen.getByRole('searchbox'), term)
  await user.click(screen.getByRole('button', { name: 'Search' }))
}

function section(name: string) {
  return screen.getByRole('region', { name })
}

beforeEach(() => {
  sessionStorage.clear()
  vi.mocked(spotify.isLoggedIn).mockReturnValue(true)
  vi.mocked(spotify.searchTracks).mockResolvedValue(tracks)
  vi.mocked(spotify.savePlaylist).mockResolvedValue('pl1')
})

describe('App', () => {
  it('shows search results', async () => {
    const user = userEvent.setup()
    render(<App />)

    await searchFor(user, 'neil')

    expect(spotify.searchTracks).toHaveBeenCalledWith('neil')
    expect(await within(section('Results')).findByText('Harvest Moon')).toBeInTheDocument()
    expect(within(section('Results')).getByText('Heart of Gold')).toBeInTheDocument()
  })

  it('moves tracks between results and playlist', async () => {
    const user = userEvent.setup()
    render(<App />)
    await searchFor(user, 'neil')

    await user.click(await screen.findByRole('button', { name: 'Add Harvest Moon to playlist' }))

    expect(within(section('Playlist')).getByText('Harvest Moon')).toBeInTheDocument()
    expect(within(section('Results')).queryByText('Harvest Moon')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Remove Harvest Moon from playlist' }))

    expect(within(section('Playlist')).queryByText('Harvest Moon')).not.toBeInTheDocument()
    expect(within(section('Results')).getByText('Harvest Moon')).toBeInTheDocument()
  })

  it('saves the playlist with its name and track URIs, then resets', async () => {
    const user = userEvent.setup()
    render(<App />)
    await searchFor(user, 'neil')
    await user.click(await screen.findByRole('button', { name: 'Add Harvest Moon to playlist' }))
    await user.click(screen.getByRole('button', { name: 'Add Heart of Gold to playlist' }))

    const name = screen.getByLabelText('Playlist name')
    await user.clear(name)
    await user.type(name, 'Neil')
    await user.click(screen.getByRole('button', { name: 'Save to Spotify' }))

    expect(spotify.savePlaylist).toHaveBeenCalledWith('Neil', ['spotify:track:1', 'spotify:track:2'])
    expect(await screen.findByRole('status')).toHaveTextContent('Saved “Neil”')
    expect(name).toHaveValue('New Playlist')
    expect(within(section('Playlist')).queryByRole('listitem')).not.toBeInTheDocument()
  })

  it('disables saving an empty playlist', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: 'Save to Spotify' })).toBeDisabled()
  })

  it('keeps the playlist when saving fails', async () => {
    vi.mocked(spotify.savePlaylist).mockRejectedValueOnce(
      new spotify.SpotifyError('Spotify request failed (500).', 500),
    )
    const user = userEvent.setup()
    render(<App />)
    await searchFor(user, 'neil')
    await user.click(await screen.findByRole('button', { name: 'Add Harvest Moon to playlist' }))
    await user.click(screen.getByRole('button', { name: 'Save to Spotify' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Spotify request failed (500).')
    expect(within(section('Playlist')).getByText('Harvest Moon')).toBeInTheDocument()
  })

  it('signs in before searching, keeping the draft for after the redirect', async () => {
    vi.mocked(spotify.isLoggedIn).mockReturnValue(false)
    const user = userEvent.setup()
    render(<App />)

    await searchFor(user, 'neil')

    expect(spotify.login).toHaveBeenCalled()
    expect(spotify.searchTracks).not.toHaveBeenCalled()
    expect(JSON.parse(sessionStorage.getItem('jammming.draft')!)).toMatchObject({ term: 'neil' })
    expect(sessionStorage.getItem('jammming.pending-search')).toBe('1')
  })

  it('resumes the pending search after returning from Spotify', async () => {
    sessionStorage.setItem(
      'jammming.draft',
      JSON.stringify({ term: 'neil', playlistName: 'Kept', playlistTracks: [tracks[1]] }),
    )
    sessionStorage.setItem('jammming.pending-search', '1')
    vi.mocked(spotify.completeLogin).mockResolvedValueOnce(true)
    render(<App />)

    await waitFor(() => expect(spotify.searchTracks).toHaveBeenCalledWith('neil'))
    expect(screen.getByLabelText('Playlist name')).toHaveValue('Kept')
    expect(within(section('Playlist')).getByText('Heart of Gold')).toBeInTheDocument()
    // The track already in the playlist is not offered again.
    expect(await within(section('Results')).findByText('Harvest Moon')).toBeInTheDocument()
    expect(within(section('Results')).queryByText('Heart of Gold')).not.toBeInTheDocument()
  })
})
