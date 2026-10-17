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
  off: "El ponente todavía no abrió el chat.",
  text: "Solo texto",
  sticker: "Solo stickers",
  mixed: "Texto y stickers",
};

/** Messages from one sender this close together read as one turn. */
const GROUP_MS = 3 * 60_000;
const timeFormat = new Intl.DateTimeFormat("es-PE", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

export function createChatPanel(opts: ChatPanelOptions) {
  const list = h("ol", { class: "chat-list", "aria-live": "polite", "aria-relevant": "additions" });
  const status = h("p", { class: "chat-status" });
  const modeLine = h("p", { class: "chat-mode" });
  const emptyTitle = h("strong", {});
  const emptyText = h("span", {});
  const empty = trusted("div", { class: "chat-empty" }, icon("chat"));
  empty.append(emptyTitle, emptyText);
  const jump = trusted("button", { type: "button", class: "chat-jump", hidden: true }, `<span>Mensajes nuevos</span>${icon("down")}`);
  const scroller = h("div", { class: "chat-scroll" }, list, empty, jump);
  const input = h("input", { class: "chat-input", type: "text", maxlength: CHAT_TEXT_MAX, placeholder: "Escribe un mensaje", enterkeyhint: "send", autocomplete: "off", "aria-label": "Mensaje" });
  const send = trusted("button", { type: "submit", class: "key key-icon key-primary chat-send", "aria-label": "Enviar" }, icon("send"));
  const stickerBtn = h("button", { type: "button", class: "key chat-sticker-btn", "aria-label": "Stickers", "aria-expanded": "false", "aria-controls": "chat-sticker-tray" }, "GIF");
  const form = h("form", { class: "chat-form" }, stickerBtn, input, send);
  const error = h("p", { class: "chat-error", role: "status", "aria-live": "polite" });
  const head = h("header", { class: "chat-head" }, h("h2", { class: "chat-title" }, "Chat"), modeLine);
  const tray = createStickerTray(opts.searchStickers, (s) => {
    opts.onSend?.({ stickerId: s.id });
    closeTray();
  }, () => closeTray(true));
  const el = h("section", { class: "chat", "aria-label": "Chat" }, head, status, scroller, tray.el, form, error);
  let state: ChatState = { mode: "off", paused: false };

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    opts.onSend?.({ text });
    input.value = "";
  });
  function closeTray(refocus = false) {
    if (tray.el.hidden) return;
    tray.el.hidden = true;
    stickerBtn.setAttribute("aria-expanded", "false");
    el.classList.remove("has-tray");
    if (refocus) stickerBtn.focus();
  }
  stickerBtn.addEventListener("click", () => {
    if (!tray.el.hidden) return closeTray();
    tray.el.hidden = false;
    stickerBtn.setAttribute("aria-expanded", "true");
    el.classList.add("has-tray");
    tray.open();
  });

  const nearBottom = () => list.scrollHeight - list.scrollTop - list.clientHeight < 40;
  const toEnd = () => {
    list.scrollTop = list.scrollHeight;
    jump.hidden = true;
  };
  jump.addEventListener("click", () => list.scrollTo({ top: list.scrollHeight, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }));
  list.addEventListener("scroll", () => {
    if (nearBottom()) jump.hidden = true;
  }, { passive: true });

  function render(m: ChatMessage): HTMLElement {
    const mine = m.from === opts.myId;
    const when = new Date(m.at);
    const meta = h(
      "span",
      { class: "chat-meta" },
      h("span", { class: "chat-name" }, mine ? "Tú" : m.name),
      h("time", { class: "chat-time", datetime: when.toISOString() }, timeFormat.format(when)),
    );
    const li = h("li", { class: `chat-msg${mine ? " is-mine" : ""}`, "data-id": m.id, "data-from": m.from, "data-at": m.at }, meta);
    if (m.text) li.append(h("p", { class: "chat-text" }, m.text));
    if (m.sticker) li.append(h("img", { class: "chat-sticker", src: m.sticker.url, alt: m.sticker.title || "Sticker", width: m.sticker.width, height: m.sticker.height, loading: "lazy", referrerpolicy: "no-referrer" }));
    if (opts.moderate) {
      // Moderation stays out of sight: shown on hover/focus, or with the "more" key on touch.
      const more = trusted("button", { type: "button", class: "chat-more", "aria-label": `Acciones para el mensaje de ${m.name}`, "aria-expanded": "false" }, icon("more"));
      const del = trusted("button", { type: "button", class: "chat-mod", "aria-label": `Borrar mensaje de ${m.name}`, title: "Borrar mensaje" }, icon("trash"));
      const mute = trusted("button", { type: "button", class: "chat-mod chat-mod-mute", "aria-label": `Silenciar a ${m.name}`, title: `Silenciar a ${m.name}` }, icon("mute"));
      more.addEventListener("click", () => {
        const open = li.classList.toggle("is-open");
        more.setAttribute("aria-expanded", String(open));
      });
      del.addEventListener("click", () => opts.moderate!.remove(m.id));
      mute.addEventListener("click", () => opts.moderate!.mute(m.from, m.name));
      li.classList.add("is-moderated");
      li.append(more, h("span", { class: "chat-mods" }, del, mute));
    }
    return li;
  }

  /** Hide the name on a sender's follow-up messages; recheck after removals. */
  function regroup(li: Element | null) {
    if (!(li instanceof HTMLElement)) return;
    const prev = li.previousElementSibling as HTMLElement | null;
    const cont = !!prev && prev.dataset.from === li.dataset.from && Number(li.dataset.at) - Number(prev.dataset.at) < GROUP_MS;
    li.classList.toggle("is-cont", cont);
  }

  function renderEmpty() {
    const none = list.childElementCount === 0;
    empty.hidden = !none || state.mode === "off";
    if (!none) return;
    if (opts.moderate) {
      emptyTitle.textContent = "Sin mensajes todavía";
      emptyText.textContent = "Lo que escriba el público aparecerá aquí.";
    } else {
      emptyTitle.textContent = "Sin mensajes todavía";
      emptyText.textContent = state.paused ? "El chat está en pausa." : "Escribe el primero.";
    }
  }

  return {
    el,
    setState(next: ChatState) {
      state = next;
      const canText = state.mode === "text" || state.mode === "mixed";
      const canSticker = (state.mode === "sticker" || state.mode === "mixed") && !!opts.stickersEnabled;
      el.dataset.mode = state.mode;
      el.toggleAttribute("data-paused", state.paused);
      // The presenter (moderator) reads how to act; the audience reads what happened.
      const off = opts.moderate ? "Chat cerrado. Ábrelo desde ⚙ para que el público escriba." : MODE_COPY.off;
      const paused = opts.moderate ? "Chat en pausa: el público no puede escribir." : "El ponente pausó el chat.";
      status.textContent = state.mode === "off" ? off : state.paused ? paused : "";
      status.hidden = !status.textContent;
      modeLine.textContent = state.mode === "off" ? "Cerrado" : state.paused ? "En pausa" : MODE_COPY[state.mode];
      const writable = !!opts.onSend && state.mode !== "off" && !state.paused;
      form.hidden = !writable;
      input.hidden = !canText;
      send.hidden = !canText;
      stickerBtn.hidden = !canSticker;
      if (!canSticker || !writable) closeTray();
      renderEmpty();
    },
    setHistory(messages: ChatMessage[]) {
      list.replaceChildren(...messages.map(render));
      for (const li of list.children) regroup(li);
      renderEmpty();
      toEnd();
    },
    add(m: ChatMessage) {
      const stick = nearBottom() || m.from === opts.myId;
      const li = render(m);
      list.append(li);
      regroup(li);
      while (list.childElementCount > 100) {
        list.firstElementChild?.remove();
        regroup(list.firstElementChild);
      }
      renderEmpty();
      if (stick) toEnd();
      else jump.hidden = false;
    },
    scrollToEnd: toEnd,
    remove(id: string) {
      const li = list.querySelector(`[data-id="${CSS.escape(id)}"]`);
      const next = li?.nextElementSibling ?? null;
      li?.remove();
      regroup(next);
      renderEmpty();
    },
    error(message: string) {
      error.textContent = message;
      setTimeout(() => (error.textContent = ""), 3500);
    },
  };
}

