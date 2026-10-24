// Inspector field builders. Each field owns one control and knows how to
// refresh itself from the model without touching a control the user is
// typing in, so the inspector never rebuilds under the cursor.
import { h, trusted } from "../../ui/dom.ts";
import { edIcon, type EdIconName } from "./icons.ts";

export interface Field {
  el: HTMLElement;
  /** Re-reads the model; skipped for the focused control. */
  update(): void;
}

let counter = 0;
const uid = (prefix: string) => `ed-${prefix}-${++counter}`;

const focused = (el: Element) => document.activeElement === el;

export interface TextFieldOptions {
  label: string;
  get: () => string;
  /** Called on every keystroke with a coalesce flag; `commit` fires on blur/change. */
  set: (value: string) => void;
  commit?: () => void;
  multiline?: boolean;
  placeholder?: string;
  maxlength?: number;
  mono?: boolean;
  /** Validation message for the current value, or "" when valid. */
  validate?: (value: string) => string;
}

export function textField(o: TextFieldOptions): Field {
  const id = uid("text");
  const control = o.multiline ? h("textarea", { id, rows: 4 }) : h("input", { id, type: "text", autocomplete: "off", spellcheck: "false" });
  if (o.placeholder) control.placeholder = o.placeholder;
  if (o.maxlength) control.maxLength = o.maxlength;
  if (o.mono) control.classList.add("ed-mono");
  const error = h("p", { class: "ed-field-error", role: "alert" });
  control.value = o.get();
  const check = () => {
    const msg = o.validate?.(control.value) ?? "";
    error.textContent = msg;
    control.setAttribute("aria-invalid", msg ? "true" : "false");
    return !msg;
  };
  control.addEventListener("input", () => {
    if (check()) o.set(control.value);
  });
  control.addEventListener("change", () => o.commit?.());
  control.addEventListener("blur", () => o.commit?.());
  const el = h("div", { class: "field ed-field" }, h("label", { for: id, class: "legend" }, o.label), control, error);
  return {
    el,
    update() {
      if (focused(control)) return;
      const v = o.get();
      if (control.value !== v) control.value = v;
      check();
    },
  };
}

export interface NumberFieldOptions {
  label: string;
  get: () => number | undefined;
  /** `undefined` clears the value (empty input). */
  set: (value: number | undefined) => void;
  commit?: () => void;
  min?: number;
  max?: number;
  step?: number;
  /** Shown after the input (%, px, s). */
  unit?: string;
  /** Empty input is allowed and means "unset". */
  optional?: boolean;
  /** Static text, or a getter re-read on every update (the effective value behind an unset field). */
  placeholder?: string | (() => string);
}

const placeholderOf = (p: string | (() => string) | undefined): string | undefined => (typeof p === "function" ? p() : p);

