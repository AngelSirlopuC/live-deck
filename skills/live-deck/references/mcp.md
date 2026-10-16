# MCP server: not needed today

Decision: Live Deck ships no MCP server. Authoring is local file work: the agent writes `decks/<id>/deck.json` with its file tools and checks it with `node bin/live-deck.ts validate <id>`. The CLI gives the same feedback an MCP tool would, needs no extra process, and works with any agent that can run a shell.

## When an MCP server would be justified

- Agents create or control live sessions on a remote Live Deck server (start a session, advance slides, open or reveal a quiz, read results) without shell access to the host.
- Decks are stored remotely (no local `decks/` checkout), so the agent cannot write files directly.
- A hosted client (no shell, e.g. a chat app) needs to author decks.

## Tools it would expose

| Tool | Purpose |
| --- | --- |
| `validate_deck(deck)` | Return `{ ok, issues[], warnings[] }` for a deck object. |
| `save_deck(id, deck)` | Validate and store a deck; refuse to overwrite without `overwrite: true`. |
| `list_decks()` | Ids, titles, slide counts, validity. |
| `upload_asset(id, name, bytes)` | Store an image under `decks/<id>/assets/`. |
| `create_session(deckId, pin)` | Return presenter and audience URLs. |
| `control_session(sessionId, action)` | `next`, `prev`, `goto`, `open_quiz`, `close_quiz`, `reveal`, `end`. |
| `session_summary(sessionId)` | Quiz results, leaderboard, reaction counts. |

Session tools must authenticate with the presenter secret and PIN (same rules as the presenter URL) and must never expose quiz answers or notes to audience-scoped callers.