/** GIPHY search docked inside the chat, above the composer. */
function createStickerTray(search: ((q: string) => Promise<Sticker[]>) | undefined, onPick: (s: Sticker) => void, onEscape: () => void) {
  const q = h("input", { type: "search", class: "sticker-search", placeholder: "Buscar en GIPHY", enterkeyhint: "search", autocomplete: "off", "aria-label": "Buscar stickers" });
  const grid = h("div", { class: "sticker-grid", role: "list", "aria-label": "Resultados" });
  const note = h("p", { class: "sticker-note", role: "status" });
  const el = h("div", { class: "sticker-tray", id: "chat-sticker-tray", hidden: true }, q, grid, h("div", { class: "sticker-foot" }, note, h("p", { class: "giphy-credit" }, "Con tecnología de GIPHY")));
  let seq = 0;
  let loaded = false;
  const load = async () => {
    if (!search) return;
    const mine = ++seq;
    note.textContent = "Buscando…";
    let results: Sticker[] = [];
    try {
      results = await search(q.value);
    } catch {
      /* handled below */
    }
    if (mine !== seq) return;
    loaded = true;
    note.textContent = results.length ? "" : "No encontramos stickers. Prueba otra palabra.";
    grid.replaceChildren(
      ...results.map((s) => {
        const b = h("button", { type: "button", class: "sticker-pick", role: "listitem", "aria-label": s.title || "Sticker", title: s.title || "Sticker" }, h("img", { src: s.url, alt: "", loading: "lazy", decoding: "async", referrerpolicy: "no-referrer", width: s.width, height: s.height }));
        b.addEventListener("click", () => onPick(s));
        return b;
      }),
    );
  };
  let debounce: number | undefined;
  q.addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = window.setTimeout(load, 350);
  });
  q.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    clearTimeout(debounce);
    void load();
  });
  el.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    e.stopPropagation();
    onEscape();
  });
  return {
    el,
    open() {
      if (!loaded) void load();
      // Touch keyboards would cover the results; focus the search only with a fine pointer.
      if (window.matchMedia?.("(pointer: fine)").matches) q.focus();
    },
  };
}
