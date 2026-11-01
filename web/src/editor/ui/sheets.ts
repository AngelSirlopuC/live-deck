// Modal sheets of the editor: confirmations, validation issues, save conflicts,
// the admin key prompt, the asset picker and the icon picker. All reuse the
// desk `.sheet` dialog from chrome.css.
import type { AssetInfo } from "../../../../shared/editor-api.ts";
import { ICON_NAMES, type IconName } from "../../../../shared/icons.ts";
import { renderIcon } from "../../render/slide.ts";
import { h, trusted } from "../../ui/dom.ts";
import type { ValidationIssue } from "../model/index.ts";
import { edIcon } from "./icons.ts";

export interface SheetHandle {
  el: HTMLDialogElement;
  close(): void;
}

let openSheets = 0;

export function isSheetOpen(): boolean {
  return openSheets > 0;
}

/** Opens a `.sheet` dialog; `showModal` when the browser has it, inline otherwise (tests). */
export function openSheet(opts: { title: string; body?: Array<HTMLElement | string | null>; actions?: HTMLElement[]; className?: string; onClose?: () => void }): SheetHandle {
  const closeBtn = trusted("button", { type: "button", class: "key key-ghost key-icon sheet-close", "aria-label": "Cerrar" }, edIcon("close"));
  const dialog = h(
    "dialog",
    { class: `sheet ed-sheet ${opts.className ?? ""}`.trim() },
    closeBtn,
    h("h2", {}, opts.title),
    ...(opts.body ?? []),
    opts.actions?.length ? h("div", { class: "sheet-actions" }, ...opts.actions) : null,
  );
  document.body.append(dialog);
  openSheets++;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    openSheets--;
    if (dialog.open && typeof dialog.close === "function") dialog.close();
    dialog.remove();
    opts.onClose?.();
  };
  closeBtn.addEventListener("click", close);
  dialog.addEventListener("close", close);
  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    close();
  });
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) close();
  });
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
  return { el: dialog, close };
}

export function confirmSheet(opts: { title: string; message: string; confirmLabel: string; danger?: boolean }): Promise<boolean> {
  return new Promise((resolve) => {
    let answer = false;
    const ok = h("button", { type: "button", class: `key ${opts.danger ? "key-danger" : "key-primary"}` }, opts.confirmLabel);
    const cancel = h("button", { type: "button", class: "key key-ghost" }, "Cancelar");
    const sheet = openSheet({ title: opts.title, body: [h("p", {}, opts.message)], actions: [cancel, ok], onClose: () => resolve(answer) });
    ok.addEventListener("click", () => {
      answer = true;
      sheet.close();
    });
    cancel.addEventListener("click", sheet.close);
    ok.focus();
  });
}

export function messageSheet(opts: { title: string; message: string; detail?: string }): SheetHandle {
  const ok = h("button", { type: "button", class: "key key-primary" }, "Entendido");
  const sheet = openSheet({ title: opts.title, body: [h("p", {}, opts.message), opts.detail ? h("pre", { class: "ed-pre" }, opts.detail) : null], actions: [ok] });
  ok.addEventListener("click", sheet.close);
  return sheet;
}

/** Human location for a validation path like `slides.2.elements.0.box`. */
export function describeIssuePath(path: string): { label: string; slide?: number; elementIndex?: number } {
  const m = /^slides\.(\d+)(?:\.elements\.(\d+))?/.exec(path);
  if (!m) return { label: path.startsWith("theme") ? "Diseño" : path === "title" ? "Título" : path };
  const slide = Number(m[1]);
  const elementIndex = m[2] !== undefined ? Number(m[2]) : undefined;
  return { label: elementIndex === undefined ? `Diapositiva ${slide + 1}` : `Diapositiva ${slide + 1} · elemento ${elementIndex + 1}`, slide, elementIndex };
}

export function issuesSheet(issues: readonly ValidationIssue[], onJump: (target: { slide?: number; elementIndex?: number }) => void): SheetHandle {
  const list = h(
    "ul",
    { class: "ed-issues" },
    ...issues.map((issue) => {
      const where = describeIssuePath(issue.path);
      const b = h("button", { type: "button", class: "ed-issue" }, h("span", { class: "ed-issue-where legend" }, where.label), h("span", { class: "ed-issue-msg" }, issue.message));
      b.addEventListener("click", () => {
        sheet.close();
        onJump(where);
      });
      return h("li", {}, b);
    }),
  );
  const sheet = openSheet({
    title: "Revisa antes de guardar",
    body: [h("p", {}, `${issues.length === 1 ? "Hay un problema" : `Hay ${issues.length} problemas`} en el deck. Toca uno para ir ahí.`), list],
    className: "ed-sheet-wide",
  });
  return sheet;
}

