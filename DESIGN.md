---
name: Live Deck
description: Live, two-way presentation player whose chrome is a radio studio desk around the slide that is on air.
colors:
  well: "#0f0c09"
  bg: "#14110d"
  desk: "#1f1a14"
  panel: "#2a241c"
  panel-hi: "#352d23"
  seam: "#3e3529"
  text: "#efe4cc"
  text-muted: "#b3a68b"
  amber: "#ffb547"
  amber-hi: "#ffc76d"
  amber-edge: "#c98a2a"
  amber-ink: "#241805"
  onair: "#ff3b2f"
  onair-ink: "#fff6f4"
  signal: "#5fd38d"
  danger: "#e2574c"
  danger-soft: "#ffb3ab"
typography:
  display:
    fontFamily: "Bricolage Grotesque, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2rem, 8vw, 2.8rem)"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Bricolage Grotesque, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.45rem"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Instrument Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  legend:
    fontFamily: "Oswald, Arial Narrow, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 500
    letterSpacing: "0.12em"
  key:
    fontFamily: "Oswald, Arial Narrow, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 500
    letterSpacing: "0.08em"
  numeral:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "0.85rem"
    fontWeight: 500
    fontFeature: "tnum"
  timer:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "2rem"
    fontWeight: 700
    fontFeature: "tnum"
rounded:
  lamp: "6px"
  chip: "8px"
  key: "10px"
  card: "12px"
  switch: "14px"
  panel: "16px"
  sheet: "18px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  xxl: "32px"
components:
  key:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    typography: "{typography.key}"
    rounded: "{rounded.key}"
    padding: "0 18px"
    height: "48px"
  key-primary:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.amber-ink}"
    typography: "{typography.key}"
    rounded: "{rounded.key}"
    padding: "0 18px"
    height: "48px"
  key-onair:
    backgroundColor: "{colors.onair}"
    textColor: "{colors.onair-ink}"
    typography: "{typography.key}"
    rounded: "{rounded.key}"
    padding: "0 18px"
    height: "48px"
  key-danger:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.danger-soft}"
    typography: "{typography.key}"
    rounded: "{rounded.key}"
    height: "48px"
  key-ghost:
    textColor: "{colors.text-muted}"
    typography: "{typography.key}"
    rounded: "{rounded.key}"
    height: "48px"
  key-transport:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.amber-ink}"
    rounded: "{rounded.key}"
    height: "56px"
  lamp:
    backgroundColor: "{colors.well}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.lamp}"
    padding: "5px 12px 5px 10px"
  switch:
    backgroundColor: "{colors.well}"
    rounded: "{rounded.switch}"
    padding: "5px"
  input:
    backgroundColor: "{colors.well}"
    textColor: "{colors.text}"
    rounded: "{rounded.key}"
    padding: "0 16px"
    height: "52px"
  vote:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.card}"
    padding: "8px 14px 8px 8px"
    height: "56px"
  vote-selected:
    backgroundColor: "#3a2d1a"
    textColor: "{colors.text}"
  panel-card:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.key}"
    padding: "12px"
  sheet:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.sheet}"
    padding: "24px 20px 20px"
---

# Design System: Live Deck

## Overview

**Creative North Star: "The On-Air Desk"** (from the direction contract: Estudio de radio "Al aire")

The slide is what is on air; everything around it is a console. The chrome is a warm charcoal studio desk with recessed wells, engraved cream legends, backlit amber keys, and one red ON AIR lamp that tells the room whether it is live. It refuses the generic floating-toolbar app: controls are physical keys sitting on a desk, not chips hovering over content.

Density is operator-grade but quiet. The audience phone stacks lamp and title strip, the 16:9 slide, a two-position En vivo / Explorar switch, then the participation panel; landscape gives the slide the whole screen and the desk appears on tap. The presenter console puts the program monitor left, the next-slide monitor, meters and notes right, and transport keys on a bottom desk with Finalizar set apart. Slides render in each deck's own theme and are outside this system; the chrome must never fight a deck.

Signature motion is the lamp warming up when the session goes live (900ms brightness surge plus red glow) and dimming when the user leaves for Explorar. Keys travel down on press with an inner shadow. Everything collapses to near-instant under reduced motion.

**Key Characteristics:**
- Warm charcoal tonal stack (well < bg < desk < panel < panel-hi) instead of shadows for structure.
- Condensed uppercase Oswald legends on every key, lamp, and section label.
- Color is semantic: red means live, amber means active or primary, green means correct, connected, or next.
- Monospace exists for numerals only, with tabular figures.
- Large tap targets: keys are never shorter than 48px on the audience surface.

