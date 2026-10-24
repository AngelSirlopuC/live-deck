---
name: live-deck
description: Author interactive presentations for Live Deck as deck.json files (format v1) and validate them with the repo CLI. Use when the user asks to "create a live deck", "make a presentation for Live Deck", "convert my outline/notes/pptx into a live deck", "add a quiz slide to my deck", "import my slides from PowerPoint/Keynote/Google Slides/Canva/Figma", to fix a deck that fails validation, or to get a deck's preview or editor links (shortcuts `/live-deck preview <id>`, `edit <id>`, `list`, `validate <id>`).
---

# Live Deck authoring

Turn an idea, outline, notes or pasted .pptx text into `decks/<id>/deck.json`, validate it, fix every error, and hand the user the preview and editor URLs.

## Shortcuts

When the skill is invoked with one of these as its first word (`/live-deck preview demo`), do only that and stop. Do not plan or write slides; only `validate` may edit the deck, and only to fix what the validator reports.

| Shortcut | Do |
| --- | --- |
| `preview <id>` | Check `decks/<id>/deck.json` exists, then reply with the "Vista previa" / "Editar" link block (Workflow step 6). |
| `edit <id>` | Same check, then reply with the editor link first (`Editar: …/edit/<id>`) and the preview link below it. Remind them to press Guardar. |
| `list` | Run `node bin/live-deck.ts list` and reply with one row per deck: id, title, slide count, and its preview and editor links. Mark decks the CLI flags as `INVALID` and give the reason instead of links. |
| `validate <id>` | Run `node bin/live-deck.ts validate <id>`, fix every issue and warning (Workflow step 5), re-run until `OK`, then summarize what you changed and end with the link block. |

- Missing id or unknown deck: run `node bin/live-deck.ts list`, show the available ids and ask which one. Never guess.
- Links use the same base as Workflow step 6: `http://localhost:5180` locally, or `PUBLIC_BASE_URL` from `.env` for a published deck.
- Anything else after `/live-deck` is a normal request: follow "Choose the path".

## Choose the path

- The user has an idea, outline, notes or pasted text: **write the deck** (Art direction, Workflow below).
- The user already has designed slides (PowerPoint, Keynote, Google Slides, Canva, Figma) and wants to keep that look: **import them** (Importing designed slides below). Do not rebuild a designed deck element by element.
- Mixed: import the designed slides, then add native slides (quizzes, a QR cover, section breaks) between them.

## Before writing

1. Work from the Live Deck repository root (it contains `bin/live-deck.ts` and `decks/`).
2. Read `references/deck-format.md` once per session. Follow it exactly; unknown fields are rejected.
3. Use `references/layout-recipes.md` for boxes and font sizes. Do not invent geometry when a recipe fits.
4. Read `references/themes.md` before the art direction step.
5. Write all deck content (titles, text, notes, quiz questions, alt text) in the user's language.
6. Pick a deck id: lowercase letters, digits and dashes, starting with a letter or digit, at most 63 chars (`my-talk-2026`).

## Art direction (before writing slides)

1. Pick exactly one preset (`estudio`, `editorial`, `neon`, `papel`, `brutalista`, `corporativo`) from the topic, the audience and the venue, and pick its mode: `light` or `dark`. Every preset has both. Use the decision tables in `references/themes.md`. Never default to dark: choose `dark` only for a dark auditorium, an LED wall, an evening or gaming event, or when the user asks for it; an unknown venue gets `light`.
2. When the user describes a look (brand colors, "minimalista", "estilo revista", "retro") or no preset fits, build a custom theme from the prompt on top of the closest preset: colors, fonts from the allowlist, card, heading, art, pattern and palette. Follow "Custom theme from the prompt" in `references/themes.md`.
3. Write one line in your plan and to the user: `Preset: <name>, mode: <light|dark>, because <reason>.` (or `Theme: custom from <preset> <mode> — <summary>, because <reason>.`).
4. Set `"theme": { "preset": "<name>", "mode": "<light|dark>" }` plus any custom fields. Do not hand-color cards; use `card: true`. Every other element color is a theme token (`"text"`, `"muted"`, `"accent"`, `"surface"`, `"background"`, `"on-accent"`), so the deck recolors when the preset or mode changes.
5. Plan a layout per slide from the recipes before writing JSON, then check the plan against the composition rules below.

## Composition variety

- No two consecutive slides with the same layout (recipe). Quiz and open-question slides count as layouts.
- Alternate dense slides (icon row, chart, two-column) with breathing slides (big number, quote, one-word section break).
- Use a rich element wherever the content supports it: a real figure becomes `big-number-card` or a `chart`; a list of 3–4 parallel ideas becomes an `icon-row`; a key phrase gets `mark`; openers, section breaks and closings get a slide `background` object or a `decor` accent.
- Never invent data for a chart or a number; ask or use text instead.
- Decor is decoration only: at most two per slide, never behind small text.
- One idea per slide still holds.

