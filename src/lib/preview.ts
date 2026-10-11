import { createContext, useContext } from 'react'
import type { Track } from '../types'

export interface Preview {
  /** Id of the track whose preview is playing, if any. */
  playingId: string | null
  toggle: (track: Track) => void
}

export const PreviewContext = createContext<Preview>({ playingId: null, toggle: () => {} })

export const usePreview = () => useContext(PreviewContext)
