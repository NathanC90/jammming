# Jammming

Search Spotify, build a playlist, and save it straight to your account. Built from
Codecademy's _Jammming_ project brief with React, TypeScript and Vite.

![Jammming with search results on the left and a playlist on the right](docs/screenshot.png)

## Features

- Search tracks by song, album or artist.
- Add tracks to a playlist and remove them again; tracks already in the playlist are hidden
  from the results.
- Name the playlist and save it to your Spotify account as a private playlist.
- Your search and playlist survive the Spotify sign-in redirect, and a search that needed you
  to sign in carries on once you're back.
- Keyboard and screen-reader friendly, responsive down to phone width, light and dark themes.

## Getting started

You need Node 22+ and a Spotify account with Premium (Spotify requires Premium for the owner
of a development-mode app).

1. **Create a Spotify app** at the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard):
   - Tick **Web API**.
   - Add the redirect URI `http://127.0.0.1:5173/`. Spotify rejects `localhost`, so the dev
     server is pinned to `127.0.0.1`. Add `https://<your-user>.github.io/jammming/` too if
     you deploy.
   - Under **User Management**, add the Spotify accounts allowed to use the app (a
     development-mode app allows up to five).
2. **Configure and run:**

   ```bash
   cp .env.example .env.local   # then paste your app's Client ID
   npm install
   npm run dev                  # http://127.0.0.1:5173
   ```

No client secret is needed: sign-in uses the Authorization Code flow with PKCE, which is
designed for apps that run entirely in the browser.

## Scripts

| Command             | What it does                                    |
| ------------------- | ----------------------------------------------- |
| `npm run dev`       | Start the dev server                            |
| `npm test`          | Run the test suite (Vitest + Testing Library)   |
| `npm run lint`      | Lint with Oxlint                                |
| `npm run typecheck` | Type-check with TypeScript                      |
| `npm run format`    | Format with Prettier (`format:check` to verify) |
| `npm run build`     | Production build into `dist/`                   |

CI runs all of the checks above on every push to `main` and on every pull request.

## Deploying to GitHub Pages

1. In the repository settings, set **Pages → Source** to **GitHub Actions**.
2. Add a repository variable (**Settings → Secrets and variables → Actions → Variables**)
   named `VITE_SPOTIFY_CLIENT_ID` with your Client ID. It's a variable rather than a secret
   because a PKCE client ID is public anyway: it ships in the bundle.
3. Add the Pages URL as a redirect URI in the Spotify dashboard.

Every push to `main` then deploys. The deploy is skipped until the variable exists.

## How it works

```
src/
├── App.tsx               state, sign-in redirect handling, draft persistence
├── components/           SearchBar, SearchResults, Playlist, Tracklist, Track
├── lib/spotify.ts        PKCE sign-in, token refresh, search, save
└── types.ts
```

`lib/spotify.ts` is the only module that talks to Spotify. Tokens live in `localStorage` and
are refreshed a minute before they expire; a 401 signs you out with a message instead of
failing silently.

### Differences from the Codecademy brief

The brief predates several Spotify Web API changes, so this follows the current API:

- **PKCE instead of the implicit grant.** Spotify deprecated the implicit grant flow the
  original project uses.
- **February 2026 development-mode API.** Playlists are created with `POST /me/playlists`
  and filled with `POST /playlists/{id}/items` (batched at 100 tracks per request), and search
  returns at most 10 results.
- **Loopback redirect URI.** Spotify no longer accepts `localhost`.

## License

No license has been chosen yet, so all rights are reserved by default.
