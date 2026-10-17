# Live Deck

Live, two-way presentations. The presenter drives the slides; the audience
follows on their phones, answers quizzes, reacts and chats, without installing
anything.

- **Two links.** A private presenter link (console, projector screen, phone
  remote) and a public audience link, shared as a QR code on the first slide.
- **En vivo / Explorar.** The audience follows the presenter in real time, or
  browses back through the slides already shown.
- **Quizzes.** Live results or secret until reveal, an optional leaderboard,
  votes by tap or keyboard (A–F, 1–6). Anonymous attendees get a creative alias.
- **Pointer effects.** Ripple, focus and zoom, mirrored on every screen.
- **Reactions and chat.** TikTok-style floating reactions among the audience;
  text and/or GIPHY sticker chat with moderation. The presenter opts in to see
  either.
- **Ephemeral by design.** Sessions live in memory. When the presenter ends a
  session they can download a summary; the data is then deleted.

## Quick start (development)

Requires Node.js 24 or newer (the server runs TypeScript natively).

```sh
npm install
npm run dev:server   # API + WebSocket on :8787
npm run dev:web      # Vite on :5180 (proxies /api, /decks, /ws)
```

Open `http://localhost:5180`, pick a deck, set a PIN and create a session.
Open the audience link on your phone (same Wi-Fi: start Vite with your LAN IP)
or in another browser window.

Preview a deck without a session at `http://localhost:5180/preview/<deck-id>`.

## Writing decks

A deck is a JSON file at `decks/<id>/deck.json` with optional images in
`decks/<id>/assets/`. The format (v1) is defined in `shared/deck.ts`:
normalized geometry on a 16:9 canvas, fragments for step-by-step reveals, quiz
slides, speaker notes and a `qr` element that shows the join code.

The easiest way to write one is with Claude and the bundled skill:

```sh
npx skills add <this-repo-url>   # installs skills/live-deck
```

Then ask: "create a live deck about …". The skill writes the deck, validates it
with the CLI and fixes any issue.

The CLI also works on its own:

```sh
npm run deck -- new my-talk --title "My talk"   # scaffold a deck
npm run deck -- validate my-talk                # check it
npm run deck -- list                            # list decks
```

## Self-hosting

```sh
cp .env.example .env    # set ADMIN_KEY
docker compose up -d --build
```

See [docs/self-hosting.md](docs/self-hosting.md) for HTTPS with Caddy, LAN use
in rooms, GIPHY stickers and sizing (about 200 attendees per session on one
small server).

## Architecture

```
shared/   deck format, wire protocol, navigation and effect geometry
server/   Node HTTP + WebSocket: sessions, presenter auth, quizzes, chat,
          reactions, GIPHY proxy, static files
web/      framework-free TypeScript client: audience app, presenter console,
          projector screen, phone remote
skills/   Claude skill for authoring decks
bin/      deck CLI
```

The server holds the only copy of each session's state and sends every viewer
a snapshot built for their role, so quiz answers and secret results never
reach the audience or the projector before the reveal. The WebSocket hub is an
adapter around the session domain; it can be replaced by a managed realtime
service if one server is not enough.

## Security and privacy

- The presenter link carries a long random token and also asks for a PIN, with
  lockout after repeated failures. Session creation needs `ADMIN_KEY` in
  production.
- The audience never receives speaker notes or quiz answers before reveal.
- Chat text is rendered as text, never HTML; sticker images come only from
  GIPHY ids resolved on the server, rated PG.
- Nothing is written to disk. Restarting the server ends all sessions.

## Checks

```sh
npm run typecheck
npm test
npm run build
```

## License

[MIT](LICENSE)
