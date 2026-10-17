import type { Deck } from "../../../shared/deck.ts";
import { nextPosition, type Position } from "../../../shared/nav.ts";
import { PIN, type PresenterCommand, type PresenterSurface, type SessionSnapshot } from "../../../shared/protocol.ts";
import { Connection, type ConnectionStatus } from "../net/connection.ts";
import { StageView } from "../render/stage-view.ts";
import { h, storage, trusted } from "../ui/dom.ts";
import { icon } from "../ui/icons.ts";
import { bindEffectTools, pressTool, type EffectTool } from "../ui/effect-tools.ts";
import { bindDeckKeys, bindSwipe, isTextEntry } from "../ui/input.ts";
import { qrSvg } from "../ui/qr.ts";
import { createPresenterAudience, createPresenterChat } from "../ui/presenter-audience.ts";
import { createPresenterQuiz } from "../ui/presenter-quiz.ts";
import { createReactionCounter, floatReactions } from "../ui/reactions.ts";
import type { ChatMessage, SessionSummary } from "../../../shared/protocol.ts";
import { openShareSheet } from "../ui/share.ts";
import { createEndPanel } from "../ui/summary.ts";
import { openPresentDialog } from "../ui/present-dialog.ts";
import { planPresentation, type PresentPlan, type Rect } from "../ui/present-plan.ts";
import { nativeScreen } from "../ui/screens.ts";

const session = storage("session");
const pinKey = (token: string) => `ld:pin:${token}`;

export function mountPresenter(root: HTMLElement, token: string, surface: PresenterSurface) {
  const pin = session.read<string>(pinKey(token));
  if (pin) connect(root, token, surface, pin);
  else askPin(root, token, surface);
}

function askPin(root: HTMLElement, token: string, surface: PresenterSurface, error = "") {
  const input = h("input", { id: "pin", inputmode: "numeric", autocomplete: "one-time-code", pattern: "[0-9]*", maxlength: 8, minlength: 4, required: true });
  const message = h("p", { class: "form-error", role: "alert" }, error);
  const form = h(
    "form",
    { class: "join-form" },
    h("label", { for: "pin", class: "legend" }, "PIN del ponente"),
    input,
    message,
    h("button", { type: "submit", class: "key key-primary" }, "Entrar a la consola"),
  );
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!PIN.test(input.value)) {
      message.textContent = "El PIN tiene de 4 a 8 dígitos.";
      return;
    }
    session.write(pinKey(token), input.value);
    connect(root, token, surface, input.value);
  });
  const surfaceName = surface === "screen" ? "Pantalla del proyector" : surface === "remote" ? "Control móvil" : "Consola del ponente";
  root.replaceChildren(h("main", { class: "join" }, h("h1", { class: "join-title" }, `Ingresa tu PIN · ${surfaceName}`), form));
  input.focus();
}

interface PresenterContext {
  /** Presenter token: also names the channel between console and projection windows. */
  token: string;
  deck: Deck;
  deckId: string;
  code: string;
  joinUrl: string;
  state: SessionSnapshot;
  send: (cmd: PresenterCommand) => void;
  /** GIPHY stickers are configured on the server. */
  stickers: boolean;
  /** Origin phones can reach (LAN address when the console runs on localhost). */
  baseUrl: string;
  /** serverNow - Date.now() at the last snapshot, for quiz timers. */
  clockOffset: number;
}