## Colors

A warm, low-light desk palette where three backlit signal colors each carry exactly one meaning.

### Primary
- **Backlit Amber** (amber): active and primary state. Primary keys, the pressed side of the switch, selected votes, the focus ring, text selection, caret, timer, ranks, chat names, quiz bars, and the standby lamp. Keys light with a gradient from Amber Highlight (amber-hi) at the top to amber, edged in Amber Bezel (amber-edge), with Amber Ink (amber-ink) legends.

### Secondary
- **ON AIR Red** (onair): live status only. The lit lamp, the Iniciar key, the En vivo side of the switch when pressed, and the red tally ring on the program monitor. Legends on red use ON AIR Ink (onair-ink).

### Tertiary
- **Signal Green** (signal): correct answers, the connected-audience dot, the answer marker on the presenter's quiz bars, and the green tally on the next-slide monitor.
- **Fault Red** (danger): destructive actions (Finalizar, Borrar datos) and wrong answers, always as a border tint mixed into the seam, never a filled key. Its readable foreground is Fault Blush (danger-soft), used for danger key legends, form and chat errors, and the bad-answer result line.

### Neutral
- **Recessed Well** (well): the darkest inset surface: lamp housing, switch tray, inputs, meters, vote and reaction keycaps, quiz bar tracks, code blocks.
- **Studio Black** (bg): page background and the top and transport bars.
- **Desk Charcoal** (desk): the audience app, console, and remote body.
- **Console Panel** (panel): cards, notes, sheets, leaderboard rows; the lower stop of the key gradient.
- **Raised Panel** (panel-hi): the upper stop of the key gradient and pressed reaction keys.
- **Seam** (seam): every 1px border, divider, and scrollbar thumb.
- **Engraved Cream** (text): primary text, and the light card behind QR codes.
- **Worn Legend** (text-muted): legends, secondary copy, inactive switch side, counts at rest.

