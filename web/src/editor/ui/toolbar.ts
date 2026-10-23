// Insert toolbar above the canvas: one key per element kind. Kinds with
// variants (shape, chart, decoration) open a small menu; image and icon open
// their pickers.
import { trusted } from "../../ui/dom.ts";
import { h } from "../../ui/dom.ts";
import type { EditorController } from "./controller.ts";
import { edIcon, type EdIconName } from "./icons.ts";
import { openMenu, type MenuItem } from "./menu.ts";

export const DECOR_SHAPES = [
  ["blob", "Mancha"],
  ["wave", "Ola"],
  ["dots", "Puntos"],
  ["rings", "Anillos"],
  ["arc", "Arco"],
  ["squiggle", "Garabato"],
  ["star", "Estrella"],
  ["grid", "Cuadrícula"],
] as const;

export interface ToolbarOptions {
  openAssetPicker: () => void;
  openIconPicker: () => void;
}

export function createToolbar(ctrl: EditorController, o: ToolbarOptions) {
  const key = (icon: EdIconName, label: string, onClick: (btn: HTMLButtonElement) => void, menu = false) => {
    const b = trusted("button", { type: "button", class: "key ed-key ed-tool", ...(menu ? { "aria-haspopup": "menu", "aria-expanded": "false" } : {}) }, `${edIcon(icon)}<span>${label}</span>`);
    b.addEventListener("click", () => onClick(b));
    return b;
  };
  const items = (list: MenuItem[], anchor: HTMLElement, label: string) => openMenu(list, anchor, { label });

  const el = h(
    "div",
    { class: "ed-toolbar", role: "toolbar", "aria-label": "Insertar" },
    h("span", { class: "legend ed-toolbar-legend" }, "Insertar"),
    key("text", "Texto", () => ctrl.addElement({ kind: "text" })),
    key(
      "shape",
      "Forma",
      (b) =>
        items(
          [
            { label: "Rectángulo", icon: "rect", onSelect: () => ctrl.addElement({ kind: "shape", shape: "rect", style: { fill: "#ffffff" } }) },
            { label: "Elipse", icon: "ellipse", onSelect: () => ctrl.addElement({ kind: "shape", shape: "ellipse", style: { fill: "#ffffff" } }) },
            { label: "Línea", icon: "line", onSelect: () => ctrl.addElement({ kind: "shape", shape: "line" }) },
          ],
          b,
          "Forma",
        ),
      true,
    ),
    key("image", "Imagen", o.openAssetPicker),
    key("sparkle", "Ícono", o.openIconPicker),
    key(
      "chart",
      "Gráfico",
      (b) =>
        items(
          [
            { label: "Barras", icon: "chart", onSelect: () => ctrl.addElement({ kind: "chart", chart: "bar" }) },
            { label: "Dona", icon: "ellipse", onSelect: () => ctrl.addElement({ kind: "chart", chart: "donut" }) },
          ],
          b,
          "Gráfico",
        ),
      true,
    ),
    key(
      "decor",
      "Decoración",
      (b) =>
        items(
          DECOR_SHAPES.map(([shape, label]) => ({ label, icon: "decor" as const, onSelect: () => ctrl.addElement({ kind: "decor", shape }) })),
          b,
          "Decoración",
        ),
      true,
    ),
    key("qr", "QR", () => ctrl.addElement({ kind: "qr" })),
  );
  return { el };
}