function connect(root: HTMLElement, token: string, surface: PresenterSurface, pin: string) {
  let ui: PresenterUi | null = null;
  let ctx: PresenterContext | null = null;
  let status: ConnectionStatus = "connecting";

  root.replaceChildren(h("p", { class: "page-message" }, "Conectando…"));

  const conn = new Connection({
    hello: () => ({ t: "hello", role: "presenter", token, pin, surface }),
    onStatus: (s) => {
      status = s;
      ui?.connection(s);
    },
    onClosed: (reason) => {
      if (reason !== "ended") return;
      session.remove(pinKey(token));
      root.replaceChildren(
        h("main", { class: "aud-closed" }, h("span", { class: "lamp", "data-state": "off" }, "Fuera del aire"), h("h1", {}, "Sesión eliminada"), h("p", {}, "No queda ningún dato de esta sesión en el servidor.")),
      );
    },
    onMessage: (msg) => {
      if (msg.t === "welcome-presenter") {
        if (!ctx) {
          ctx = { token, deck: msg.deck, deckId: msg.deckId, code: msg.code, joinUrl: msg.joinUrl, baseUrl: msg.baseUrl, stickers: msg.features.stickers, state: msg.state, send: (cmd) => conn.send(cmd), clockOffset: 0 };
          document.title = `${msg.deck.title} · ${surface === "screen" ? "pantalla" : surface === "remote" ? "control" : "consola"}`;
          ui = surface === "screen" ? screenUi(root, ctx) : surface === "remote" ? remoteUi(root, ctx, token) : consoleUi(root, ctx, token);
        }
        ctx.state = msg.state;
        ctx.clockOffset = msg.state.serverNow - Date.now();
        ui!.update(ctx.state);
        ui!.connection(status);
      } else if (msg.t === "state" && ctx) {
        ctx.state = msg.state;
        ctx.clockOffset = msg.state.serverNow - Date.now();
        ui?.update(ctx.state);
      } else if (msg.t === "ripple" && ctx && msg.slide === ctx.state.position.slide) {
        ui?.ripple(msg.x, msg.y);
      } else if (msg.t === "summary") {
        ui?.summary?.(msg.summary);
      } else if (msg.t === "reactions") {
        ui?.reactions?.(msg.counts, msg.totals ?? null);
      } else if (msg.t === "chat") {
        ui?.chat?.("add", msg.message);
      } else if (msg.t === "chat-delete") {
        ui?.chat?.("remove", msg.id);
      } else if (msg.t === "chat-history") {
        ui?.chat?.("history", msg.messages);
      } else if (msg.t === "error") {
        if (msg.code === "unauthorized") {
          session.remove(pinKey(token));
          askPin(root, token, surface, "PIN incorrecto. Inténtalo de nuevo.");
        } else if (msg.code === "locked") {
          session.remove(pinKey(token));
          askPin(root, token, surface, "Demasiados intentos. Espera unos minutos antes de volver a intentar.");
        } else if (msg.code === "not-found") {
          session.remove(pinKey(token));
          root.replaceChildren(h("main", { class: "aud-closed" }, h("h1", {}, "Sesión no encontrada"), h("p", {}, "La sesión expiró o el servidor se reinició. Crea una nueva desde el inicio.")));
        }
      }
    },
  });
  window.addEventListener("pagehide", () => conn.stop(), { once: true });
}

interface PresenterUi {
  update(state: SessionSnapshot): void;
  ripple(x: number, y: number): void;
  reactions?(counts: number[], totals: number[] | null): void;
  summary?(s: SessionSummary): void;
  chat?(op: "add", m: ChatMessage): void;
  chat?(op: "remove", id: string): void;
  chat?(op: "history", m: ChatMessage[]): void;
  connection(status: ConnectionStatus): void;
}

function lampFor(state: SessionSnapshot): { state: string; text: string } {
  if (state.status === "ended") return { state: "off", text: "Finalizada" };
  if (state.status === "waiting") return { state: "standby", text: "En espera" };
  return { state: "on", text: "Al aire" };
}

function elapsed(startedAt: number | null): string {
  if (!startedAt) return "00:00";
  const s = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const hh = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return hh ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;
}

function confirmSheet(title: string, body: string, confirmLabel: string, danger: boolean): Promise<boolean> {
  return new Promise((resolve) => {
    const ok = h("button", { type: "button", class: danger ? "key key-danger" : "key key-primary" }, confirmLabel);
    const cancel = h("button", { type: "button", class: "key key-ghost" }, "Cancelar");
    const sheet = h("dialog", { class: "sheet", "aria-labelledby": "confirm-title" }, h("h2", { id: "confirm-title" }, title), h("p", {}, body), h("div", { class: "sheet-actions" }, cancel, ok));
    const done = (v: boolean) => {
      sheet.close();
      sheet.remove();
      resolve(v);
    };
    ok.addEventListener("click", () => done(true));
    cancel.addEventListener("click", () => done(false));
    sheet.addEventListener("cancel", () => done(false));
    document.body.append(sheet);
    sheet.showModal();
    cancel.focus();
  });
}

function sessionActions(ctx: PresenterContext) {
  const start = trusted("button", { type: "button", class: "key key-onair" }, `${icon("play")}<span>Iniciar</span>`);
  const restrict = trusted("button", { type: "button", class: "key" }, `${icon("lock")}<span>Cerrar acceso</span>`);
  const end = trusted("button", { type: "button", class: "key key-danger" }, `${icon("power")}<span>Finalizar</span>`);
  start.addEventListener("click", () => ctx.send({ t: "start" }));
  restrict.addEventListener("click", async () => {
    if (ctx.state.restricted) return ctx.send({ t: "restrict", restricted: false });
    const ok = await confirmSheet("¿Cerrar el acceso?", "Todo el público deja de ver la presentación y nadie más puede entrar. Puedes volver a abrirlo después.", "Cerrar acceso", true);
    if (ok) ctx.send({ t: "restrict", restricted: true });
  });
  end.addEventListener("click", async () => {
    const ok = await confirmSheet("¿Finalizar la presentación?", "Se cierra el canal para todo el público. Esta acción no se puede deshacer.", "Finalizar", true);
    if (ok) ctx.send({ t: "end" });
  });
  const update = (s: SessionSnapshot) => {
    start.hidden = s.status !== "waiting";
    restrict.innerHTML = s.restricted ? `${icon("unlock")}<span>Abrir acceso</span>` : `${icon("lock")}<span>Cerrar acceso</span>`;
    restrict.setAttribute("aria-pressed", String(s.restricted));
    restrict.disabled = s.status === "ended";
    end.disabled = s.status === "ended";
  };
  return { start, restrict, end, update };
}