### Named Rules
**The One Lamp Rule.** ON AIR Red (#ff3b2f) means "this is live" and nothing else. Destructive actions use Fault Red as a tinted border, never the lamp red as a fill.

**The Backlit Key Rule.** Amber is the only color for "active" and "primary." If a key is pressed, selected, or the main action, it is amber; nothing else lights up.

**The Green Means Good Rule.** Signal Green is reserved for correct, connected, and next; it never decorates.

## Typography

**Display Font:** Bricolage Grotesque (with ui-sans-serif, system-ui)
**Body Font:** Instrument Sans (with ui-sans-serif, system-ui)
**Legend Font:** Oswald (with Arial Narrow)
**Numeral Font:** JetBrains Mono (with ui-monospace)

**Character:** Engraved hardware legends in condensed caps over a friendly, readable grotesque body; Bricolage at heavy weight gives page titles a poster voice without leaving the desk.

### Hierarchy
- **Display** (800, clamp(2rem, 8vw, 2.8rem), 1.02, -0.03em, balanced wrap): join, home, closed, and waiting-room titles; the end-of-session panel title at 2.2rem.
- **Headline** (Bricolage, 1.45rem, 1.15, -0.02em): sheet titles. The console deck title uses Bricolage at 1.1rem.
- **Body** (Instrument Sans 400 to 600, 1rem, 1.4 to 1.5): copy, chat, notes (1.1rem, 1.5), vote labels (600, 1.02rem), inputs (500, 1.1rem).
- **Legend** (Oswald 500, 0.75 to 0.8rem, 0.12 to 0.14em, uppercase): section labels (Chat, Ranking, Notas, Audiencia), field labels, monitor labels, lamp text (600, 0.78rem, 0.14em).
- **Key** (Oswald 500, 0.95rem, 0.08em, uppercase; 600 on primary and on-air keys): every key legend. Compact desks step down to 0.75 to 0.82rem.
- **Numeral** (JetBrains Mono 500 to 700, 0.85rem, tabular): audience count, slide position, vote shares, ranks, scores, vote key letters, session code. The console timer is 2rem at 700 in amber.

### Named Rules
**The Numerals-Only Mono Rule.** Mono is for numbers and number-like codes: counts, timers, scores, ranks, slide positions, session codes. Words in a status line stay in the body face with tabular figures; when a line mixes both, only the number span is mono.

**The Engraved Legend Rule.** Every label that names a control or a section is an Oswald uppercase legend. Legends label; they never sit above a headline as decoration.

## Layout

Phone portrait first. The audience app is a four-row grid: title bar (lamp, title, count, share), 16:9 stage, controls desk (switch, explore nav, reactions), scrolling participation panel. Bars sit on Studio Black with a seam rule; the desk and panel sit on Desk Charcoal.

- **Landscape phone (orientation landscape, max-height 560px):** the stage fills the screen on black; bar and controls overlay top and bottom on an opaque Studio Black desk, hidden until tap, fading and sliding 8px in over 220ms. The participation panel hides.
- **Wide audience (min-width 900px, min-height 561px):** slide left, a 360px desk column right for controls and panel.
- **Presenter console:** bar, body, transport rows. Body is program monitor plus a desk of auto-fit cards (min 260px) on the left, and a right column (min 300px, 30%) of next-slide monitor, meters, and notes. Below 900px it stacks to one column. Transport keys are 56px tall, at least 140px wide, with a 32px gap isolating Finalizar.
- **Centered pages** (join, home, closed): one left-aligned column, max 460px, vertically centered, 20px gaps.
- **Phone remote:** preview, scrolling notes, then a 1:2 transport row of 72px keys.

Spacing runs on a 6/8/12/16/20/32px rhythm; panels pad 12 to 16px, sheets 24/20px. All edges respect safe-area insets.

## Elevation & Depth

Depth is tonal first: surfaces step from the Recessed Well up through bg, desk, panel, and panel-hi, and every edge is a 1px seam. Shadows appear only where the desk is physical: keys rise off it, wells sink into it, sheets float above it, and lit things glow.

### Shadow Vocabulary
- **Key travel** (`box-shadow: 0 2px 0 #0a0806, 0 4px 10px -4px rgb(0 0 0 / 0.6), inset 0 1px 0 rgb(255 255 255 / 0.07)`): the solid 2px skirt is the key's physical edge on the desk, paired with a soft drop and a top highlight. Keys and votes only.
- **Key pressed** (`box-shadow: inset 0 2px 6px rgb(0 0 0 / 0.5)` with `transform: translateY(2px)`): the key bottoms out. The contract specified 1px of travel; the build ships 2px.
- **Well** (`box-shadow: inset 0 2px 4px rgb(0 0 0 / 0.5)`): inputs sit recessed in the desk.
- **Sheet** (`box-shadow: 0 24px 60px -12px rgb(0 0 0 / 0.75)`) over a `rgb(8 6 4 / 0.7)` backdrop with 2px blur.
- **Lamp glow** (`box-shadow: 0 0 22px -4px` ON AIR Red at 70%): only on the lit lamp.
- **Monitor tally** (`box-shadow: 0 0 0 2px`): ON AIR Red at 45% on the program monitor, Signal Green at 40% on the next-slide monitor.

### Named Rules
**The Physical Desk Rule.** A shadow must correspond to a physical behavior: a key that travels, a well that recesses, a sheet that lifts, or a lamp that glows. Cards and panels stay flat with a seam border.

## Shapes

Softly machined corners, tightening as objects get smaller: 6px lamps and overlay notices, 8px code blocks and leaderboard rows, 10px keys, inputs, monitors, and desk cards, 12px votes, reaction keys, and waiting-room cards, 14px the switch tray and QR card, 16px the end panel, 18px sheets. Circles are reserved for lamp and status LEDs. Every surface has a 1px seam border; dashed borders mean an empty slot (last slide) or a selection region.

## Components

### Buttons (Keys)
Backlit hardware keys: tactile, legible, never floating.
- **Shape:** gently machined (10px), min-height 48px, 18px side padding; icon keys are 48px square with 22px icons.
- **Default:** Raised Panel to Console Panel gradient, seam border, cream Oswald legend.
- **Primary:** amber-hi to amber gradient, Amber Bezel border, Amber Ink legend at 600.
- **On air:** lamp-red gradient, ON AIR Ink legend; only for starting the broadcast.
- **Danger:** default body with a Fault Blush legend and a fault-tinted border.
- **Ghost:** transparent, no shadow, Worn Legend text; for cancel and secondary choices.
- **Hover / Focus / Active:** hover brightens 12%; focus is a 3px amber outline at 2px offset; active travels 2px down and swaps to the inset shadow over 80ms. Disabled drops to 42% opacity.
- **Transport:** 56px tall, at least 140px wide on the console; 72px on the remote.

### Two-Position Switch
A recessed Well tray (14px, 5px padding) holding two keys. The pressed side lights: amber for Explorar, ON AIR Red for En vivo. The unpressed side is a ghost key. Each side carries a stroke icon and an uppercase legend.

### ON AIR Lamp
A well-housed status pill (6px) with a 9px LED and an Oswald caps label. **Off:** dark LED, muted text ("Fuera del aire", "Sin señal", "Explorando"). **Standby:** amber LED, cream text ("En espera", "Conectando"). **On:** red LED with glow, blush text, red-tinted border, and the 900ms warm-up. The lamp is the only red status signal on the audience surface.

### Inputs / Fields
- **Style:** Recessed Well, seam border, 10px, 52px tall, 16px padding, Instrument Sans 500 at 1.1rem, inset well shadow, amber caret.
- **Focus:** 2px amber outline, 1px offset.
- **Error:** Fault Blush message line below, reserving its height so the form does not jump.
- **Label:** a legend above, with an optional muted hint.

### Cards / Containers
- **Corner Style:** 10px for desk cards (quiz, audience, notes) and chat message highlights, 12px for waiting-room cards, 16px end panel.
- **Background:** Console Panel; meters and code blocks use the Recessed Well.
- **Shadow Strategy:** flat; see The Physical Desk Rule.
- **Border:** 1px seam; "mine" and current-user rows switch the border to Amber Bezel.
- **Internal Padding:** 12 to 14px.

### Vote Keys
The audience's quiz answers as physical keys: 56px, 12px corners, a 40px Well keycap with an amber mono letter, label in body 600, share in mono on the right. Selected: Amber Bezel border, dark amber gradient, lit amber keycap. Correct: green-tinted border and gradient with a Signal Green keycap. Wrong: fault-tinted border.

### Monitors
Program and next-slide monitors on the console: legend label above, 16:9 host with 10px corners and a seam border. Program carries the red tally ring, next carries the green tally ring.

### Chat Log
The chat is a running log, not a stack of cards. Each message is a borderless row: amber sender name, JetBrains Mono 24-hour time (0.72rem, muted), body text below. Follow-up messages from the same sender within three minutes drop the name line and read as one turn. The viewer's own turn reads "Tú" on an amber wash (amber at 9% over the panel), never an amber border. The list fades under the header with a mask instead of clipping. Presenter moderation is a pair of 32px icon keys (trash, mute) on a lifted chip at the message's top-right, shown on hover or focus on pointer devices and always on touch; hover tints them Fault Red. Empty and closed states are centered notes; a closed audience chat shrinks its sheet to fit. A "Mensajes nuevos" amber pill appears when a message arrives while the reader is scrolled up. On wide audience screens (900px and up, once the talk is live) the chat docks at the bottom of the side column (280 to 320px wide) and the header chat key hides; phones keep the sheet.

### Sheets
Bottom sheets on phones (centered from 700px): 18px corners, Console Panel, Bricolage headline, muted copy, a row of flexible keys, and an icon close key top right. Enter by sliding 24px up over 280ms.

### Icons
One inline stroke family: 24px grid, 2px stroke, round joins, drawn at 20px (22px in icon keys). Never icon fonts or glyph characters.

## Do's and Don'ts

### Do:
- **Do** keep the slide on black and let the deck theme own everything inside the 16:9 frame.
- **Do** reserve ON AIR Red (#ff3b2f) for the lit lamp, the Iniciar key, the pressed En vivo switch, and the program tally.
- **Do** use amber for every active, selected, or primary control and for standby states.
- **Do** use Signal Green only for correct answers, connection, and the next-slide tally.
- **Do** set every key, lamp, and section label as an uppercase Oswald legend.
- **Do** set numerals in JetBrains Mono with tabular figures, and keep words in the body face.
- **Do** keep audience tap targets at 48px or taller and respect safe-area insets.
- **Do** give every shadow a physical reason: key travel, recessed well, lifted sheet, or lamp glow.

### Don't:
- **Don't** use ON AIR Red for errors, destructive actions, or decoration.
- **Don't** fill a destructive key with red; tint its border and legend instead.
- **Don't** set words, labels, or sentences in mono.
- **Don't** float control toolbars over the slide; landscape controls sit on an opaque desk bar. Only transient notices and the projector reaction counter overlay the slide.
- **Don't** add shadows to flat cards and panels; separate them with tone and a seam.
- **Don't** put a legend above a headline as a decorative kicker.
