# Deck format v1

Source of truth: `shared/deck.ts`. Every object is strict: unknown keys fail validation.

## Deck

| Field | Type | Rules |
| --- | --- | --- |
| `version` | `1` | Required, literal 1. |
| `title` | string | Required, 1–200 chars. Shown in lists and the summary. |
| `theme` | object | Optional. Default `{ background: "#10131a", foreground: "#f4f1ea", accent: "#ff7a45", muted: "#9aa3b2" }`. Prefer `{ "preset": "<name>" }`. |
| `slides` | Slide[] | Required, 1–200. Slide ids unique. |

## Theme

Colors are hex: `#` + 3–8 hex digits.

| Field | Type | Rules |
| --- | --- | --- |
| `preset` | `"estudio"` \| `"editorial"` \| `"neon"` \| `"papel"` \| `"brutalista"` \| `"corporativo"` | Optional. Brings colors, fonts (display/body/mono), slide background (gradient and/or pattern), card style, heading style and chart palette. See `themes.md`. |
| `background` | hex | Required without `preset`; optional override with one. |
| `foreground` | hex | Required without `preset`; optional override with one. |
| `accent` | hex | Required without `preset`; optional override with one. |
| `muted` | hex | Optional. |
| `surface` | hex | Optional. Overrides the card/surface color (cards, `card: true` text, donut gaps). |

- With a preset, override colors only when the user's brand requires it: `{ "preset": "corporativo", "accent": "#0057b8" }`.
- Without a preset the old rules hold exactly: `background`, `foreground`, `accent` required, `muted` optional.

## Slide

| Field | Type | Rules |
| --- | --- | --- |
| `id` | string | Required, `[A-Za-z0-9_-]{1,40}`, unique in the deck. |
| `layout` | `"free"` \| `"quiz"` | Optional, default free. `"quiz"` requires `quiz`, and `quiz` requires `"quiz"`. |
| `background` | hex \| Background | Optional, overrides the theme background. See below. |
| `notes` | string | Optional (always set it), max 5000 chars. Presenter-only; never sent to the audience. |
| `elements` | Element[] | Required (use `[]` on quiz slides), max 60. Element ids unique per slide. |
| `quiz` | Quiz | Only with `layout: "quiz"`. |

### Slide background object

A hex string still works (`"background": "#0b0d12"`). The object form (all fields optional, strict):

| Field | Type | Rules |
| --- | --- | --- |
| `color` | hex | Solid base color. |
| `gradient` | `{ "from": hex, "to": hex, "angle"?: number }` | Linear gradient; `angle` 0–360 (degrees). |
| `image` | asset src | Same rules as image `src` (`https://…` or `assets/<file>`, no `..`). Covers the slide. |
| `dim` | number 0–0.9 | Darkens the image so text stays readable. Use 0.4–0.6 under text. |
| `pattern` | `"dots"` \| `"grid"` \| `"lines"` \| `"noise"` | Subtle texture over the color/gradient. |

```json
{ "background": { "gradient": { "from": "#1b1f3a", "to": "#0b0d12", "angle": 135 }, "pattern": "dots" } }
```

Omit `background` on most slides: the preset already supplies one. Use the object for openers, section breaks and closings.

## Common element fields

| Field | Type | Rules |
| --- | --- | --- |
| `id` | string | `[A-Za-z0-9_-]{1,40}`, unique in the slide. Effects (ripple, focus, zoom) target it. |
| `type` | `"text"` \| `"image"` \| `"shape"` \| `"qr"` \| `"icon"` \| `"chart"` \| `"decor"` | Discriminator. No other types: free HTML or SVG is not allowed. |
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
  - `card` boolean: draws the preset card (surface color, radius, border, shadow). Do not combine with `background` or `radius`; let the preset decide.
  - `uppercase` boolean
  - `tracking` -0.05–0.3 (letter spacing in em; negative tightens big display type, positive opens small caps labels)
  - `mark` boolean: accent highlight underline behind the text. Use on one short phrase per slide.

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

### icon

A curated Lucide icon. The authoritative list is `ICON_NAMES` in `shared/icons.ts` (~80 kebab-case names); any other name fails validation. Check the file when unsure.

- `name`: an `ICON_NAMES` entry, e.g. `"rocket"`.
- `style` (optional): `color` hex, `background` hex (a filled tile behind the icon), `strokeWidth` 1–3, `radius` px (rounds the background tile).
- Keep the box roughly square on screen: `h ≈ w × 16/9` (e.g. `w: 0.08, h: 0.142`).

Representative names (verify against `ICON_NAMES`):

| Meaning | Names |
| --- | --- |
| People and talk | `users`, `user`, `message-circle`, `heart`, `smile`, `thumbs-up`, `hand` |
| Ideas and goals | `lightbulb`, `target`, `rocket`, `sparkles`, `trophy`, `flag` |
| Data and growth | `bar-chart-3`, `trending-up`, `trending-down`, `pie-chart`, `database` |
| Safety | `shield-check`, `lock`, `key`, `alert-triangle`, `check-circle` |
| Time and place | `clock`, `calendar`, `map-pin`, `globe` |
| Tech and work | `code`, `cpu`, `cloud`, `zap`, `settings`, `book-open`, `graduation-cap` |

### chart

Simple data chart rendered as SVG. Use it when the content has 2–8 real numbers; never invent data.

- `kind`: `"bar"` \| `"donut"`.
- `data`: array of `{ "label": string (max 40 chars), "value": number >= 0 }`. Bar: 1–8 points, one series. Donut: 2–6 slices.
- `unit` (optional): string, max 8 chars, appended to values (`"%"`, `" h"`, `"k"`).
- `style` (optional): only `color` hex (bar color; default accent). Donut uses the preset's categorical palette in fixed order.
- Bar shows value labels on the bars and no legend. Donut shows a legend with values and the total in the center.
- Give it room: at least `w: 0.4, h: 0.5`.

### decor

Built-in decorative SVG shape. It carries no content: never put meaning in decor.

- `shape`: `"blob"` \| `"wave"` \| `"dots"` \| `"rings"` \| `"arc"` \| `"squiggle"` \| `"star"` \| `"grid"`.
- `style` (optional): `color` hex (default accent), `opacity` 0.05–1.
- Place it before text in `elements` so it draws behind; keep it off the text, usually hugging a corner or an edge (boxes cannot leave the canvas). One or two per slide at most.

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