// Console ----------------------------------------------------------------------

function consoleUi(root: HTMLElement, ctx: PresenterContext, token: string): PresenterUi {
  const lamp = h("span", { class: "lamp" });
  const count = h("span", { class: "console-stat" });
  const codeTag = h("span", { class: "console-stat" }, "Código ", h("span", { class: "num" }, ctx.code));
  const conn = h("span", { class: "console-conn", role: "status", "aria-live": "polite" });
  const qrBtn = trusted("button", { type: "button", class: "key", "aria-label": "Enlace del público", title: "Enlace del público" }, `${icon("qr")}<span>Enlace del público</span>`);
  const remoteBtn = trusted("button", { type: "button", class: "key", "aria-label": "Control móvil", title: "Control móvil" }, `${icon("phone")}<span>Control móvil</span>`);
  qrBtn.addEventListener("click", () => openShareSheet(ctx.joinUrl, ctx.deck.title));
  remoteBtn.addEventListener("click", () => openRemoteSheet(`${ctx.baseUrl}/p/${token}/remote`));

  const chatUi = createPresenterChat(ctx.send, ctx.stickers);
  const presentBtn = trusted("button", { type: "button", class: "key key-primary", "aria-label": "Presentar", title: "Presentar" }, `${icon("play")}<span>Presentar</span>`);
  const header = h("header", { class: "console-bar" }, lamp, h("strong", { class: "console-title" }, ctx.deck.title), codeTag, count, conn, h("span", { class: "spacer" }), presentBtn, chatUi.button, qrBtn, remoteBtn);

  const programHost = h("div", { class: "monitor-host" });
  const nextHost = h("div", { class: "monitor-host" });
  let tool: EffectTool = "ripple";
  const toolKeys = (
    [
      ["ripple", "Señalar", "R"],
      ["focus", "Enfocar", "F"],
      ["zoom", "Zoom", "Z"],
    ] as const
  ).map(([id, label, kbd]) => {
    const b = h("button", { type: "button", class: "key", "data-tool": id, "aria-pressed": String(id === tool), "aria-keyshortcuts": kbd }, label, " ", h("kbd", {}, kbd));
    b.addEventListener("click", () => press(id));
    return b;
  });
  const clearFx = h("button", { type: "button", class: "key key-ghost", "aria-keyshortcuts": "Escape" }, "Quitar efecto ", h("kbd", {}, "Esc"));
  clearFx.addEventListener("click", () => ctx.send({ t: "effect", effect: null }));
  const setTool = (t: EffectTool) => {
    tool = t;
    for (const b of toolKeys) b.setAttribute("aria-pressed", String(b.dataset.tool === t));
  };
  // Pressing the selected tool again turns it off and removes its effect.
  const press = (t: EffectTool) => {
    const next = pressTool(tool, t, ctx.state.effect?.kind ?? null);
    if (next.clear) ctx.send({ t: "effect", effect: null });
    setTool(next.tool);
  };
  window.addEventListener("keydown", (e) => {
    const el = e.target as HTMLElement | null;
    if (el && isTextEntry(el)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === "r") press("ripple");
    else if (k === "f") press("focus");
    else if (k === "z") press("zoom");
    else if (e.key === "Escape" && !document.querySelector("dialog[open]")) ctx.send({ t: "effect", effect: null });
  });
  // Shown only in presentation mode: the slide fills the screen and this bar
  // floats over it while the mouse moves.
  const presentPrev = trusted("button", { type: "button", class: "key key-icon", "aria-label": "Anterior" }, icon("prev"));
  const presentNext = trusted("button", { type: "button", class: "key key-icon key-primary", "aria-label": "Siguiente" }, icon("next"));
  const presentExit = trusted("button", { type: "button", class: "key", "aria-label": "Salir del modo presentación" }, `${icon("shrink")}<span>Salir</span>`);
  presentPrev.addEventListener("click", () => ctx.send({ t: "prev" }));
  presentNext.addEventListener("click", () => ctx.send({ t: "next" }));
  const presentNav = h("div", { class: "present-nav" }, presentPrev, presentNext);
  const program = h(
    "section",
    { class: "monitor monitor-program", "aria-label": "Diapositiva actual" },
    h("div", { class: "monitor-head" }, h("span", { class: "monitor-label" }, "Programa"), presentNav, h("div", { class: "fx-tools", role: "toolbar", "aria-label": "Efectos en vivo" }, ...toolKeys, clearFx), presentExit),
    programHost,
  );
  const nextMon = h("section", { class: "monitor monitor-next", "aria-label": "Siguiente" }, h("span", { class: "monitor-label" }, "Siguiente"), nextHost);
  const timer = h("div", { class: "console-timer", "aria-label": "Tiempo transcurrido" }, "00:00");
  const slideNo = h("div", { class: "console-slide-no" });
  const notes = h("div", { class: "console-notes", tabindex: 0, "aria-label": "Notas del ponente" });
  const pq = createPresenterQuiz(ctx.deck, ctx.send, { leaderboard: true });
  const pa = createPresenterAudience(ctx.send);
  const side = h("aside", { class: "console-side" }, nextMon, h("div", { class: "console-meters" }, timer, slideNo), h("h2", { class: "legend" }, "Notas"), notes);
  // Audience-facing controls live on the desk under the program monitor so the
  // next-slide monitor and timer never scroll out of view.
  const desk = h("div", { class: "console-desk" }, pq.quizEl, pq.boardEl, pa.el);
  const programFloaters = h("div", { class: "floaters", "aria-hidden": "true" });
  // Inside the host so the stage clipping also clips the floaters.
  programHost.append(programFloaters);

  const prev = trusted("button", { type: "button", class: "key key-transport", "aria-label": "Anterior" }, `${icon("prev")}<span>Anterior</span>`);
  const next = trusted("button", { type: "button", class: "key key-transport key-primary", "aria-label": "Siguiente" }, `<span>Siguiente</span>${icon("next")}`);
  prev.addEventListener("click", () => ctx.send({ t: "prev" }));
  next.addEventListener("click", () => ctx.send({ t: "next" }));
  const actions = sessionActions(ctx);
  const transport = h("footer", { class: "console-transport" }, actions.start, prev, next, h("span", { class: "spacer" }), actions.restrict, h("span", { class: "transport-gap" }), actions.end);

  const body = h("div", { class: "console-body" }, h("div", { class: "console-main" }, program, desk), side);
  const consoleEl = h("main", { class: "console" }, header, body, transport);
  root.replaceChildren(consoleEl);

  // Presentation mode: same tab, slide fullscreen, presenter keeps every control.
  let presenting = false;
  let idleTimer: number | undefined;
  const wake = () => {
    if (!presenting) return;
    consoleEl.classList.add("controls-visible");
    clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => consoleEl.classList.remove("controls-visible"), 2500);
  };
  const features = (r: Rect) => `popup,left=${Math.round(r.left)},top=${Math.round(r.top)},width=${Math.round(r.width)},height=${Math.round(r.height)}`;
  const goFullscreen = (screenId: string | null) => {
    const screen = screenId ? nativeScreen(screenId) : null;
    const opts = { navigationUI: "hide", ...(screen ? { screen } : {}) } as FullscreenOptions;
    return document.documentElement.requestFullscreen?.(opts).catch(() => {}) ?? Promise.resolve();
  };
  let usedFullscreen = false;
  // The projection tab and the presenter window talk over a same-origin channel:
  // the presenter view can stop the projection, and learns whether one is running.
  const channel = typeof BroadcastChannel === "function" ? new BroadcastChannel(`live-deck-present:${token}`) : null;
  let presenterWin: Window | null = null;
  let remoteProjection = false;
  const syncPresentButton = () => {
    const stop = remoteProjection && !presenting;
    presentBtn.innerHTML = stop ? `${icon("power")}<span>Dejar de presentar</span>` : `${icon("play")}<span>Presentar</span>`;
    presentBtn.setAttribute("aria-label", stop ? "Dejar de presentar" : "Presentar");
    presentBtn.title = stop ? "Dejar de presentar" : "Presentar";
  };
  channel?.addEventListener("message", (e: MessageEvent<{ t: string; on?: boolean }>) => {
    if (e.data.t === "stop" && presenting) setPresenting(false);
    else if (e.data.t === "hello" && presenting) channel.postMessage({ t: "projecting", on: true });
    else if (e.data.t === "projecting") {
      remoteProjection = !!e.data.on;
      syncPresentButton();
    }
  });
  channel?.postMessage({ t: "hello" });

  // Recovery when the presenter window is closed: the projection alone has no controls.
  const reopen = trusted("button", { type: "button", class: "key key-primary" }, `${icon("screen")}<span>Abrir vista de presentador</span>`);
  const stopHere = trusted("button", { type: "button", class: "key" }, `${icon("power")}<span>Dejar de presentar</span>`);
  const recover = h("div", { class: "present-recover", role: "alertdialog", "aria-label": "Se cerró la vista de presentador", hidden: true }, h("p", {}, "Se cerró la vista de presentador."), h("div", { class: "present-recover-actions" }, reopen, stopHere));
  const corner = trusted("button", { type: "button", class: "key present-corner", "aria-label": "Dejar de presentar" }, `${icon("shrink")}<span>Salir</span>`);
  programHost.append(recover, corner);
  stopHere.addEventListener("click", () => setPresenting(false));
  corner.addEventListener("click", () => setPresenting(false));
  let lastPresenterRect: Rect | null = null;
  reopen.addEventListener("click", () => {
    presenterWin = window.open(`/p/${token}`, "live-deck-presenter", lastPresenterRect ? features(lastPresenterRect) : "popup,width=1280,height=800");
    if (!presenterWin) notifyBlocked();
    else recover.hidden = true;
  });
  window.setInterval(() => {
    if (presenting && presenterWin && presenterWin.closed) {
      presenterWin = null;
      recover.hidden = false;
      consoleEl.classList.add("controls-visible");
    }
  }, 1000);

  const setPresenting = (on: boolean, plan?: PresentPlan) => {
    presenting = on;
    channel?.postMessage({ t: "projecting", on });
    if (!on) {
      recover.hidden = true;
      presenterWin = null;
    }
    consoleEl.classList.toggle("is-presenting", on);
    // With a separate presenter view the projection shows only the slide.
    consoleEl.classList.toggle("projection-only", on && !!plan && !plan.floatingControls);
    if (on) {
      wake();
    } else {
      consoleEl.classList.remove("controls-visible", "projection-only");
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    }
    syncFsPrompt();
    programView.refit();
  };
  presentBtn.addEventListener("click", async () => {
    // From a presenter window while another tab projects, the button stops it.
    if (remoteProjection && !presenting) {
      channel?.postMessage({ t: "stop" });
      remoteProjection = false;
      syncPresentButton();
      return;
    }
    const req = await openPresentDialog();
    if (!req) return;
    const plan = planPresentation(req, req.screens, req.currentId);
    if (ctx.state.status === "waiting") ctx.send({ t: "start" });
    else if (req.fromStart) ctx.send({ t: "goto", pos: { slide: 0, step: 0 } });

    if (plan.projectorWindow) {
      // The console stays here; the slide opens covering the chosen screen.
      projectorWin = window.open(`/p/${token}/screen?present=1`, "live-deck-screen", features(plan.projectorWindow));
      if (!projectorWin) return notifyBlocked();
      showSharing(plan.screenLabel);
      return;
    }
    setPresenting(true, plan);
    // Fullscreen first: Chrome may still let the same click open the presenter window.
    usedFullscreen = plan.fullscreen;
    pendingScreen = null;
    if (plan.fullscreen) await goFullscreen(null);
    syncFsPrompt();
    if (plan.presenterWindow) {
      lastPresenterRect = plan.presenterWindow;
      presenterWin = window.open(`/p/${token}`, "live-deck-presenter", features(plan.presenterWindow));
      if (!presenterWin) notifyBlocked();
    }
  });
  // "Presentando en …" banner while the projection lives on another screen.
  let projectorWin: Window | null = null;
  const shareLabel = h("p", { class: "share-banner-text" });
  const stopShare = trusted("button", { type: "button", class: "key key-danger" }, `${icon("power")}<span>Detener</span>`);
  const shareBanner = h("div", { class: "share-banner", role: "status", hidden: true }, h("span", { class: "share-dot", "aria-hidden": "true" }), shareLabel, stopShare);
  consoleEl.insertBefore(shareBanner, body);
  const hideSharing = () => {
    shareBanner.hidden = true;
    presentBtn.hidden = ctx.state.status === "ended";
    projectorWin = null;
  };
  const showSharing = (where: string) => {
    shareLabel.textContent = `Presentando en ${where === "una ventana aparte" ? where : `«${where}»`}. Haz clic una vez en la diapositiva de esa pantalla para verla en pantalla completa.`;
    shareBanner.hidden = false;
    presentBtn.hidden = true;
  };
  stopShare.addEventListener("click", () => {
    channel?.postMessage({ t: "close-screen" });
    projectorWin?.close();
    hideSharing();
  });
  window.setInterval(() => {
    if (projectorWin && projectorWin.closed) hideSharing();
  }, 1000);
  const notifyBlocked = () =>
    void confirmSheet("El navegador bloqueó la ventana", "Permite ventanas emergentes para este sitio y vuelve a pulsar Presentar.", "Entendido", false);
  presentExit.addEventListener("click", () => setPresenting(false));
  let wasFullscreen = false;
  document.addEventListener("fullscreenchange", () => {
    // Leaving fullscreen (Esc) ends the presentation, as in other slide tools.
    if (presenting && wasFullscreen && !document.fullscreenElement) setPresenting(false);
    wasFullscreen = !!document.fullscreenElement;
  });
  // When the dialog click was spent on the presenter window, one more click
  // here completes fullscreen (browsers require a fresh gesture).
  const fsPrompt = trusted("button", { type: "button", class: "key key-primary fs-prompt", hidden: true }, `${icon("expand")}<span>Pantalla completa</span>`);
  fsPrompt.addEventListener("click", () => void goFullscreen(pendingScreen));
  programHost.append(fsPrompt);
  let pendingScreen: string | null = null;
  const syncFsPrompt = () => (fsPrompt.hidden = !(presenting && usedFullscreen && !document.fullscreenElement));
  document.addEventListener("fullscreenchange", () => {
    syncFsPrompt();
    programView.refit();
  });
  document.addEventListener("visibilitychange", () => programView.refit());
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && presenting && !document.fullscreenElement && !document.querySelector("dialog[open]")) setPresenting(false);
  });
  window.addEventListener("pointermove", wake);
  let endPanel: ReturnType<typeof createEndPanel> | null = null;

  const assetBase = `/decks/${ctx.deckId}/`;
  const programView = new StageView(programHost, ctx.deck, { assetBase, joinUrl: ctx.joinUrl });
  const nextView = new StageView(nextHost, ctx.deck, { assetBase, joinUrl: ctx.joinUrl });
  void qrSvg(ctx.joinUrl).then((svg) => {
    programView.setOptions({ qrSvg: svg });
    nextView.setOptions({ qrSvg: svg });
  });
  bindDeckKeys(window, { next: () => ctx.send({ t: "next" }), prev: () => ctx.send({ t: "prev" }) });
  bindEffectTools(programView, () => tool, ctx.send, () => ctx.state.effect);
  setInterval(() => {
    timer.textContent = elapsed(ctx.state.startedAt);
    pq.update(ctx.state, ctx.clockOffset);
    const slide = ctx.deck.slides[ctx.state.position.slide]!;
    programView.setQuiz(ctx.state.quizzes[slide.id] ?? null, { presenter: true, clockOffset: ctx.clockOffset });
  }, 1000);

  return {
    ripple: (x, y) => programView.ripple(x, y),
    summary(s) {
      endPanel?.setSummary(s);
    },
    reactions(counts, totals) {
      if (ctx.state.presenterView.showReactions) floatReactions(programFloaters, counts);
      if (ctx.state.presenterView.showReactionCounter) pa.counter.update(totals);
    },
    chat(op: "add" | "remove" | "history", arg: unknown) {
      if (op === "add") chatUi.add(arg as ChatMessage);
      else if (op === "remove") chatUi.remove(arg as string);
      else chatUi.history(arg as ChatMessage[]);
    },
    update(s) {
      if (s.status === "ended" && presenting) setPresenting(false);
      if (s.status === "ended" && !endPanel) {
        endPanel = createEndPanel(async () => {
          const ok = await confirmSheet("¿Borrar los datos ahora?", "Se eliminan votos, ranking y reacciones del servidor. Descarga el resumen antes.", "Borrar datos", true);
          if (ok) ctx.send({ t: "purge" });
        });
        body.replaceChildren(endPanel.el);
        transport.hidden = true;
        for (const b of [qrBtn, remoteBtn, presentBtn]) b.hidden = true;
        ctx.send({ t: "summary" });
      }
      pa.update(s);
      chatUi.update(s);
      const l = lampFor(s);
      lamp.dataset.state = l.state;
      lamp.textContent = l.text;
      for (const b of [...toolKeys, clearFx]) b.disabled = s.status !== "live";
      clearFx.disabled = s.status !== "live" || !s.effect;
      count.textContent = `${s.audienceCount} ${s.audienceCount === 1 ? "persona" : "personas"}`;
      programView.show(s.position);
      programView.setEffect(s.effect);
      const current = ctx.deck.slides[s.position.slide]!;
      programView.setQuiz(s.quizzes[current.id] ?? null, { presenter: true, clockOffset: ctx.clockOffset });
      pq.update(s, ctx.clockOffset);
      const upcoming: Position = nextPosition(ctx.deck.slides, s.position);
      const atEnd = upcoming.slide === s.position.slide && upcoming.step === s.position.step;
      nextHost.hidden = atEnd;
      if (!atEnd) nextView.show(upcoming);
      nextMon.dataset.empty = String(atEnd);
      slideNo.textContent = `${s.position.slide + 1} / ${ctx.deck.slides.length}`;
      notes.textContent = ctx.deck.slides[s.position.slide]?.notes ?? "Sin notas para esta diapositiva.";
      timer.textContent = elapsed(s.startedAt);
      prev.disabled = s.status !== "live";
      next.disabled = s.status !== "live";
      actions.update(s);
    },
    connection(status) {
      conn.textContent = status === "open" ? "" : status === "reconnecting" ? "Reconectando…" : status === "closed" ? "Desconectado" : "Conectando…";
    },
  };
}

