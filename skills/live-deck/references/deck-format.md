# Deck format v1

Source of truth: `shared/deck.ts`. Every object is strict: unknown keys fail validation.

## Deck

| Field | Type | Rules |
| --- | --- | --- |
| `version` | `1` | Required, literal 1. |
| `title` | string | Required, 1–200 chars. Shown in lists and the summary. |
| `theme` | object | Optional. Default `{ background: "#10131a", foreground: "#f4f1ea", accent: "#ff7a45", muted: "#9aa3b2" }`. |
| `slides` | Slide[] | Required, 1–200. Slide ids unique. |

## Theme

`background`, `foreground`, `accent` (required when `theme` is set), `muted` (optional). All hex: `#` + 3–8 hex digits.

## Slide

| Field | Type | Rules |
| --- | --- | --- |
| `id` | string | Required, `[A-Za-z0-9_-]{1,40}`, unique in the deck. |
| `layout` | `"free"` \| `"quiz"` | Optional, default free. `"quiz"` requires `quiz`, and `quiz` requires `"quiz"`. |
| `background` | hex | Optional, overrides the theme background. |
| `notes` | string | Optional (always set it), max 5000 chars. Presenter-only; never sent to the audience. |
| `elements` | Element[] | Required (use `[]` on quiz slides), max 60. Element ids unique per slide. |
| `quiz` | Quiz | Only with `layout: "quiz"`. |

## Common element fields

| Field | Type | Rules |
| --- | --- | --- |
| `id` | string | `[A-Za-z0-9_-]{1,40}`, unique in the slide. Effects (ripple, focus, zoom) target it. |
| `type` | `"text"` \| `"image"` \| `"shape"` \| `"qr"` | Discriminator. |
| `box` | `{ x, y, w, h }` | Normalized 0..1 on the 16:9 canvas, origin top-left. `x + w <= 1`, `y + h <= 1`. |
| `fragment` | integer 1–20 | Optional. Element appears at that step; absent = always visible. |

### text

- `text`: string, max 2000. `\n` breaks lines.
- `style` (optional, all optional):
  - `fontSize` 8–400 (logical px on 1920x1080)
  - `fontWeight` 400 \| 500 \| 600 \| 700 \| 800
  - `font` `"display"` \| `"body"` \| `"mono"`
  - `italic` boolean
  - `color` hex
  - `align` `"left"` \| `"center"` \| `"right"`
  - `valign` `"top"` \| `"middle"` \| `"bottom"`
  - `lineHeight` 0.8–3
  - `background` hex (card fill)
  - `radius` 0–540 (px)
  - `padding` 0–200 (px)

### image

- `src`: `https://…` or `assets/<path>` (chars `[A-Za-z0-9_\-./]`, no `..`, max 500). Local files live in `decks/<id>/assets/`; the CLI fails if the file is missing.
- `alt`: string, required, max 300.
- `fit`: `"contain"` \| `"cover"` (optional).
- `style`: only `{ radius }`.

### shape

- `shape`: `"rect"` \| `"ellipse"` \| `"line"`. A horizontal line uses `h: 0`.
- `style` (optional): `fill` hex, `stroke` hex, `strokeWidth` 0–40, `radius` 0–540.

### qr

Renders the session join QR and URL at runtime. No payload.
- `style` (optional): only `color` and `background` (hex). Use a light background with dark color for scanability.
- Put one on slide 1. Keep it at least 0.25 wide and roughly square on screen (`h ≈ w × 16/9`).

## Quiz

| Field | Type | Rules |
| --- | --- | --- |
| `question` | string | 1–300 chars. |
| `options` | string[] | 2–6 items, each 1–120 chars. Audience answers with A–F or 1–6. |
| `correctIndex` | integer | 0-based, must be < options length. Exactly one correct answer. |
| `display` | `"live"` \| `"secret"` | live: votes visible while voting. secret: hidden until the presenter reveals. |
| `timerSec` | integer | Optional, 5–600. |
| `results` | `"ranking"` \| `"grid"` | Optional. How visible results show: `"ranking"` (default) re-orders options by votes and highlights first place; `"grid"` keeps the fixed A–F layout. |

The answer and notes are stripped before the deck reaches the audience.

## Validation messages

The CLI prints `path: message`, where path indexes into the JSON (`slides.2.quiz.correctIndex: correctIndex must point to an option`). Fix at that path and re-run.
