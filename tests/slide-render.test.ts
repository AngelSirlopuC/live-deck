// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { Rocket } from "lucide";
import { beforeEach, describe, expect, it } from "vitest";
import type { Deck } from "../shared/deck.ts";
import { THEME_PRESETS } from "../shared/themes.ts";
import { STAGE_HEIGHT, STAGE_WIDTH, renderSlide } from "../web/src/render/slide.ts";

const deck: Deck = {
  version: 1,
  title: "T",
  slides: [
    {
      id: "s1",
      elements: [
        { id: "a", type: "text", box: { x: 0.5, y: 0.5, w: 0.25, h: 0.25 }, text: "<b>raw</b>\nline" },
        { id: "b", type: "text", box: { x: 0, y: 0, w: 0.1, h: 0.1 }, text: "later", fragment: 2 },
        { id: "q", type: "qr", box: { x: 0, y: 0, w: 0.2, h: 0.2 } },
      ],
    },
    {
      id: "s2",
      layout: "quiz",
      elements: [],
      quiz: { question: "Best?", options: ["One", "Two", "Three"], correctIndex: 1, display: "secret" },
    },
  ],
};

describe("renderSlide", () => {
  it("maps normalized boxes onto the 1920x1080 logical stage", () => {
    const el = renderSlide(deck, 0, { step: 0 });
    expect(el.style.width).toBe(`${STAGE_WIDTH}px`);
    expect(el.style.height).toBe(`${STAGE_HEIGHT}px`);
    const a = el.querySelector<HTMLElement>('[data-element-id="a"]')!;
    expect(a.style.left).toBe("960px");
    expect(a.style.top).toBe("540px");
    expect(a.style.width).toBe("480px");
    expect(a.style.height).toBe("270px");
  });

  it("renders text as text, never as HTML", () => {
    const el = renderSlide(deck, 0, { step: 0 });
    const a = el.querySelector('[data-element-id="a"]')!;
    expect(a.querySelector("b")).toBeNull();
    expect(a.textContent).toBe("<b>raw</b>\nline");
  });

  it("hides fragments until their step", () => {
    const at1 = renderSlide(deck, 0, { step: 1 }).querySelector<HTMLElement>('[data-element-id="b"]')!;
    expect(at1.hidden).toBe(true);
    const at2 = renderSlide(deck, 0, { step: 2 }).querySelector<HTMLElement>('[data-element-id="b"]')!;
    expect(at2.hidden).toBe(false);
  });

  it("fills qr elements with the join url when provided", () => {
    const withUrl = renderSlide(deck, 0, { step: 0, joinUrl: "https://x.test/s/ABC", qrSvg: "<svg data-qr></svg>" });
    const q = withUrl.querySelector('[data-element-id="q"]')!;
    expect(q.querySelector("svg")).not.toBeNull();
    expect(q.textContent).toContain("x.test/s/ABC");
    const placeholder = renderSlide(deck, 0, { step: 0 }).querySelector('[data-element-id="q"]')!;
    expect(placeholder.querySelector("svg")).toBeNull();
    expect(placeholder.textContent).toContain("El QR aparece al presentar");
  });

  it("lays out quiz slides with one option per choice and no answer leak", () => {
    const el = renderSlide(deck, 1, { step: 0 });
    const options = el.querySelectorAll("[data-option-index]");
    expect(options).toHaveLength(3);
    expect(el.textContent).toContain("Best?");
    expect(el.innerHTML).not.toContain("correct");
  });
});

const box = { x: 0.1, y: 0.1, w: 0.3, h: 0.3 };
const one = (slide: Partial<Deck["slides"][number]>, theme?: Deck["theme"]): Deck => ({
  version: 1,
  title: "T",
  ...(theme ? { theme } : {}),
  slides: [{ id: "s", elements: [], ...slide }],
});

