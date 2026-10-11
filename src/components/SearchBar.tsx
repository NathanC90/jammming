import { useState, type FormEvent } from 'react'

interface SearchBarProps {
  initialTerm?: string
  isSearching: boolean
  onSearch: (term: string) => void
}

export function SearchBar({ initialTerm = '', isSearching, onSearch }: SearchBarProps) {
  const [term, setTerm] = useState(initialTerm)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (term.trim()) onSearch(term)
  }

  return (
    <form className="search-bar" role="search" onSubmit={handleSubmit}>
      <label htmlFor="search-term" className="visually-hidden">
        Song, album or artist
      </label>
      <input
        id="search-term"
        type="search"
        placeholder="Enter a song, album or artist"
        value={term}
        onChange={(event) => setTerm(event.target.value)}
      />
      <button type="submit" className="button" disabled={isSearching || !term.trim()}>
        {isSearching ? 'Searching…' : 'Search'}
      </button>
    </form>
  )
}
