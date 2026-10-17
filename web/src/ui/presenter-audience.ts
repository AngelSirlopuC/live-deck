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

/** Header chat button + drawer: open/close the chat, pick its mode, moderate. */
export function createPresenterChat(send: (cmd: PresenterCommand) => void) {
  const button = trusted("button", { type: "button", class: "key chat-btn" }, `${icon("chat")}<span>Chat</span><span class="badge" hidden></span>`);
  const badge = button.querySelector<HTMLElement>(".badge")!;
  const paused = toggle("chat-paused", "Pausar chat", (on) => send({ t: "chat-pause", paused: on }));
  const modeKeys = MODES.map(([mode, label]) => {
    const b = h("button", { type: "button", class: "key", "data-mode": mode, "aria-pressed": "false" }, label);
    b.addEventListener("click", () => send({ t: "chat-mode", mode }));
    return b;
  });
  const panel = createChatPanel({
    moderate: {
      remove: (id) => send({ t: "chat-delete", id }),
      mute: (participantId) => send({ t: "chat-mute", participantId }),
    },
  });
  const close = trusted("button", { type: "button", class: "key key-icon sheet-close", "aria-label": "Cerrar" }, icon("close"));
  const drawer = h(
    "dialog",
    { class: "sheet chat-sheet chat-drawer", "aria-label": "Chat del público" },
    close,
    h("h2", {}, "Chat del público"),
    h("div", { class: "pa-modes", role: "group", "aria-label": "Modo del chat" }, ...modeKeys),
    paused.el,
    panel.el,
  );
  document.body.append(drawer);
  let unread = 0;
  const setUnread = (n: number) => {
    unread = n;
    badge.hidden = n === 0;
    badge.textContent = n > 9 ? "9+" : String(n);
  };
  button.addEventListener("click", () => {
    drawer.showModal();
    setUnread(0);
    panel.scrollToEnd();
  });
  close.addEventListener("click", () => drawer.close());
  drawer.addEventListener("click", (e) => {
    if (e.target === drawer) drawer.close();
  });

  return {
    button,
    update(s: SessionSnapshot) {
      for (const b of modeKeys) b.setAttribute("aria-pressed", String(b.dataset.mode === s.chat.mode));
      paused.input.checked = s.chat.paused;
      paused.input.disabled = s.chat.mode === "off";
      panel.setState(s.chat);
      button.classList.toggle("is-live", s.chat.mode !== "off" && !s.chat.paused);
    },
    add(m: ChatMessage) {
      panel.add(m);
      if (!drawer.open) setUnread(unread + 1);
    },
    remove: (id: string) => panel.remove(id),
    history: (m: ChatMessage[]) => panel.setHistory(m),
  };
}