## Workflow

1. Plan the outline: one idea per slide, 5–25 slides for a normal talk. Add 1 quiz every 4–8 slides when the audience can answer something. Add an open-question slide when the user asks for one or when the audience can answer in a word or two (opinions, expectations, a word that sums something up). Do the art direction step and assign a layout to each slide.
2. Scaffold: `node bin/live-deck.ts new <id> --title "<title>"`. It refuses to overwrite; if the deck exists, edit it instead (ask first if the user did not mean that deck).
3. Replace the template slides in `decks/<id>/deck.json` with the planned slides.
4. Validate: `node bin/live-deck.ts validate <id>`.
5. Fix every printed issue (`path: message`, e.g. `slides.3.elements.1.box: box must stay inside the canvas`) and re-run until it prints `OK <title> (<n> slides, <q> quizzes)` (plus `, <a> open question(s)` when the deck has any). Treat `warning:` lines as defects too.
6. Tell the user: deck path, chosen preset and mode and why, slide, quiz and open-question count. Always end your message with this block, filled in (never skip it, never shorten it to one link):

   ```
   Vista previa: http://localhost:5180/preview/<id>
   Editar:       http://localhost:5180/edit/<id>
   ```

   - These are the local development URLs; they work while `npm run dev:server` and `npm run dev:web` are running. If they are not running, say so and give both commands.
   - After a publish to a hosted server (see below), give the same two paths on the server's address instead: the value of `PUBLIC_BASE_URL` in `.env` (for example `https://deck.example.com/preview/<id>`). Without that variable, give the local URLs only and say which address to use once it is hosted.
   - Explain the difference: **Vista previa** is a single-viewer rehearsal with no session: the QR shows a placeholder ("El QR aparece al presentar"), there is no audience, quizzes and chat are inactive, and they move with arrows, click or swipe. **Editar** opens the visual editor: move and resize elements, edit text in place, change the theme and mode, then press Guardar (the preview shows only saved changes).
   - To present for real, they press "Presentar" on the preview (opens the home page with the deck preselected), set a 4–8 digit PIN and open the console. The join QR, quizzes, chat and effects work only in that live session.
   - For an event on a hosted server, publish it with `npm run publish:deck -- <id>` (needs `LIVE_DECK_PUBLISH_TARGET` in `.env`; add `--dry-run` first). It validates again and copies only that deck. Never publish without the user asking.

If the user edited the deck in the editor, read `deck.json` again before changing it, because the file on disk is the source of truth.

`npm run deck -- <command>` is equivalent to `node bin/live-deck.ts <command>`. Requires Node >= 24.

## Importing designed slides

Use this when the user already designed slides in PowerPoint, Keynote, Google Slides, Canva, Figma or any other tool. Live Deck keeps their design as images and adds the live layer (join QR, quizzes, chat, reactions, effects).

1. Ask the user to export one PNG or JPG per slide at 1920x1080 (16:9) into one folder, named so they sort in order (`slide1.png`, `slide2.png`, … sort naturally).
2. Run `node bin/live-deck.ts import <folder> --id <id> --title "<title>"`. It copies the images to `decks/<id>/assets/slide-01.<ext>`…, writes one slide per image (`s01`…, `background.image`, empty `elements` and `notes`) and validates. It refuses an existing id, an invalid id, a missing folder or a folder without `.png`/`.jpg`/`.jpeg`/`.webp` files. Report every non-16:9 warning to the user and suggest re-exporting at 1920x1080.
3. Look at every imported image (open each file in `decks/<id>/assets/`) and write speaker `notes` for every slide from what it shows.
4. Decide where a native quiz slide helps (recipe `quiz`, after a key idea, 1 every 4–8 slides) and insert it between the image slides with a new unique id.
5. A slide visibly designed as a question with options becomes a zone quiz: follow `references/zone-quizzes.md` (question, options and correct answer read from the image, one zone per option measured on the 16:9 canvas). Never guess the correct answer silently.
6. Validate and fix until it prints `OK`, as in the main workflow.
7. Ask the user to open `/preview/<id>` and check that the dashed zone outlines (with the option letter) sit on their designed options; adjust the boxes if not. The outlines appear only in the preview, never in a live session.
8. Tell the user the join QR is already overlaid on slide 1 (bottom-right, white tile); to move or resize it, edit the `qr` element's `box` on slide 1, keeping it at least 0.25 wide and roughly square on screen.
9. End with the same "Vista previa" / "Editar" link block as step 6 of the Workflow.

