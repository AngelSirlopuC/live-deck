// ⌘K command menu: a filtered list of every editor action with keyboard
// navigation. Matching is a pure function so it is tested on its own.
import { h, trusted } from "../../ui/dom.ts";
import { edIcon, type EdIconName } from "./icons.ts";

export interface CommandItem {
  id: string;
  label: string;
  group: string;
  icon?: EdIconName;
  hint?: string;
  /** Extra words that should match (accents stripped automatically). */
  keywords?: string;
  run: () => void;
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Subsequence score: lower is better; undefined when the query does not match. */
export function fuzzyScore(query: string, text: string): number | undefined {
  const q = fold(query).replace(/\s+/g, "");
  const t = fold(text);
  if (!q) return 0;
  if (t.includes(q)) return t.indexOf(q);
  let score = 0;
  let pos = 0;
  for (const ch of q) {
    const i = t.indexOf(ch, pos);
    if (i < 0) return undefined;
    score += i - pos + 1;
    pos = i + 1;
  }
  return 100 + score;
}

export function filterCommands<T extends Pick<CommandItem, "label" | "group" | "keywords">>(query: string, items: readonly T[]): T[] {
  if (!query.trim()) return [...items];
  return items
    .map((item) => ({ item, score: fuzzyScore(query, `${item.label} ${item.group} ${item.keywords ?? ""}`) }))
    .filter((x): x is { item: T; score: number } => x.score !== undefined)
    .sort((a, b) => a.score - b.score)
    .map((x) => x.item);
}

export function createCommandMenu(getItems: () => CommandItem[]) {
  let dialog: HTMLDialogElement | null = null;

  function close() {
    if (!dialog) return;
    const d = dialog;
    dialog = null;
    if (d.open && typeof d.close === "function") d.close();
    d.remove();
  }

  function open() {
    close();
    const items = getItems();
    const input = h("input", { type: "search", class: "ed-cmd-input", placeholder: "Escribe una acción…", "aria-label": "Buscar acción", autocomplete: "off", role: "combobox", "aria-expanded": "true", "aria-controls": "ed-cmd-list" });
    const list = h("div", { class: "ed-cmd-list", role: "listbox", id: "ed-cmd-list" });
    let active = 0;
    let visible: CommandItem[] = [];
    const paint = () => {
      visible = filterCommands(input.value, items);
      active = Math.min(active, Math.max(visible.length - 1, 0));
      let lastGroup = "";
      const nodes: HTMLElement[] = [];
      visible.forEach((item, i) => {
        if (item.group !== lastGroup) {
          lastGroup = item.group;
          nodes.push(h("div", { class: "legend ed-cmd-group" }, item.group));
        }
        const b = trusted("button", { type: "button", role: "option", class: "ed-cmd-item", "aria-selected": String(i === active), "data-index": String(i), id: `ed-cmd-${i}` }, `${item.icon ? edIcon(item.icon) : '<span class="ed-menu-gap"></span>'}<span class="ed-cmd-label"></span>${item.hint ? '<kbd class="ed-menu-hint"></kbd>' : ""}`);
        b.querySelector(".ed-cmd-label")!.textContent = item.label;
        if (item.hint) b.querySelector(".ed-menu-hint")!.textContent = item.hint;
        b.addEventListener("click", () => run(item));
        b.addEventListener("pointermove", () => {
          if (active !== i) {
            active = i;
            paint();
          }
        });
        nodes.push(b);
      });
      if (!visible.length) nodes.push(h("p", { class: "ed-empty" }, "Ninguna acción coincide."));
      list.replaceChildren(...nodes);
      input.setAttribute("aria-activedescendant", visible.length ? `ed-cmd-${active}` : "");
      list.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView?.({ block: "nearest" });
    };
    const run = (item: CommandItem) => {
      close();
      item.run();
    };
    input.addEventListener("input", () => {
      active = 0;
      paint();
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!visible.length) return;
        active = (active + (e.key === "ArrowDown" ? 1 : -1) + visible.length) % visible.length;
        paint();
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = visible[active];
        if (item) run(item);
      }
    });
    dialog = h("dialog", { class: "sheet ed-sheet ed-cmd", "aria-label": "Acciones" }, trusted("span", { class: "ed-cmd-icon", "aria-hidden": "true" }, edIcon("search")), input, list);
    dialog.addEventListener("close", close);
    dialog.addEventListener("cancel", (e) => {
      e.preventDefault();
      close();
    });
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) close();
    });
    document.body.append(dialog);
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    paint();
    input.focus();
    return { input, list };
  }

  return {
    open,
    close,
    get isOpen() {
      return dialog !== null;
    },
  };
}
