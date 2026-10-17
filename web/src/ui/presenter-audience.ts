import type { ChatMessage, ChatMode, PresenterCommand, PresenterView, SessionSnapshot } from "../../../shared/protocol.ts";
import { createChatPanel } from "./chat.ts";
import { h, trusted } from "./dom.ts";
import { icon } from "./icons.ts";
import { createReactionCounter } from "./reactions.ts";

const MODES: Array<[ChatMode, string]> = [
  ["off", "Cerrado"],
  ["text", "Texto"],
  ["sticker", "Stickers"],
  ["mixed", "Mixto"],
];

function toggle(id: string, label: string, onChange: (on: boolean) => void) {
  const input = h("input", { type: "checkbox", id, role: "switch" });
  input.addEventListener("change", () => onChange(input.checked));
  return { input, el: h("label", { class: "pq-switch", for: id }, input, h("span", {}, label)) };
}

/** Presenter controls for reactions: floating view and trend counter. */
export function createPresenterAudience(send: (cmd: PresenterCommand) => void) {
  const setView = (view: Partial<PresenterView>) => send({ t: "view", view });
  const showReactions = toggle("pv-reactions", "Ver reacciones en vivo", (on) => setView({ showReactions: on }));
  const showCounter = toggle("pv-counter", "Mostrar contador de reacciones", (on) => setView({ showReactionCounter: on }));
  const counter = createReactionCounter();
  counter.update(null);
  const el = h("section", { class: "pa", "aria-label": "Reacciones" }, h("h2", { class: "legend" }, "Reacciones"), showReactions.el, showCounter.el, counter.el);
  return {
    el,
    counter,
    update(s: SessionSnapshot) {
      showReactions.input.checked = s.presenterView.showReactions;
      showCounter.input.checked = s.presenterView.showReactionCounter;
      if (!s.presenterView.showReactionCounter) counter.update(null);
    },
  };
}

const MODE_LABEL: Record<ChatMode, string> = { off: "Cerrado", text: "Texto", sticker: "Stickers", mixed: "Mixto" };

/**
 * Chat panel for the console side column. Messages are always visible;
 * settings (mode, pause) sit behind a gear button and per-message moderation
 * shows on hover or with the "⋯" button.
 */
export function createPresenterChat(send: (cmd: PresenterCommand) => void, stickers: boolean) {
  const paused = toggle("chat-paused", "Pausar chat", (on) => send({ t: "chat-pause", paused: on }));
  const modeKeys = MODES.map(([mode, label]) => {
    const b = h("button", { type: "button", class: "key", "data-mode": mode, "aria-pressed": "false" }, label);
    b.addEventListener("click", () => send({ t: "chat-mode", mode }));
    // Sticker modes need a GIPHY key on the server.
    if (!stickers && (mode === "sticker" || mode === "mixed")) b.disabled = true;
    return b;
  });
  const note = h("p", { class: "pa-note", hidden: stickers }, "Stickers desactivados: el servidor no tiene GIPHY_API_KEY.");
  const settings = h("div", { class: "pc-settings", id: "pc-settings", hidden: true }, h("div", { class: "pa-modes", role: "group", "aria-label": "Modo del chat" }, ...modeKeys), note, paused.el);
  const gear = trusted("button", { type: "button", class: "pc-gear", "aria-label": "Configurar chat", "aria-expanded": "false", "aria-controls": "pc-settings", title: "Configurar chat" }, icon("settings"));
  gear.addEventListener("click", () => {
    settings.hidden = !settings.hidden;
    gear.setAttribute("aria-expanded", String(!settings.hidden));
  });
  const modeBadge = h("span", { class: "pc-mode" });
  const panel = createChatPanel({
    moderate: {
      remove: (id) => send({ t: "chat-delete", id }),
      mute: (participantId) => send({ t: "chat-mute", participantId }),
    },
  });
  const el = h(
    "section",
    { class: "presenter-chat", "aria-label": "Chat del público" },
    h("div", { class: "pc-head" }, h("h2", { class: "legend" }, "Chat"), modeBadge, h("span", { class: "spacer" }), gear),
    settings,
    panel.el,
  );

  return {
    el,
    update(s: SessionSnapshot) {
      for (const b of modeKeys) b.setAttribute("aria-pressed", String(b.dataset.mode === s.chat.mode));
      paused.input.checked = s.chat.paused;
      paused.input.disabled = s.chat.mode === "off";
      modeBadge.textContent = s.chat.mode === "off" ? "Cerrado" : s.chat.paused ? "Pausado" : MODE_LABEL[s.chat.mode];
      modeBadge.dataset.state = s.chat.mode === "off" ? "off" : s.chat.paused ? "paused" : "on";
      panel.setState(s.chat);
    },
    add: (m: ChatMessage) => panel.add(m),
    remove: (id: string) => panel.remove(id),
    history: (m: ChatMessage[]) => panel.setHistory(m),
  };
}
