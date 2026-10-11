import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { PreviewContext } from '../lib/preview'
import type { Track } from '../types'

interface PreviewProviderProps {
  children: ReactNode
  onError: (message: string) => void
}

/**
 * Owns the one audio element all 30-second previews share, so starting a preview stops
 * whichever was playing. `playingId` follows the element's own play/pause events rather
 * than our clicks, so it stays right when a clip ends, fails, or is paused by media keys.
 */
export function PreviewProvider({ children, onError }: PreviewProviderProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const currentIdRef = useRef<string | null>(null)
  const [playingId, setPlayingId] = useState<string | null>(null)

  useEffect(() => {
    const audio = new Audio()
    const stopped = () => setPlayingId(null)
    audio.addEventListener('play', () => setPlayingId(currentIdRef.current))
    audio.addEventListener('pause', stopped)
    audio.addEventListener('ended', stopped)
    audioRef.current = audio
    return () => {
      audio.pause()
      audio.removeAttribute('src')
      audioRef.current = null
    }
  }, [])

  const toggle = useCallback(
    (track: Track) => {
      const audio = audioRef.current
      if (!audio || !track.previewUrl) return
      if (playingId === track.id) {
        audio.pause()
        return
      }
      currentIdRef.current = track.id
      audio.src = track.previewUrl
      audio.play().catch((err: unknown) => {
        // Switching tracks before the last one started aborts its play(); that's expected.
        if (err instanceof DOMException && err.name === 'AbortError') return
        setPlayingId(null)
        onError(`Couldn't play the preview of “${track.name}”.`)
      })
    },
    [playingId, onError],
  )

  return <PreviewContext value={{ playingId, toggle }}>{children}</PreviewContext>
}
