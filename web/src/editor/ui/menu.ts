// Popover menus (insert pickers, add-slide, context menu). Fixed-positioned so
// they escape scrolling panels; closed by Esc, outside click or a choice.
import { h, trusted } from "../../ui/dom.ts";
import { edIcon, type EdIconName } from "./icons.ts";

export interface MenuItem {
  label: string;
  icon?: EdIconName;
  /** Small right-aligned hint, e.g. a shortcut. */
  hint?: string;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

export type MenuEntry = MenuItem | "separator";

let open: { el: HTMLElement; close: () => void } | null = null;

export function closeMenu() {
  open?.close();
}

export function isMenuOpen(): boolean {
  return open !== null;
}

/** Opens a menu at a viewport point (context menu) or under an anchor element. */
export function openMenu(entries: readonly MenuEntry[], at: { x: number; y: number } | HTMLElement, opts: { label?: string; returnFocus?: HTMLElement } = {}): HTMLElement {
  closeMenu();
  const items = entries.map((entry) => {
    if (entry === "separator") return h("div", { class: "ed-menu-sep", role: "separator" });
    const b = trusted(
      "button",
      { type: "button", role: "menuitem", class: `ed-menu-item${entry.danger ? " is-danger" : ""}`, disabled: entry.disabled ? "" : undefined },
      `${entry.icon ? edIcon(entry.icon) : '<span class="ed-menu-gap"></span>'}<span class="ed-menu-label"></span>${entry.hint ? '<kbd class="ed-menu-hint"></kbd>' : ""}`,
    );
    b.querySelector(".ed-menu-label")!.textContent = entry.label;
    if (entry.hint) b.querySelector(".ed-menu-hint")!.textContent = entry.hint;
    b.addEventListener("click", () => {
      close();
      entry.onSelect();
    });
    return b;
  });
  const menu = h("div", { class: "ed-menu", role: "menu", "aria-label": opts.label ?? "Menú", tabindex: "-1" }, ...items);
  document.body.append(menu);

  const place = () => {
    const w = menu.offsetWidth;
    const hgt = menu.offsetHeight;
    let x: number;
    let y: number;
    if (at instanceof HTMLElement) {
      const r = at.getBoundingClientRect();
      x = r.left;
      y = r.bottom + 4;
    } else {
      x = at.x;
      y = at.y;
    }
    x = Math.max(8, Math.min(x, window.innerWidth - w - 8));
    y = Math.max(8, Math.min(y, window.innerHeight - hgt - 8));
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
  };
  place();

  const buttons = () => [...menu.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    }
    const list = buttons();
    const i = list.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      list[(i + step + list.length) % list.length]?.focus();
    }
    if (e.key === "Tab") close();
  };
  const onPointer = (e: PointerEvent) => {
    if (!menu.contains(e.target as Node) && !(at instanceof HTMLElement && at.contains(e.target as Node))) close();
  };
  const close = () => {
    if (open?.el !== menu) return;
    menu.remove();
    document.removeEventListener("keydown", onKey, true);
    document.removeEventListener("pointerdown", onPointer, true);
    window.removeEventListener("blur", close);
    open = null;
    if (at instanceof HTMLElement) at.setAttribute("aria-expanded", "false");
    (opts.returnFocus ?? (at instanceof HTMLElement ? at : undefined))?.focus();
  };
  open = { el: menu, close };
  if (at instanceof HTMLElement) at.setAttribute("aria-expanded", "true");
  document.addEventListener("keydown", onKey, true);
  // Deferred so the click that opened the menu does not close it.
  setTimeout(() => {
    document.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("blur", close);
  }, 0);
  buttons()[0]?.focus();
  return menu;
}
