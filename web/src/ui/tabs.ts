import { h } from "./dom.ts";

export interface TabSpec {
  id: string;
  label: string;
  panel: HTMLElement;
}

/**
 * Accessible tab strip (ARIA tabs, arrow keys) over existing panels. A hidden
 * tab can be flagged with notify() so new activity there is not missed.
 */
export function createTabs(name: string, specs: readonly TabSpec[]) {
  let current = specs[0]!.id;
  const buttons = specs.map((spec) => {
    const b = h("button", { type: "button", role: "tab", class: "tab", id: `tab-${name}-${spec.id}`, "data-tab": spec.id, "aria-controls": `panel-${name}-${spec.id}` }, spec.label);
    spec.panel.id = `panel-${name}-${spec.id}`;
    spec.panel.setAttribute("role", "tabpanel");
    spec.panel.setAttribute("aria-labelledby", b.id);
    b.addEventListener("click", () => select(spec.id));
    b.addEventListener("keydown", (e) => {
      const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!step) return;
      e.preventDefault();
      const i = (specs.findIndex((s) => s.id === current) + step + specs.length) % specs.length;
      select(specs[i]!.id);
      buttons[i]!.focus();
    });
    return b;
  });
  const list = h("div", { class: "tabs", role: "tablist", "aria-label": name }, ...buttons);

  function select(id: string) {
    current = id;
    specs.forEach((spec, i) => {
      const on = spec.id === id;
      spec.panel.hidden = !on;
      const b = buttons[i]!;
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
      if (on) delete b.dataset.unread;
    });
  }
  select(current);

  return {
    list,
    select,
    get current() {
      return current;
    },
    /** Flags activity on a tab that is not on screen. */
    notify(id: string) {
      if (id === current) return;
      const b = buttons.find((x) => x.dataset.tab === id);
      if (b) b.dataset.unread = "true";
    },
  };
}
