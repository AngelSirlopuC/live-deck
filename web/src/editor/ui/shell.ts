// Editor shell: top bar, rail, canvas, inspector tabs, keyboard dispatch, the
// save flow (validation sheet, conflict sheet, key prompt) and the command
// menu. Everything renders from controller state.
import type { IconName } from "../../../../shared/icons.ts";
import { PRESET_NAMES } from "../../../../shared/themes.ts";
import { h, trusted } from "../../ui/dom.ts";
import { createTabs } from "../../ui/tabs.ts";
import type { ZOrder } from "../model/index.ts";
import { createCanvas } from "./canvas.ts";
import { createCommandMenu, type CommandItem } from "./command-menu.ts";
import type { EditorController, EditorState, SaveOutcome } from "./controller.ts";
import { exportPdf } from "./export.ts";
import { iconKey } from "./fields.ts";
import { edIcon } from "./icons.ts";
import { createDesignPanel } from "./inspector/design.ts";
import { createElementPanel } from "./inspector/element.ts";
import { createSlidePanel } from "./inspector/slide.ts";
import { closeMenu, isMenuOpen, openMenu, type MenuEntry } from "./menu.ts";
import { ADD_SLIDE_ITEMS, createOverview, createRail, deleteSlideWithConfirm } from "./rail.ts";
import { assetSheet, confirmSheet, conflictSheet, iconSheet, isSheetOpen, issuesSheet, keySheet, messageSheet } from "./sheets.ts";
import { isTypingTarget, shortcutFor } from "./shortcuts.ts";
import { createThumbCache } from "./thumbs.ts";
import { createToolbar } from "./toolbar.ts";

const MOD = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl+";

export interface ShellOptions {
  /** Where "assets/…" resolve, e.g. "/decks/<id>/". */
  assetBase: string;
  previewUrl: string;
  homeUrl?: string;
  print?: (deck: EditorState["deck"]) => void;
}

