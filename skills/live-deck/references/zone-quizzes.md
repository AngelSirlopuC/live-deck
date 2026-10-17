# Zone quizzes

A zone quiz turns an imported slide that is visibly designed as a question with options into a live quiz. The image stays as designed; Live Deck draws on top of each option's zone the vote fill, the percentage, the rank badge (1º, 2º…), the viewer's own vote and, after reveal, the green of the correct answer (wrong ones marked). Tapping a zone on the screen also votes. Phones, the presenter panel and the summary show the `question` and `options` text.

## JSON

```json
{ "id": "s07", "layout": "quiz", "notes": "Lee la pregunta en voz alta, espera 20 s y revela. Correcta: B (2009).",
  "background": { "image": "assets/slide-07.png" },
  "elements": [],
  "quiz": {
    "question": "¿En qué año se lanzó la primera versión de Node.js?",
    "options": ["2005", "2009", "2012"],
    "correctIndex": 1,
    "display": "live",
    "timerSec": 20,
    "zones": [
      { "x": 0.08, "y": 0.4, "w": 0.26, "h": 0.36 },
      { "x": 0.37, "y": 0.4, "w": 0.26, "h": 0.36 },
      { "x": 0.66, "y": 0.4, "w": 0.26, "h": 0.36 }
    ]
  } }
```

- `layout: "quiz"`, `elements: []`, `background: { "image": "assets/<file>" }` (the imported image; keep the path the import wrote).
- `quiz.question`, `quiz.options` (2–6), `quiz.correctIndex`, `quiz.display` (`"live"` or `"secret"`) are required as in any quiz; `timerSec` (5–600) is optional.
- `quiz.zones`: one `{ x, y, w, h }` per option.

## Rules

1. Exactly one zone per option, in option order: `zones[0]` is option A, `zones[1]` is B, and so on. `zones.length` must equal `options.length` (validation error at `quiz.zones`).
2. Boxes are normalized like element boxes: every value in 0..1, `x + w <= 1`, `y + h <= 1`.
3. A zone covers the whole clickable option area on the image (card, button or label with its letter) plus a small margin, about 0.005–0.01 on each side. Zones must not overlap each other.
4. Options never re-order on screen in zone mode: the overlays stay on their zones; `results: "ranking"` does not move them.
5. `question` and `options` must match the text on the image (same wording, same order, same letter or number), because phones show the text, not the image. Shorten only to fit the limits (question <= 300 chars, option <= 120) and keep the meaning.
6. Leave the bottom edge of the slide clear where possible: the votes/timer pill shows there.
7. The player does not draw the native question/options grid on a zone quiz; the image provides them.

## Measuring zones from an image

The import expects a 1920x1080 (16:9) export, so pixel coordinates map directly onto the canvas.

1. Open the image (`decks/<id>/assets/slide-NN.png`) and read its size; if it is not 1920x1080, use its real width `W` and height `H` (the import warned if it is not 16:9; ask for a re-export when the ratio is off).
2. For each option, find its pixel bounding box: left `px`, top `py`, right `px2`, bottom `py2`.
3. Convert: `x = px / W`, `y = py / H`, `w = (px2 - px) / W`, `h = (py2 - py) / H`.
4. Add the margin: subtract ~0.005–0.01 from `x` and `y`, add twice that to `w` and `h`, then clamp so `x, y >= 0` and `x + w <= 1`, `y + h <= 1`.
5. Round to 3 decimals and write the zones in option order.

Example: option B is a card from (980, 390) to (1800, 650) on a 1920x1080 image.

- `x = 980 / 1920 = 0.510`, `y = 390 / 1080 = 0.361`
- `w = 820 / 1920 = 0.427`, `h = 260 / 1080 = 0.241`
- With a 0.005 margin: `{ "x": 0.505, "y": 0.356, "w": 0.437, "h": 0.251 }` (`x + w = 0.942`, `y + h = 0.607`, inside the canvas).

Then validate and ask the user to open `/preview/<id>`: it draws a dashed outline with the option letter on every zone (only in the preview, never live). Adjust any zone that misses its option and validate again.

## Picking the correct answer

- Read it from the user's material: a marked answer on the slide, the speaker notes, an answer key, or the user's message.
- If it is not stated, ask the user which option is correct before finishing the deck. Never guess silently; if you must propose one, say so explicitly and get it confirmed.
- Put the answer in `notes` too (it is stripped before the deck reaches the audience, like `correctIndex`).

## When to use a native quiz instead

Insert a native quiz slide (recipe `quiz` in `layout-recipes.md`, no `zones`) when:

- no slide is designed as a quiz (there is no question with options on any image);
- the option text on the image is too small to read from the room or to measure reliably;
- the options are not visually separated (one paragraph, overlapping shapes, no clear area per option);
- there are more than 6 options, or the design hides which areas are the options.
