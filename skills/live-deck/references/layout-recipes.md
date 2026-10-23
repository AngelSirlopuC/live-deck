# Layout recipes

Boxes are normalized `{ x, y, w, h }` on a 16:9 canvas. Font sizes are logical px on 1920x1080. Side margins are 0.07; content width is 0.86. Copy a recipe, change ids and text, keep the geometry.

## title-qr (slide 1, required)

```json
[
  { "id": "kicker", "type": "text", "box": { "x": 0.07, "y": 0.14, "w": 0.5, "h": 0.06 }, "text": "EVENT · DATE", "style": { "fontSize": 30, "fontWeight": 700, "font": "mono", "color": "#ff7a45" } },
  { "id": "title", "type": "text", "box": { "x": 0.07, "y": 0.22, "w": 0.52, "h": 0.36 }, "text": "Title in up to eight words", "style": { "fontSize": 96, "fontWeight": 800, "font": "display", "lineHeight": 1.05 } },
  { "id": "subtitle", "type": "text", "box": { "x": 0.07, "y": 0.64, "w": 0.48, "h": 0.12 }, "text": "Scan the code to join.", "style": { "fontSize": 36, "color": "#9aa3b2", "lineHeight": 1.3 } },
  { "id": "qr", "type": "qr", "box": { "x": 0.64, "y": 0.16, "w": 0.29, "h": 0.68 }, "style": { "background": "#f4f1ea", "color": "#10131a" } }
]
```

## heading-bullets (fragments)

Heading at `{ x: 0.07, y: 0.1, w: 0.86, h: 0.14 }`, fontSize 80, weight 800, font display. Up to 4 bullets, `h: 0.14`, at `y` 0.32, 0.5, 0.68 (and 0.86 only with `h: 0.1`), fontSize 44, `fragment` 1..n.

## two-column

```json
[
  { "id": "h", "type": "text", "box": { "x": 0.07, "y": 0.1, "w": 0.86, "h": 0.14 }, "text": "Before vs after", "style": { "fontSize": 80, "fontWeight": 800, "font": "display" } },
  { "id": "left", "type": "text", "box": { "x": 0.07, "y": 0.3, "w": 0.4, "h": 0.56 }, "text": "Left column\nline two", "style": { "fontSize": 40, "lineHeight": 1.3, "background": "#1b2130", "radius": 24, "padding": 40 } },
  { "id": "right", "type": "text", "box": { "x": 0.53, "y": 0.3, "w": 0.4, "h": 0.56 }, "text": "Right column\nline two", "fragment": 1, "style": { "fontSize": 40, "lineHeight": 1.3, "background": "#1b2130", "radius": 24, "padding": 40 } }
]
```

## agenda (2x2 cards with fragments)

Heading as above. Cards `w: 0.4, h: 0.22` at (0.07, 0.32), (0.53, 0.32), (0.07, 0.6), (0.53, 0.6), `fragment` 1–4, style `{ "fontSize": 40, "lineHeight": 1.25, "background": "#1b2130", "radius": 24, "padding": 36 }`. Text pattern `"01\nShort point"`.

## big-number

```json
[
  { "id": "num", "type": "text", "box": { "x": 0.07, "y": 0.18, "w": 0.86, "h": 0.4 }, "text": "73 %", "style": { "fontSize": 260, "fontWeight": 800, "font": "display", "align": "center", "valign": "middle", "color": "#ff7a45" } },
  { "id": "label", "type": "text", "box": { "x": 0.15, "y": 0.62, "w": 0.7, "h": 0.16 }, "text": "of attendees check their phone in the first 10 minutes", "style": { "fontSize": 44, "align": "center", "lineHeight": 1.25 } }
]
```

## image-caption

```json
[
  { "id": "img", "type": "image", "box": { "x": 0.07, "y": 0.08, "w": 0.86, "h": 0.68 }, "src": "assets/photo.jpg", "alt": "Describe the image", "fit": "cover", "style": { "radius": 24 } },
  { "id": "caption", "type": "text", "box": { "x": 0.07, "y": 0.8, "w": 0.86, "h": 0.1 }, "text": "One-line caption", "style": { "fontSize": 36, "color": "#9aa3b2", "align": "center" } }
]
```

