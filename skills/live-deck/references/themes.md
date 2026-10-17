# Theme presets

Set one with `"theme": { "preset": "<name>" }`. A preset brings colors, display/body/mono fonts, the default slide background, the card style used by `card: true`, the heading style and the donut palette. Exact values live in `shared/themes.ts`; this file is about when and how to use each one.

## Choose in one line

Decide from topic, audience and venue, then write one line: `Preset: <name>, because <topic/audience/venue reason>.`

| Topic / audience / venue | Preset |
| --- | --- |
| Tech talk, meetup, product demo, mixed audience | `estudio` |
| Culture, research, humanities, keynote with a story | `editorial` |
| Gaming, music, youth event, night event, dark auditorium | `neon` |
| School, workshop, community, craft, kids and families | `papel` |
| Design, manifesto, startup pitch, provocative opinion | `brutalista` |
| Business review, public sector, finance, bright projector room | `corporativo` |

Venue tiebreakers: a projector in a bright room washes out dark backgrounds and thin type, so prefer `papel` or `corporativo`; a dark auditorium or LED wall favors `neon` or `estudio`. When the user's brand has a color, keep the preset and override `accent` (and `background` only if the brand demands it).

## estudio

- Personality: calm, modern, confident. The safe default with character.
- Use for: tech, product, internal talks, mixed audiences, unknown venues.
- Avoid when: the topic needs warmth (kids, community) or strong opinion.
- Typography: clean geometric sans display, readable sans body, mono for kickers.
- Composition: dark field with a soft gradient; cards for grouped points; one accent color for kickers and numbers; `decor` rings or arc in a corner on openers; bar charts in accent.

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
- Use for: business reviews, public sector, finance, clients, bright projector rooms.
- Avoid when: the goal is to entertain or provoke.
- Typography: neutral sans display, medium weights (700 headings), no uppercase body.
- Composition: light background, accent used sparingly; charts and big-number cards carry the content; icon rows for processes; at most one `decor` (arc or dots) at low opacity on the opener and closing.

## Rules for every preset

- Do not hand-set `background`/`radius` on text cards; use `card: true` so the preset decides.
- Do not mix presets' looks: one accent, one display font, one card style per deck.
- Contrast first: text over images needs `dim` >= 0.4; small text never sits on decor.
