# Theme presets

Set one with `"theme": { "preset": "<name>", "mode": "light" | "dark" }`. A preset brings colors, display/body/mono fonts, the default slide background, the card style used by `card: true`, the heading style and the donut palette. Exact values live in `shared/themes.ts`; this file is about when and how to use each one.

## Choose in one line

Decide from topic, audience and venue, then write one line: `Preset: <name>, mode: <light|dark>, because <topic/audience/venue reason>.`

Always choose the mode explicitly. Never default to dark: it is the right call only for a dark auditorium, an LED wall, an evening or gaming event, or when the user asks for it.

| Topic / audience / venue | Preset |
| --- | --- |
| Tech talk, meetup, product demo, mixed audience | `estudio` |
| Culture, research, humanities, keynote with a story | `editorial` |
| Gaming, music, youth event, night event, dark auditorium | `neon` |
| School, workshop, community, craft, kids and families | `papel` |
| Design, manifesto, startup pitch, provocative opinion | `brutalista` |
| Business review, public sector, finance, bright projector room | `corporativo` |

## Light or dark

Every preset has both modes. Without `mode` a preset keeps its original look (`estudio`, `neon` and `corporativo` are dark; `editorial`, `papel` and `brutalista` are light), so always write `mode`.

| Situation | Mode |
| --- | --- |
| Daytime room, classroom, office, projector with lights on, unknown venue | `light` |
| Slides shared as a PDF or read on laptops | `light` |
| Dark auditorium, stage with an LED wall, evening event, cinema | `dark` |
| Gaming, music, night culture, the user asks for dark | `dark` |

A projector in a bright room washes out dark backgrounds and thin type: that is why `light` is the default for unknown venues. When the user's brand has a color, keep the preset and override `accent` (and `background` only if the brand demands it).

## estudio

- Personality: calm, modern, confident. The safe default with character.
- Use for: tech, product, internal talks, mixed audiences, unknown venues.
- Avoid when: the topic needs warmth (kids, community) or strong opinion.
- Typography: clean geometric sans display, readable sans body, mono for kickers.
- Composition: soft gradient field (warm paper in `light`, charcoal in `dark`); cards for grouped points; one accent color for kickers and numbers; `decor` rings or arc in a corner on openers; bar charts in accent.

## editorial

- Personality: magazine, thoughtful, literary.
- Use for: storytelling, research findings, culture, history, keynotes.
- Avoid when: the room is noisy and the talk is fast; dense data dashboards.
- Typography: serif display with tight tracking (`tracking: -0.02`), sans body, italic for quotes.
- Composition: generous whitespace, text left-aligned in narrow columns (`w` 0.5–0.6); thin `shape: "line"` hairline rules (strokeWidth 2) above sections; big pull quotes with `mark` on one phrase; few cards; images full-bleed with `dim` on section breaks.

## neon

- Personality: electric, nocturnal, energetic.
- Use for: gaming, music, youth audiences, hackathons, evening events, dark auditoriums.
- Avoid when: bright rooms, formal or sensitive topics, long reading.
- Typography: bold wide display, often `uppercase` with open tracking (0.05–0.1) on short labels.
- Composition: near-black background with glowing accent; `pattern: "grid"` on section breaks; big numbers in accent; `decor` star or squiggle at low opacity (0.2–0.4); short text only.

## papel

- Personality: warm, handmade, friendly.
- Use for: schools, workshops, community and NGO talks, families, bright rooms.
- Avoid when: the audience expects corporate polish or the room is very dark.
- Typography: rounded or humanist display, relaxed line height (1.3+), sentence case.
- Composition: light paper background with `pattern: "noise"` or `"dots"`; `card: true` notes; icon rows with labels; `decor` blob or squiggle in accent; donut charts read well here.

## brutalista

