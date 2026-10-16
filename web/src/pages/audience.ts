import type { PublicDeck } from "../../../shared/deck.ts";
import { exploreNext, isAfter, prevPosition, type Position } from "../../../shared/nav.ts";
import { NAME_MAX, REACTIONS, type CloseReason, type ErrorCode, type Identity, type PersonalState, type SessionInfo, type SessionSnapshot, type Sticker } from "../../../shared/protocol.ts";
import { Runner } from "../arcade/runner.ts";
import { Connection, type ConnectionStatus } from "../net/connection.ts";
import { StageView } from "../render/stage-view.ts";
import { h, storage, trusted } from "../ui/dom.ts";
import { icon } from "../ui/icons.ts";
import { bindDeckKeys, bindSwipe } from "../ui/input.ts";
import { qrSvg } from "../ui/qr.ts";
import { createChatPanel } from "../ui/chat.ts";
import { createQuizPanel, createScorePanel, optionFromKey } from "../ui/quiz-panel.ts";
import { createReactionBar, floatReactions } from "../ui/reactions.ts";
import { openShareSheet } from "../ui/share.ts";

type Mode = "live" | "explore";
type StoredIdentity = { id: string; key: string };

const local = storage("local");

const CHAT_ERROR_COPY: Partial<Record<ErrorCode, string>> = {
  "chat-closed": "El chat está cerrado.",
  "chat-paused": "El ponente pausó el chat.",
  "chat-mode": "Ese tipo de mensaje no está permitido ahora.",
  "chat-muted": "El ponente te silenció en el chat.",
  "chat-rate": "Vas muy rápido. Espera unos segundos.",
  "chat-empty": "El mensaje está vacío.",
  "chat-sticker": "Ese sticker no está disponible.",
};
const idKey = (code: string) => `ld:id:${code}`;

const CLOSED_COPY: Record<CloseReason | "rejected", { title: string; body: string }> = {
  ended: { title: "La presentación terminó", body: "Gracias por participar. Tus respuestas no se guardan después del cierre." },
  restricted: { title: "El acceso está cerrado", body: "El ponente cerró el acceso a esta presentación." },
  "not-found": { title: "Sesión no encontrada", body: "Revisa el enlace o vuelve a escanear el código QR." },
  replaced: { title: "Sesión abierta en otra pestaña", body: "Sigue la presentación desde la otra pestaña." },
  rejected: { title: "No pudimos conectarte", body: "Vuelve a escanear el código QR para entrar." },
};

export async function mountAudience(root: HTMLElement, code: string) {
  let info: SessionInfo | null = null;
  try {
    const res = await fetch(`/api/sessions/${code}`);
    if (res.ok) info = (await res.json()) as SessionInfo;
  } catch {
    /* network error: handled as not found below */
  }
  if (!info) return renderClosed(root, "not-found");
  if (info.status === "ended") return renderClosed(root, "ended");
  if (info.restricted) return renderClosed(root, "restricted");
  document.title = info.title;

  const saved = local.read<StoredIdentity>(idKey(code));
  if (saved) return startLive(root, code, { resume: saved });
  renderJoin(root, info, (name) => startLive(root, code, { name }));
}

function renderClosed(root: HTMLElement, reason: CloseReason | "rejected") {
  const copy = CLOSED_COPY[reason];
  root.replaceChildren(
    h(
      "main",
      { class: "aud-closed" },
      h("span", { class: "lamp", "data-state": "off" }, "Fuera del aire"),
      h("h1", {}, copy.title),
      h("p", {}, copy.body),
    ),
  );
}

function renderJoin(root: HTMLElement, info: SessionInfo, onJoin: (name: string | null) => void) {
  const input = h("input", {
    id: "join-name",
    name: "given-name",
    autocomplete: "given-name",
    maxlength: NAME_MAX,
    placeholder: "Ej. Ana",
    enterkeyhint: "go",
    autocapitalize: "words",
  });
  const form = h(
    "form",
    { class: "join-form" },
    h("label", { for: "join-name", class: "legend" }, "Tu nombre de pila"),
    input,
    h("button", { type: "submit", class: "key key-primary" }, "Entrar"),
    h("button", { type: "button", class: "key key-ghost", "data-anon": true }, "Entrar sin nombre"),
    h("p", { class: "join-hint" }, "Sin nombre te asignamos un alias para el ranking."),
  );
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = input.value.trim();
    onJoin(name || null);
  });
  form.querySelector("[data-anon]")!.addEventListener("click", () => onJoin(null));

  root.replaceChildren(
    h(
      "main",
      { class: "join" },
      h("span", { class: "lamp", "data-state": info.status === "live" ? "on" : "standby" }, info.status === "live" ? "En vivo" : "En espera"),
      h("h1", { class: "join-title" }, info.title),
      form,
    ),
  );
  input.focus();
}

