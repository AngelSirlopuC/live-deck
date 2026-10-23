# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Framework-free TypeScript + CSS on Vite (client) and Node with `ws` (server), matching the owner's existing `topo-web` toolchain. Chosen during planning; confirmed by the user when the plan was approved.

## Users

- **Presenters** (open product, any field: teachers, speakers, companies): run a talk from a laptop console, a projector tab, and optionally a phone remote. Job: keep the room engaged without losing control of the flow.
- **Audience members**: join from their own phone by scanning a QR, with a first name or anonymously. Job: follow the talk, answer quizzes, react, and chat without distracting the room. Mostly mobile, often in portrait, in a room with a projector.

## Product Purpose

A view-only presentation player that makes a talk live and two-way: presenter-driven slide sync, an independent browsing mode, quizzes with reveal and scoring, live pointer effects (ripple, focus, zoom), ephemeral reactions, and a GIPHY chat. Success: the audience participates from their phones while attention stays on the talk.

## Positioning

Unlike poll tools that sit beside the slides, the slides themselves are the live surface: the deck, the quiz, and the presenter's gestures (ripple/focus/zoom) reach every phone in real time, and late or distracted attendees can browse back on their own.

## Operating Context

- Rooms with a projector; attendees on mixed phones over venue Wi-Fi.
- Up to ~200 attendees per session in the MVP.
- Decks are JSON files authored by a Claude skill, imported from images, or edited by hand in the browser editor at `/edit/<id>`.
- Sessions are ephemeral: nothing persists after the presenter ends it except a summary the presenter downloads.

## Capabilities and Constraints

- Modes: "En vivo" (follow the presenter) and "Explorar" (browse slides already shown).
- Slides are always a 16:9 canvas; the deck's theme controls slide look. The surrounding UI (chrome) must not fight any deck theme.
- iOS Safari cannot lock orientation: portrait shows slide on top plus a panel below.
- UI copy is Spanish (Peru audience); identifiers and code in English.

## Evidence on Hand

- Sample deck: `decks/demo/deck.json`. No real customers, testimonials, or metrics exist; do not invent them.

## Product Principles

1. The talk is the hero: chrome stays quiet and never covers the slide without reason.
2. One-thumb participation: every audience action works with one hand on a phone.
3. The presenter stays in control: nothing the audience does reaches the projector unless the presenter opts in.
4. Ephemeral by default: sessions leave nothing behind but the presenter's summary.

## Accessibility & Inclusion

Large tap targets, readable contrast over any deck theme, reduced-motion support, screen-reader labels for controls and live updates.
