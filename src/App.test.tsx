import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { searchTracks, SearchError } from './lib/itunes'
import { loadPlaylists } from './lib/playlists'
import type { Track } from './types'

vi.mock('./lib/itunes', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./lib/itunes')>()),
  searchTracks: vi.fn(),
}))

const tracks: Track[] = [
  {
    id: '1',
    name: 'Harvest Moon',
    artist: 'Neil Young',
    album: 'Harvest Moon',
    previewUrl: 'https://example.com/1.m4a',
  },
  {
    id: '2',
    name: 'Heart of Gold',
    artist: 'Neil Young',
    album: 'Harvest',
    previewUrl: 'https://example.com/2.m4a',
  },
]

/** jsdom can't play media; fire the events a browser would so the UI can react. */
function stubAudio() {
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    this.dispatchEvent(new Event('play'))
    return Promise.resolve()
  })
  const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    this.dispatchEvent(new Event('pause'))
  })
  return { play, pause }
}

type User = ReturnType<typeof userEvent.setup>

async function searchFor(user: User, term: string) {
  await user.type(screen.getByRole('searchbox'), term)
  await user.click(screen.getByRole('button', { name: 'Search' }))
}

async function buildPlaylist(user: User, name: string) {
  await searchFor(user, 'neil')
  await user.click(await screen.findByRole('button', { name: 'Add Harvest Moon to playlist' }))
  await user.click(screen.getByRole('button', { name: 'Add Heart of Gold to playlist' }))
  const input = screen.getByLabelText('Playlist name')
  await user.clear(input)
  await user.type(input, name)
}

function section(name: string) {
  return screen.getByRole('region', { name })
}

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
  vi.mocked(searchTracks).mockResolvedValue(tracks)
})

describe('App', () => {
  it('shows search results', async () => {
    const user = userEvent.setup()
    render(<App />)

    await searchFor(user, 'neil')

    expect(searchTracks).toHaveBeenCalledWith('neil')
    expect(await within(section('Results')).findByText('Harvest Moon')).toBeInTheDocument()
    expect(within(section('Results')).getByText('Heart of Gold')).toBeInTheDocument()
  })

  it('shows search errors', async () => {
    vi.mocked(searchTracks).mockRejectedValueOnce(new SearchError('Search timed out.'))
    const user = userEvent.setup()
    render(<App />)

    await searchFor(user, 'neil')

    expect(await screen.findByRole('alert')).toHaveTextContent('Search timed out.')
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

  it('keeps keyboard focus in the list after moving a track', async () => {
    const user = userEvent.setup()
    render(<App />)
    await searchFor(user, 'neil')

    await user.click(await screen.findByRole('button', { name: 'Add Harvest Moon to playlist' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Add Heart of Gold to playlist' })).toHaveFocus(),
    )
  })

  it('disables saving an empty playlist', () => {
    render(<App />)
    expect(screen.getByRole('button', { name: 'Save playlist' })).toBeDisabled()
  })

  it('saves a playlist, lists it, and resets the editor', async () => {
    const user = userEvent.setup()
    render(<App />)
    await buildPlaylist(user, 'Neil')

    await user.click(screen.getByRole('button', { name: 'Save playlist' }))

    expect(screen.getByRole('status')).toHaveTextContent('Saved “Neil”')
    expect(within(section('Saved playlists')).getByText('Neil')).toBeInTheDocument()
    expect(within(section('Saved playlists')).getByText('2 tracks')).toBeInTheDocument()
    expect(screen.getByLabelText('Playlist name')).toHaveValue('New Playlist')
    expect(loadPlaylists()[0].tracks.map((t) => t.id)).toEqual(['1', '2'])
  })

  it('reopens a saved playlist and saves changes in place', async () => {
    const user = userEvent.setup()
    render(<App />)
    await buildPlaylist(user, 'Neil')
    await user.click(screen.getByRole('button', { name: 'Save playlist' }))

    await user.click(screen.getByRole('button', { name: 'Open Neil' }))
    await user.click(screen.getByRole('button', { name: 'Remove Heart of Gold from playlist' }))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(loadPlaylists()).toHaveLength(1)
    expect(within(section('Saved playlists')).getByText('1 track')).toBeInTheDocument()
  })

  it('deletes a saved playlist after confirmation', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(<App />)
    await buildPlaylist(user, 'Neil')
    await user.click(screen.getByRole('button', { name: 'Save playlist' }))

    await user.click(screen.getByRole('button', { name: 'Delete Neil' }))

    expect(confirm).toHaveBeenCalled()
    expect(screen.queryByRole('region', { name: 'Saved playlists' })).not.toBeInTheDocument()
    expect(loadPlaylists()).toEqual([])
  })

  it('keeps the playlist being built across a reload', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App />)
    await buildPlaylist(user, 'Draft')
    unmount()

    render(<App />)

    expect(screen.getByLabelText('Playlist name')).toHaveValue('Draft')
    expect(within(section('Playlist')).getByText('Harvest Moon')).toBeInTheDocument()
  })

  it('plays one preview at a time and toggles it off', async () => {
    const { play, pause } = stubAudio()
    const user = userEvent.setup()
    render(<App />)
    await searchFor(user, 'neil')

    await user.click(await screen.findByRole('button', { name: 'Play preview of Harvest Moon' }))

    expect(play).toHaveBeenCalledTimes(1)
    expect((play.mock.contexts[0] as HTMLAudioElement).src).toBe('https://example.com/1.m4a')
    const pauseButton = screen.getByRole('button', { name: 'Pause preview of Harvest Moon' })

    // Starting another preview switches over instead of layering a second audio stream.
    await user.click(screen.getByRole('button', { name: 'Play preview of Heart of Gold' }))
    expect((play.mock.contexts[1] as HTMLAudioElement).src).toBe('https://example.com/2.m4a')
    expect(play.mock.contexts[1]).toBe(play.mock.contexts[0])
    expect(pauseButton).toHaveAccessibleName('Play preview of Harvest Moon')

    await user.click(screen.getByRole('button', { name: 'Pause preview of Heart of Gold' }))
    expect(pause).toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: 'Play preview of Heart of Gold' }),
    ).toBeInTheDocument()
  })

  it('resets the button when a preview finishes', async () => {
    const { play } = stubAudio()
    const user = userEvent.setup()
    render(<App />)
    await searchFor(user, 'neil')
    await user.click(await screen.findByRole('button', { name: 'Play preview of Harvest Moon' }))

    act(() => (play.mock.contexts[0] as HTMLAudioElement).dispatchEvent(new Event('ended')))

    expect(screen.getByRole('button', { name: 'Play preview of Harvest Moon' })).toBeInTheDocument()
  })

  it('reports a preview that fails to play', async () => {
    stubAudio().play.mockRejectedValueOnce(new DOMException('no source', 'NotSupportedError'))
    const user = userEvent.setup()
    render(<App />)
    await searchFor(user, 'neil')

    await user.click(await screen.findByRole('button', { name: 'Play preview of Harvest Moon' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('preview of “Harvest Moon”')
  })

  it('shows no preview button for tracks without one', async () => {
    vi.mocked(searchTracks).mockResolvedValue([{ ...tracks[0], previewUrl: undefined }])
    const user = userEvent.setup()
    render(<App />)
    await searchFor(user, 'neil')

    await screen.findByText('Harvest Moon')
    expect(screen.queryByRole('button', { name: /preview/ })).not.toBeInTheDocument()
  })
})