function openRemoteSheet(url: string) {
  const qr = h("div", { class: "share-qr", role: "img", "aria-label": "Código QR del control móvil" });
  void qrSvg(url).then((svg) => (qr.innerHTML = svg));
  const close = trusted("button", { type: "button", class: "key key-icon sheet-close", "aria-label": "Cerrar" }, icon("close"));
  const sheet = h(
    "dialog",
    { class: "sheet share-sheet", "aria-labelledby": "remote-title" },
    close,
    h("h2", { id: "remote-title" }, "Control desde tu celular"),
    qr,
    h("p", { class: "form-error" }, "Este código da control de la presentación. No lo muestres en el proyector; el celular te pedirá el PIN."),
  );
  close.addEventListener("click", () => sheet.close());
  sheet.addEventListener("close", () => sheet.remove());
  document.body.append(sheet);
  sheet.showModal();
}

// Projector screen ----------------------------------------------------------------

function screenUi(root: HTMLElement, ctx: PresenterContext): PresenterUi {
  const host = h("div", { class: "screen-host" });
  const hint = h("p", { class: "screen-hint" }, "Doble clic o tecla F para pantalla completa");
  const floaters = h("div", { class: "floaters floaters-screen", "aria-hidden": "true" });
  const counter = createReactionCounter();
  counter.el.classList.add("screen-counter");
  counter.update(null);
  const board = h("section", { class: "screen-board", "aria-label": "Ranking", hidden: true }, h("h2", { class: "legend" }, "Ranking"), h("ol", { class: "leaderboard" }));
  root.replaceChildren(h("main", { class: "screen" }, host, floaters, counter.el, board, hint));
  const view = new StageView(host, ctx.deck, { assetBase: `/decks/${ctx.deckId}/`, joinUrl: ctx.joinUrl });
  void qrSvg(ctx.joinUrl).then((svg) => view.setOptions({ qrSvg: svg }));

  const fullscreen = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {});
  host.addEventListener("dblclick", fullscreen);
  // Opened from the console's Presentar: one click here completes fullscreen
  // (browsers do not let another window start fullscreen without it).
  if (new URLSearchParams(location.search).has("present")) {
    const start = trusted("button", { type: "button", class: "screen-start" }, `${icon("expand")}<span>Haz clic para presentar en pantalla completa</span>`);
    root.querySelector(".screen")!.append(start);
    const sync = () => (start.hidden = !!document.fullscreenElement);
    start.addEventListener("click", () => void document.documentElement.requestFullscreen().catch(() => {}));
    document.addEventListener("fullscreenchange", sync);
    sync();
  }
  if (typeof BroadcastChannel === "function") {
    const ch = new BroadcastChannel(`live-deck-present:${ctx.token}`);
    ch.addEventListener("message", (e: MessageEvent<{ t: string }>) => {
      if (e.data.t === "close-screen") window.close();
    });
  }
  window.addEventListener("keydown", (e) => {
    if (e.key === "f" || e.key === "F") fullscreen();
  });
  bindDeckKeys(window, { next: () => ctx.send({ t: "next" }), prev: () => ctx.send({ t: "prev" }) });

  let idle: number | undefined;
  window.addEventListener("pointermove", () => {
    root.classList.remove("cursor-hidden");
    hint.classList.add("visible");
    clearTimeout(idle);
    idle = window.setTimeout(() => {
      root.classList.add("cursor-hidden");
      hint.classList.remove("visible");
    }, 2000);
  });

  setInterval(() => {
    const view0 = ctx.state.quizzes[ctx.deck.slides[ctx.state.position.slide]!.id];
    if (view0?.status === "open" && view0.endsAt) view.setQuiz(view0, { clockOffset: ctx.clockOffset });
  }, 1000);

  return {
    ripple: (x, y) => view.ripple(x, y),
    reactions(counts, totals) {
      if (ctx.state.presenterView.showReactions) floatReactions(floaters, counts);
      counter.update(ctx.state.presenterView.showReactionCounter ? totals : null);
    },
    update(s) {
      if (!s.presenterView.showReactionCounter) counter.update(null);
      // Public leaderboard on revealed quiz slides, only when the presenter shows scores.
      const slideId = ctx.deck.slides[s.position.slide]!.id;
      const rows = (s.leaderboard ?? []).slice(0, 5);
      board.hidden = !s.showScore || s.quizzes[slideId]?.status !== "revealed" || rows.length === 0;
      if (!board.hidden) {
        board.querySelector("ol")!.replaceChildren(
          ...rows.map((r) => h("li", {}, h("span", { class: "lb-rank" }, String(r.rank)), h("span", { class: "lb-name" }, r.name), h("span", { class: "lb-score" }, `${r.correct}/${r.answered}`))),
        );
      }
      view.show(s.position);
      view.setEffect(s.effect);
      view.setQuiz(s.quizzes[ctx.deck.slides[s.position.slide]!.id] ?? null, { clockOffset: ctx.clockOffset });
    },
    connection() {},
  };
}

