# Deck format v1

Source of truth: `shared/deck.ts`. Every object is strict: unknown keys fail validation.

## Deck

| Field | Type | Rules |
| --- | --- | --- |
| `version` | `1` | Required, literal 1. |
| `title` | string | Required, 1–200 chars. Shown in lists and the summary. |
| `theme` | object | Optional. Default `{ background: "#10131a", foreground: "#f4f1ea", accent: "#ff7a45", muted: "#9aa3b2" }`. Prefer `{ "preset": "<name>" }`. |
| `motion` | `"calm"` \| `"lively"` \| `"snappy"` \| `"none"` | Optional, default `calm`. One motion style for the whole deck: how elements enter and how slides change. See "Motion" in `SKILL.md`. |
| `slides` | Slide[] | Required, 1–200. Slide ids unique. |

## Colors

Two kinds of color value exist:

- **hex**: `#` + 3–8 hex digits (`"#c2410c"`). Theme-level colors (`theme.background`, `foreground`, `accent`, `muted`, `surface`, `palette`, `art.from/to`) are always hex.
- **theme token**: a role of the current theme. Allowed on every element and slide color field (text `color`/`background`, shape `fill`/`stroke`, icon `color`/`background`, chart `color`, decor `color`, qr `color`/`background`, slide `background` and its `color` and gradient `from`/`to`). A token follows the preset and the mode, so the deck recolors when the theme changes; a hex does not.

| Token | Resolves to | Use it for |
| --- | --- | --- |
| `"text"` | theme foreground | body copy, strokes, the QR tile (`background: "text"`) |
| `"muted"` | theme muted | subtitles, captions, arrows, secondary lines |
| `"accent"` | theme accent | kickers, big numbers, highlighted tiles, icon backgrounds |
| `"surface"` | theme surface (card color) | hand-made cards and panels (`card: true` already uses it) |
| `"background"` | theme background (even on a slide that paints its own ground) | text on an inverted element or slide, the QR modules (`color: "background"`) |
| `"on-accent"` | text color that reads on the accent | text or icons sitting on an `accent` fill |

Write tokens for every color that belongs to the theme. Write a hex only for a brand color the user gave you, or inside `theme`. Any other string (`"red"`, `"var(--x)"`, `"primary"`) fails validation.

## Theme

Theme colors are hex: `#` + 3–8 hex digits (tokens are for elements and slides, not for the theme itself).

| Field | Type | Rules |
| --- | --- | --- |
| `preset` | `"estudio"` \| `"editorial"` \| `"neon"` \| `"papel"` \| `"brutalista"` \| `"corporativo"` | Optional. Brings colors, fonts (display/body/mono), slide background (gradient and/or pattern), card style, heading style and chart palette. See `themes.md`. |
| `background` | hex | Required without `preset`; optional override with one. |
| `foreground` | hex | Required without `preset`; optional override with one. |
| `accent` | hex | Required without `preset`; optional override with one. |
| `muted` | hex | Optional. |
| `surface` | hex | Optional. Overrides the card/surface color (cards, `card: true` text, donut gaps). |
| `mode` | `"light"` \| `"dark"` | Optional. Every preset has both; without it the preset keeps its original look. Always set it (see `themes.md`, "Light or dark"). |
| `fonts` | `{ display?, body? }` | Optional. Font names from the allowlist in `themes.md` ("Custom theme from the prompt"); other names are rejected. |
| `card` | `{ radius?: 0–64, border?: "none" \| "hairline" \| "thick", shadow?: "none" \| "soft" \| "hard" }` | Optional. Changes how `card: true` looks. |
| `heading` | `{ weight?: 400 \| 500 \| 600 \| 700 \| 800 \| 900, uppercase?: boolean, tracking?: -0.05–0.2 }` | Optional. Display text treatment. |
| `art` | `{ kind: "none" \| "glow" \| "gradient", from?, to?, angle?: 0–360 }` | Optional. Background art painted over the ground; `glow` uses the accent. |
| `pattern` | `"none"` \| `"dots"` \| `"grid"` \| `"lines"` \| `"noise"` | Optional. Ground pattern. |
| `palette` | hex[] (3–8) | Optional. Chart colors in order; accent first. |