describe("renderSlide with rich decks", () => {
  it("lays out an open-question slide with its question and a waiting line, and only there", () => {
    const stage = renderSlide(one({ layout: "ask", ask: { question: "¿Qué palabra describe tu semana?" } }), 0, { step: 0 });
    expect(stage.querySelector(".stage-ask-question")!.textContent).toBe("¿Qué palabra describe tu semana?");
    expect(stage.textContent).toContain("Responde desde tu teléfono");
    expect(renderSlide(one({}), 0, { step: 0 }).querySelector(".stage-ask")).toBeNull();
  });

  beforeEach(() => document.head.replaceChildren());

  it("renders legacy decks without preset layers, font overrides or font links", () => {
    // decks/demo plus a frozen copy of the pre-preset guide deck keep legacy rendering covered.
    for (const file of ["decks/demo/deck.json", "tests/fixtures/legacy-guide.json"]) {
      const legacy = JSON.parse(readFileSync(`${process.cwd()}/${file}`, "utf8")) as Deck;
      legacy.slides.forEach((slide, i) => {
        const stage = renderSlide(legacy, i, { step: 99 });
        expect(stage.dataset.preset).toBeUndefined();
        expect(stage.querySelector(".stage-bg")).toBeNull();
        expect(stage.style.getPropertyValue("--font-display")).toBe("");
        expect(stage.style.getPropertyValue("--theme-bg")).toBe(slide.background ?? legacy.theme!.background);
      });
    }
    expect(document.head.querySelector("link")).toBeNull();
  });

  it("exposes preset colours, fonts and card tokens as CSS variables on the stage", () => {
    const stage = renderSlide(one({}, { preset: "editorial", accent: "#0044ff" }), 0, { step: 0 });
    expect(stage.dataset.preset).toBe("editorial");
    expect(stage.style.getPropertyValue("--theme-bg")).toBe(THEME_PRESETS.editorial.colors.background);
    expect(stage.style.getPropertyValue("--theme-accent")).toBe("#0044ff");
    expect(stage.style.getPropertyValue("--theme-surface")).toBe(THEME_PRESETS.editorial.colors.surface);
    expect(stage.style.getPropertyValue("--font-display")).toContain("Fraunces");
    expect(stage.style.getPropertyValue("--card-radius")).not.toBe("");
  });

  it("loads each preset's Google Fonts stylesheet once", () => {
    renderSlide(one({}, { preset: "neon" }), 0, { step: 0 });
    renderSlide(one({}, { preset: "neon" }), 0, { step: 0 });
    const links = document.head.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]');
    expect(links).toHaveLength(1);
    expect(links[0]!.href).toContain("fonts.googleapis.com/css2");
    expect(links[0]!.dataset.themeFonts).toBe("Space Grotesk|Space Mono|Unbounded");
  });

  it("draws gradient, image, pattern and dim background layers", () => {
    const stage = renderSlide(
      one({ background: { color: "#101010", gradient: { from: "#000000", to: "#ffffff", angle: 90 }, image: "assets/bg.jpg", dim: 0.4, pattern: "grid" } }),
      0,
      { step: 0, assetBase: "/decks/x/" },
    );
    expect(stage.style.getPropertyValue("--theme-bg")).toBe("#101010");
    const bg = stage.querySelector<HTMLElement>(".stage-bg")!;
    expect(bg).not.toBeNull();
    expect(stage.firstElementChild).toBe(bg);
    expect(bg.querySelector<HTMLElement>(".stage-bg-gradient")!.style.getPropertyValue("--bg-gradient")).toBe("linear-gradient(90deg, #000000, #ffffff)");
    expect(bg.querySelector<HTMLImageElement>(".stage-bg-image")!.getAttribute("src")).toBe("/decks/x/assets/bg.jpg");
    expect(bg.querySelector<HTMLElement>(".stage-bg-pattern")!.dataset.pattern).toBe("grid");
    expect(bg.querySelector<HTMLElement>(".stage-bg-dim")!.style.opacity).toBe("0.4");
  });

  it("uses only the requested background layers", () => {
    const stage = renderSlide(one({ background: { pattern: "dots" } }), 0, { step: 0 });
    const bg = stage.querySelector(".stage-bg")!;
    expect(bg.querySelector(".stage-bg-pattern")).not.toBeNull();
    expect(bg.querySelector(".stage-bg-gradient, .stage-bg-image, .stage-bg-dim")).toBeNull();
  });

  it("paints a colour-only background object as the ground with no extra layer", () => {
    const stage = renderSlide(one({ background: { color: "#223344" } }, { preset: "neon" }), 0, { step: 0 });
    expect(stage.style.getPropertyValue("--theme-bg")).toBe("#223344");
    expect(stage.querySelector(".stage-bg")).toBeNull();
  });

  it("applies card, uppercase, tracking and mark text styles", () => {
    const stage = renderSlide(
      one({ elements: [{ id: "t", type: "text", box, text: "Hola", style: { card: true, uppercase: true, tracking: 0.12, mark: true } }] }),
      0,
      { step: 0 },
    );
    const t = stage.querySelector<HTMLElement>('[data-element-id="t"]')!;
    expect(t.classList.contains("card")).toBe(true);
    expect(t.style.textTransform).toBe("uppercase");
    expect(t.style.letterSpacing).toBe("0.12em");
    const mark = t.querySelector(".el-mark")!;
    expect(mark.textContent).toBe("Hola");
    expect(t.textContent).toBe("Hola");
  });

  it("renders icons as Lucide SVG built with DOM APIs", () => {
    const stage = renderSlide(
      one({ elements: [{ id: "i", type: "icon", box, name: "rocket", style: { color: "#ff0000", strokeWidth: 1.5, background: "#000000", radius: 20 } }] }),
      0,
      { step: 0 },
    );
    const node = stage.querySelector<HTMLElement>('[data-element-id="i"]')!;
    const svg = node.querySelector("svg")!;
    expect(svg.namespaceURI).toBe("http://www.w3.org/2000/svg");
    expect(svg.getAttribute("stroke-width")).toBe("1.5");
    expect(svg.querySelectorAll("path")).toHaveLength(Rocket.length);
    expect(svg.querySelector("path")!.getAttribute("d")).toBe(Rocket[0]![1].d);
    expect(node.style.color).toBe("rgb(255, 0, 0)");
    expect(node.style.borderRadius).toBe("20px");
  });

  it("renders nothing inside an icon whose name is not curated", () => {
    const deck = one({ elements: [{ id: "i", type: "icon", box, name: "<img src=x onerror=1>" as never }] });
    const node = renderSlide(deck, 0, { step: 0 }).querySelector('[data-element-id="i"]')!;
    expect(node.children).toHaveLength(0);
    expect(node.innerHTML).toBe("");
  });

  it("renders decor as a built-in SVG shape", () => {
    for (const shape of ["blob", "wave", "dots", "rings", "arc", "squiggle", "star", "grid"] as const) {
      const stage = renderSlide(one({ elements: [{ id: "d", type: "decor", box, shape, style: { color: "#00ff00", opacity: 0.5 } }] }), 0, { step: 0 });
      const node = stage.querySelector<HTMLElement>('[data-element-id="d"]')!;
      const svg = node.querySelector("svg")!;
      expect(svg, shape).not.toBeNull();
      expect(svg.children.length, shape).toBeGreaterThan(0);
      expect(node.style.opacity).toBe("0.5");
      expect(node.getAttribute("aria-hidden")).toBe("true");
    }
  });
});

