// Element inspector: box and every style field of the selected element's
// schema, plus arrange / align / distribute. Fields are rebuilt only when the
// selection identity changes; deck changes refresh them in place. There is no
// fragment or animation control: the AI decides the steps and the deck motion,
// and edits here leave an element's `fragment` untouched.
import type { Box, DeckElement } from "../../../../../shared/deck.ts";
import { ICON_NAMES } from "../../../../../shared/icons.ts";
import { THEME_COLOR_KEYS, THEME_COLOR_TOKENS, type ThemeColorToken } from "../../../../../shared/theme-colors.ts";
import { resolveThemeSpec } from "../../../../../shared/themes.ts";
import { h, trusted } from "../../../ui/dom.ts";
import { clampBox, isValidId, round4, type AlignEdge, type ElementPatch, type ZOrder } from "../../model/index.ts";
import type { EditorController, EditorState } from "../controller.ts";
import { colorField, iconKey, numberField, row, section, segmentedField, selectField, textField, toggleField, type ColorSwatch, type Field } from "../fields.ts";
import { edIcon } from "../icons.ts";
import { DECOR_SHAPES } from "../toolbar.ts";

const KIND_LABEL: Record<DeckElement["type"], string> = { text: "Texto", image: "Imagen", shape: "Forma", qr: "Código QR", icon: "Ícono", chart: "Gráfico", decor: "Decoración" };

export interface ElementPanelOptions {
  openAssetPicker: (onPick: (src: string) => void) => void;
  openIconPicker: (onPick: (name: string) => void, current?: string) => void;
}

const TOKEN_LABELS: Record<ThemeColorToken, string> = { text: "Texto", muted: "Apagado", accent: "Acento", surface: "Superficie", background: "Fondo", "on-accent": "Sobre acento" };

/** Theme swatches for colour fields: one per token, previewed with the colour the current theme resolves it to. */
export function themeSwatches(state: EditorState): (ColorSwatch & { token: ThemeColorToken })[] {
  const colors = resolveThemeSpec(state.deck?.theme).colors;
  return THEME_COLOR_TOKENS.map((token) => ({ name: TOKEN_LABELS[token], token, value: colors[THEME_COLOR_KEYS[token]] }));
}