- With a preset, override colors only when the user's brand requires it: `{ "preset": "corporativo", "accent": "#0057b8" }`.
- Without a preset the old rules hold exactly: `background`, `foreground`, `accent` required, `muted` optional.
- Every field is data: there is no way to pass CSS. `validate` warns (`warning:`) when text, muted or accent colors lack contrast on the ground.

## Slide

| Field | Type | Rules |
| --- | --- | --- |
| `id` | string | Required, `[A-Za-z0-9_-]{1,40}`, unique in the deck. |
| `layout` | `"free"` \| `"quiz"` \| `"ask"` | Optional, default free. `"quiz"` requires `quiz`, and `quiz` requires `"quiz"`. `"ask"` requires `ask`, and `ask` requires `"ask"`. |
| `background` | hex \| token \| Background | Optional, overrides the theme background. See below. |
| `notes` | string | Optional (always set it), max 5000 chars. Presenter-only; never sent to the audience. |
| `elements` | Element[] | Required (use `[]` on quiz and open-question slides), max 60. Element ids unique per slide. |
| `quiz` | Quiz | Only with `layout: "quiz"`. |
| `ask` | Ask | Only with `layout: "ask"`. |

### Slide background object

A color string still works (`"background": "accent"` or `"#0b0d12"`). The object form (all fields optional, strict):

| Field | Type | Rules |
| --- | --- | --- |
| `color` | hex \| token | Solid base color. |
| `gradient` | `{ "from": hex \| token, "to": hex \| token, "angle"?: number }` | Linear gradient; `angle` 0–360 (degrees). |
| `image` | asset src | Same rules as image `src` (`https://…` or `assets/<file>`, no `..`). Covers the slide. |
| `dim` | number 0–0.9 | Darkens the image so text stays readable. Use 0.4–0.6 under text. |
| `pattern` | `"dots"` \| `"grid"` \| `"lines"` \| `"noise"` | Subtle texture over the color/gradient. |

```json
{ "background": { "gradient": { "from": "#1b1f3a", "to": "#0b0d12", "angle": 135 }, "pattern": "dots" } }
```

Omit `background` on most slides: the preset already supplies one. Use the object for openers, section breaks and closings.

Imported slides (`live-deck import`) use exactly this field: `"background": { "image": "assets/slide-01.png" }` with no new layout; elements such as the join `qr` may sit on top.

## Common element fields

| Field | Type | Rules |
| --- | --- | --- |
| `id` | string | `[A-Za-z0-9_-]{1,40}`, unique in the slide. Effects (ripple, focus, zoom) target it. |
| `type` | `"text"` \| `"image"` \| `"shape"` \| `"qr"` \| `"icon"` \| `"chart"` \| `"decor"` | Discriminator. No other types: free HTML or SVG is not allowed. |
| `box` | `{ x, y, w, h }` | Normalized 0..1 on the 16:9 canvas, origin top-left. `x + w <= 1`, `y + h <= 1`. |
| `fragment` | integer 1–20 | Optional. Element appears at that step; absent = always visible. You decide the steps; the editor does not let people change them. Each element's entrance animation is derived automatically from its type, never written in the deck. |

### text

- `text`: string, max 2000. `\n` breaks lines.
- `style` (optional, all optional):
  - `fontSize` 8–400 (logical px on 1920x1080)
  - `fontWeight` 400 \| 500 \| 600 \| 700 \| 800
  - `font` `"display"` \| `"body"` \| `"mono"`
  - `italic` boolean
  - `color` hex or token (see "Colors")
  - `align` `"left"` \| `"center"` \| `"right"`
  - `valign` `"top"` \| `"middle"` \| `"bottom"`
  - `lineHeight` 0.8–3
  - `background` hex or token (hand-made card fill; `"surface"` matches the theme cards)
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
- `style` (optional): `fill` hex or token, `stroke` hex or token, `strokeWidth` 0–40, `radius` 0–540.

### qr

Renders the session join QR and URL at runtime. No payload.
- `style` (optional): only `color` (the modules) and `background` (the tile), hex or token. Leave both out: the player always draws dark modules on a light tile taken from the theme, so the QR scans in every preset and mode. A pair you set is used only when it is dark-on-light with at least 4:1 contrast; otherwise the player falls back to the theme pair. Set `background: "#ffffff"`, `color: "#000000"` only over a photo.
- Put one on slide 1. Keep it at least 0.25 wide and roughly square on screen (`h ≈ w × 16/9`).

