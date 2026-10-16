import type { Deck } from "../../../shared/deck.ts";
import { nextPosition, type Position } from "../../../shared/nav.ts";
import { PIN, type PresenterCommand, type PresenterSurface, type SessionSnapshot } from "../../../shared/protocol.ts";
import { Connection, type ConnectionStatus } from "../net/connection.ts";
import { StageView } from "../render/stage-view.ts";
import { h, storage, trusted } from "../ui/dom.ts";
import { icon } from "../ui/icons.ts";
import { bindDeckKeys, bindSwipe } from "../ui/input.ts";
import { qrSvg } from "../ui/qr.ts";
import { openShareSheet } from "../ui/share.ts";

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
  root.replaceChildren(h("main", { class: "join" }, h("span", { class: "lamp", "data-state": "off" }, surfaceName), h("h1", { class: "join-title" }, "Ingresa tu PIN"), form));
  input.focus();
}

interface PresenterContext {
  deck: Deck;
  deckId: string;
  code: string;
  joinUrl: string;
  state: SessionSnapshot;
  send: (cmd: PresenterCommand) => void;
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
    onMessage: (msg) => {
      if (msg.t === "welcome-presenter") {
        if (!ctx) {
          ctx = { deck: msg.deck, deckId: msg.deckId, code: msg.code, joinUrl: msg.joinUrl, state: msg.state, send: (cmd) => conn.send(cmd) };
          document.title = `${msg.deck.title} · ${surface === "screen" ? "pantalla" : surface === "remote" ? "control" : "consola"}`;
          ui = surface === "screen" ? screenUi(root, ctx) : surface === "remote" ? remoteUi(root, ctx, token) : consoleUi(root, ctx, token);
        }
        ctx.state = msg.state;
        ui!.update(ctx.state);
        ui!.connection(status);
      } else if (msg.t === "state" && ctx) {
        ctx.state = msg.state;
        ui?.update(ctx.state);
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
  const codeTag = h("span", { class: "console-stat" }, `Código ${ctx.code}`);
  const conn = h("span", { class: "console-conn", role: "status", "aria-live": "polite" });
  const qrBtn = trusted("button", { type: "button", class: "key" }, `${icon("qr")}<span>Enlace del público</span>`);
  const screenBtn = trusted("button", { type: "button", class: "key" }, `${icon("screen")}<span>Abrir pantalla</span>`);
  const remoteBtn = trusted("button", { type: "button", class: "key" }, `${icon("phone")}<span>Control móvil</span>`);
  qrBtn.addEventListener("click", () => openShareSheet(ctx.joinUrl, ctx.deck.title));
  screenBtn.addEventListener("click", () => window.open(`/p/${token}/screen`, "live-deck-screen", "noopener"));
  remoteBtn.addEventListener("click", () => openRemoteSheet(`${location.origin}/p/${token}/remote`));

  const header = h("header", { class: "console-bar" }, lamp, h("strong", { class: "console-title" }, ctx.deck.title), codeTag, count, conn, h("span", { class: "spacer" }), qrBtn, screenBtn, remoteBtn);

  const programHost = h("div", { class: "monitor-host" });
  const nextHost = h("div", { class: "monitor-host" });
  const program = h("section", { class: "monitor monitor-program", "aria-label": "Diapositiva actual" }, h("span", { class: "monitor-label" }, "Programa"), programHost);
  const nextMon = h("section", { class: "monitor monitor-next", "aria-label": "Siguiente" }, h("span", { class: "monitor-label" }, "Siguiente"), nextHost);
  const timer = h("div", { class: "console-timer", "aria-label": "Tiempo transcurrido" }, "00:00");
  const slideNo = h("div", { class: "console-slide-no" });
  const notes = h("div", { class: "console-notes", tabindex: 0, "aria-label": "Notas del ponente" });
  const side = h("aside", { class: "console-side" }, nextMon, h("div", { class: "console-meters" }, timer, slideNo), h("h2", { class: "legend" }, "Notas"), notes);

  const prev = trusted("button", { type: "button", class: "key key-transport", "aria-label": "Anterior" }, `${icon("prev")}<span>Anterior</span>`);
  const next = trusted("button", { type: "button", class: "key key-transport key-primary", "aria-label": "Siguiente" }, `<span>Siguiente</span>${icon("next")}`);
  prev.addEventListener("click", () => ctx.send({ t: "prev" }));
  next.addEventListener("click", () => ctx.send({ t: "next" }));
  const actions = sessionActions(ctx);
  const transport = h("footer", { class: "console-transport" }, actions.start, prev, next, h("span", { class: "spacer" }), actions.restrict, h("span", { class: "transport-gap" }), actions.end);

  root.replaceChildren(h("main", { class: "console" }, header, h("div", { class: "console-body" }, program, side), transport));

  const assetBase = `/decks/${ctx.deckId}/`;
  const programView = new StageView(programHost, ctx.deck, { assetBase, joinUrl: ctx.joinUrl });
  const nextView = new StageView(nextHost, ctx.deck, { assetBase, joinUrl: ctx.joinUrl });
  void qrSvg(ctx.joinUrl).then((svg) => {
    programView.setOptions({ qrSvg: svg });
    nextView.setOptions({ qrSvg: svg });
  });
  bindDeckKeys(window, { next: () => ctx.send({ t: "next" }), prev: () => ctx.send({ t: "prev" }) });
  setInterval(() => (timer.textContent = elapsed(ctx.state.startedAt)), 1000);

  return {
    update(s) {
      const l = lampFor(s);
      lamp.dataset.state = l.state;
      lamp.textContent = l.text;
      count.textContent = `${s.audienceCount} ${s.audienceCount === 1 ? "persona" : "personas"}`;
      programView.show(s.position);
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
  root.replaceChildren(h("main", { class: "screen" }, host, hint));
  const view = new StageView(host, ctx.deck, { assetBase: `/decks/${ctx.deckId}/`, joinUrl: ctx.joinUrl });
  void qrSvg(ctx.joinUrl).then((svg) => view.setOptions({ qrSvg: svg }));

  const fullscreen = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {});
  host.addEventListener("dblclick", fullscreen);
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

  return {
    update(s) {
      view.show(s.position);
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

  root.replaceChildren(
    h(
      "main",
      { class: "remote" },
      h("header", { class: "aud-bar" }, lamp, slideNo, h("span", { class: "spacer" }), timer),
      host,
      notes,
      h("div", { class: "remote-transport" }, prev, next),
      h("div", { class: "remote-actions" }, actions.start, actions.restrict, actions.end),
    ),
  );
  const view = new StageView(host, ctx.deck, { assetBase: `/decks/${ctx.deckId}/`, joinUrl: ctx.joinUrl });
  bindSwipe(host, { next: () => ctx.send({ t: "next" }), prev: () => ctx.send({ t: "prev" }) });
  setInterval(() => (timer.textContent = elapsed(ctx.state.startedAt)), 1000);

  return {
    update(s) {
      const l = lampFor(s);
      lamp.dataset.state = l.state;
      lamp.textContent = l.text;
      slideNo.textContent = `${s.position.slide + 1} / ${ctx.deck.slides.length}`;
      view.show(s.position);
      notes.textContent = ctx.deck.slides[s.position.slide]?.notes ?? "Sin notas.";
      prev.disabled = s.status !== "live";
      next.disabled = s.status !== "live";
      actions.update(s);
    },
    connection() {},
  };
}