// Phone remote --------------------------------------------------------------------

function remoteUi(root: HTMLElement, ctx: PresenterContext, _token: string): PresenterUi {
  const lamp = h("span", { class: "lamp" });
  const slideNo = h("span", { class: "remote-slide-no" });
  const timer = h("span", { class: "remote-timer" }, "00:00");
  const host = h("div", { class: "remote-preview" });
  const notes = h("div", { class: "console-notes remote-notes" });
  const prev = trusted("button", { type: "button", class: "key key-transport", "aria-label": "Anterior" }, icon("prev"));
  const next = trusted("button", { type: "button", class: "key key-transport key-primary", "aria-label": "Siguiente" }, `<span>Siguiente</span>${icon("next")}`);
  prev.addEventListener("click", () => ctx.send({ t: "prev" }));
  next.addEventListener("click", () => ctx.send({ t: "next" }));
  const actions = sessionActions(ctx);
  const rq = createPresenterQuiz(ctx.deck, ctx.send, { leaderboard: false });
  let rtool: EffectTool = "ripple";
  const rtools = (
    [
      ["ripple", "Señalar"],
      ["focus", "Enfocar"],
      ["zoom", "Zoom"],
    ] as const
  ).map(([id, label]) => {
    const b = h("button", { type: "button", class: "key", "data-tool": id, "aria-pressed": String(id === rtool) }, label);
    b.addEventListener("click", () => {
      const next = pressTool(rtool, id, ctx.state.effect?.kind ?? null);
      if (next.clear) ctx.send({ t: "effect", effect: null });
      rtool = next.tool;
      for (const k of rtools) k.setAttribute("aria-pressed", String(k.dataset.tool === rtool));
    });
    return b;
  });
  const rclear = h("button", { type: "button", class: "key key-ghost" }, "Quitar");
  rclear.addEventListener("click", () => ctx.send({ t: "effect", effect: null }));

  root.replaceChildren(
    h(
      "main",
      { class: "remote" },
      h("header", { class: "aud-bar" }, lamp, slideNo, h("span", { class: "spacer" }), timer),
      host,
      h("div", { class: "fx-tools remote-tools", role: "toolbar", "aria-label": "Efectos" }, ...rtools, rclear),
      h("div", { class: "remote-middle" }, rq.quizEl, notes),
      h("div", { class: "remote-transport" }, prev, next),
      h("div", { class: "remote-actions" }, actions.start, actions.restrict, actions.end),
    ),
  );
  const view = new StageView(host, ctx.deck, { assetBase: `/decks/${ctx.deckId}/`, joinUrl: ctx.joinUrl });
  // Swipe changes slides with the pointer tool; taps place the selected effect.
  bindSwipe(host, { next: () => ctx.send({ t: "next" }), prev: () => ctx.send({ t: "prev" }) }, 40, () => false, () => rtool === "ripple");
  bindEffectTools(view, () => rtool, ctx.send, () => ctx.state.effect);
  setInterval(() => (timer.textContent = elapsed(ctx.state.startedAt)), 1000);

  return {
    ripple: (x, y) => view.ripple(x, y),
    update(s) {
      const l = lampFor(s);
      lamp.dataset.state = l.state;
      lamp.textContent = l.text;
      slideNo.textContent = `${s.position.slide + 1} / ${ctx.deck.slides.length}`;
      view.show(s.position);
      view.setEffect(s.effect);
      view.setQuiz(s.quizzes[ctx.deck.slides[s.position.slide]!.id] ?? null, { presenter: true, clockOffset: ctx.clockOffset });
      rq.update(s, ctx.clockOffset);
      notes.textContent = ctx.deck.slides[s.position.slide]?.notes ?? "Sin notas.";
      prev.disabled = s.status !== "live";
      next.disabled = s.status !== "live";
      actions.update(s);
    },
    connection() {},
  };
}
