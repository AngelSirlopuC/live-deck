// Slide panel: id, layout, background layers, speaker notes, and the quiz /
// open-question editors. Rebuilt when the slide identity or layout changes.
import type { Quiz, Slide, SlideBackground } from "../../../../../shared/deck.ts";
import { ASK_QUESTION_MAX, ASK_TEXT_DEFAULT, ASK_TEXT_MAX, ASK_TEXT_MIN } from "../../../../../shared/ask.ts";
import { h, trusted } from "../../../ui/dom.ts";
import { isValidId, type SlidePatch } from "../../model/index.ts";
import type { EditorController, EditorState } from "../controller.ts";
import { colorField, iconKey, numberField, row, section, segmentedField, selectField, textField, type Field } from "../fields.ts";
import { edIcon } from "../icons.ts";
import { themeSwatches } from "./element.ts";

export type BackgroundMode = "none" | "color" | "gradient" | "image" | "pattern";

/** Which background editor a slide's background opens in. */
export function backgroundMode(bg: Slide["background"]): BackgroundMode {
  if (bg === undefined) return "none";
  if (typeof bg === "string") return "color";
  if (bg.gradient) return "gradient";
  if (bg.image) return "image";
  if (bg.color) return "color";
  return "pattern";
}

/** Object form of a slide background (a hex string becomes `{ color }`). */
export function backgroundObject(bg: Slide["background"]): SlideBackground {
  if (bg === undefined) return {};
  return typeof bg === "string" ? { color: bg } : bg;
}

export interface SlidePanelOptions {
  openAssetPicker: (onPick: (src: string) => void, onClose?: () => void) => void;
}

