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

## closing

```json
[
  { "id": "thanks", "type": "text", "box": { "x": 0.07, "y": 0.3, "w": 0.86, "h": 0.26 }, "text": "Thank you", "style": { "fontSize": 180, "fontWeight": 800, "font": "display", "align": "center", "valign": "middle" } },
  { "id": "contact", "type": "text", "box": { "x": 0.07, "y": 0.6, "w": 0.86, "h": 0.1 }, "text": "name@example.com", "style": { "fontSize": 36, "color": "#9aa3b2", "align": "center" } }
]
```
