import { CHAT_TEXT_MAX, type ChatMessage, type ChatMode, type ChatState, type Sticker } from "../../../shared/protocol.ts";
import { h, trusted } from "./dom.ts";
import { icon } from "./icons.ts";

export interface ChatPanelOptions {
  /** Sends a text or a sticker id. */
  onSend?: (msg: { text: string } | { stickerId: string }) => void;
  searchStickers?: (q: string) => Promise<Sticker[]>;
  stickersEnabled?: boolean;
  /** Presenter moderation actions on each message. */
  moderate?: { remove: (id: string) => void; mute: (participantId: string, name: string) => void };
  myId?: string;
}

const MODE_COPY: Record<ChatMode, string> = {
  off: "El chat está cerrado.",
  text: "Chat de texto",
  sticker: "Chat de stickers",
  mixed: "Chat de texto y stickers",
};

export function createChatPanel(opts: ChatPanelOptions) {
  const list = h("ol", { class: "chat-list", "aria-live": "polite", "aria-relevant": "additions" });
  const status = h("p", { class: "chat-status" });
  const input = h("input", { class: "chat-input", type: "text", maxlength: CHAT_TEXT_MAX, placeholder: "Escribe un mensaje", enterkeyhint: "send", autocomplete: "off", "aria-label": "Mensaje" });
  const send = trusted("button", { type: "submit", class: "key key-icon key-primary", "aria-label": "Enviar" }, icon("next"));
  const stickerBtn = h("button", { type: "button", class: "key chat-sticker-btn" }, "GIF");
  const form = h("form", { class: "chat-form" }, stickerBtn, input, send);
  const error = h("p", { class: "chat-error", role: "status", "aria-live": "polite" });
  const el = h("section", { class: "chat", "aria-label": "Chat" }, h("h2", { class: "legend" }, "Chat"), status, list, form, error);
  let state: ChatState = { mode: "off", paused: false };

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    opts.onSend?.({ text });
    input.value = "";
  });
  stickerBtn.addEventListener("click", () => openStickerPicker(opts.searchStickers!, (s) => opts.onSend?.({ stickerId: s.id })));

  function render(m: ChatMessage): HTMLElement {
    const li = h("li", { class: `chat-msg${m.from === opts.myId ? " is-mine" : ""}`, "data-id": m.id }, h("span", { class: "chat-name" }, m.name));
    if (m.text) li.append(h("span", { class: "chat-text" }, m.text));
    if (m.sticker) li.append(h("img", { class: "chat-sticker", src: m.sticker.url, alt: m.sticker.title || "Sticker", width: m.sticker.width, height: m.sticker.height, loading: "lazy", referrerpolicy: "no-referrer" }));
    if (opts.moderate) {
      const del = h("button", { type: "button", class: "chat-mod" }, "Borrar");
      const mute = h("button", { type: "button", class: "chat-mod" }, "Silenciar");
      del.addEventListener("click", () => opts.moderate!.remove(m.id));
      mute.addEventListener("click", () => opts.moderate!.mute(m.from, m.name));
      li.append(h("span", { class: "chat-mods" }, del, mute));
    }
    return li;
  }

  const nearBottom = () => list.scrollHeight - list.scrollTop - list.clientHeight < 40;

  return {
    el,
    setState(next: ChatState) {
      state = next;
      const canText = state.mode === "text" || state.mode === "mixed";
      const canSticker = (state.mode === "sticker" || state.mode === "mixed") && !!opts.stickersEnabled;
      el.dataset.mode = state.mode;
      status.textContent = state.mode === "off" ? MODE_COPY.off : state.paused ? "El ponente pausó el chat." : "";
      status.hidden = !status.textContent;
      const writable = !!opts.onSend && state.mode !== "off" && !state.paused;
      form.hidden = !writable;
      input.hidden = !canText;
      send.hidden = !canText;
      stickerBtn.hidden = !canSticker;
    },
    setHistory(messages: ChatMessage[]) {
      list.replaceChildren(...messages.map(render));
      list.scrollTop = list.scrollHeight;
    },
    add(m: ChatMessage) {
      const stick = nearBottom();
      list.append(render(m));
      while (list.childElementCount > 100) list.firstElementChild?.remove();
      if (stick) list.scrollTop = list.scrollHeight;
    },
    remove(id: string) {
      list.querySelector(`[data-id="${CSS.escape(id)}"]`)?.remove();
    },
    error(message: string) {
      error.textContent = message;
      setTimeout(() => (error.textContent = ""), 3500);
    },
  };
}

function openStickerPicker(search: (q: string) => Promise<Sticker[]>, onPick: (s: Sticker) => void) {
  const q = h("input", { type: "search", placeholder: "Buscar en GIPHY", enterkeyhint: "search", "aria-label": "Buscar stickers" });
  const grid = h("div", { class: "sticker-grid", role: "list" });
  const note = h("p", { class: "sticker-note" });
  const close = trusted("button", { type: "button", class: "key key-icon sheet-close", "aria-label": "Cerrar" }, icon("close"));
  const sheet = h("dialog", { class: "sheet sticker-sheet", "aria-labelledby": "sticker-title" }, close, h("h2", { id: "sticker-title" }, "Stickers"), q, grid, note, h("p", { class: "giphy-credit" }, "Con tecnología de GIPHY"));
  let seq = 0;
  const load = async () => {
    const mine = ++seq;
    note.textContent = "Buscando…";
    let results: Sticker[] = [];
    try {
      results = await search(q.value);
    } catch {
      /* handled below */
    }
    if (mine !== seq) return;
    note.textContent = results.length ? "" : "No encontramos stickers. Prueba otra palabra.";
    grid.replaceChildren(
      ...results.map((s) => {
        const b = h("button", { type: "button", class: "sticker-pick", role: "listitem", "aria-label": s.title || "Sticker" }, h("img", { src: s.url, alt: "", loading: "lazy", referrerpolicy: "no-referrer", width: s.width, height: s.height }));
        b.addEventListener("click", () => {
          onPick(s);
          sheet.close();
        });
        return b;
      }),
    );
  };
  let debounce: number | undefined;
  q.addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = window.setTimeout(load, 350);
  });
  close.addEventListener("click", () => sheet.close());
  sheet.addEventListener("close", () => sheet.remove());
  document.body.append(sheet);
  sheet.showModal();
  void load();
}