## Hard rules

- `version` is `1`. `title` 1–200 chars. 1–200 slides.
- Slide 1 contains a `qr` element (the audience scans it to join). Recipe: `title-qr`.
- Slide ids are unique in the deck. Element ids are unique per slide and match `[A-Za-z0-9_-]{1,40}`.
- Every box is normalized: `x, y, w, h` in 0..1 and `x + w <= 1`, `y + h <= 1`.
- Font sizes are logical px on a 1920x1080 stage. Body text >= 32, headings 64–110. Never below 24.
- Quiz slides: `"layout": "quiz"`, `elements: []`, and a `quiz` with 2–6 options (each 1–120 chars), exactly one `correctIndex` (0-based, < options length), `display` `"live"` (bars move while voting) or `"secret"` (hidden until reveal), optional integer `timerSec` 5–600, optional `zones` (one box per option, only on imported designed slides; see `references/zone-quizzes.md`). A `quiz` without `layout: "quiz"` (or vice versa) is invalid.
- Open-question slides: `"layout": "ask"`, `elements: []`, and an `ask` with `question` (1–200 chars, not blank) and optional integer `maxChars` 10–100 (characters per answer, default 40). The audience answers in a few words from their phone; equal answers group ignoring case, accents and spacing and show most repeated first with `×N`. Answers open when the presenter reaches the slide; the presenter can close them. An `ask` without `layout: "ask"` (or vice versa) is invalid. Keep the question short and answerable in one to three words; use a quiz instead when there is a right answer.
- Images: `src` is `https://…` or `assets/<file>`; put local files in `decks/<id>/assets/`. Never use `..`. Always set `alt`.
- Every slide has speaker `notes` (what to say, what to do: reveal, focus, zoom).
- Set `theme` once at deck level, normally just `{ "preset": "<name>", "mode": "<light|dark>" }`. Without a preset, `background`, `foreground` and `accent` are required. Theme colors are hex (`#rrggbb`).
- Use theme tokens for colors: element and slide color fields take `"text"`, `"muted"`, `"accent"`, `"surface"`, `"background"` or `"on-accent"` (table in `references/deck-format.md`, "Colors"). Write a hex only for a brand color the user gave you, or inside `theme`. Never copy a preset's hex into an element: it stops following the theme.
- Only the built-in element types exist: `text`, `image`, `shape`, `qr`, `icon`, `chart`, `decor`. Free HTML or SVG is not allowed (deck content reaches audience phones). Icon names must come from `ICON_NAMES` in `shared/icons.ts`.
- Reveal content step by step with `fragment: 1..20` (element appears on that step). Keep to <= 6 steps per slide.

- No more than ~40 words of visible text per slide; move detail into `notes`.

## Motion (you decide it; people never set animations by hand)

Animations are not authored per element. The player derives each element's entrance from its type (text rises, bars grow, donuts sweep, lines draw, images settle, icons pop, decorations and the QR fade) and staggers them in reading order. You make two decisions:

1. **Deck motion style**, one line in the plan: `Motion: <style>, because <reason>.`

   | Style | Use for |
   | --- | --- |
   | `calm` (default) | Most talks: business, education, research, sensitive topics, older or formal audiences. |
   | `lively` | Workshops, community, product launches, young audiences, playful presets (`papel`, `neon`). |
   | `snappy` | Fast talks, lightning talks, pitches, `brutalista`, dense decks with many steps. |
   | `none` | When the user asks for no animation, accessibility-first events, or decks shared as reading material. |

2. **Steps (`fragment`)**: reveal only when the order carries meaning. Use steps for: lists the speaker comments one by one, a process or timeline, a build-up to a conclusion, a question before its answer, a chart before its takeaway. Do not use steps for: titles, kickers, section breaks, a single idea, decoration, the QR, quiz and open-question slides. Group an icon with its label on the same step. Keep the heading always visible. Order steps in reading order (top to bottom, left to right) unless the argument needs another order.

The editor shows no animation or step controls, so the deck you write is the final word on motion. If the user wants a different feel, change `motion` or the steps yourself.

## Converting existing material

- Outline or notes: each top-level bullet becomes a slide; sub-bullets become fragments or notes.
- Pasted .pptx text: keep slide order and titles, shorten body text to the essential claim, move the rest to `notes`. Images from the pptx need files in `assets/`; if the user cannot provide them, omit them and say so.
- A .pptx/.key/Canva file whose design the user wants to keep: do not transcribe it; ask for one exported image per slide and follow "Importing designed slides".
- Questions in the material ("¿Sabías que…?", "Quiz:") become quiz slides. Ask for the correct answer only if it cannot be inferred.
- Open prompts with no right answer ("¿Qué esperas de hoy?", "Una palabra para…") become open-question slides (`layout: "ask"`).

