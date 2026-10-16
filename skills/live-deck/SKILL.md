---
name: live-deck
description: Author interactive presentations for Live Deck as deck.json files (format v1) and validate them with the repo CLI. Use when the user asks to "create a live deck", "make a presentation for Live Deck", "convert my outline/notes/pptx into a live deck", "add a quiz slide to my deck", or to fix a deck that fails validation.
---

# Live Deck authoring

Turn an idea, outline, notes or pasted .pptx text into `decks/<id>/deck.json`, validate it, fix every error, and hand the user a preview URL.

## Before writing

1. Work from the Live Deck repository root (it contains `bin/live-deck.ts` and `decks/`).
2. Read `references/deck-format.md` once per session. Follow it exactly; unknown fields are rejected.
3. Use `references/layout-recipes.md` for boxes and font sizes. Do not invent geometry when a recipe fits.
4. Write all deck content (titles, text, notes, quiz questions, alt text) in the user's language.
5. Pick a deck id: lowercase letters, digits and dashes, starting with a letter or digit, at most 63 chars (`my-talk-2026`).

## Workflow

1. Plan the outline: one idea per slide, 5–25 slides for a normal talk. Add 1 quiz every 4–8 slides when the audience can answer something.
2. Scaffold: `node bin/live-deck.ts new <id> --title "<title>"`. It refuses to overwrite; if the deck exists, edit it instead (ask first if the user did not mean that deck).
3. Replace the template slides in `decks/<id>/deck.json` with the planned slides.
4. Validate: `node bin/live-deck.ts validate <id>`.
5. Fix every printed issue (`path: message`, e.g. `slides.3.elements.1.box: box must stay inside the canvas`) and re-run until it prints `OK <title> (<n> slides, <q> quizzes)`. Treat `warning:` lines as defects too.
6. Tell the user: deck path, slide and quiz count, and preview at `/preview/<id>` (dev: `http://localhost:5180/preview/<id>`). To present, they create a session from the home page.

`npm run deck -- <command>` is equivalent to `node bin/live-deck.ts <command>`. Requires Node >= 24.

## Hard rules

- `version` is `1`. `title` 1–200 chars. 1–200 slides.
- Slide 1 contains a `qr` element (the audience scans it to join). Recipe: `title-qr`.
- Slide ids are unique in the deck. Element ids are unique per slide and match `[A-Za-z0-9_-]{1,40}`.
- Every box is normalized: `x, y, w, h` in 0..1 and `x + w <= 1`, `y + h <= 1`.
- Font sizes are logical px on a 1920x1080 stage. Body text >= 32, headings 64–110. Never below 24.
- Quiz slides: `"layout": "quiz"`, `elements: []`, and a `quiz` with 2–6 options (each 1–120 chars), exactly one `correctIndex` (0-based, < options length), `display` `"live"` (bars move while voting) or `"secret"` (hidden until reveal), optional integer `timerSec` 5–600. A `quiz` without `layout: "quiz"` (or vice versa) is invalid.
- Images: `src` is `https://…` or `assets/<file>`; put local files in `decks/<id>/assets/`. Never use `..`. Always set `alt`.
- Every slide has speaker `notes` (what to say, what to do: reveal, focus, zoom).
- Colors are hex (`#rrggbb`). Prefer theme colors; set `theme` once at deck level.
- Reveal content step by step with `fragment: 1..20` (element appears on that step). Keep to <= 6 steps per slide.
- No more than ~40 words of visible text per slide; move detail into `notes`.

## Converting existing material

- Outline or notes: each top-level bullet becomes a slide; sub-bullets become fragments or notes.
- Pasted .pptx text: keep slide order and titles, shorten body text to the essential claim, move the rest to `notes`. Images from the pptx need files in `assets/`; if the user cannot provide them, omit them and say so.
- Questions in the material ("¿Sabías que…?", "Quiz:") become quiz slides. Ask for the correct answer only if it cannot be inferred.

## Worked example

Request: "Make a 4-slide live deck in Spanish about safe passwords with one quiz."

```json
{
  "version": 1,
  "title": "Contraseñas seguras",
  "theme": { "background": "#10131a", "foreground": "#f4f1ea", "accent": "#ff7a45", "muted": "#9aa3b2" },
  "slides": [
    { "id": "portada", "notes": "Saluda y pide que escaneen el QR.", "elements": [
      { "id": "titulo", "type": "text", "box": { "x": 0.07, "y": 0.22, "w": 0.52, "h": 0.36 }, "text": "Contraseñas que nadie adivina", "style": { "fontSize": 96, "fontWeight": 800, "font": "display", "lineHeight": 1.05 } },
      { "id": "qr", "type": "qr", "box": { "x": 0.64, "y": 0.16, "w": 0.29, "h": 0.68 }, "style": { "background": "#f4f1ea", "color": "#10131a" } }
    ] },
    { "id": "reglas", "notes": "Cada regla aparece con 'siguiente'.", "elements": [
      { "id": "h", "type": "text", "box": { "x": 0.07, "y": 0.1, "w": 0.86, "h": 0.14 }, "text": "Tres reglas", "style": { "fontSize": 80, "fontWeight": 800, "font": "display" } },
      { "id": "r1", "type": "text", "box": { "x": 0.07, "y": 0.32, "w": 0.86, "h": 0.14 }, "text": "Usa frases largas", "fragment": 1, "style": { "fontSize": 44 } },
      { "id": "r2", "type": "text", "box": { "x": 0.07, "y": 0.5, "w": 0.86, "h": 0.14 }, "text": "Una contraseña por sitio", "fragment": 2, "style": { "fontSize": 44 } },
      { "id": "r3", "type": "text", "box": { "x": 0.07, "y": 0.68, "w": 0.86, "h": 0.14 }, "text": "Activa la verificación en dos pasos", "fragment": 3, "style": { "fontSize": 44 } }
    ] },
    { "id": "quiz-largo", "layout": "quiz", "notes": "Revela tras 30 s.", "elements": [],
      "quiz": { "question": "¿Cuál es más difícil de adivinar?", "options": ["P@ssw0rd!", "caballo-bateria-grapa-correcto"], "correctIndex": 1, "display": "secret", "timerSec": 30 } },
    { "id": "cierre", "notes": "Agradece y finaliza la sesión.", "elements": [
      { "id": "gracias", "type": "text", "box": { "x": 0.07, "y": 0.3, "w": 0.86, "h": 0.26 }, "text": "Gracias", "style": { "fontSize": 180, "fontWeight": 800, "font": "display", "align": "center", "valign": "middle" } }
    ] }
  ]
}
```

Then: `node bin/live-deck.ts validate contrasenas` → `OK Contraseñas seguras (4 slides, 1 quizzes)`.

## References

- `references/deck-format.md`: every field, allowed values and limits.
- `references/layout-recipes.md`: proven boxes for common slide types.
- `references/mcp.md`: why there is no MCP server and when one would be justified.
- Full example using every element type: `decks/demo/deck.json`. Schema source of truth: `shared/deck.ts`.