### icon

A curated Lucide icon. The authoritative list is `ICON_NAMES` in `shared/icons.ts` (~80 kebab-case names); any other name fails validation. Check the file when unsure.

- `name`: an `ICON_NAMES` entry, e.g. `"rocket"`.
- `style` (optional): `color` hex or token, `background` hex or token (a filled tile behind the icon; `"accent"` with `color: "on-accent"` is the usual pair), `strokeWidth` 1–3, `radius` px (rounds the background tile).
- Default color: the preset accent, or the text color when the accent is too faint on its ground (under 3:1, e.g. yellow on light paper in `brutalista`). Set `color` only to force a specific hue.
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
- `style` (optional): only `color` hex or token (bar color; default accent). Donut uses the preset's categorical palette in fixed order.
- Bar shows value labels on the bars and no legend. Donut shows a legend with values and the total in the center.
- Give it room: at least `w: 0.4, h: 0.5`.

### decor

Built-in decorative SVG shape. It carries no content: never put meaning in decor.

- `shape`: `"blob"` \| `"wave"` \| `"dots"` \| `"rings"` \| `"arc"` \| `"squiggle"` \| `"star"` \| `"grid"`.
- `style` (optional): `color` hex or token (default accent), `opacity` 0.05–1.
- Place it before text in `elements` so it draws behind; keep it off the text, usually hugging a corner or an edge (boxes cannot leave the canvas). One or two per slide at most.

## Quiz

| Field | Type | Rules |
| --- | --- | --- |
| `question` | string | 1–300 chars. |
| `options` | string[] | 2–6 items, each 1–120 chars. Audience answers with A–F or 1–6. |
| `correctIndex` | integer | 0-based, must be < options length. Exactly one correct answer. |
| `display` | `"live"` \| `"secret"` | live: votes visible while voting. secret: hidden until the presenter reveals. |
| `timerSec` | integer | Optional, 5–600. |
| `results` | `"ranking"` \| `"grid"` | Optional. Layout of the options: `"ranking"` (default) is one vertical list from the start, re-ordered by votes with first place highlighted once results are visible; `"grid"` keeps the fixed A–F layout in two columns. |
| `zones` | `{ x, y, w, h }[]` | Optional. Zone quiz on a designed image: normalized boxes with the same rules as element boxes (0..1, `x + w <= 1`, `y + h <= 1`), exactly one per option in option order. `zones.length` must equal `options.length` (error path `quiz.zones`). |

### Zone quizzes (`quiz.zones`)

- Used on imported designed slides: the slide keeps `background: { "image": "assets/<file>" }` and `elements: []`, and the image already shows the question and options.
- With `zones`, the player does not draw the native question/options grid. It draws one overlay per zone at its box: translucent vote fill (share of votes), percentage badge, rank badge (1º, 2º… when results are visible), correct/wrong marking after reveal, the viewer's own vote outline and the leader highlight. Tapping a zone also votes. Options never re-order in zone mode (`results: "ranking"` does not move zones). The status line (votes, timer) shows in a small pill at the bottom of the slide.
- `question` and `options` stay required and must match the text on the image: phones, the presenter panel and the summary show them.
- `/preview/<id>` draws dashed outlines with the option letter on every zone to check alignment; live sessions never show them.
- Full method and examples: `zone-quizzes.md`.

The answer and notes are stripped before the deck reaches the audience.

## Ask (open question)

| Field | Type | Rules |
| --- | --- | --- |
| `question` | string | 1–200 chars, not blank. |
| `maxChars` | integer | Optional, 10–100. Characters per answer; default 40. |

- The slide shows the question and fills in the answers live: equal answers (ignoring case, accents and spacing) group into one entry with `×N`, most repeated first, ties A to Z.
- Answers open the first time the presenter reaches the slide and stay open until the presenter closes them; going back never reopens a closed question. Each person sends one answer per question and can change it while it is open.
- The audience's answer box turns on the browser's spellcheck and autocorrect and recommends using it, so a typo does not split a word.
- Every open question reached appears in the session summary with its grouped answers.

## Validation messages

The CLI prints `path: message`, where path indexes into the JSON (`slides.2.quiz.correctIndex: correctIndex must point to an option`). Fix at that path and re-run.