export function createShell(ctrl: EditorController, o: ShellOptions) {
  const root = h("div", { class: "editor" });
  const thumbs = createThumbCache(o.assetBase);

  // --- pickers shared by toolbar, inspector and canvas drop -----------------
  let assetCache: { name: string; size: number }[] | null = null;
  const upload = async (file: File): Promise<{ ok: true; src: string } | { ok: false; message: string }> => {
    const result = await ctrl.api.upload(ctrl.deckId, file, file.name);
    if (result.kind === "ok") {
      assetCache = null;
      return { ok: true, src: result.src };
    }
    if (result.kind === "unauthorized") {
      askForKey("La clave ya no es válida.");
      return { ok: false, message: "Necesitas la clave de administración para subir imágenes." };
    }
    return { ok: false, message: result.message };
  };
  const openAssetPicker = async (onPick: (src: string) => void, onClose?: () => void) => {
    if (!assetCache) {
      const result = await ctrl.api.listAssets(ctrl.deckId);
      if (result.kind === "unauthorized") {
        onClose?.();
        return askForKey("La clave ya no es válida.");
      }
      assetCache = result.kind === "ok" ? result.assets : [];
    }
    assetSheet({ assets: assetCache, assetBase: o.assetBase, onPick, onUpload: upload, onClose });
  };
  const openIconPicker = (onPick: (name: string) => void, current?: string) => iconSheet((n) => onPick(n), current as IconName | undefined);
  const insertImage = (src: string, at?: { x: number; y: number }) => ctrl.addElement({ kind: "image", src, alt: "" }, at ? { x: Math.max(0, at.x - 0.2), y: Math.max(0, at.y - 0.25) } : undefined);

  // --- areas --------------------------------------------------------------
  const rail = createRail(ctrl, thumbs);
  const overview = createOverview(ctrl, thumbs);
  const canvas = createCanvas(ctrl, {
    assetBase: o.assetBase,
    onContextMenu: (at) => openMenu(contextEntries(), at, { label: "Elemento", returnFocus: canvas.overlay }),
    onDropFiles: async (files, at) => {
      for (const file of files) {
        const result = await upload(file);
        if (result.ok) insertImage(result.src, at);
        else messageSheet({ title: "No se pudo subir la imagen", message: result.message });
      }
    },
  });
  const toolbar = createToolbar(ctrl, {
    openAssetPicker: () => void openAssetPicker((src) => insertImage(src)),
    openIconPicker: () => openIconPicker((name) => ctrl.addElement({ kind: "icon", name: name as IconName })),
  });
  const elementPanel = createElementPanel(ctrl, { openAssetPicker: (cb) => void openAssetPicker(cb), openIconPicker });
  const slidePanel = createSlidePanel(ctrl, { openAssetPicker: (cb, onClose) => void openAssetPicker(cb, onClose) });
  const designPanel = createDesignPanel(ctrl);
  const tabs = createTabs("inspector", [
    { id: "element", label: "Elemento", panel: elementPanel.el },
    { id: "slide", label: "Diapositiva", panel: slidePanel.el },
    { id: "design", label: "Diseño", panel: designPanel.el },
  ]);
  const inspector = h("aside", { class: "ed-inspector", "aria-label": "Inspector" }, tabs.list, h("div", { class: "ed-inspector-body" }, elementPanel.el, slidePanel.el, designPanel.el));

  // --- top bar ------------------------------------------------------------
  const back = trusted("a", { class: "key key-ghost key-icon ed-key", href: o.homeUrl ?? "/", "aria-label": "Volver al inicio", title: "Volver al inicio" }, edIcon("back"));
  const titleInput = h("input", { type: "text", class: "ed-title", "aria-label": "Título del deck", maxlength: 200, spellcheck: "false" });
  titleInput.addEventListener("input", () => ctrl.dispatch({ type: "setTitle", title: titleInput.value }, "title"));
  titleInput.addEventListener("blur", () => ctrl.seal());
  const lamp = h("span", { class: "lamp ed-lamp" }, "Guardado");
  const status = h("span", { class: "ed-status", role: "status", "aria-live": "polite" }, lamp);
  const undoBtn = iconKey("undo", `Deshacer (${MOD}Z)`, () => ctrl.undo());
  const redoBtn = iconKey("redo", `Rehacer (⇧${MOD}Z)`, () => ctrl.redo());
  const previewLink = trusted("a", { class: "key ed-key", href: o.previewUrl, target: "_blank", rel: "noopener" }, `${edIcon("eye")}<span>Vista previa</span>`);
  const exportBtn = trusted("button", { type: "button", class: "key ed-key" }, `${edIcon("print")}<span>Exportar PDF</span>`);
  exportBtn.addEventListener("click", () => (o.print ?? ((d) => d && exportPdf(d, o.assetBase)))(ctrl.state.deck));
  const cmdBtn = trusted("button", { type: "button", class: "key key-ghost ed-key ed-cmd-hint" }, `${edIcon("command")}<span>Acciones</span><kbd>${MOD}K</kbd>`);
  const saveBtn = trusted("button", { type: "button", class: "key key-primary ed-key ed-save" }, `${edIcon("save")}<span>Guardar</span>`);
  saveBtn.addEventListener("click", () => void save());
  const discardBtn = h("button", { type: "button", class: "key key-ghost ed-key ed-discard" }, "Descartar");
  discardBtn.addEventListener("click", () => void discard());
  const topbar = h("header", { class: "ed-topbar" }, back, titleInput, status, h("span", { class: "spacer" }), undoBtn, redoBtn, previewLink, exportBtn, cmdBtn, discardBtn, saveBtn);

  const center = h("div", { class: "ed-center" }, toolbar.el, canvas.el, overview.el);
  const workspace = h("div", { class: "ed-workspace" }, rail.el, center, inspector);
  const narrow = h("div", { class: "ed-narrow" }, h("p", { class: "ed-narrow-title" }, "El editor necesita una pantalla más ancha"), h("p", {}, "Ábrelo en una laptop o escritorio de al menos 1100 px. Mientras tanto puedes ver la presentación."), trusted("a", { class: "key key-primary", href: o.previewUrl }, `${edIcon("eye")}<span>Ver vista previa</span>`));
  const stateView = h("div", { class: "ed-state", hidden: true });
  root.append(topbar, workspace, narrow, stateView);

  // --- save flow ------------------------------------------------------------
  let saving = false;
  async function save(): Promise<SaveOutcome | undefined> {
    if (saving) return undefined;
    // A field still focused has not sealed its coalesced run; flush it.
    if (canvas.isEditing) canvas.stopInlineEdit(true);
    (document.activeElement as HTMLElement | null)?.blur?.();
    saving = true;
    try {
      const result = await ctrl.save();
      handleSave(result);
      return result;
    } finally {
      saving = false;
    }
  }
  /** Drops every unsaved change and reloads what is on disk. */
  async function discard(): Promise<boolean> {
    if (!ctrl.isDirty) return false;
    const ok = await confirmSheet({ title: "¿Descartar los cambios?", message: "Se pierde todo lo que editaste desde la última vez que guardaste.", confirmLabel: "Descartar", danger: true });
    if (ok) await ctrl.reload();
    return ok;
  }
  function handleSave(result: SaveOutcome) {
    switch (result.kind) {
      case "issues":
        issuesSheet(result.issues, (where) => {
          if (where.slide !== undefined) ctrl.selectSlide(where.slide);
          const el = where.elementIndex !== undefined ? ctrl.currentSlide?.elements[where.elementIndex] : undefined;
          if (el) {
            ctrl.selectOne(el.id);
            tabs.select("element");
          } else if (where.slide !== undefined) tabs.select("slide");
          else tabs.select("design");
        });
        return;
      case "conflict":
        conflictSheet({ reload: () => void ctrl.reload(), overwrite: () => void ctrl.overwrite().then(handleSave) });
        return;
      case "invalid":
        messageSheet({ title: "El servidor rechazó el deck", message: "Corrige lo que indica y vuelve a guardar.", detail: result.error });
        return;
      case "unauthorized":
        askForKey("La clave ya no es válida. Escríbela para guardar.", () => void save());
        return;
      case "error":
        messageSheet({ title: "No se pudo guardar", message: result.message });
        return;
      default:
        return;
    }
  }
  function askForKey(message?: string, then?: () => void) {
    keySheet({
      message,
      onSubmit: (key) => {
        ctrl.api.keys.set(key);
        if (ctrl.state.phase === "unauthorized") void ctrl.load();
        else then?.();
      },
    });
  }

  // --- context menu and command menu --------------------------------------
  const z = (to: ZOrder) => ctrl.dispatch({ type: "reorderZ", slide: ctrl.state.selection.slide, ids: ctrl.state.selection.ids, to });
  function contextEntries(): MenuEntry[] {
    const sel = ctrl.state.selection.ids;
    if (!sel.length) {
      return [
        { label: "Pegar", icon: "duplicate", hint: `${MOD}V`, onSelect: () => void ctrl.paste() },
        { label: "Seleccionar todo", hint: `${MOD}A`, onSelect: () => ctrl.selectAllElements() },
      ];
    }
    const text = sel.length === 1 && ctrl.selectedElements[0]?.type === "text";
    return [
      ...(text ? [{ label: "Editar texto", icon: "text" as const, hint: "Doble clic", onSelect: () => canvas.startInlineEdit(sel[0]!) }] : []),
      { label: "Duplicar", icon: "duplicate", hint: `${MOD}D`, onSelect: () => ctrl.duplicateSelected() },
      { label: "Copiar", hint: `${MOD}C`, onSelect: () => void ctrl.copy() },
      { label: "Cortar", hint: `${MOD}X`, onSelect: () => void ctrl.cut() },
      "separator",
      { label: "Traer al frente", icon: "front", onSelect: () => z("front") },
      { label: "Adelantar", icon: "up", onSelect: () => z("forward") },
      { label: "Enviar atrás", icon: "down", onSelect: () => z("backward") },
      { label: "Enviar al fondo", icon: "backward", onSelect: () => z("back") },
      "separator",
      { label: "Borrar", icon: "trash", hint: "⌫", danger: true, onSelect: () => ctrl.deleteSelected() },
    ];
  }

  function commandItems(): CommandItem[] {
    const deck = ctrl.state.deck;
    const items: CommandItem[] = [
      { id: "save", group: "Deck", label: "Guardar", icon: "save", hint: `${MOD}S`, run: () => void save() },
      { id: "discard", group: "Deck", label: "Descartar cambios", icon: "trash", run: () => void discard() },
      { id: "preview", group: "Deck", label: "Abrir vista previa", icon: "eye", run: () => window.open(o.previewUrl, "_blank", "noopener") },
      { id: "export", group: "Deck", label: "Exportar PDF", icon: "print", run: () => exportBtn.click() },
      { id: "overview", group: "Deck", label: ctrl.state.overview ? "Cerrar vista general" : "Vista general", icon: "grid", hint: "G", run: () => ctrl.setOverview(!ctrl.state.overview) },
      { id: "undo", group: "Edición", label: "Deshacer", icon: "undo", hint: `${MOD}Z`, run: () => ctrl.undo() },
      { id: "redo", group: "Edición", label: "Rehacer", icon: "redo", hint: `⇧${MOD}Z`, run: () => ctrl.redo() },
      ...ADD_SLIDE_ITEMS.map((s) => ({ id: `add-${s.kind}`, group: "Diapositivas", label: `Añadir diapositiva: ${s.label.toLowerCase()}`, icon: s.icon, run: () => ctrl.addSlide(s.kind) })),
      { id: "dup-slide", group: "Diapositivas", label: "Duplicar diapositiva", icon: "duplicate", run: () => ctrl.duplicateSlide() },
      { id: "del-slide", group: "Diapositivas", label: "Borrar diapositiva", icon: "trash", run: () => void deleteSlideWithConfirm(ctrl) },
      { id: "ins-text", group: "Insertar", label: "Texto", icon: "text", run: () => ctrl.addElement({ kind: "text" }) },
      { id: "ins-rect", group: "Insertar", label: "Rectángulo", icon: "rect", keywords: "forma", run: () => ctrl.addElement({ kind: "shape", shape: "rect", style: { fill: "#ffffff" } }) },
      { id: "ins-ellipse", group: "Insertar", label: "Elipse", icon: "ellipse", keywords: "forma circulo", run: () => ctrl.addElement({ kind: "shape", shape: "ellipse", style: { fill: "#ffffff" } }) },
      { id: "ins-line", group: "Insertar", label: "Línea", icon: "line", keywords: "forma", run: () => ctrl.addElement({ kind: "shape", shape: "line" }) },
      { id: "ins-image", group: "Insertar", label: "Imagen", icon: "image", keywords: "foto subir", run: () => void openAssetPicker((src) => insertImage(src)) },
      { id: "ins-icon", group: "Insertar", label: "Ícono", icon: "sparkle", run: () => openIconPicker((name) => ctrl.addElement({ kind: "icon", name: name as IconName })) },
      { id: "ins-bar", group: "Insertar", label: "Gráfico de barras", icon: "chart", run: () => ctrl.addElement({ kind: "chart", chart: "bar" }) },
      { id: "ins-donut", group: "Insertar", label: "Gráfico de dona", icon: "chart", run: () => ctrl.addElement({ kind: "chart", chart: "donut" }) },
      { id: "ins-decor", group: "Insertar", label: "Decoración", icon: "decor", run: () => ctrl.addElement({ kind: "decor" }) },
      { id: "ins-qr", group: "Insertar", label: "Código QR", icon: "qr", run: () => ctrl.addElement({ kind: "qr" }) },
      ...PRESET_NAMES.map((p) => ({ id: `preset-${p}`, group: "Diseño", label: `Preset: ${p}`, icon: "palette" as const, keywords: "tema", run: () => ctrl.dispatch({ type: "setTheme", patch: { preset: p } }) })),
    ];
    if (deck) {
      deck.slides.forEach((s, i) => items.push({ id: `go-${i}`, group: "Ir a", label: `Ir a la diapositiva ${i + 1}`, keywords: `${s.id} diapositiva`, icon: "slides", run: () => ctrl.selectSlide(i) }));
    }
    return items;
  }
  const commandMenu = createCommandMenu(commandItems);
  cmdBtn.addEventListener("click", () => commandMenu.open());

  // --- keyboard -------------------------------------------------------------
  function onKeyDown(e: KeyboardEvent) {
    if (ctrl.state.phase !== "ready") return;
    const dialogOpen = isSheetOpen() || commandMenu.isOpen || isMenuOpen();
    const action = shortcutFor(e, { typing: isTypingTarget(e.target) || canvas.isEditing, dialogOpen });
    if (!action) return;
    switch (action) {
      case "save":
        e.preventDefault();
        void save();
        return;
      case "commandMenu":
        e.preventDefault();
        commandMenu.open();
        return;
      case "escape":
        if (dialogOpen) {
          closeMenu();
          return; // sheets handle their own Esc
        }
        if (canvas.isEditing) return;
        e.preventDefault();
        if (ctrl.state.overview) ctrl.setOverview(false);
        else if (ctrl.state.selection.ids.length) ctrl.clearSelection();
        else if (isTypingTarget(e.target)) (e.target as HTMLElement).blur();
        return;
      case "undo": e.preventDefault(); ctrl.undo(); return;
      case "redo": e.preventDefault(); ctrl.redo(); return;
      case "delete": if (ctrl.state.selection.ids.length) { e.preventDefault(); ctrl.deleteSelected(); } return;
      case "duplicate": if (ctrl.state.selection.ids.length) { e.preventDefault(); ctrl.duplicateSelected(); } return;
      case "copy": if (ctrl.state.selection.ids.length) { e.preventDefault(); void ctrl.copy(); } return;
      case "cut": if (ctrl.state.selection.ids.length) { e.preventDefault(); void ctrl.cut(); } return;
      case "paste": e.preventDefault(); void ctrl.paste(); return;
      case "selectAll": e.preventDefault(); ctrl.selectAllElements(); return;
      case "nudge":
        if (!ctrl.state.selection.ids.length) return;
        e.preventDefault();
        ctrl.nudge(e.key, e.shiftKey);
        return;
      case "slideUp": e.preventDefault(); ctrl.moveSlide(ctrl.state.selection.slide, ctrl.state.selection.slide - 1); return;
      case "slideDown": e.preventDefault(); ctrl.moveSlide(ctrl.state.selection.slide, ctrl.state.selection.slide + 1); return;
      case "nextSlide": e.preventDefault(); ctrl.selectSlide(ctrl.state.selection.slide + 1); return;
      case "prevSlide": e.preventDefault(); ctrl.selectSlide(ctrl.state.selection.slide - 1); return;
      case "overview": e.preventDefault(); ctrl.setOverview(!ctrl.state.overview); return;
    }
  }
  function onKeyUp(e: KeyboardEvent) {
    // Arrow nudges coalesce while the key repeats; releasing it ends the undo step.
    if (e.key.startsWith("Arrow")) ctrl.seal();
  }
  function onBeforeUnload(e: BeforeUnloadEvent) {
    if (!ctrl.isDirty) return;
    e.preventDefault();
    // Older engines only show the prompt when returnValue is set.
    e.returnValue = "";
  }

  // --- render -------------------------------------------------------------
  let lastIds = "";
  let lastPhase = "";
  function render(state: EditorState) {
    root.dataset.phase = state.phase;
    const ready = state.phase === "ready" && !!state.deck;
    workspace.hidden = !ready;
    topbar.hidden = !ready;
    stateView.hidden = ready;
    if (state.phase !== lastPhase) {
      lastPhase = state.phase;
      paintState(state);
    }
    if (!ready) return;
    document.title = `${state.deck!.title} · editor`;
    if (document.activeElement !== titleInput && titleInput.value !== state.deck!.title) titleInput.value = state.deck!.title;
    undoBtn.disabled = !state.canUndo;
    redoBtn.disabled = !state.canRedo;
    paintLamp(state);
    const ids = `${state.selection.slide}:${state.selection.ids.join(",")}`;
    if (ids !== lastIds) {
      const hadIds = lastIds.split(":")[1] !== "";
      const hasIds = state.selection.ids.length > 0;
      if (hasIds && !hadIds) tabs.select("element");
      else if (!hasIds && hadIds && tabs.current === "element") tabs.select("slide");
      lastIds = ids;
    }
    rail.render(state);
    canvas.render(state);
    overview.render(state);
    elementPanel.render(state);
    slidePanel.render(state);
    designPanel.render(state);
    canvas.el.hidden = state.overview;
    toolbar.el.hidden = state.overview;
  }
  function paintLamp(state: EditorState) {
    const map: Record<EditorState["saveState"], [string, string]> = { saved: ["Guardado", "off"], dirty: ["Sin guardar", "standby"], saving: ["Guardando…", "standby"], error: ["Error al guardar", "error"] };
    const [label, lampState] = map[state.saveState];
    lamp.textContent = label;
    lamp.dataset.state = lampState;
    lamp.title = state.saveState === "error" ? state.error : "";
    saveBtn.disabled = state.saveState === "saving";
    discardBtn.hidden = state.saveState === "saved";
  }
  function paintState(state: EditorState) {
    const retry = trusted("button", { type: "button", class: "key key-primary" }, `${edIcon("redo")}<span>Reintentar</span>`);
    retry.addEventListener("click", () => void ctrl.load());
    const homeLink = h("a", { class: "key key-ghost", href: o.homeUrl ?? "/" }, "Volver al inicio");
    const box = (title: string, message: string, ...extra: HTMLElement[]) => h("div", { class: "ed-state-box" }, h("h1", { class: "ed-state-title" }, title), h("p", {}, message), h("div", { class: "ed-keys" }, ...extra));
    switch (state.phase) {
      case "loading":
        stateView.replaceChildren(h("p", { class: "ed-state-loading" }, "Cargando el deck…"));
        return;
      case "unauthorized": {
        const key = trusted("button", { type: "button", class: "key key-primary" }, `${edIcon("save")}<span>Escribir la clave</span>`);
        key.addEventListener("click", () => askForKey());
        stateView.replaceChildren(box("El editor necesita la clave", "La clave de administración es la misma que usa la página de inicio.", key, homeLink));
        askForKey();
        return;
      }
      case "not-found":
        stateView.replaceChildren(box("No existe ese deck", `No hay ninguna carpeta decks/${ctrl.deckId}/ con un deck.json.`, homeLink));
        return;
      case "invalid":
        stateView.replaceChildren(
          box("El archivo deck.json no es válido", "Corrígelo a mano y vuelve a abrir el editor. Esto dice el servidor:", retry, homeLink),
          h("pre", { class: "ed-pre" }, state.error),
          ...(state.raw ? [h("details", { class: "ed-raw" }, h("summary", { class: "legend" }, "Ver el archivo"), h("pre", { class: "ed-pre" }, state.raw))] : []),
        );
        return;
      case "error":
        stateView.replaceChildren(box("No se pudo cargar el deck", state.error, retry, homeLink));
        return;
      default:
        return;
    }
  }

  const unsubscribe = ctrl.subscribe(render);
  render(ctrl.state);

  return {
    el: root,
    canvas,
    tabs,
    commandMenu,
    save,
    discard,
    titleInput,
    lamp,
    mount(parent: HTMLElement) {
      parent.replaceChildren(root);
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      window.addEventListener("beforeunload", onBeforeUnload);
    },
    destroy() {
      unsubscribe();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("beforeunload", onBeforeUnload);
      canvas.destroy();
      root.remove();
    },
  };
}
