# Live Deck

Real-time interactive presentations: the presenter drives the slides, the
audience follows from their phones, votes in quizzes, reacts, and chats.

## Development

```sh
npm install
npm run dev:server   # API + WebSocket on :8787
npm run dev:web      # Vite on :5180 (proxies /api, /decks, /ws)
```

Open `http://localhost:5180/preview/demo` to preview the sample deck.

## Decks

A deck lives in `decks/<id>/deck.json` (format v1, see `shared/deck.ts`) with
optional images in `decks/<id>/assets/`. Geometry is normalized (0..1) on a 16:9
canvas; slides render on a 1920x1080 logical stage scaled to the screen.

The raw deck file is never served: the API returns `publicDeck()`, which strips
speaker notes and quiz answers.

## Checks

```sh
npm run typecheck
npm test
```