describe("icon rendering regressions", () => {
  const iconDeck = (preset: "brutalista" | "neon", style: Record<string, unknown>): Deck =>
    ({
      version: 1,
      title: "T",
      theme: { preset },
      slides: [{ id: "s", elements: [{ id: "i", type: "icon", name: "rocket", box: { x: 0.1, y: 0.1, w: 0.08, h: 0.142 }, style }] }],
    }) as Deck;

  it("pads a background icon relative to its own box, not the stage", () => {
    const el = renderSlide(iconDeck("brutalista", { background: "#ffd400" }), 0, { step: 0 }).querySelector<HTMLElement>('[data-element-id="i"]')!;
    const pad = parseFloat(el.style.padding);
    expect(pad).toBeGreaterThan(0);
    expect(pad).toBeLessThan(0.08 * 1920 * 0.3);
    expect(el.querySelector("svg")).not.toBeNull();
  });

  it("uses the text colour for icons when the accent is too faint on the ground", () => {
    const light = renderSlide(iconDeck("brutalista", {}), 0, { step: 0 }).querySelector<HTMLElement>('[data-element-id="i"]')!;
    expect(light.style.color).toBe("var(--theme-fg)");
    const dark = renderSlide(iconDeck("neon", {}), 0, { step: 0 }).querySelector<HTMLElement>('[data-element-id="i"]')!;
    expect(dark.style.color).toBe("var(--theme-accent)");
  });
});