function startLive(root: HTMLElement, code: string, join: { name?: string | null; resume?: StoredIdentity }) {
  let deck: PublicDeck | null = null;
  let me: Identity | null = null;
  let state: SessionSnapshot | null = null;
  let joinUrl = "";
  let mode: Mode = "live";
  let explorePos: Position = { slide: 0, step: 0 };
  let unlockedAll = false;
  let abandonDismissed = false;
  let view: StageView | null = null;
  let runner: Runner | null = null;
  let connStatus: ConnectionStatus = "connecting";
  let personal: PersonalState | null = null;
  let clockOffset = 0;
  let stickersEnabled = false;
  const ownPending: number[] = REACTIONS.map(() => 0);

  // Shell -------------------------------------------------------------------
  const lamp = h("span", { class: "lamp", "data-state": "standby" }, "Conectando");
  const title = h("span", { class: "aud-title" });
  const count = h("span", { class: "aud-count", "aria-label": "Personas conectadas" });
  const shareBtn = trusted("button", { type: "button", class: "key key-icon", "aria-label": "Compartir sesión" }, icon("share"));
  const bar = h("header", { class: "aud-bar" }, lamp, title, count, shareBtn);

  const stageHost = h("div", { class: "aud-stage-host" });
  const notice = h("div", { class: "aud-notice", role: "status", "aria-live": "polite" });
  const floaters = h("div", { class: "floaters", "aria-hidden": "true" });
  const stageWrap = h("div", { class: "aud-stage" }, stageHost, floaters, notice);

  const liveKey = trusted("button", { type: "button", class: "key key-switch", "data-mode": "live", "aria-pressed": "true" }, `${icon("radio")}<span>En vivo</span>`);
  const exploreKey = trusted("button", { type: "button", class: "key key-switch", "data-mode": "explore", "aria-pressed": "false" }, `${icon("compass")}<span>Explorar</span>`);
  const prevKey = trusted("button", { type: "button", class: "key key-icon", "aria-label": "Diapositiva anterior" }, icon("prev"));
  const nextKey = trusted("button", { type: "button", class: "key key-icon", "aria-label": "Diapositiva siguiente" }, icon("next"));
  const posLabel = h("span", { class: "aud-pos", "aria-live": "polite" });
  const exploreNav = h("div", { class: "aud-explore-nav" }, prevKey, posLabel, nextKey);
  const reactionBar = createReactionBar((i) => {
    if (state?.status !== "live") return;
    ownPending[i]!++;
    floatReactions(floaters, REACTIONS.map((_, k) => (k === i ? 1 : 0)));
    conn.send({ t: "react", i });
  });
  const controls = h("div", { class: "aud-controls" }, h("div", { class: "switch", role: "group", "aria-label": "Modo de vista" }, liveKey, exploreKey), exploreNav, reactionBar.el);

  const banner = h("p", { class: "aud-banner", hidden: true });
  const who = h("p", { class: "aud-who" });
  const quizPanel = createQuizPanel((slideId, option) => conn.send({ t: "vote", slideId, option }));
  const scorePanel = createScorePanel();
  const chat = createChatPanel({
    onSend: (m) => conn.send({ t: "chat", ...m }),
    searchStickers: async (q) => {
      const res = await fetch(`/api/sessions/${code}/stickers?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error(String(res.status));
      return (await res.json()) as Sticker[];
    },
    get stickersEnabled() {
      return stickersEnabled;
    },
    get myId() {
      return me?.id;
    },
  });
  const panel = h("section", { class: "aud-panel", "aria-label": "Participación" }, banner, quizPanel.el, scorePanel.el, chat.el, who);

  const waiting = h("section", { class: "aud-waiting", hidden: true });
  const shell = h("main", { class: "aud", "data-mode": "live" }, bar, stageWrap, controls, panel, waiting);
  root.replaceChildren(shell);

  // Landscape: the slide fills the screen and the chrome appears on tap.
  let chromeTimer: number | undefined;
  const showChrome = () => {
    shell.classList.add("chrome-visible");
    clearTimeout(chromeTimer);
    chromeTimer = window.setTimeout(() => shell.classList.remove("chrome-visible"), 3500);
  };
  stageHost.addEventListener("click", (e) => {
    // Tapping an option on a quiz slide votes; elsewhere it reveals the landscape chrome.
    const option = (e.target as HTMLElement).closest<HTMLElement>("[data-option-index]");
    const qs = quizPanel.state;
    if (option && qs && qs.view?.status === "open" && !qs.readOnly) conn.send({ t: "vote", slideId: qs.slideId, option: Number(option.dataset.optionIndex) });
    else showChrome();
  });
  window.addEventListener("keydown", (e) => {
    const qs = quizPanel.state;
    const el = e.target as HTMLElement | null;
    if (!qs || qs.readOnly || qs.view?.status !== "open" || e.metaKey || e.ctrlKey || e.altKey) return;
    if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
    const option = optionFromKey(e.key, qs.quiz.options.length);
    if (option === null) return;
    e.preventDefault();
    conn.send({ t: "vote", slideId: qs.slideId, option });
  });
  // Countdown for timed quizzes.
  setInterval(() => {
    if (quizPanel.state?.view?.status === "open" && quizPanel.state.view.endsAt) render();
  }, 1000);

  // Navigation ---------------------------------------------------------------
  const limit = (): Position | null => (unlockedAll ? null : (state?.highWater ?? { slide: 0, step: 0 }));

  const setMode = (next: Mode) => {
    mode = next;
    if (mode === "explore" && state) explorePos = { ...state.position };
    render();
  };

  const go = (dir: 1 | -1) => {
    if (!deck || !state || (state.status !== "live" && !unlockedAll)) return;
    if (mode === "live") {
      if (unlockedAll) return;
      // Swiping while live drops you into Explorar at the same slide.
      explorePos = { ...state.position };
      mode = "explore";
    }
    explorePos = dir === 1 ? exploreNext(deck.slides, explorePos, limit()) : prevPosition(deck.slides, explorePos);
    render();
  };

  liveKey.addEventListener("click", () => {
    if (unlockedAll && !state?.presenterOnline) return;
    setMode("live");
  });
  exploreKey.addEventListener("click", () => setMode("explore"));
  prevKey.addEventListener("click", () => go(-1));
  nextKey.addEventListener("click", () => go(1));
  bindSwipe(stageHost, { next: () => go(1), prev: () => go(-1) });
  bindDeckKeys(window, { next: () => go(1), prev: () => go(-1) });
  shareBtn.addEventListener("click", () => openShareSheet(joinUrl, deck?.title ?? ""));

  // Rendering ----------------------------------------------------------------
  function render() {
    if (!deck || !state || !me) return;
    const waitingNow = state.status === "waiting" && !unlockedAll;
    shell.dataset.mode = mode;
    shell.dataset.status = waitingNow ? "waiting" : "live";
    title.textContent = deck.title;
    count.textContent = String(state.audienceCount);
    who.textContent = `Participas como ${me.name}`;

    const onAir = !waitingNow && mode === "live" && state.presenterOnline && !unlockedAll;
    lamp.dataset.state = waitingNow ? "standby" : onAir ? "on" : "off";
    lamp.textContent = waitingNow ? "En espera" : onAir ? "En vivo" : mode === "explore" ? "Explorando" : "Sin señal";

    liveKey.setAttribute("aria-pressed", String(mode === "live"));
    exploreKey.setAttribute("aria-pressed", String(mode === "explore"));
    liveKey.disabled = unlockedAll && !state.presenterOnline;

    waiting.hidden = !waitingNow;
    stageWrap.hidden = waitingNow;
    controls.hidden = waitingNow;
    if (waitingNow) {
      mountWaiting();
      return;
    }
    runner?.destroy();
    runner = null;

    const following = mode === "live" && !unlockedAll;
    const pos = following ? state.position : explorePos;
    view!.show(pos);
    view!.setEffect(following ? state.effect : null);

    const shown = deck.slides[pos.slide]!;
    const quizView = state.quizzes[shown.id] ?? null;
    const myVote = personal?.votes[shown.id];
    view!.setQuiz(quizView, { myVote, clockOffset });
    quizPanel.update(
      shown.quiz ? { slideId: shown.id, quiz: shown.quiz, view: quizView, myVote, readOnly: unlockedAll || state.abandoned, clockOffset } : null,
    );
    scorePanel.update(state.showScore, personal, state.leaderboard, me.name);
    chat.el.hidden = state.chat.mode === "off";
    chat.setState(state.chat);
    reactionBar.setEnabled(state.status === "live");
    const lim = limit();
    posLabel.textContent = `${pos.slide + 1} / ${deck.slides.length}`;
    prevKey.disabled = pos.slide === 0 && pos.step === 0;
    nextKey.disabled = !isAfter(exploreNext(deck.slides, pos, lim), pos);

    banner.hidden = !unlockedAll;
    banner.textContent = unlockedAll ? "Solo está activo el modo Explorar: el ponente no está conectado." : "";

    if (connStatus === "reconnecting") notice.textContent = "Reconectando…";
    else if (!state.presenterOnline && !state.abandoned && !unlockedAll) notice.textContent = "El ponente se está reconectando…";
    else notice.textContent = "";

    if (state.abandoned && !unlockedAll && !abandonDismissed) askAbandoned();
  }

  function mountWaiting() {
    if (runner) return;
    const bestLine = h("p", { class: "arcade-best" });
    runner = new Runner((score, best) => (bestLine.textContent = score >= best && score > 0 ? `¡Nuevo récord: ${score}!` : `Puntaje ${score} · récord ${best}`));
    const qr = h("div", { class: "aud-waiting-qr" });
    void qrSvg(joinUrl, "#efe4cc").then((svg) => (qr.innerHTML = svg));
    waiting.replaceChildren(
      h("h1", { class: "aud-waiting-title" }, "La presentación empieza pronto"),
      h("p", { class: "aud-waiting-sub" }, `${deck!.title}. Cuando el ponente inicie, la verás aquí automáticamente.`),
      h("div", { class: "arcade" }, runner.canvas, bestLine),
      h("div", { class: "aud-waiting-share" }, qr, h("p", {}, "¿Alguien más quiere entrar? Que escanee este código.")),
    );
  }

  let abandonSheet: HTMLDialogElement | null = null;
  function askAbandoned() {
    if (abandonSheet) return;
    const open = h("button", { type: "button", class: "key key-primary" }, "Abrir toda la presentación");
    const stay = h("button", { type: "button", class: "key key-ghost" }, "Seguir esperando");
    abandonSheet = h(
      "dialog",
      { class: "sheet", "aria-labelledby": "abandon-title" },
      h("h2", { id: "abandon-title" }, "El ponente lleva 15 minutos desconectado"),
      h("p", {}, "Puedes abrir toda la presentación y recorrerla por tu cuenta. Solo estará activo el modo Explorar y los quizzes que no se revelaron se verán sin votación."),
      h("div", { class: "sheet-actions" }, open, stay),
    );
    const close = () => {
      abandonSheet?.close();
      abandonSheet?.remove();
      abandonSheet = null;
    };
    open.addEventListener("click", () => {
      unlockedAll = true;
      mode = "explore";
      if (state) explorePos = { ...state.position };
      close();
      render();
    });
    stay.addEventListener("click", () => {
      abandonDismissed = true;
      close();
    });
    document.body.append(abandonSheet);
    abandonSheet.showModal();
  }

  // Connection ---------------------------------------------------------------
  const conn = new Connection({
    hello: () => {
      const stored = local.read<StoredIdentity>(idKey(code)) ?? join.resume;
      return stored ? { t: "hello", role: "audience", code, resume: stored } : { t: "hello", role: "audience", code, name: join.name ?? null };
    },
    onStatus: (s) => {
      connStatus = s;
      render();
    },
    onClosed: (reason) => {
      runner?.destroy();
      if (reason === "ended" || reason === "not-found") local.remove(idKey(code));
      renderClosed(root, reason);
    },
    onMessage: (msg) => {
      switch (msg.t) {
        case "welcome-audience": {
          me = msg.you;
          stickersEnabled = msg.features.stickers;
          local.write(idKey(code), { id: me.id, key: me.resumeKey });
          joinUrl = msg.joinUrl;
          if (!deck) {
            deck = msg.deck;
            view = new StageView(stageHost, deck, { assetBase: `/decks/${msg.deckId}/`, joinUrl });
            void qrSvg(joinUrl).then((svg) => view?.setOptions({ qrSvg: svg }));
          }
          state = msg.state;
          clockOffset = state.serverNow - Date.now();
          if (!state.abandoned) abandonDismissed = false;
          render();
          break;
        }
        case "me":
          personal = msg.me;
          render();
          break;
        case "reactions": {
          // Our own taps were already floated locally; show only everyone else's.
          const others = msg.counts.map((n, i) => {
            const mine = Math.min(n, ownPending[i] ?? 0);
            ownPending[i] = (ownPending[i] ?? 0) - mine;
            return n - mine;
          });
          if (mode === "live" || unlockedAll) floatReactions(floaters, others);
          break;
        }
        case "chat":
          chat.add(msg.message);
          break;
        case "chat-delete":
          chat.remove(msg.id);
          break;
        case "chat-history":
          chat.setHistory(msg.messages);
          break;
        case "state": {
          const wasAbandoned = state?.abandoned;
          state = msg.state;
          clockOffset = state.serverNow - Date.now();
          if (wasAbandoned && !state.abandoned) abandonDismissed = false;
          render();
          break;
        }
        case "ripple":
          if (mode === "live" && !unlockedAll && state && msg.slide === state.position.slide) view?.ripple(msg.x, msg.y);
          break;
        case "error":
          if (msg.code === "not-found") local.remove(idKey(code));
          else if (CHAT_ERROR_COPY[msg.code]) chat.error(CHAT_ERROR_COPY[msg.code]!);
          else if (msg.code === "bad-request" && quizPanel.state) quizPanel.error("La votación ya está cerrada.");
          else if (msg.code === "rate-limited") quizPanel.error("Vas muy rápido. Espera un momento.");
          break;
      }
    },
  });
  window.addEventListener("pagehide", () => conn.stop(), { once: true });
}