Image beside text: image `{ x: 0.53, y: 0.12, w: 0.4, h: 0.76 }`, text `{ x: 0.07, y: 0.12, w: 0.42, h: 0.76 }` with `valign: "middle"`.

## diagram (boxes and arrows)

Nodes `w: 0.22, h: 0.2` at `y: 0.42`, x 0.07 / 0.39 / 0.71, style `{ "align": "center", "valign": "middle", "radius": 28, "background": "#1b2130", "fontSize": 40 }`. Arrows are `shape: "line"` with `h: 0` between them, e.g. `{ "x": 0.3, "y": 0.52, "w": 0.09, "h": 0 }`, style `{ "stroke": "#9aa3b2", "strokeWidth": 6 }`.

## quiz

```json
{ "id": "quiz-1", "layout": "quiz", "notes": "…", "elements": [],
  "quiz": { "question": "…?", "options": ["A", "B", "C", "D"], "correctIndex": 2, "display": "live" } }
```

The player renders question, options, bars and timer; do not add elements.

## ask (open question)

```json
{ "id": "pregunta-1", "layout": "ask", "notes": "…", "elements": [],
  "ask": { "question": "¿Qué palabra describe tu semana?", "maxChars": 30 } }
```

The player renders the question and the grouped answers (`×N` on repeats); do not add elements. Ask for one to three words, never a sentence.

## closing

```json
[
  { "id": "thanks", "type": "text", "box": { "x": 0.07, "y": 0.3, "w": 0.86, "h": 0.26 }, "text": "Thank you", "style": { "fontSize": 180, "fontWeight": 800, "font": "display", "align": "center", "valign": "middle" } },
  { "id": "contact", "type": "text", "box": { "x": 0.07, "y": 0.6, "w": 0.86, "h": 0.1 }, "text": "name@example.com", "style": { "fontSize": 36, "color": "#9aa3b2", "align": "center" } }
]
```

## Recipes with rich elements

These assume a `theme.preset`. They set no colors on purpose: the preset supplies fonts, card style and palette. Recipes that need a slide `background` are shown as whole slides; change `id`, texts and `notes`. Icons and decor draw in element order, so decor goes first.

### hero-gradient (opener; keeps the slide-1 QR)

```json
{ "id": "hero-gradient", "notes": "Welcome; ask everyone to scan the QR.",
  "background": { "gradient": { "from": "#1b1f3a", "to": "#0b0d12", "angle": 135 } },
  "elements": [
    { "id": "decor", "type": "decor", "shape": "rings", "box": { "x": 0.0, "y": 0.55, "w": 0.26, "h": 0.45 }, "style": { "opacity": 0.25 } },
    { "id": "kicker", "type": "text", "box": { "x": 0.07, "y": 0.14, "w": 0.5, "h": 0.06 }, "text": "Event · date", "style": { "fontSize": 30, "fontWeight": 700, "font": "mono", "uppercase": true, "tracking": 0.12 } },
    { "id": "title", "type": "text", "box": { "x": 0.07, "y": 0.22, "w": 0.52, "h": 0.36 }, "text": "Title in up to eight words", "style": { "fontSize": 100, "fontWeight": 800, "font": "display", "lineHeight": 1.02, "tracking": -0.02 } },
    { "id": "qr", "type": "qr", "box": { "x": 0.64, "y": 0.16, "w": 0.29, "h": 0.68 }, "style": { "background": "#f4f1ea", "color": "#10131a" } }
  ] }
```

Pick gradient stops near the preset background (dark presets: two darks; light presets: two lights). Remove the `qr` only when this is not slide 1.

### icon-row (3–4 ideas)

Columns `w: 0.185` at x 0.07 / 0.295 / 0.52 / 0.745; icons `w: 0.08, h: 0.142` centered in each column. For 3 items use columns `w: 0.26` at x 0.07 / 0.37 / 0.67 and icons at x 0.16 / 0.46 / 0.76.