## Worked example

Request: "Make a 4-slide live deck in Spanish about safe passwords with one quiz."

Preset: `estudio`, because it is a general tech-safety talk for a mixed audience in an unknown room. Layouts: hero-gradient → icon-row → quiz → closing with decor.

```json
{
  "version": 1,
  "title": "Contraseñas seguras",
  "theme": { "preset": "estudio" },
  "slides": [
    { "id": "portada", "notes": "Saluda y pide que escaneen el QR.",
      "background": { "gradient": { "from": "surface", "to": "background", "angle": 135 } },
      "elements": [
      { "id": "decor", "type": "decor", "shape": "rings", "box": { "x": 0.0, "y": 0.55, "w": 0.26, "h": 0.45 }, "style": { "opacity": 0.25 } },
      { "id": "titulo", "type": "text", "box": { "x": 0.07, "y": 0.22, "w": 0.52, "h": 0.36 }, "text": "Contraseñas que nadie adivina", "style": { "fontSize": 96, "fontWeight": 800, "font": "display", "lineHeight": 1.05, "tracking": -0.02 } },
      { "id": "qr", "type": "qr", "box": { "x": 0.64, "y": 0.16, "w": 0.29, "h": 0.68 } }
    ] },
    { "id": "reglas", "notes": "Cada regla aparece con 'siguiente'.", "elements": [
      { "id": "h", "type": "text", "box": { "x": 0.07, "y": 0.1, "w": 0.86, "h": 0.14 }, "text": "Tres reglas", "style": { "fontSize": 80, "fontWeight": 800, "font": "display" } },
      { "id": "i1", "type": "icon", "name": "key", "box": { "x": 0.16, "y": 0.36, "w": 0.08, "h": 0.142 }, "fragment": 1 },
      { "id": "r1", "type": "text", "box": { "x": 0.07, "y": 0.55, "w": 0.26, "h": 0.2 }, "text": "Usa frases largas", "fragment": 1, "style": { "fontSize": 40, "align": "center" } },
      { "id": "i2", "type": "icon", "name": "lock", "box": { "x": 0.46, "y": 0.36, "w": 0.08, "h": 0.142 }, "fragment": 2 },
      { "id": "r2", "type": "text", "box": { "x": 0.37, "y": 0.55, "w": 0.26, "h": 0.2 }, "text": "Una contraseña por sitio", "fragment": 2, "style": { "fontSize": 40, "align": "center" } },
      { "id": "i3", "type": "icon", "name": "shield-check", "box": { "x": 0.76, "y": 0.36, "w": 0.08, "h": 0.142 }, "fragment": 3 },
      { "id": "r3", "type": "text", "box": { "x": 0.67, "y": 0.55, "w": 0.26, "h": 0.2 }, "text": "Activa la verificación en dos pasos", "fragment": 3, "style": { "fontSize": 40, "align": "center" } }
    ] },
    { "id": "quiz-largo", "layout": "quiz", "notes": "Revela tras 30 s.", "elements": [],
      "quiz": { "question": "¿Cuál es más difícil de adivinar?", "options": ["P@ssw0rd!", "caballo-bateria-grapa-correcto"], "correctIndex": 1, "display": "secret", "timerSec": 30 } },
    { "id": "cierre", "notes": "Agradece y finaliza la sesión.", "background": { "color": "surface", "pattern": "dots" }, "elements": [
      { "id": "decor", "type": "decor", "shape": "blob", "box": { "x": 0.7, "y": 0.55, "w": 0.3, "h": 0.45 }, "style": { "opacity": 0.3 } },
      { "id": "gracias", "type": "text", "box": { "x": 0.07, "y": 0.3, "w": 0.86, "h": 0.26 }, "text": "Gracias", "style": { "fontSize": 180, "fontWeight": 800, "font": "display", "align": "center", "valign": "middle", "mark": true } }
    ] }
  ]
}
```

Then: `node bin/live-deck.ts validate contrasenas` → `OK Contraseñas seguras (4 slides, 1 quizzes)`.

## References

- `references/deck-format.md`: every field, allowed values and limits.
- `references/layout-recipes.md`: proven boxes for common slide types, including rich recipes (hero-gradient, icon-row, big-number-card, chart-bar, chart-donut, quote-mark, section-break, imported-slide, zone-quiz).
- `references/zone-quizzes.md`: zone quizzes on imported designed slides (JSON, rules, measuring zones).
- `references/themes.md`: the six presets, when to use each, and composition tips.
- `references/mcp.md`: why there is no MCP server and when one would be justified.
- Full example using every element type: `decks/demo/deck.json`. Schema source of truth: `shared/deck.ts`.