export function createElementPanel(ctrl: EditorController, o: ElementPanelOptions) {
  const el = h("div", { class: "ed-panel ed-panel-element" });
  let identity = "";
  let fields: Field[] = [];

  const coalesce = (key: string) => `field:${ctrl.state.selection.slide}:${ctrl.state.selection.ids.join(",")}:${key}`;
  const seal = () => ctrl.seal();
  const patch = (p: ElementPatch, key: string) => ctrl.patchSelected(p, coalesce(key));
  const style = (key: string, value: unknown) => patch({ style: { [key]: value } }, `style.${key}`);

  const current = (): DeckElement | undefined => ctrl.selectedElements[0];
  const styleOf = (): Record<string, unknown> => ((current() as { style?: Record<string, unknown> } | undefined)?.style ?? {});

  const boxField = (label: string, key: keyof Box) =>
    numberField({
      label,
      unit: "%",
      min: 0,
      max: 100,
      step: 0.1,
      get: () => {
        const b = current()?.box;
        return b ? round4(b[key] * 100) : undefined;
      },
      set: (v) => {
        const e = current();
        if (!e || v === undefined) return;
        const b = { ...e.box, [key]: v / 100 };
        ctrl.setBoxes({ [e.id]: clampBox(b, e.type === "shape" && e.shape === "line" ? { minH: 0 } : {}) }, coalesce(`box.${key}`));
      },
      commit: seal,
    });

  const arrange = () => {
    const ids = () => ctrl.state.selection.ids;
    const z = (to: ZOrder) => ctrl.dispatch({ type: "reorderZ", slide: ctrl.state.selection.slide, ids: ids(), to });
    return section(
      "Orden",
      h(
        "div",
        { class: "ed-keys" },
        iconKey("front", "Traer al frente", () => z("front")),
        iconKey("up", "Adelantar", () => z("forward")),
        iconKey("down", "Enviar atrás", () => z("backward")),
        iconKey("backward", "Enviar al fondo", () => z("back")),
      ),
    );
  };

  const alignSection = (multi: boolean) => {
    const ids = () => ctrl.state.selection.ids;
    const al = (edge: AlignEdge) => ctrl.dispatch({ type: "align", slide: ctrl.state.selection.slide, ids: ids(), edge });
    const dist = (axis: "horizontal" | "vertical") => ctrl.dispatch({ type: "distribute", slide: ctrl.state.selection.slide, ids: ids(), axis });
    return section(
      multi ? "Alinear entre sí" : "Alinear a la diapositiva",
      h(
        "div",
        { class: "ed-keys" },
        iconKey("alignLeft", "Alinear a la izquierda", () => al("left")),
        iconKey("alignCenterX", "Centrar horizontalmente", () => al("hcenter")),
        iconKey("alignRight", "Alinear a la derecha", () => al("right")),
        iconKey("alignTop", "Alinear arriba", () => al("top")),
        iconKey("alignCenterY", "Centrar verticalmente", () => al("vcenter")),
        iconKey("alignBottom", "Alinear abajo", () => al("bottom")),
      ),
      ids().length >= 3 ? h("div", { class: "ed-keys" }, iconKey("distributeX", "Distribuir horizontalmente", () => dist("horizontal")), iconKey("distributeY", "Distribuir verticalmente", () => dist("vertical"))) : null,
    );
  };

  const build = (state: EditorState) => {
    fields = [];
    const sel = state.selection;
    const selected = ctrl.selectedElements;
    if (selected.length === 0) {
      el.replaceChildren(h("p", { class: "ed-empty" }, "Selecciona un elemento en el lienzo o inserta uno con la barra de arriba."));
      return;
    }
    if (selected.length > 1) {
      const del = trusted("button", { type: "button", class: "key key-danger ed-key" }, `${edIcon("trash")}<span>Borrar ${selected.length}</span>`);
      del.addEventListener("click", () => ctrl.deleteSelected());
      el.replaceChildren(
        h("header", { class: "ed-panel-head" }, h("h2", { class: "ed-panel-title" }, `${selected.length} elementos`), h("p", { class: "ed-panel-sub" }, selected.map((e) => e.id).join(", "))),
        alignSection(true),
        arrange(),
        section("Acciones", h("div", { class: "ed-keys" }, del)),
      );
      return;
    }
    const e = selected[0]!;
    const swatches = themeSwatches(state);
    const F = (f: Field) => {
      fields.push(f);
      return f;
    };
    const idField = F(
      textField({
        label: "Id",
        mono: true,
        get: () => current()?.id ?? "",
        validate: (v) => (!isValidId(v) ? "Solo letras, números, guion y guion bajo (1-40)." : current()?.id !== v && ctrl.currentSlide?.elements.some((x) => x.id === v) ? "Ya hay un elemento con ese id." : ""),
        set: () => {},
        commit: () => {
          const input = idField.el.querySelector("input")!;
          const v = input.value;
          const cur = current();
          if (cur && v !== cur.id && isValidId(v) && !ctrl.currentSlide?.elements.some((x) => x.id === v)) {
            ctrl.patchElement(cur.id, { id: v });
            ctrl.select([v]);
          }
        },
      }),
    );
    const position = section("Posición y tamaño", row(F(boxField("X", "x")), F(boxField("Y", "y"))), row(F(boxField("Ancho", "w")), F(boxField("Alto", "h"))));

    const typeSections: HTMLElement[] = [];
    const num = (label: string, key: string, min: number, max: number, step = 1, unit?: string) =>
      F(numberField({ label, min, max, step, unit, optional: true, get: () => styleOf()[key] as number | undefined, set: (v) => style(key, v), commit: seal }));
    const color = (label: string, key: string) => F(colorField({ label, optional: true, swatches, get: () => styleOf()[key] as string | undefined, set: (v) => style(key, v), commit: seal }));
    const toggle = (label: string, key: string) => F(toggleField({ label, get: () => Boolean(styleOf()[key]), set: (v) => style(key, v || undefined) }));
    const radius = () => num("Radio", "radius", 0, 540, 1, "px");

    switch (e.type) {
      case "text": {
        typeSections.push(
          section(
            "Texto",
            F(textField({ label: "Contenido", multiline: true, maxlength: 2000, get: () => (current() as typeof e).text, set: (v) => patch({ text: v }, "text"), commit: seal })),
            F(
              segmentedField({
                label: "Fuente",
                options: [
                  { value: "body", label: "Texto" },
                  { value: "display", label: "Título" },
                  { value: "mono", label: "Mono" },
                ],
                get: () => (styleOf().font as string) ?? "body",
                set: (v) => style("font", v === "body" ? undefined : v),
              }),
            ),
            row(num("Tamaño", "fontSize", 8, 400, 1, "px"), F(selectField({ label: "Peso", options: [{ value: "", label: "Normal" }, ...[400, 500, 600, 700, 800].map((w) => ({ value: String(w), label: String(w) }))], get: () => String(styleOf().fontWeight ?? ""), set: (v) => style("fontWeight", v ? Number(v) : undefined) }))),
            row(
              F(segmentedField({ label: "Alineación", options: [{ value: "left", label: "Izquierda", icon: "alignLeft" }, { value: "center", label: "Centro", icon: "alignCenterX" }, { value: "right", label: "Derecha", icon: "alignRight" }], get: () => (styleOf().align as string) ?? "left", set: (v) => style("align", v === "left" ? undefined : v) })),
              F(segmentedField({ label: "Vertical", options: [{ value: "top", label: "Arriba", icon: "alignTop" }, { value: "middle", label: "Medio", icon: "alignCenterY" }, { value: "bottom", label: "Abajo", icon: "alignBottom" }], get: () => (styleOf().valign as string) ?? "top", set: (v) => style("valign", v === "top" ? undefined : v) })),
            ),
            row(num("Interlineado", "lineHeight", 0.8, 3, 0.05), num("Espaciado", "tracking", -0.05, 0.3, 0.01, "em")),
            h("div", { class: "ed-toggles" }, toggle("Cursiva", "italic").el, toggle("Mayúsculas", "uppercase").el, toggle("Resaltado", "mark").el, toggle("Tarjeta", "card").el),
          ),
          section("Color y fondo", color("Color", "color"), color("Fondo", "background"), row(num("Relleno", "padding", 0, 200, 1, "px"), radius())),
        );
        break;
      }
      case "image": {
        const src = F(textField({ label: "Archivo", mono: true, get: () => (current() as typeof e).src, set: (v) => patch({ src: v }, "src"), commit: seal }));
        const pick = trusted("button", { type: "button", class: "key ed-key" }, `${edIcon("image")}<span>Elegir imagen</span>`);
        pick.addEventListener("click", () => o.openAssetPicker((picked) => ctrl.patchSelected({ src: picked })));
        typeSections.push(
          section(
            "Imagen",
            src,
            h("div", { class: "ed-keys" }, pick),
            F(textField({ label: "Texto alternativo", maxlength: 300, placeholder: "Describe la imagen", get: () => (current() as typeof e).alt, set: (v) => patch({ alt: v }, "alt"), commit: seal })),
            F(segmentedField({ label: "Ajuste", options: [{ value: "contain", label: "Completa" }, { value: "cover", label: "Recortar" }], get: () => (current() as typeof e).fit ?? "contain", set: (v) => patch({ fit: v === "contain" ? undefined : v }, "fit") })),
            radius(),
          ),
        );
        break;
      }
      case "shape": {
        const line = e.shape === "line";
        typeSections.push(
          section(
            "Forma",
            F(segmentedField({ label: "Tipo", options: [{ value: "rect", label: "Rectángulo", icon: "rect" }, { value: "ellipse", label: "Elipse", icon: "ellipse" }, { value: "line", label: "Línea", icon: "line" }], get: () => (current() as typeof e).shape, set: (v) => patch({ shape: v }, "shape") })),
            line ? null : color("Relleno", "fill"),
            color(line ? "Color" : "Borde", "stroke"),
            line || e.shape === "ellipse" ? num(line ? "Grosor" : "Grosor del borde", "strokeWidth", 0, 40, 1, "px").el : row(num("Grosor del borde", "strokeWidth", 0, 40, 1, "px"), radius()),
          ),
        );
        break;
      }
      case "qr":
        typeSections.push(section("Código QR", h("p", { class: "ed-note" }, "El código y el enlace de la sesión aparecen al presentar."), color("Color", "color"), color("Fondo", "background")));
        break;
      case "icon": {
        const pick = trusted("button", { type: "button", class: "key ed-key" }, `${edIcon("sparkle")}<span>Cambiar ícono</span>`);
        pick.addEventListener("click", () => o.openIconPicker((name) => ctrl.patchSelected({ name }), (current() as typeof e).name));
        const nameField = F(selectField({ label: "Ícono", options: ICON_NAMES.map((n) => ({ value: n, label: n })), get: () => (current() as typeof e).name, set: (v) => patch({ name: v }, "name") }));
        typeSections.push(section("Ícono", nameField, h("div", { class: "ed-keys" }, pick), color("Color", "color"), color("Fondo", "background"), row(num("Grosor", "strokeWidth", 1, 3, 0.25), radius())));
        break;
      }
      case "chart": {
        typeSections.push(
          section(
            "Gráfico",
            F(segmentedField({ label: "Tipo", options: [{ value: "bar", label: "Barras" }, { value: "donut", label: "Dona" }], get: () => (current() as typeof e).kind, set: (v) => patch({ kind: v }, "kind") })),
            row(F(textField({ label: "Unidad", maxlength: 8, placeholder: "%", get: () => (current() as typeof e).unit ?? "", set: (v) => patch({ unit: v || undefined }, "unit"), commit: seal })), color("Color", "color")),
            chartRows(),
          ),
        );
        break;
      }
      case "decor":
        typeSections.push(
          section(
            "Decoración",
            F(selectField({ label: "Figura", options: DECOR_SHAPES.map(([v, l]) => ({ value: v, label: l })), get: () => (current() as typeof e).shape, set: (v) => patch({ shape: v }, "shape") })),
            color("Color", "color"),
            num("Opacidad", "opacity", 0.05, 1, 0.05),
          ),
        );
        break;
    }

    const del = trusted("button", { type: "button", class: "key key-danger ed-key" }, `${edIcon("trash")}<span>Borrar</span>`);
    del.addEventListener("click", () => ctrl.deleteSelected());
    const dup = trusted("button", { type: "button", class: "key ed-key" }, `${edIcon("duplicate")}<span>Duplicar</span>`);
    dup.addEventListener("click", () => ctrl.duplicateSelected());
    el.replaceChildren(
      h("header", { class: "ed-panel-head" }, h("h2", { class: "ed-panel-title" }, KIND_LABEL[e.type]), idField.el),
      position,
      ...typeSections,
      alignSection(false),
      arrange(),
      section("Acciones", h("div", { class: "ed-keys" }, dup, del)),
    );
    void sel;
  };

  /** Data rows editor for charts: label/value per row, add/remove within the kind's limits. */
  function chartRows(): HTMLElement {
    const wrap = h("div", { class: "ed-chart-rows" });
    const legendRow = h("div", { class: "ed-chart-head" }, h("span", { class: "legend" }, "Etiqueta"), h("span", { class: "legend" }, "Valor"));
    const list = h("div", { class: "ed-chart-list" });
    const add = trusted("button", { type: "button", class: "key ed-key" }, `${edIcon("plus")}<span>Añadir dato</span>`);
    const hint = h("p", { class: "field-hint" });
    const data = () => ((current() as Extract<DeckElement, { type: "chart" }> | undefined)?.data ?? []);
    const limits = () => ((current() as Extract<DeckElement, { type: "chart" }> | undefined)?.kind === "donut" ? [2, 6] : [1, 8]);
    const write = (rows: { label: string; value: number }[], key: string) => patch({ data: rows }, key);
    let built = -1;
    const paint = () => {
      const rows = data();
      const [min, max] = limits() as [number, number];
      hint.textContent = `De ${min} a ${max} datos.`;
      add.disabled = rows.length >= max;
      if (built === rows.length && list.childElementCount === rows.length) {
        rows.forEach((r, i) => {
          const li = list.children[i]!;
          const [label, value] = li.querySelectorAll("input");
          if (label && document.activeElement !== label && label.value !== r.label) label.value = r.label;
          if (value && document.activeElement !== value && Number(value.value) !== r.value) value.value = String(r.value);
        });
        return;
      }
      built = rows.length;
      list.replaceChildren(
        ...rows.map((r, i) => {
          const label = h("input", { type: "text", maxlength: 40, "aria-label": `Etiqueta ${i + 1}` });
          label.value = r.label;
          const value = h("input", { type: "number", min: 0, step: "any", class: "ed-mono", "aria-label": `Valor ${i + 1}` });
          value.value = String(r.value);
          label.addEventListener("input", () => write(data().map((x, j) => (j === i ? { ...x, label: label.value } : x)), `data.${i}.label`));
          value.addEventListener("input", () => {
            const n = Number(value.value);
            if (Number.isFinite(n) && n >= 0) write(data().map((x, j) => (j === i ? { ...x, value: n } : x)), `data.${i}.value`);
          });
          for (const input of [label, value]) input.addEventListener("blur", seal);
          const remove = iconKey("close", `Quitar dato ${i + 1}`, () => {
            if (data().length <= limits()[0]!) return;
            ctrl.patchSelected({ data: data().filter((_, j) => j !== i) });
          });
          remove.disabled = rows.length <= min;
          return h("div", { class: "ed-chart-row" }, label, value, remove);
        }),
      );
    };
    add.addEventListener("click", () => {
      const rows = data();
      if (rows.length >= limits()[1]!) return;
      ctrl.patchSelected({ data: [...rows, { label: String.fromCharCode(65 + rows.length), value: 10 }] });
    });
    paint();
    fields.push({ el: wrap, update: paint });
    wrap.append(legendRow, list, h("div", { class: "ed-keys" }, add), hint);
    return wrap;
  }

  return {
    el,
    render(state: EditorState) {
      const selected = ctrl.selectedElements;
      const key = `${state.selection.slide}|${selected.map((e) => `${e.id}:${e.type}${e.type === "shape" ? `:${e.shape}` : ""}${e.type === "chart" ? `:${e.kind}` : ""}`).join(",")}`;
      if (key !== identity) {
        identity = key;
        build(state);
        return;
      }
      for (const f of fields) f.update();
    },
  };
}