```json
[
  { "id": "h", "type": "text", "box": { "x": 0.07, "y": 0.1, "w": 0.86, "h": 0.14 }, "text": "Four habits", "style": { "fontSize": 80, "fontWeight": 800, "font": "display" } },
  { "id": "i1", "type": "icon", "name": "lightbulb", "box": { "x": 0.1225, "y": 0.36, "w": 0.08, "h": 0.142 }, "fragment": 1 },
  { "id": "l1", "type": "text", "box": { "x": 0.07, "y": 0.55, "w": 0.185, "h": 0.2 }, "text": "Short label", "fragment": 1, "style": { "fontSize": 36, "align": "center", "lineHeight": 1.25 } },
  { "id": "i2", "type": "icon", "name": "users", "box": { "x": 0.3475, "y": 0.36, "w": 0.08, "h": 0.142 }, "fragment": 2 },
  { "id": "l2", "type": "text", "box": { "x": 0.295, "y": 0.55, "w": 0.185, "h": 0.2 }, "text": "Short label", "fragment": 2, "style": { "fontSize": 36, "align": "center", "lineHeight": 1.25 } },
  { "id": "i3", "type": "icon", "name": "shield-check", "box": { "x": 0.5725, "y": 0.36, "w": 0.08, "h": 0.142 }, "fragment": 3 },
  { "id": "l3", "type": "text", "box": { "x": 0.52, "y": 0.55, "w": 0.185, "h": 0.2 }, "text": "Short label", "fragment": 3, "style": { "fontSize": 36, "align": "center", "lineHeight": 1.25 } },
  { "id": "i4", "type": "icon", "name": "rocket", "box": { "x": 0.7975, "y": 0.36, "w": 0.08, "h": 0.142 }, "fragment": 4 },
  { "id": "l4", "type": "text", "box": { "x": 0.745, "y": 0.55, "w": 0.185, "h": 0.2 }, "text": "Short label", "fragment": 4, "style": { "fontSize": 36, "align": "center", "lineHeight": 1.25 } }
]
```

### big-number-card

```json
[
  { "id": "card", "type": "text", "box": { "x": 0.07, "y": 0.16, "w": 0.5, "h": 0.68 }, "text": "73 %", "style": { "fontSize": 220, "fontWeight": 800, "font": "display", "align": "center", "valign": "middle", "card": true, "tracking": -0.03 } },
  { "id": "label", "type": "text", "box": { "x": 0.62, "y": 0.16, "w": 0.31, "h": 0.68 }, "text": "of attendees check their phone in the first 10 minutes", "style": { "fontSize": 44, "lineHeight": 1.25, "valign": "middle" } }
]
```

### chart-bar

```json
[
  { "id": "h", "type": "text", "box": { "x": 0.07, "y": 0.08, "w": 0.86, "h": 0.12 }, "text": "Answers per minute", "style": { "fontSize": 72, "fontWeight": 800, "font": "display" } },
  { "id": "chart", "type": "chart", "kind": "bar", "box": { "x": 0.07, "y": 0.26, "w": 0.6, "h": 0.64 }, "unit": "%",
    "data": [ { "label": "Q1", "value": 42 }, { "label": "Q2", "value": 58 }, { "label": "Q3", "value": 71 }, { "label": "Q4", "value": 64 } ] },
  { "id": "takeaway", "type": "text", "box": { "x": 0.71, "y": 0.26, "w": 0.22, "h": 0.64 }, "text": "Q3 peaked after the live quiz", "fragment": 1, "style": { "fontSize": 40, "lineHeight": 1.25, "valign": "middle" } }
]
```

### chart-donut

```json
[
  { "id": "h", "type": "text", "box": { "x": 0.07, "y": 0.08, "w": 0.86, "h": 0.12 }, "text": "Where time goes", "style": { "fontSize": 72, "fontWeight": 800, "font": "display" } },
  { "id": "chart", "type": "chart", "kind": "donut", "box": { "x": 0.17, "y": 0.24, "w": 0.66, "h": 0.68 }, "unit": " h",
    "data": [ { "label": "Meetings", "value": 12 }, { "label": "Focus work", "value": 18 }, { "label": "Email", "value": 6 } ] }
]
```