- Personality: raw, loud, opinionated.
- Use for: design talks, manifestos, pitches, contrarian opinions, short punchy decks.
- Avoid when: sensitive topics, older or formal audiences, long explanations.
- Typography: heavy display in `uppercase`, tight tracking (-0.02 to 0) at big sizes; mono for labels.
- Composition: thick-bordered cards (`card: true`), hard shadows, flat colors, yellow `mark` highlight on the key phrase, `decor` grid or star; asymmetric boxes are fine as long as alignment is deliberate.

## corporativo

- Personality: clear, trustworthy, restrained.
- Use for: business reviews, public sector, finance, clients. In bright projector rooms use `"mode": "light"` (white ground, navy type); the original look is navy.
- Avoid when: the goal is to entertain or provoke.
- Typography: neutral sans display, medium weights (700 headings), no uppercase body.
- Composition: accent used sparingly; charts and big-number cards carry the content; icon rows for processes; at most one `decor` (arc or dots) at low opacity on the opener and closing.

## Rules for every preset

- Do not hand-set `background`/`radius` on text cards; use `card: true` so the preset decides.
- Do not mix presets' looks: one accent, one display font, one card style per deck.
- Contrast first: text over images needs `dim` >= 0.4; small text never sits on decor.

## Custom theme from the prompt

When the user describes a look ("colores de mi marca", "estilo revista de moda", "minimalista y blanco", "como una pizarra", "retro de los 80") or none of the six worlds fits, build the theme instead of forcing a preset. Write it as data, never CSS:

```json
"theme": {
  "preset": "editorial",
  "mode": "light",
  "background": "#fbf7f0", "foreground": "#1d1a16", "accent": "#c2410c", "muted": "#6b6259", "surface": "#f1e9dc",
  "fonts": { "display": "Fraunces", "body": "Instrument Sans" },
  "card": { "radius": 6, "border": "hairline", "shadow": "none" },
  "heading": { "weight": 800, "uppercase": false, "tracking": -0.02 },
  "art": { "kind": "glow" },
  "pattern": "none",
  "palette": ["#c2410c", "#0f766e", "#7c3aed", "#b45309"]
}
```

Steps:

1. Start from the closest preset (it supplies everything you do not set) and pick the mode with the table above. Without a preset, `background`, `foreground` and `accent` are required.
2. Colors: one accent, a ground, a text color and a muted color. Derive them from the brand or the mood in the prompt. Contrast rules, checked by `validate` as `warning:` lines: text on ground ≥ 4.5:1 (aim for 7:1), muted ≥ 3:1 (aim for 4.5:1), accent ≥ 3:1, every palette color ≥ 3:1 on the ground.
3. Fonts: pick `display` and `body` only from this list (anything else is rejected):
   - grotesk: Bricolage Grotesque, Instrument Sans, Inter Tight, Space Grotesk, Archivo
   - humanist: Plus Jakarta Sans, Manrope · rounded: Nunito, Fredoka · geometric: Outfit
   - condensed: Oswald, Barlow Condensed · display: Unbounded, Syne
   - serif: Fraunces, Playfair Display, Newsreader, Lora · slab: Roboto Slab
   - mono: JetBrains Mono, IBM Plex Mono, Space Mono, Courier Prime · hand: Caveat (short labels only)

   Pair a characterful display with a calm body; never two display faces. Mono and hand faces are for display accents, not body text.
4. `card`: `radius` 0–64 (px on the 1920 canvas), `border` `none` | `hairline` | `thick`, `shadow` `none` | `soft` | `hard` (`thick` + `hard` reads brutalist).
5. `heading`: `weight` 400–900, `uppercase`, `tracking` −0.05 to 0.2.
6. `art`: `{ "kind": "none" }`, `{ "kind": "glow" }` (soft accent light in a corner) or `{ "kind": "gradient", "from": "#…", "to": "#…", "angle": 135 }`. `pattern`: `none`, `dots`, `grid`, `lines` or `noise`.
7. `palette`: 3–8 chart colors, the accent first.

State the choice in one line, as with presets: `Theme: custom from editorial light — cream ground, rust accent, Fraunces titles, because <prompt reason>.` The user can fine-tune any of it later in the editor's Diseño panel.
