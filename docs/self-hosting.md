# Self-hosting Live Deck

Live Deck is a single Node.js process with no database: everything a session
needs lives in memory. One container is all you run.

## Quick start

Requirements: Docker with the Compose plugin.

```sh
git clone <this repository> live-deck && cd live-deck
cp .env.example .env
# Edit .env and set ADMIN_KEY, for example to the output of:
openssl rand -base64 32
docker compose up -d --build
```

Open <http://localhost:8787/>, enter the admin key when asked (the browser
remembers it in local storage), pick a deck and create a session. You get two
links: the presenter link (keep it private, it is protected by a PIN) and the
audience link, which is also shown as a QR code on the first slide.

Check that the container is healthy:

```sh
docker compose ps            # STATUS shows (healthy)
curl -s http://127.0.0.1:8787/api/health
```

The server refuses to start in production without `ADMIN_KEY`; see
`docker compose logs live-deck` if the container keeps restarting.

## Configuration

Every variable is documented in [`.env.example`](../.env.example):

| Variable | Purpose |
| --- | --- |
| `ADMIN_KEY` | Required. Protects session creation and the deck list. |
| `PUBLIC_BASE_URL` | Public URL for join links and QR codes, e.g. `https://deck.example.com`. |
| `TRUST_PROXY` | `1` only behind a trusted reverse proxy. |
| `ALLOWED_ORIGINS` | Exact origins allowed to open WebSockets; empty = same host. |
| `GIPHY_API_KEY` | Optional; enables chat stickers. |
| `PORT`, `HOST`, `DECKS_DIR` | Image defaults (`8787`, `0.0.0.0`, `/app/decks`) rarely need changing. |

After editing `.env`, apply it with `docker compose up -d` (recreates the
container).

## Adding decks

`./decks` is mounted read-only into the container, so you add decks without
rebuilding:

```text
decks/
  my-talk/
    deck.json      # format v1, see shared/deck.ts and decks/demo/deck.json
    assets/        # optional images referenced by the deck
```

The deck id is the folder name (lowercase letters, digits and dashes). Decks
are read from disk when a session is created, so a new or edited deck is
available immediately. Speaker notes and quiz answers in `deck.json` are never
sent to attendees.

## HTTPS with Caddy

Attendees join from their phones, usually over the internet, so serve Live Deck
over HTTPS. [`deploy/Caddyfile.example`](../deploy/Caddyfile.example) is a
complete reverse-proxy config with automatic certificates, WebSocket support
and security headers (HSTS, CSP, no referrer).

1. Point your domain's DNS at the server and open ports 80 and 443.
2. Install Caddy, copy the example to `/etc/caddy/Caddyfile` and replace
   `deck.example.com` with your domain.
3. In `.env` set `PUBLIC_BASE_URL=https://your-domain` and `TRUST_PROXY=1`,
   then `docker compose up -d`.
4. Reload Caddy.

Keep the default `127.0.0.1:8787:8787` port mapping when using Caddy:
`TRUST_PROXY=1` is only safe while the proxy is the sole way to reach the app.
Otherwise anyone could forge `X-Forwarded-For` and bypass per-IP rate limits.

## Rooms without internet (LAN)

For a classroom or meeting room, phones on the same Wi-Fi can join the laptop
running Live Deck directly:

1. Find the laptop's LAN address (for example `192.168.1.20`).
2. In `compose.yaml` change the port mapping to `"192.168.1.20:8787:8787"`.
3. In `.env` set `PUBLIC_BASE_URL=http://192.168.1.20:8787` so the QR code points
   at that address, and leave `TRUST_PROXY` empty.
4. `docker compose up -d`, then open `http://192.168.1.20:8787/` on the laptop.

Notes: many guest or corporate Wi-Fi networks isolate clients from each other;
use a network you control or a phone hotspot. Without HTTPS, everything except
the PIN-protected presenter actions travels unencrypted on that network.
Fonts and stickers still load from the internet when available; without it the
app falls back to system fonts and stickers are unavailable.

## Stickers (GIPHY)

Set `GIPHY_API_KEY` (free key from <https://developers.giphy.com/>) to enable
stickers in chat. Searches go through the server, which requests G/PG content
only and rate-limits each attendee; the key never reaches browsers. Without a
key the chat works in text mode only.

## Privacy

- Sessions are kept **in memory only**. Nothing is written to disk.
- An ended session is deleted 30 minutes after it ends, or immediately when the
  presenter deletes it after downloading the summary.
- Restarting or upgrading the server **ends every active session**. Do it
  between talks.
- The downloadable summary contains quiz results, the leaderboard and reaction
  counts, never chat messages.
- Sticker images are loaded by attendees' devices **directly from GIPHY**, which
  therefore sees their IP addresses. Leave `GIPHY_API_KEY` empty if that is not
  acceptable for your audience.
- Fonts are loaded from Google Fonts by every browser that opens the app.
- The admin key is stored in the presenter's browser local storage. Use a
  dedicated browser profile on shared computers.

## Sizing

Live Deck targets about **200 attendees per session**. One small VPS (1 vCPU,
1 GB RAM) comfortably runs a session of that size; the work is WebSocket
fan-out, not computation. Several smaller concurrent sessions fit on the same
instance. Run a single instance: sessions live in memory and are not shared
between processes.

## Upgrading

```sh
git pull
docker compose up -d --build
docker image prune -f        # optional: remove the previous image
```

Upgrading restarts the container and ends all active sessions; schedule it
between presentations.