export function numberField(o: NumberFieldOptions): Field {
  const id = uid("num");
  const control = h("input", { id, type: "number", inputmode: "decimal", min: o.min, max: o.max, step: o.step ?? 1, placeholder: placeholderOf(o.placeholder) });
  control.classList.add("ed-mono");
  const show = () => {
    const v = o.get();
    control.value = v === undefined ? "" : String(v);
    if (typeof o.placeholder === "function") control.placeholder = o.placeholder();
  };
  show();
  control.addEventListener("input", () => {
    if (control.value.trim() === "") {
      if (o.optional) o.set(undefined);
      return;
    }
    const n = Number(control.value);
    if (!Number.isFinite(n)) return;
    if (o.min !== undefined && n < o.min) return;
    if (o.max !== undefined && n > o.max) return;
    o.set(n);
  });
  control.addEventListener("change", () => {
    o.commit?.();
    show();
  });
  control.addEventListener("blur", () => o.commit?.());
  const wrap = h("div", { class: "ed-num" }, control, o.unit ? h("span", { class: "ed-unit", "aria-hidden": "true" }, o.unit) : null);
  const el = h("div", { class: "field ed-field" }, h("label", { for: id, class: "legend" }, o.label), wrap);
  return {
    el,
    update() {
      if (focused(control)) return;
      show();
    },
  };
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectGroup {
  label: string;
  options: readonly SelectOption[];
}

export interface SelectFieldOptions {
  label: string;
  /** Ungrouped options, listed before any group. */
  options: readonly SelectOption[];
  /** Options under `<optgroup>` headings. */
  groups?: readonly SelectGroup[];
  get: () => string;
  set: (value: string) => void;
}

export function selectField(o: SelectFieldOptions): Field {
  const id = uid("sel");
  const option = (opt: SelectOption) => h("option", { value: opt.value }, opt.label);
  const control = h("select", { id }, ...o.options.map(option), ...(o.groups ?? []).map((g) => h("optgroup", { label: g.label }, ...g.options.map(option))));
  control.value = o.get();
  control.addEventListener("change", () => o.set(control.value));
  const el = h("div", { class: "field ed-field" }, h("label", { for: id, class: "legend" }, o.label), control);
  return {
    el,
    update() {
      const v = o.get();
      if (control.value !== v) control.value = v;
    },
  };
}

export interface ToggleFieldOptions {
  label: string;
  get: () => boolean;
  set: (value: boolean) => void;
}

/** Labelled checkbox drawn as a small desk switch. */
export function toggleField(o: ToggleFieldOptions): Field {
  const id = uid("tgl");
  const control = h("input", { id, type: "checkbox", class: "ed-toggle-input" });
  control.checked = o.get();
  control.addEventListener("change", () => o.set(control.checked));
  const el = h("label", { for: id, class: "ed-toggle" }, control, h("span", { class: "ed-toggle-track", "aria-hidden": "true" }), h("span", { class: "legend" }, o.label));
  return {
    el,
    update() {
      control.checked = o.get();
    },
  };
}

export interface SegmentOption {
  value: string;
  label: string;
  icon?: EdIconName;
}

export interface SegmentedFieldOptions {
  label: string;
  options: readonly SegmentOption[];
  get: () => string;
  set: (value: string) => void;
}

/** Radio-like key group (align, font role, kind). */
export function segmentedField(o: SegmentedFieldOptions): Field {
  const buttons = o.options.map((opt) => {
    const b = opt.icon
      ? trusted("button", { type: "button", class: "ed-seg", "aria-label": opt.label, title: opt.label, "data-value": opt.value }, edIcon(opt.icon))
      : h("button", { type: "button", class: "ed-seg", "data-value": opt.value }, opt.label);
    b.addEventListener("click", () => o.set(opt.value));
    return b;
  });
  const paint = () => {
    const v = o.get();
    for (const b of buttons) b.setAttribute("aria-pressed", String(b.dataset.value === v));
  };
  paint();
  const group = h("div", { class: "ed-segments", role: "group", "aria-label": o.label }, ...buttons);
  const el = h("div", { class: "field ed-field" }, h("span", { class: "legend" }, o.label), group);
  return { el, update: paint };
}

/** `#rgb`/`#rrggbbaa` → `#rrggbb` for the native picker; anything else → null. */
export function toPickerHex(value: string | undefined): string | null {
  if (!value) return null;
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(value);
  if (!m) return null;
  const hex = m[1]!;
  if (hex.length === 3) return `#${hex.split("").map((c) => c + c).join("")}`.toLowerCase();
  return `#${hex.slice(0, 6)}`.toLowerCase();
}

export const HEX_RE = /^#[0-9a-fA-F]{3,8}$/;

export interface ColorFieldOptions {
  label: string;
  get: () => string | undefined;
  /** `undefined` removes the colour (inherit from theme). */
  set: (value: string | undefined) => void;
  commit?: () => void;
  /** Theme colours offered as one-click swatches. */
  swatches?: readonly { name: string; value: string }[];
  /** Shows a clear key when the value is optional. */
  optional?: boolean;
  /** Static text, or a getter for the effective colour (shown as placeholder and as the empty picker's swatch). */
  placeholder?: string | (() => string);
}

/** Native picker + hex text + theme swatches; all three write the same value. */
export function colorField(o: ColorFieldOptions): Field {
  const id = uid("color");
  const picker = h("input", { type: "color", class: "ed-color-picker", "aria-label": `${o.label}: selector` });
  const text = h("input", { id, type: "text", class: "ed-mono ed-color-hex", autocomplete: "off", spellcheck: "false", placeholder: placeholderOf(o.placeholder) ?? "tema", maxlength: 9 });
  const clear = o.optional ? trusted("button", { type: "button", class: "ed-color-clear", "aria-label": `Quitar ${o.label.toLowerCase()}`, title: "Usar el color del tema" }, edIcon("close")) : null;
  const swatches = (o.swatches ?? []).map((s) => {
    const b = h("button", { type: "button", class: "ed-swatch", title: `${s.name} ${s.value}`, "aria-label": `${o.label}: ${s.name}` });
    b.style.setProperty("--swatch", s.value);
    b.addEventListener("click", () => {
      o.set(s.value);
      o.commit?.();
      paint();
    });
    return b;
  });
  const paint = () => {
    const v = o.get();
    const hex = toPickerHex(v);
    const effective = typeof o.placeholder === "function" ? o.placeholder() : undefined;
    if (effective !== undefined) text.placeholder = effective;
    picker.value = hex ?? toPickerHex(effective) ?? "#000000";
    picker.classList.toggle("is-empty", !hex);
    if (!focused(text)) text.value = v ?? "";
    if (clear) clear.hidden = v === undefined;
    for (const s of swatches) s.setAttribute("aria-pressed", String(s.title.endsWith(v ?? "\u0000")));
  };
  paint();
  picker.addEventListener("input", () => {
    o.set(picker.value);
    text.value = picker.value;
  });
  picker.addEventListener("change", () => o.commit?.());
  text.addEventListener("input", () => {
    const v = text.value.trim();
    if (v === "" && o.optional) {
      o.set(undefined);
      paint();
      return;
    }
    if (!HEX_RE.test(v)) {
      text.setAttribute("aria-invalid", "true");
      return;
    }
    text.removeAttribute("aria-invalid");
    o.set(v);
    picker.value = toPickerHex(v) ?? picker.value;
  });
  text.addEventListener("change", () => {
    o.commit?.();
    paint();
  });
  clear?.addEventListener("click", () => {
    o.set(undefined);
    o.commit?.();
    paint();
  });
  const row = h("div", { class: "ed-color" }, picker, text, clear);
  const el = h(
    "div",
    { class: "field ed-field" },
    h("label", { for: id, class: "legend" }, o.label),
    row,
    swatches.length ? h("div", { class: "ed-swatches", role: "group", "aria-label": `${o.label}: colores del tema` }, ...swatches) : null,
  );
  return { el, update: paint };
}

/** Section with an engraved legend; children are fields or keys. */
export function section(title: string, ...children: Array<HTMLElement | Field | null | false | undefined>): HTMLElement {
  return h("section", { class: "ed-section" }, h("h3", { class: "legend ed-section-title" }, title), ...children.map((c) => (c ? ("el" in c ? c.el : c) : null)));
}

/** Two or three fields on one row. */
export function row(...fields: Field[]): HTMLElement {
  return h("div", { class: "ed-row", "data-cols": String(fields.length) }, ...fields.map((f) => f.el));
}

export function iconKey(name: EdIconName, label: string, onClick: () => void, extra: Record<string, string> = {}): HTMLButtonElement {
  const b = trusted("button", { type: "button", class: "key key-icon ed-key", "aria-label": label, title: label, ...extra }, edIcon(name));
  b.addEventListener("click", onClick);
  return b;
}

export function textKey(label: string, onClick: () => void, cls = "key ed-key", icon?: EdIconName): HTMLButtonElement {
  const b = icon ? trusted("button", { type: "button", class: cls }, `${edIcon(icon)}<span>${label}</span>`) : h("button", { type: "button", class: cls }, label);
  b.addEventListener("click", onClick);
  return b;
}