export function createSlidePanel(ctrl: EditorController, o: SlidePanelOptions) {
  const el = h("div", { class: "ed-panel ed-panel-slide" });
  let identity = "";
  let fields: Field[] = [];
  const F = (f: Field) => {
    fields.push(f);
    return f;
  };
  const slide = (): Slide | undefined => ctrl.currentSlide;
  const index = () => ctrl.state.selection.slide;
  const coalesce = (key: string) => `slide:${index()}:${key}`;
  const seal = () => ctrl.seal();
  const set = (patch: SlidePatch, key?: string) => ctrl.dispatch({ type: "setSlide", index: index(), patch }, key ? coalesce(key) : undefined);
  const bg = () => backgroundObject(slide()?.background);
  const setBg = (next: SlideBackground, key: string) => set({ background: next }, key);

  const build = (state: EditorState) => {
    fields = [];
    const s = slide();
    if (!s) return;
    const swatches = themeSwatches(state);
    const mode = backgroundMode(s.background);

    const idField = F(
      textField({
        label: "Id",
        mono: true,
        get: () => slide()?.id ?? "",
        validate: (v) => (!isValidId(v) ? "Solo letras, números, guion y guion bajo (1-40)." : v !== slide()?.id && ctrl.deck.slides.some((x) => x.id === v) ? "Ya hay una diapositiva con ese id." : ""),
        set: () => {},
        commit: () => {
          const v = idField.el.querySelector("input")!.value;
          if (v !== slide()?.id && isValidId(v) && !ctrl.deck.slides.some((x) => x.id === v)) set({ id: v });
        },
      }),
    );
    const layout = F(
      segmentedField({
        label: "Tipo",
        options: [
          { value: "free", label: "Libre" },
          { value: "quiz", label: "Quiz" },
          { value: "ask", label: "Pregunta abierta" },
        ],
        get: () => slide()?.layout ?? "free",
        set: (v) => set({ layout: v as Slide["layout"] }),
      }),
    );

    // Background -----------------------------------------------------------
    const modeField = F(
      selectField({
        label: "Fondo",
        options: [
          { value: "none", label: "Del tema" },
          { value: "color", label: "Color" },
          { value: "gradient", label: "Degradado" },
          { value: "image", label: "Imagen" },
          { value: "pattern", label: "Solo patrón" },
        ],
        get: () => backgroundMode(slide()?.background),
        set: (v) => {
          const cur = bg();
          const keep = { ...(cur.dim !== undefined ? { dim: cur.dim } : {}), ...(cur.pattern ? { pattern: cur.pattern } : {}) };
          switch (v as BackgroundMode) {
            case "none": return void set({ background: undefined });
            case "color": return void setBg({ ...keep, color: cur.color ?? "#1a1a1a" }, "bg");
            case "gradient": return void setBg({ ...keep, gradient: cur.gradient ?? { from: "#1a1a2e", to: "#e94560", angle: 135 } }, "bg");
            case "image": {
              let picked = false;
              return void o.openAssetPicker(
                (src) => {
                  picked = true;
                  setBg({ ...keep, image: src, dim: keep.dim ?? 0.4 }, "bg");
                },
                () => {
                  if (!picked) modeField.update();
                },
              );
            }
            case "pattern": return void setBg({ ...keep, pattern: keep.pattern ?? "dots" }, "bg");
          }
        },
      }),
    );
    const bgFields: Array<Field | HTMLElement> = [];
    if (mode === "color") bgFields.push(F(colorField({ label: "Color", swatches, get: () => bg().color, set: (v) => setBg({ ...bg(), color: v ?? "#1a1a1a" }, "bg.color"), commit: seal })));
    if (mode === "gradient") {
      const g = () => bg().gradient ?? { from: "#000000", to: "#ffffff" };
      bgFields.push(
        row(
          F(colorField({ label: "Desde", swatches, get: () => g().from, set: (v) => setBg({ ...bg(), gradient: { ...g(), from: v ?? "#000000" } }, "bg.from"), commit: seal })),
          F(colorField({ label: "Hasta", swatches, get: () => g().to, set: (v) => setBg({ ...bg(), gradient: { ...g(), to: v ?? "#ffffff" } }, "bg.to"), commit: seal })),
        ),
        F(numberField({ label: "Ángulo", min: 0, max: 360, step: 1, unit: "°", get: () => g().angle ?? 135, set: (v) => setBg({ ...bg(), gradient: { ...g(), angle: v } }, "bg.angle"), commit: seal })),
      );
    }
    if (mode === "image") {
      const pick = trusted("button", { type: "button", class: "key ed-key" }, `${edIcon("image")}<span>Cambiar imagen</span>`);
      pick.addEventListener("click", () => o.openAssetPicker((src) => setBg({ ...bg(), image: src }, "bg.image")));
      bgFields.push(F(textField({ label: "Archivo", mono: true, get: () => bg().image ?? "", set: (v) => setBg({ ...bg(), image: v }, "bg.image"), commit: seal })), h("div", { class: "ed-keys" }, pick));
    }
    if (mode !== "none") {
      bgFields.push(
        row(
          F(selectField({ label: "Patrón", options: [{ value: "", label: "Ninguno" }, { value: "dots", label: "Puntos" }, { value: "grid", label: "Cuadrícula" }, { value: "lines", label: "Líneas" }, { value: "noise", label: "Grano" }], get: () => bg().pattern ?? "", set: (v) => setBg({ ...bg(), pattern: (v || undefined) as SlideBackground["pattern"] }, "bg.pattern") })),
          F(numberField({ label: "Oscurecer", min: 0, max: 0.9, step: 0.05, optional: true, placeholder: "0", get: () => bg().dim, set: (v) => setBg({ ...bg(), dim: v }, "bg.dim"), commit: seal })),
        ),
      );
    }

    const notes = F(textField({ label: "Notas del ponente", multiline: true, maxlength: 5000, placeholder: "Solo tú las ves en la consola.", get: () => slide()?.notes ?? "", set: (v) => set({ notes: v }, "notes"), commit: seal }));

    const sections: HTMLElement[] = [
      h("header", { class: "ed-panel-head" }, h("h2", { class: "ed-panel-title" }, `Diapositiva ${index() + 1}`), idField.el),
      section("Tipo de diapositiva", layout),
      section("Fondo", modeField, ...bgFields),
    ];
    if (s.layout === "quiz") sections.push(quizSection());
    if (s.layout === "ask") sections.push(askSection());
    sections.push(section("Notas", notes));
    el.replaceChildren(...sections);
  };

  function quizSection(): HTMLElement {
    const q = (): Quiz => slide()?.quiz ?? { question: "", options: [], correctIndex: 0, display: "live" };
    const setQ = (patch: Partial<Quiz>, key?: string) => set({ quiz: patch }, key);
    const question = F(textField({ label: "Pregunta", multiline: true, maxlength: 300, get: () => q().question, set: (v) => setQ({ question: v }, "quiz.question"), commit: seal }));
    const list = h("div", { class: "ed-options", role: "group", "aria-label": "Opciones" });
    const add = trusted("button", { type: "button", class: "key ed-key" }, `${edIcon("plus")}<span>Añadir opción</span>`);
    const hint = h("p", { class: "field-hint" }, "De 2 a 6 opciones. Marca la correcta.");
    let built = -1;
    const paintOptions = () => {
      const quiz = q();
      add.disabled = quiz.options.length >= 6;
      if (built === quiz.options.length) {
        quiz.options.forEach((opt, i) => {
          const rowEl = list.children[i]!;
          const input = rowEl.querySelector<HTMLInputElement>('input[type="text"]')!;
          const radio = rowEl.querySelector<HTMLInputElement>('input[type="radio"]')!;
          if (document.activeElement !== input && input.value !== opt) input.value = opt;
          radio.checked = quiz.correctIndex === i;
        });
        return;
      }
      built = quiz.options.length;
      list.replaceChildren(
        ...quiz.options.map((opt, i) => {
          const letter = String.fromCharCode(65 + i);
          const radio = h("input", { type: "radio", name: `ed-correct-${index()}`, "aria-label": `${letter} es la correcta`, title: "Respuesta correcta" });
          radio.checked = quiz.correctIndex === i;
          radio.addEventListener("change", () => setQ({ correctIndex: i }));
          const input = h("input", { type: "text", maxlength: 120, "aria-label": `Opción ${letter}` });
          input.value = opt;
          input.addEventListener("input", () => setQ({ options: q().options.map((x, j) => (j === i ? input.value : x)) }, `quiz.options.${i}`));
          input.addEventListener("blur", seal);
          const remove = iconKey("close", `Quitar opción ${letter}`, () => {
            const cur = q();
            if (cur.options.length <= 2) return;
            const options = cur.options.filter((_, j) => j !== i);
            const correctIndex = cur.correctIndex === i ? 0 : cur.correctIndex > i ? cur.correctIndex - 1 : cur.correctIndex;
            setQ({ options, correctIndex });
          });
          remove.disabled = quiz.options.length <= 2;
          return h("div", { class: `ed-option${quiz.correctIndex === i ? " is-correct" : ""}` }, h("label", { class: "ed-option-key" }, radio, h("span", { class: "ed-option-letter" }, letter)), input, remove);
        }),
      );
    };
    paintOptions();
    fields.push({ el: list, update: paintOptions });
    add.addEventListener("click", () => {
      const cur = q();
      if (cur.options.length >= 6) return;
      setQ({ options: [...cur.options, `Opción ${String.fromCharCode(65 + cur.options.length)}`] });
    });
    const display = F(segmentedField({ label: "Votos", options: [{ value: "live", label: "En vivo" }, { value: "secret", label: "Secretos" }], get: () => q().display, set: (v) => setQ({ display: v as Quiz["display"] }) }));
    const results = F(segmentedField({ label: "Resultados", options: [{ value: "ranking", label: "Ranking" }, { value: "grid", label: "Cuadrícula" }], get: () => q().results ?? "ranking", set: (v) => setQ({ results: v === "ranking" ? undefined : (v as Quiz["results"]) }) }));
    const timer = F(numberField({ label: "Temporizador", unit: "s", min: 5, max: 600, optional: true, placeholder: "sin límite", get: () => q().timerSec, set: (v) => setQ({ timerSec: v }, "quiz.timer"), commit: seal }));
    return section("Quiz", question, list, h("div", { class: "ed-keys" }, add), hint, display, results, timer);
  }

  function askSection(): HTMLElement {
    const a = () => slide()?.ask ?? { question: "" };
    return section(
      "Pregunta abierta",
      F(textField({ label: "Pregunta", multiline: true, maxlength: ASK_QUESTION_MAX, get: () => a().question, set: (v) => set({ ask: { question: v } }, "ask.question"), commit: seal })),
      F(numberField({ label: "Largo máximo de respuesta", unit: "car.", min: ASK_TEXT_MIN, max: ASK_TEXT_MAX, optional: true, placeholder: String(ASK_TEXT_DEFAULT), get: () => a().maxChars, set: (v) => set({ ask: { maxChars: v } }, "ask.max"), commit: seal })),
      h("p", { class: "field-hint" }, `Entre ${ASK_TEXT_MIN} y ${ASK_TEXT_MAX} caracteres por respuesta.`),
    );
  }

  return {
    el,
    render(state: EditorState) {
      const s = slide();
      if (!s) return;
      const key = `${state.selection.slide}|${s.layout ?? "free"}|${backgroundMode(s.background)}`;
      if (key !== identity) {
        identity = key;
        build(state);
        return;
      }
      for (const f of fields) f.update();
    },
  };
}
