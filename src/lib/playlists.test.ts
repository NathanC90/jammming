import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deletePlaylist, loadPlaylists, savePlaylist } from './playlists'
import type { Track } from '../types'

const track: Track = { id: '1', name: 'Song', artist: 'Artist', album: 'Album' }

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('playlists', () => {
  it('saves newest first and survives a reload', () => {
    savePlaylist('First', [track])
    savePlaylist(' Second ', [])

    expect(loadPlaylists().map((p) => p.name)).toEqual(['Second', 'First'])
  })

  it('updates in place when given an existing id', () => {
    const [saved] = savePlaylist('Draft', [track])
    const after = savePlaylist('Final', [], saved.id)

    expect(after).toHaveLength(1)
    expect(after[0]).toMatchObject({ id: saved.id, name: 'Final', tracks: [] })
  })

  it('deletes by id', () => {
    const [saved] = savePlaylist('Gone', [track])
    expect(deletePlaylist(saved.id)).toEqual([])
    expect(loadPlaylists()).toEqual([])
  })

  it('treats corrupt storage as empty', () => {
    localStorage.setItem('jammming.playlists', '{not json')
    expect(loadPlaylists()).toEqual([])
    localStorage.setItem('jammming.playlists', '{"an":"object"}')
    expect(loadPlaylists()).toEqual([])
  })

  it('reports a full storage quota instead of failing silently', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    expect(() => savePlaylist('Big', [track])).toThrow('storage is full')
  })
})
