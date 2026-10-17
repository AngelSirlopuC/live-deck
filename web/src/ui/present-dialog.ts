import { h, storage, trusted } from "./dom.ts";
import { icon } from "./icons.ts";
import type { PresentOptions, ScreenChoice } from "./present-plan.ts";
import { displaysAvailable, presentationApiSupported } from "./present-api.ts";
import { loadScreens, screenPermission } from "./screens.ts";

const local = storage("local");
const PREFS = "ld:present:prefs";

export interface PresentRequest extends PresentOptions {
  fromStart: boolean;
  screens: ScreenChoice[];
  currentId: string | null;
}

/** Presentation options dialog (Google Slides style). Resolves null on cancel. */
export function openPresentDialog(displayUrl: string): Promise<PresentRequest | null> {
  return new Promise((resolve) => {
    const saved = local.read<{ presenterView: boolean; fromStart: boolean; fullscreen: boolean }>(PREFS) ?? { presenterView: true, fromStart: false, fullscreen: true };
    let screens: ScreenChoice[] = [];
    let currentId: string | null = null;
    let target: string | null = null;
    const apiSupported = presentationApiSupported();
    let displayFound: boolean | null = null;
    let mode: "tab" | "window" | "display" = "tab";

    const option = (id: string, title: string, hint: string, checked: boolean, art: string) => {
      const input = h("input", { type: "checkbox", id, checked });
      const row = h("label", { class: "po-option", for: id }, input, h("span", { class: "po-text" }, h("strong", {}, title), hint ? h("span", {}, hint) : null), h("span", { class: `po-art po-art-${art}`, "aria-hidden": "true" }));
      return { input, row };
    };
    const presenter = option("po-presenter", "Vista de presentador", "Solo con una pantalla: la consola se abre en una ventana aparte y esta pestaña muestra la diapositiva", saved.presenterView, "presenter");
    const fromStart = option("po-start", "Mostrar la presentación desde el principio", "", saved.fromStart, "start");
    const full = option("po-full", "Pantalla completa", "", saved.fullscreen, "full");

    const list = h("div", { class: "po-screens", role: "radiogroup", "aria-label": "Pantalla de presentación" });
    const note = h("p", { class: "po-note", hidden: true }, "La consola se queda en esta pestaña. En la otra pantalla, un clic sobre la diapositiva la pone en pantalla completa.");
    const permission = h("div", { class: "po-permission", hidden: true });
    const renderScreens = () => {
      const items: Array<{ id: string | null; label: string; detail: string; mode: "tab" | "window" | "display"; internal: boolean }> = [];
      if (screens.length === 0) items.push({ id: null, label: "Pantalla actual", detail: "Esta pestaña muestra la diapositiva", mode: "tab", internal: true });
      for (const s of screens) {
        items.push({ id: s.id, label: `${s.label}${s.id === currentId ? " (actual)" : ""}`, detail: `${s.width}×${s.height}${s.isPrimary ? " · principal" : ""}`, mode: "tab", internal: s.isInternal });
      }
      // Chrome's own picker (Presentation API): handy for Chromecast.
      if (apiSupported) {
        items.push({
          id: null,
          label: "Chromecast u otra pantalla (selector de Chrome)",
          detail: displayFound === false ? "Chrome no detecta pantallas: conecta una en modo extendido o un Chromecast" : "Chrome te deja elegir la pantalla y la proyecta a pantalla completa",
          mode: "display",
          internal: false,
        });
      }
      // Only needed when the browser cannot list screens.
      if (screens.length === 0) items.push({ id: null, label: "Ventana aparte", detail: "Arrástrala al proyector y haz clic en ella para pantalla completa", mode: "window", internal: false });
      const syncPresenterOption = () => {
        const elsewhere = mode !== "tab" || (target !== null && target !== currentId);
        presenter.row.hidden = elsewhere;
        full.row.hidden = elsewhere;
        note.hidden = !elsewhere;
        note.textContent =
          mode === "display"
            ? "La consola se queda en esta pestaña. Al iniciar, Chrome te pide elegir la pantalla y proyecta la diapositiva a pantalla completa."
            : mode === "window"
              ? "La consola se queda en esta pestaña. Arrastra la ventana al proyector y haz clic en ella para pantalla completa."
              : "Esta pestaña se proyecta a pantalla completa en esa pantalla y la vista de presentador (la consola) se abre en una ventana en tu pantalla.";
        // The window-management permission only matters when not using Chrome's picker.
        permission.classList.toggle("is-irrelevant", mode === "display");
      };
      list.replaceChildren(
        ...items.map((it, i) => {
          const checked = it.mode === mode && (it.mode !== "tab" || it.id === target);
          const input = h("input", { type: "radio", name: "po-screen", id: `po-s${i}`, checked });
          input.addEventListener("change", () => {
            target = it.id;
            mode = it.mode;
            syncPresenterOption();
          });
          return h("label", { class: "po-screen", for: `po-s${i}` }, input, h("span", { class: "po-text" }, h("strong", {}, it.label), h("span", {}, it.detail)), trusted("span", { class: "po-screen-icon", "aria-hidden": "true" }, icon(it.internal ? "laptop" : "screen")));
        }),
      );
      syncPresenterOption();
    };

    const refresh = async () => {
      const found = await loadScreens(() => void refresh());
      if (found) {
        screens = found.screens;
        currentId = found.currentId;
        // Default to an external screen when one exists: that is usually the projector.
        // Google Slides model: default to an external screen, the projector.
        if (target === null && mode === "tab") target = screens.find((s) => s.id !== currentId)?.id ?? currentId;
      }
      renderScreens();
    };

    const allow = h("button", { type: "button", class: "key key-ghost" }, "Permitir");
    allow.addEventListener("click", async () => {
      await refresh();
      permission.hidden = (await screenPermission()) === "granted";
    });

    void (async () => {
      if (apiSupported) {
        displayFound = await displaysAvailable(displayUrl, (v) => {
          displayFound = v;
          renderScreens();
        });
      }
      let state = await screenPermission();
      // Without Chrome's picker, ask right away: the click that opened this dialog
      // lets the browser show its prompt. With the picker it is not needed.
      if (state === "granted" || state === "prompt") {
        await refresh();
        state = await screenPermission();
      } else renderScreens();
      if (state === "prompt") {
        permission.hidden = false;
        permission.replaceChildren(h("p", {}, "Permite que Live Deck vea tus otras pantallas para proyectar en ellas"), allow);
      } else if (state === "denied") {
        permission.hidden = false;
        permission.replaceChildren(h("p", {}, "El permiso de gestión de ventanas está bloqueado. Actívalo en la configuración del sitio para elegir pantallas."));
      } else if (state === "unsupported") {
        permission.hidden = false;
        permission.replaceChildren(h("p", {}, "Este navegador no permite elegir pantallas. Usa \"Ventana aparte\" y arrástrala al proyector, o proyecta esta pestaña."));
      }
    })();

    const cancel = h("button", { type: "button", class: "key key-ghost" }, "Cancelar");
    const start = h("button", { type: "submit", class: "key key-primary" }, "Iniciar presentación");
    const form = h(
      "form",
      { method: "dialog", class: "po-form" },
      h("h2", { id: "po-title" }, "Opciones de presentación"),
      presenter.row,
      fromStart.row,
      full.row,
      h("h3", { class: "legend" }, "Pantalla de presentación"),
      list,
      note,
      permission,
      h("div", { class: "sheet-actions po-actions" }, cancel, start),
    );
    const sheet = h("dialog", { class: "sheet present-dialog", "aria-labelledby": "po-title" }, form);
    const done = (value: PresentRequest | null) => {
      sheet.close();
      sheet.remove();
      resolve(value);
    };
    cancel.addEventListener("click", () => done(null));
    sheet.addEventListener("cancel", () => done(null));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const prefs = { presenterView: presenter.input.checked, fromStart: fromStart.input.checked, fullscreen: full.input.checked };
      local.write(PREFS, prefs);
      done({ ...prefs, target, mode, screens, currentId });
    });
    document.body.append(sheet);
    sheet.showModal();
    start.focus();
  });
}
