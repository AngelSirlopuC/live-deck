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
- **Design freely.** Write decks with Claude using six theme presets, icons,
  charts and decor, or import slides designed in any tool and keep your design,
  including quizzes drawn over your own question slides.
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
The console opens with the join QR on the first slide.

Phones on the same Wi-Fi work out of the box: when the console runs on
`localhost`, join links and QR codes use this machine's LAN address (the server
prints it on start, e.g. `http://192.168.1.34:5180`). To drive the slides from
your phone, press **Control móvil** in the console, scan the code and enter
your PIN. If your OS firewall asks, allow incoming connections for Node.

### Preview vs. presenting

| | Preview | Live session |
| --- | --- | --- |
| URL | `/preview/<deck-id>` | `/p/<token>` (console), `/s/<code>` (audience) |
| Who sees it | Only you, in that tab | Everyone who joins |
| Join QR | Placeholder ("El QR aparece al presentar") | Real code to join |
| Quizzes, chat, reactions, effects | Inactive | Active |
| Navigation | Arrows, click or swipe | Driven by the presenter |

Use the preview to rehearse a deck before a talk. When it looks right, press
**Presentar** (top right): it opens the home page with that deck preselected;
set a 4–8 digit PIN and open the console to start the live session.

Chat stickers need a free GIPHY API key (developers.giphy.com → Create an API
key). Put it in `.env` (git-ignored), which `npm run dev:server` loads:

```sh
cp .env.example .env    # then set GIPHY_API_KEY=...
```

Without a key, chat works in text mode and the console disables sticker modes.

### Presenting on a projector

Press **Presentar** in the console. As in Google Slides you choose:

- **Vista de presentador**: the console (current and next slide, notes, timer,
  quiz, chat, controls) opens in its own window, and this tab shows only the
  slide. Project the slide, keep the controls on your laptop.
- **Mostrar desde el principio** and **Pantalla completa**.
- **Pantalla de presentación**: this screen, another connected screen, or a
  separate window you drag to the projector.

To list other screens, press **Permitir** to grant the browser's window
management permission (Chrome and Edge). The slide then goes fullscreen on the
screen you picked and the presenter view opens on the other one, from a single
click. Without the permission (or in other browsers), the presenter view still
opens; if the browser needs another click for fullscreen, a **Pantalla
completa** button appears over the slide. Leaving fullscreen (Esc) ends the
projection and brings the console back. Allow pop-ups for the site so the
presenter view can open.

While projecting, the presenter view's main button becomes **Dejar de
presentar**; once stopped it is **Presentar** again, so you can pick another
mode. If the presenter view is closed, the projection shows **Abrir vista de
presentador** and **Dejar de presentar**, and moving the mouse over it reveals a
**Salir** button in the corner. Ending the session also ends the projection.

The phone remote (**Control móvil**) works alongside any of these.

## Creating presentations

There are two ways in. Both end in the same live session.

| | 1. Write a deck with Claude | 2. Import slides you designed |
| --- | --- | --- |
| Best for | Starting from an idea, outline or notes | Slides already made in PowerPoint, Keynote, Google Slides, Canva, Figma… |
| Design | Six theme presets, icons, charts, decor, backgrounds | Exactly your design (each slide is an image) |
| Step-by-step reveals, focus/zoom on one element | Yes | No (focus/zoom on an area still works) |
| Quizzes | Native quiz slides | Native quiz slides, or **zone quizzes** drawn over your designed question |

### Install the skill (both paths)

```sh
npx skills add AngelSirlopuC/live-deck   # Claude Code, Cursor, Codex, Gemini CLI and more
```

### Path 1: write a deck with Claude

Ask: "create a live deck about …". The skill picks a theme preset for the topic,
audience and room, plans varied layouts, writes `decks/<id>/deck.json`, validates
it with the CLI and fixes every issue, then gives you the preview link.

What a deck can use (format v1, defined in `shared/deck.ts`):

- **Theme presets**: `estudio`, `editorial`, `neon`, `papel`, `brutalista`,
  `corporativo`. Each brings its own fonts, colours, background art and card
  style; colours can be overridden for a brand.
- **Elements**: text (with `card`, `uppercase`, `tracking`, `mark`), images,
  shapes, curated Lucide icons, bar and donut charts, decorative shapes, and the
  join `qr`.
- **Slide backgrounds**: colour, gradient, image (with dimming) or pattern.
- **Fragments** for step-by-step reveals, **speaker notes**, and **quiz slides**
  (live or secret results, shown as a ranking by default, optional timer).

Decks are data, never HTML: nothing in a deck can run code on attendees' phones.

### Path 2: import slides you designed

1. Export one image per slide (PNG or JPG, 1920×1080, 16:9) into a folder.
2. Import it:

   ```sh
   npm run deck -- import ./my-slides --id my-talk --title "My talk"
   ```

   Images are taken in natural order (`slide2` before `slide10`), copied to
   `decks/my-talk/assets/`, and the join QR is placed on slide 1 (bottom right;
   move it by editing its box). Images that are not 16:9 get a warning.
3. Ask Claude (with the skill) to "add notes and quizzes to my-talk". It looks
   at every image, writes speaker notes, inserts native quiz slides where they
   help, and turns slides designed as a question into **zone quizzes**.
4. Open the preview and check the zone outlines sit on your options.

**Zone quizzes.** Design the question slide yourself (question plus option
boxes). In the deck, the quiz lists the question, options and correct answer as
data, plus `zones`: one box per option on the 16:9 canvas. During the session
Live Deck draws over your image the vote fill, percentage, rank badge (1º, 2º…),
the correct answer after reveal, and each person's own vote. Attendees vote from
the panel on their phone, with keys A–F, or by tapping the option on the slide.
Options keep their designed position. See
`skills/live-deck/references/zone-quizzes.md`.

### The deck CLI

```sh
npm run deck -- new my-talk --title "My talk"     # scaffold a deck
npm run deck -- import ./my-slides --id my-talk   # build a deck from slide images
npm run deck -- validate my-talk                  # schema, assets (incl. backgrounds), QR on slide 1
npm run deck -- list                              # list decks and flag invalid ones
```

### Example decks

| Deck | Shows |
| --- | --- |
| `decks/demo` | Every basic element and both quiz modes |
| `decks/como-crear-una-presentacion` | Path 1: the `brutalista` preset, icons, charts with real data, decor, credits |
| `decks/importadas-demo` | Path 2: imported designed images, a zone quiz and an interleaved native quiz |

Open any of them at `/preview/<deck-id>`.

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