### quote-mark

```json
[
  { "id": "decor", "type": "decor", "shape": "squiggle", "box": { "x": 0.07, "y": 0.12, "w": 0.16, "h": 0.12 }, "style": { "opacity": 0.6 } },
  { "id": "quote", "type": "text", "box": { "x": 0.07, "y": 0.28, "w": 0.78, "h": 0.4 }, "text": "The best slide is the one the audience remembers", "style": { "fontSize": 84, "fontWeight": 700, "font": "display", "lineHeight": 1.1, "tracking": -0.02, "mark": true } },
  { "id": "author", "type": "text", "box": { "x": 0.07, "y": 0.74, "w": 0.6, "h": 0.08 }, "text": "— Author, role", "style": { "fontSize": 34, "font": "mono" } }
]
```

`mark` highlights the whole text element: keep the quote short (<= 12 words) or split the key phrase into its own element.

### section-break (one word)

```json
{ "id": "section-break", "notes": "Pause; announce the new part.",
  "background": { "image": "assets/section.jpg", "dim": 0.55 },
  "elements": [
    { "id": "word", "type": "text", "box": { "x": 0.07, "y": 0.3, "w": 0.86, "h": 0.4 }, "text": "Practice", "style": { "fontSize": 220, "fontWeight": 800, "font": "display", "align": "center", "valign": "middle", "uppercase": true, "tracking": -0.02, "color": "#ffffff" } }
  ] }
```

Without a photo use `"background": { "color": "#0b0d12", "pattern": "grid" }` (pick a color from the preset world) and drop the `color` override on the text. `assets/section.jpg` must exist in `decks/<id>/assets/`.

## Imported designed slides

Slides imported with `live-deck import` are whole images designed in another tool. Do not place text over them; add only notes, the slide-1 `qr`, or turn a designed question into a zone quiz (`zone-quizzes.md`).

### imported-slide

```json
{ "id": "s02", "notes": "Explica el diagrama de izquierda a derecha y pregunta quién lo ha usado.",
  "background": { "image": "assets/slide-02.png" },
  "elements": [] }
```

Slide 1 also carries the join QR on top of the image. The import places it bottom-right on a white tile; keep the box the CLI wrote and edit it only to move the QR off important content (example geometry):

```json
{ "id": "s01", "notes": "Da la bienvenida y pide que escaneen el QR.",
  "background": { "image": "assets/slide-01.png" },
  "elements": [
    { "id": "qr", "type": "qr", "box": { "x": 0.81, "y": 0.66, "w": 0.16, "h": 0.3 }, "style": { "background": "#ffffff", "color": "#000000" } }
  ] }
```

### zone-quiz (2x2 designed options)

Fits a typical designed quiz: question across the top, four option cards in a 2x2 grid. Measure the real zones from the image before using it; these boxes are only a starting point.

```json
{ "id": "s05", "layout": "quiz", "notes": "Deja 30 s y revela. La correcta es la C: el sol.",
  "background": { "image": "assets/slide-05.png" },
  "elements": [],
  "quiz": {
    "question": "¿Cuál es la principal fuente de energía de la Tierra?",
    "options": ["El viento", "El petróleo", "El sol", "El núcleo terrestre"],
    "correctIndex": 2,
    "display": "secret",
    "timerSec": 30,
    "zones": [
      { "x": 0.06, "y": 0.34, "w": 0.43, "h": 0.25 },
      { "x": 0.51, "y": 0.34, "w": 0.43, "h": 0.25 },
      { "x": 0.06, "y": 0.62, "w": 0.43, "h": 0.25 },
      { "x": 0.51, "y": 0.62, "w": 0.43, "h": 0.25 }
    ]
  } }
```

Zones follow option order (A top-left, B top-right, C bottom-left, D bottom-right here). Keep the bottom ~8% free: the votes/timer pill shows there.