export function conflictSheet(handlers: { reload: () => void; overwrite: () => void }): SheetHandle {
  const reload = h("button", { type: "button", class: "key" }, "Recargar");
  const overwrite = h("button", { type: "button", class: "key key-danger" }, "Sobrescribir");
  const sheet = openSheet({
    title: "Otra persona cambió este deck",
    body: [h("p", {}, "El archivo en el servidor es más nuevo que el que abriste. Recargar descarta tus cambios; sobrescribir guarda los tuyos encima de los suyos.")],
    actions: [reload, overwrite],
  });
  reload.addEventListener("click", () => {
    sheet.close();
    handlers.reload();
  });
  overwrite.addEventListener("click", () => {
    sheet.close();
    handlers.overwrite();
  });
  reload.focus();
  return sheet;
}

export function keySheet(opts: { message?: string; onSubmit: (key: string) => void }): SheetHandle {
  const input = h("input", { id: "ed-admin-key", type: "password", autocomplete: "off" });
  const error = h("p", { class: "form-error", role: "alert" }, opts.message ?? "");
  const submit = h("button", { type: "submit", class: "key key-primary" }, "Entrar");
  const form = h("form", { class: "ed-key-form" }, h("div", { class: "field" }, h("label", { for: "ed-admin-key", class: "legend" }, "Clave de administración"), input), error, submit);
  const sheet = openSheet({ title: "El editor necesita la clave", body: [h("p", {}, "Es la misma clave de administración que usa la página de inicio."), form] });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const key = input.value.trim();
    if (!key) {
      error.textContent = "Escribe la clave.";
      return;
    }
    sheet.close();
    opts.onSubmit(key);
  });
  input.focus();
  return sheet;
}

export interface AssetPickerOptions {
  assets: AssetInfo[];
  assetBase: string;
  onPick: (src: string) => void;
  onUpload: (file: File) => Promise<{ ok: true; src: string } | { ok: false; message: string }>;
  onClose?: () => void;
}

export function assetSheet(o: AssetPickerOptions): SheetHandle {
  const error = h("p", { class: "form-error", role: "alert" });
  const grid = h("div", { class: "ed-assets", role: "list" });
  const paint = (assets: AssetInfo[]) => {
    grid.replaceChildren(
      ...(assets.length
        ? assets.map((a) => {
            const b = h("button", { type: "button", class: "ed-asset", role: "listitem", title: a.name }, h("img", { src: `${o.assetBase}assets/${a.name}`, alt: "", loading: "lazy" }), h("span", { class: "ed-asset-name" }, a.name));
            b.addEventListener("click", () => {
              sheet.close();
              o.onPick(`assets/${a.name}`);
            });
            return b;
          })
        : [h("p", { class: "ed-empty" }, "Este deck aún no tiene imágenes. Sube una para empezar.")]),
    );
  };
  paint(o.assets);
  const file = h("input", { type: "file", accept: "image/png,image/jpeg,image/webp,image/gif", class: "visually-hidden", id: "ed-asset-file" });
  const upload = trusted("label", { for: "ed-asset-file", class: "key key-primary ed-upload" }, `${edIcon("upload")}<span>Subir imagen</span>`);
  const status = h("p", { class: "field-hint ed-upload-status", "aria-live": "polite" });
  file.addEventListener("change", async () => {
    const f = file.files?.[0];
    if (!f) return;
    error.textContent = "";
    status.textContent = `Subiendo ${f.name}…`;
    const result = await o.onUpload(f);
    status.textContent = "";
    file.value = "";
    if (!result.ok) {
      error.textContent = result.message;
      return;
    }
    sheet.close();
    o.onPick(result.src);
  });
  const sheet = openSheet({
    title: "Imágenes del deck",
    body: [h("p", {}, "PNG, JPEG, WebP o GIF de hasta 8 MB. También puedes soltar una imagen sobre la diapositiva."), grid, error, status],
    actions: [file, upload],
    className: "ed-sheet-wide",
    onClose: o.onClose,
  });
  return sheet;
}

export function iconSheet(onPick: (name: IconName) => void, current?: IconName): SheetHandle {
  const search = h("input", { type: "search", id: "ed-icon-search", placeholder: "Buscar ícono", autocomplete: "off" });
  const grid = h("div", { class: "ed-icons", role: "listbox", "aria-label": "Íconos" });
  const paint = (q: string) => {
    const query = q.trim().toLowerCase();
    const names = ICON_NAMES.filter((n) => n.includes(query));
    grid.replaceChildren(
      ...(names.length
        ? names.map((name) => {
            const b = h("button", { type: "button", role: "option", class: "ed-icon-opt", title: name, "aria-label": name, "aria-selected": String(name === current) });
            const svg = renderIcon(name, 2);
            if (svg) b.append(svg);
            b.append(h("span", { class: "ed-icon-name" }, name));
            b.addEventListener("click", () => {
              sheet.close();
              onPick(name);
            });
            return b;
          })
        : [h("p", { class: "ed-empty" }, "Ningún ícono coincide.")]),
    );
  };
  paint("");
  search.addEventListener("input", () => paint(search.value));
  const sheet = openSheet({ title: "Elige un ícono", body: [h("div", { class: "field" }, h("label", { for: "ed-icon-search", class: "legend" }, "Buscar"), search), grid], className: "ed-sheet-wide" });
  search.focus();
  return sheet;
}
