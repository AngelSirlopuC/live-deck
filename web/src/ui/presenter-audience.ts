import type { ChatMode, PresenterCommand, PresenterView, SessionSnapshot } from "../../../shared/protocol.ts";
import { createChatPanel } from "./chat.ts";
import { h } from "./dom.ts";
import { createReactionCounter } from "./reactions.ts";

const MODES: Array<[ChatMode, string]> = [
  ["off", "Apagado"],
  ["text", "Texto"],
  ["sticker", "Stickers"],
  ["mixed", "Mixto"],
];

function toggle(id: string, label: string, onChange: (on: boolean) => void) {
  const input = h("input", { type: "checkbox", id, role: "switch" });
  input.addEventListener("change", () => onChange(input.checked));
  return { input, el: h("label", { class: "pq-switch", for: id }, input, h("span", {}, label)) };
}

/** Presenter controls for audience activity: reactions view, trend counter, chat mode and moderation. */
export function createPresenterAudience(send: (cmd: PresenterCommand) => void) {
  const setView = (view: Partial<PresenterView>) => send({ t: "view", view });
  const showReactions = toggle("pv-reactions", "Ver reacciones en vivo", (on) => setView({ showReactions: on }));
  const showCounter = toggle("pv-counter", "Mostrar contador de reacciones", (on) => setView({ showReactionCounter: on }));
  const showChat = toggle("pv-chat", "Ver el chat", (on) => setView({ showChat: on }));
  const paused = toggle("chat-paused", "Pausar chat", (on) => send({ t: "chat-pause", paused: on }));

  const modeKeys = MODES.map(([mode, label]) => {
    const b = h("button", { type: "button", class: "key", "data-mode": mode, "aria-pressed": "false" }, label);
    b.addEventListener("click", () => send({ t: "chat-mode", mode }));
    return b;
  });
  const counter = createReactionCounter();
  const chat = createChatPanel({
    moderate: {
      remove: (id) => send({ t: "chat-delete", id }),
      mute: (participantId) => send({ t: "chat-mute", participantId }),
    },
  });

  const el = h(
    "section",
    { class: "pa", "aria-label": "Audiencia" },
    h("h2", { class: "legend" }, "Audiencia"),
    showReactions.el,
    showCounter.el,
    counter.el,
    h("p", { class: "pa-label" }, "Chat"),
    h("div", { class: "pa-modes", role: "group", "aria-label": "Modo del chat" }, ...modeKeys),
    paused.el,
    showChat.el,
    chat.el,
  );
  counter.update(null);

  return {
    el,
    chat,
    counter,
    update(s: SessionSnapshot) {
      showReactions.input.checked = s.presenterView.showReactions;
      showCounter.input.checked = s.presenterView.showReactionCounter;
      showChat.input.checked = s.presenterView.showChat;
      paused.input.checked = s.chat.paused;
      paused.input.disabled = s.chat.mode === "off";
      for (const b of modeKeys) b.setAttribute("aria-pressed", String(b.dataset.mode === s.chat.mode));
      chat.el.hidden = !s.presenterView.showChat;
      chat.setState(s.chat);
      if (!s.presenterView.showReactionCounter) counter.update(null);
    },
  };
}
