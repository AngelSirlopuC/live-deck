import { h, storage, trusted } from "./dom.ts";
import { icon } from "./icons.ts";
import type { PresentOptions, ScreenChoice } from "./present-plan.ts";
import { loadScreens, screenPermission } from "./screens.ts";

const local = storage("local");
const PREFS = "ld:present:prefs";

export interface PresentRequest extends PresentOptions {
  fromStart: boolean;
  screens: ScreenChoice[];
  currentId: string | null;
}

/** Presentation options dialog (Google Slides style). Resolves null on cancel. */
export function openPresentDialog(): Promise<PresentRequest | null> {
  return new Promise((resolve) => {
    const saved = local.read<{ presenterView: boolean; fromStart: boolean; fullscreen: boolean }>(PREFS) ?? { presenterView: true, fromStart: false, fullscreen: true };
    let screens: ScreenChoice[] = [];
    let currentId: string | null = null;
    let target: string | null = null;
    let mode: "tab" | "window" = "tab";

    const option = (id: string, title: string, hint: string, checked: boolean, art: string) => {
      const input = h("input", { type: "checkbox", id, checked });
      const row = h("label", { class: "po-option", for: id }, input, h("span", { class: "po-text" }, h("strong", {}, title), hint ? h("span", {}, hint) : null), h("span", { class: `po-art po-art-${art}`, "aria-hidden": "true" }));
      return { input, row };
    };
    const presenter = option("po-presenter", "Vista de presentador", "Notas, siguiente diapositiva, quiz, chat y controles en una ventana aparte", saved.presenterView, "presenter");
    const fromStart = option("po-start", "Mostrar la presentación desde el principio", "", saved.fromStart, "start");
    const full = option("po-full", "Pantalla completa", "", saved.fullscreen, "full");

    const list = h("div", { class: "po-screens", role: "radiogroup", "aria-label": "Pantalla de presentación" });
    const permission = h("div", { class: "po-permission", hidden: true });
    const renderScreens = () => {
      const items: Array<{ id: string | null; label: string; detail: string; mode: "tab" | "window" }> = [];
      if (screens.length === 0) items.push({ id: null, label: "Pantalla actual", detail: "Esta pestaña muestra la diapositiva", mode: "tab" });
      for (const s of screens) {
        items.push({ id: s.id, label: `${s.label}${s.id === currentId ? " (actual)" : ""}`, detail: `${s.width}×${s.height}${s.isPrimary ? " · principal" : ""}`, mode: "tab" });
      }
      items.push({ id: null, label: "Ventana aparte", detail: screens.length > 1 ? "Se abre en otra pantalla" : "Arrástrala al proyector y pulsa F", mode: "window" });
      list.replaceChildren(
        ...items.map((it, i) => {
          const checked = it.mode === mode && (it.mode === "window" || it.id === target);
          const input = h("input", { type: "radio", name: "po-screen", id: `po-s${i}`, checked });
          input.addEventListener("change", () => {
            target = it.id;
            mode = it.mode;
          });
          return h("label", { class: "po-screen", for: `po-s${i}` }, input, h("span", { class: "po-text" }, h("strong", {}, it.label), h("span", {}, it.detail)), trusted("span", { class: "po-screen-icon", "aria-hidden": "true" }, icon(it.mode === "window" ? "screen" : "laptop")));
        }),
      );
    };

    const refresh = async () => {
      const found = await loadScreens(() => void refresh());
      if (found) {
        screens = found.screens;
        currentId = found.currentId;
        // Default to an external screen when one exists: that is usually the projector.
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
      const state = await screenPermission();
      if (state === "granted") await refresh();
      else renderScreens();
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