describe("zone quizzes", () => {
  const zoneDeck: Deck = {
    version: 1,
    title: "T",
    slides: [
      {
        id: "z",
        layout: "quiz",
        background: { image: "assets/slide-01.png" },
        elements: [],
        quiz: {
          question: "Designed question?",
          options: ["Alpha", "Beta", "Gamma"],
          correctIndex: 1,
          display: "live",
          zones: [
            { x: 0.05, y: 0.5, w: 0.25, h: 0.2 },
            { x: 0.375, y: 0.5, w: 0.25, h: 0.2 },
            { x: 0.7, y: 0.5, w: 0.25, h: 0.2 },
          ],
        },
      },
    ],
  };

  it("draws one positioned overlay per zone instead of the native question and options", () => {
    const stage = renderSlide(zoneDeck, 0, { step: 0 });
    const quiz = stage.querySelector<HTMLElement>(".quiz")!;
    expect(quiz.dataset.layout).toBe("zones");
    const zones = [...stage.querySelectorAll<HTMLElement>("[data-option-index]")];
    expect(zones).toHaveLength(3);
    expect(zones.map((z) => z.dataset.optionIndex)).toEqual(["0", "1", "2"]);
    expect([zones[1]!.style.left, zones[1]!.style.top, zones[1]!.style.width, zones[1]!.style.height]).toEqual(["720px", "540px", "480px", "216px"]);
    for (const z of zones) {
      expect(z.classList.contains("quiz-zone")).toBe(true);
      expect(z.querySelector(".quiz-bar")).not.toBeNull();
      expect(z.querySelector(".quiz-count")).not.toBeNull();
      expect(z.querySelector(".quiz-rank")).not.toBeNull();
    }
    expect(stage.querySelector(".quiz-question")).toBeNull();
    expect(stage.querySelector(".quiz-options")).toBeNull();
    expect(stage.querySelector(".quiz-label")).toBeNull();
    expect(stage.textContent).not.toContain("Designed question?");
    expect(stage.textContent).not.toContain("Alpha");
    expect(quiz.querySelector(".quiz-status")).not.toBeNull();
    expect(stage.innerHTML).not.toContain("correct");
  });

  it("draws dashed zone guides with the option letter only when showZones is set", () => {
    const live = renderSlide(zoneDeck, 0, { step: 0 });
    expect(live.querySelector(".quiz-zone-key")).toBeNull();
    expect(live.querySelector(".quiz-zone.has-guide")).toBeNull();
    const preview = renderSlide(zoneDeck, 0, { step: 0, showZones: true });
    const guides = [...preview.querySelectorAll<HTMLElement>(".quiz-zone.has-guide")];
    expect(guides).toHaveLength(3);
    expect(guides.map((g) => g.querySelector(".quiz-zone-key")!.textContent)).toEqual(["A", "B", "C"]);
  });

  it("keeps rendering native quizzes the same with or without showZones", () => {
    const native = renderSlide(deck, 1, { step: 0, showZones: true });
    expect(native.querySelector<HTMLElement>(".quiz")!.dataset.layout).toBeUndefined();
    expect(native.querySelector(".quiz-question")).not.toBeNull();
    expect(native.querySelector(".quiz-zone-key")).toBeNull();
  });
});

describe("stage view refit", () => {
  it("re-measures the host on demand", async () => {
    const { StageView } = await import("../web/src/render/stage-view.ts");
    const host = document.body.appendChild(document.createElement("div"));
    let width = 960;
    let height = 540;
    Object.defineProperty(host, "clientWidth", { get: () => width });
    Object.defineProperty(host, "clientHeight", { get: () => height });
    (globalThis as any).ResizeObserver ??= class { observe() {} disconnect() {} };
    const deck: Deck = { version: 1, title: "T", slides: [{ id: "s", elements: [] }] };
    const view = new StageView(host, deck);
    view.show({ slide: 0, step: 0 });
    expect(view.current!.style.transform).toContain("scale(0.5)");
    width = 1920;
    height = 1080;
    view.refit();
    expect(view.current!.style.transform).toContain("scale(1)");
  });
});

describe("entrances", () => {
  const motionDeck: Deck = {
    version: 1,
    title: "M",
    slides: [
      {
        id: "s",
        elements: [
          { id: "title", type: "text", box: { x: 0.1, y: 0.1, w: 0.8, h: 0.1 }, text: "Hola", style: { fontSize: 96 } },
          { id: "bars", type: "chart", kind: "bar", box: { x: 0.1, y: 0.3, w: 0.8, h: 0.4 }, data: [{ label: "a", value: 1 }, { label: "b", value: 2 }] },
          { id: "rule", type: "shape", shape: "line", box: { x: 0.1, y: 0.25, w: 0.8, h: 0.01 } },
          { id: "note", type: "text", box: { x: 0.1, y: 0.8, w: 0.8, h: 0.1 }, text: "Luego", fragment: 1 },
          { id: "last", type: "text", box: { x: 0.1, y: 0.9, w: 0.8, h: 0.1 }, text: "Final", fragment: 2 },
        ],
      },
    ],
  };
  const byId = (stage: HTMLElement, id: string) => stage.querySelector<HTMLElement>(`[data-element-id="${id}"]`)!;
  const entering = (stage: HTMLElement) => [...stage.querySelectorAll<HTMLElement>(".el.enter")].map((n) => n.dataset.elementId);

  it("adds nothing without enterSlide or enterStep, so the editor, thumbnails and print stay static", () => {
    const stage = renderSlide(motionDeck, 0, { step: 2 });
    expect(entering(stage)).toEqual([]);
    expect(stage.querySelectorAll("[style*='--enter']")).toHaveLength(0);
    expect(stage.querySelectorAll("[style*='--bar-index']")).toHaveLength(0);
    expect(stage.dataset.motion).toBe("calm");
  });

  it("gives every always-visible element its derived entrance on enterSlide, in reading order", () => {
    const stage = renderSlide(motionDeck, 0, { step: 0, enterSlide: true });
    expect(entering(stage)).toEqual(["title", "bars", "rule"]);
    const title = byId(stage, "title");
    expect(title.classList.contains("enter-rise-lg")).toBe(true);
    expect(title.style.getPropertyValue("--enter-delay")).toBe("0ms");
    expect(title.style.getPropertyValue("--enter-duration")).toBe("560ms");
    expect(title.style.getPropertyValue("--enter-ease")).not.toBe("");
    expect(byId(stage, "rule").classList.contains("enter-draw")).toBe(true);
    expect(byId(stage, "rule").style.getPropertyValue("--enter-delay")).toBe("80ms");
    expect(byId(stage, "bars").style.getPropertyValue("--enter-delay")).toBe("160ms");
    expect(byId(stage, "bars").classList.contains("enter-grow")).toBe(true);
    const bars = [...byId(stage, "bars").querySelectorAll<SVGElement>(".chart-bar")];
    expect(bars.map((b) => b.style.getPropertyValue("--bar-index"))).toEqual(["0", "1"]);
    expect(byId(stage, "note").classList.contains("enter")).toBe(false);
  });

  it("gives only the revealed step's elements an entrance on enterStep", () => {
    const stage = renderSlide(motionDeck, 0, { step: 1, enterStep: 1 });
    expect(entering(stage)).toEqual(["note"]);
    expect(byId(stage, "note").classList.contains("enter-rise")).toBe(true);
    expect(byId(stage, "title").classList.contains("enter")).toBe(false);
  });

  it("follows the deck motion style and plays nothing for none", () => {
    const snappy = renderSlide({ ...motionDeck, motion: "snappy" }, 0, { step: 0, enterSlide: true });
    expect(snappy.dataset.motion).toBe("snappy");
    expect(byId(snappy, "title").style.getPropertyValue("--enter-duration")).toBe("300ms");
    const none = renderSlide({ ...motionDeck, motion: "none" }, 0, { step: 1, enterSlide: true, enterStep: 1 });
    expect(none.dataset.motion).toBe("none");
    expect(entering(none)).toEqual([]);
  });

  it("keeps the stage DOM identical with and without the flags apart from entrance marks", () => {
    const strip = (stage: HTMLElement) => {
      for (const n of stage.querySelectorAll<HTMLElement>(".el.enter")) {
        n.classList.remove("enter", ...[...n.classList].filter((c) => c.startsWith("enter-")));
        for (const p of ["--enter-delay", "--enter-duration", "--enter-ease"]) n.style.removeProperty(p);
        for (const b of n.querySelectorAll<SVGElement>(".chart-bar")) {
          b.style.removeProperty("--bar-index");
          if (b.getAttribute("style") === "") b.removeAttribute("style");
        }
        if (n.getAttribute("style") === "") n.removeAttribute("style");
      }
      return stage.outerHTML.replace(/ class="el(.*?)"/g, (_m, rest: string) => ` class="el${rest.replace(/\s+$/, "")}"`);
    };
    expect(strip(renderSlide(motionDeck, 0, { step: 1, enterSlide: true, enterStep: 1 }))).toBe(strip(renderSlide(motionDeck, 0, { step: 1 })));
  });

  it("disables every entrance keyframe and the slide transition under prefers-reduced-motion", () => {
    const css = readFileSync(`${process.cwd()}/web/src/styles/stage.css`, "utf8");
    const names = [...css.matchAll(/@keyframes\s+((?:enter|stage-in|layer-in)[\w-]*)/g)].map((m) => m[1]!);
    expect(names.length).toBeGreaterThanOrEqual(10);
    const reduced = [...css.matchAll(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/g)].map((m) => m[1]!).join("\n");
    for (const name of names) {
      const uses = [...css.matchAll(/([^{}]+)\{[^{}]*animation(?:-name)?:\s*([\w-]+)[^{}]*\}/g)].filter((m) => m[2] === name).map((m) => m[1]!.trim().split("\n").pop()!.trim());
      expect(uses.length, `${name} is used`).toBeGreaterThan(0);
      for (const selector of uses) {
        const rule = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^{]*\\{[^}]*animation:\\s*none`);
        expect(reduced, `${selector} (${name}) is disabled under reduced motion`).toMatch(rule);
      }
    }
    expect(css).not.toMatch(/transition:\s*all/);
  });
});
