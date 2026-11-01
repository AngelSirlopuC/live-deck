// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { EditorApi } from "../../web/src/editor/ui/api.ts";
import { EditorController } from "../../web/src/editor/ui/controller.ts";
import { fakeServer, loadedController, memoryKeys, sampleDeck } from "./helpers.ts";

describe("EditorController load", () => {
  it("loads the deck with the admin key header and starts clean", async () => {
    const { ctrl, server } = await loadedController();
    expect(ctrl.state.phase).toBe("ready");
    expect(ctrl.state.revision).toBe("rev-1");
    expect(ctrl.state.saveState).toBe("saved");
    expect(server.calls[0]?.headers["x-admin-key"]).toBe("secret");
    expect(ctrl.state.deck?.slides).toHaveLength(3);
  });

  it("reports unauthorized, not-found, invalid file and network errors", async () => {
    const server = fakeServer();
    server.respond(() => new Response("{}", { status: 401 }));
    const a = await loadedController(server);
    expect(a.ctrl.state.phase).toBe("unauthorized");
    server.respond(() => new Response("{}", { status: 404 }));
    expect((await loadedController(server)).ctrl.state.phase).toBe("not-found");
    server.respond(() => new Response(JSON.stringify({ error: "slides: Required", raw: "{ bad" }), { status: 422 }));
    const c = await loadedController(server);
    expect(c.ctrl.state.phase).toBe("invalid");
    expect(c.ctrl.state.error).toBe("slides: Required");
    expect(c.ctrl.state.raw).toBe("{ bad");
    const api = new EditorApi(memoryKeys(), async () => {
      throw new TypeError("offline");
    });
    const ctrl = new EditorController(api, "x");
    await ctrl.load();
    expect(ctrl.state.phase).toBe("error");
    expect(ctrl.state.error).toMatch(/servidor/);
  });
});

describe("EditorController editing", () => {
  it("select → move via setBoxes → dirty → undo back to saved", async () => {
    const { ctrl } = await loadedController();
    const states: string[] = [];
    ctrl.subscribe((s) => states.push(s.saveState));
    ctrl.selectOne("titulo");
    expect(ctrl.state.selection.ids).toEqual(["titulo"]);
    ctrl.setBoxes({ titulo: { x: 0.2, y: 0.1, w: 0.5, h: 0.2 } }, "drag:titulo");
    ctrl.setBoxes({ titulo: { x: 0.3, y: 0.1, w: 0.5, h: 0.2 } }, "drag:titulo");
    ctrl.seal();
    expect(ctrl.state.saveState).toBe("dirty");
    expect(ctrl.selectedElements[0]?.box.x).toBe(0.3);
    ctrl.undo();
    // One drag is one undo step.
    expect(ctrl.selectedElements[0]?.box.x).toBe(0.1);
    expect(ctrl.state.saveState).toBe("saved");
    expect(ctrl.state.canRedo).toBe(true);
    ctrl.redo();
    expect(ctrl.selectedElements[0]?.box.x).toBe(0.3);
    expect(states).toContain("dirty");
  });

  it("an unchanged patch does not dirty the deck", async () => {
    const { ctrl } = await loadedController();
    ctrl.selectOne("titulo");
    ctrl.patchSelected({ style: { fontSize: 80 } });
    expect(ctrl.state.saveState).toBe("saved");
    expect(ctrl.state.canUndo).toBe(false);
  });

  it("keeps the selection on undo when the element still exists and prunes it otherwise", async () => {
    const { ctrl } = await loadedController();
    ctrl.selectOne("caja");
    ctrl.deleteSelected();
    expect(ctrl.state.selection.ids).toEqual([]);
    ctrl.undo();
    expect(ctrl.currentSlide?.elements.map((e) => e.id)).toContain("caja");
    ctrl.addElement({ kind: "text", text: "Nuevo" });
    expect(ctrl.state.selection.ids).toEqual(["text-1"]);
    ctrl.undo();
    expect(ctrl.state.selection.ids).toEqual([]);
  });

  it("nudges the selection with arrows and clamps slide index after deleting the last slide", async () => {
    const { ctrl } = await loadedController();
    ctrl.selectOne("caja");
    ctrl.nudge("ArrowRight", false);
    ctrl.nudge("ArrowRight", true);
    expect(ctrl.selectedElements[0]?.box.x).toBeCloseTo(0.6 + 0.0025 + 0.02, 4);
    ctrl.selectSlide(2);
    ctrl.deleteSlide();
    expect(ctrl.state.selection.slide).toBe(1);
    expect(ctrl.deck.slides).toHaveLength(2);
  });

  it("adds, duplicates and reorders slides from the rail", async () => {
    const { ctrl } = await loadedController();
    ctrl.addSlide("quiz");
    expect(ctrl.state.selection.slide).toBe(1);
    expect(ctrl.currentSlide?.layout).toBe("quiz");
    ctrl.duplicateSlide(0);
    expect(ctrl.state.selection.slide).toBe(1);
    expect(ctrl.currentSlide?.id).toBe("portada-2");
    ctrl.moveSlide(1, 0);
    expect(ctrl.deck.slides[0]?.id).toBe("portada-2");
    expect(ctrl.state.selection.slide).toBe(0);
  });

  it("copies and pastes elements across slides with fresh ids", async () => {
    const { ctrl } = await loadedController();
    ctrl.select(["titulo", "caja"]);
    expect(await ctrl.copy()).toBe(true);
    ctrl.selectSlide(1);
    expect(await ctrl.paste()).toBe(true);
    expect(ctrl.currentSlide?.elements.map((e) => e.id)).toEqual(["titulo", "caja"]);
    expect(ctrl.state.selection.ids).toEqual(["titulo", "caja"]);
    expect(await ctrl.paste()).toBe(true);
    expect(ctrl.currentSlide?.elements).toHaveLength(4);
  });
});

describe("EditorController save", () => {
  it("PUTs the deck with the loaded revision and becomes clean with the new revision", async () => {
    const { ctrl, server } = await loadedController();
    expect(await ctrl.save()).toEqual({ kind: "clean" });
    ctrl.dispatch({ type: "setTitle", title: "Nuevo título" });
    const result = await ctrl.save();
    expect(result).toEqual({ kind: "saved" });
    const put = server.calls.find((c) => c.method === "PUT")!;
    expect(JSON.parse(put.body!)).toMatchObject({ revision: "rev-1", deck: { title: "Nuevo título" } });
    expect(put.headers["x-admin-key"]).toBe("secret");
    expect(ctrl.state.saveState).toBe("saved");
    expect(ctrl.state.revision).not.toBe("rev-1");
  });

  it("blocks the save with validation issues", async () => {
    const { ctrl, server } = await loadedController();
    ctrl.selectSlide(1);
    ctrl.dispatch({ type: "setSlide", index: 1, patch: { quiz: { question: "   " } } });
    const result = await ctrl.save();
    expect(result.kind).toBe("issues");
    if (result.kind === "issues") expect(result.issues[0]?.path).toBe("slides.1.quiz.question");
    expect(server.calls.some((c) => c.method === "PUT")).toBe(false);
  });

  it("409 → conflict; reload discards mine; overwrite refetches the revision and PUTs mine", async () => {
    const { ctrl, server } = await loadedController();
    ctrl.dispatch({ type: "setTitle", title: "Mío" });
    server.revision = "rev-other";
    server.deck = { ...sampleDeck(), title: "De otra persona" };
    expect(await ctrl.save()).toEqual({ kind: "conflict" });
    expect(ctrl.state.saveState).toBe("dirty");

    const overwrite = await ctrl.overwrite();
    expect(overwrite).toEqual({ kind: "saved" });
    expect(server.deck.title).toBe("Mío");
    expect(ctrl.state.saveState).toBe("saved");

    ctrl.dispatch({ type: "setTitle", title: "Otra vez" });
    server.revision = "rev-x";
    server.deck = { ...sampleDeck(), title: "Ajeno" };
    expect(await ctrl.save()).toEqual({ kind: "conflict" });
    await ctrl.reload();
    expect(ctrl.deck.title).toBe("Ajeno");
    expect(ctrl.state.saveState).toBe("saved");
    expect(ctrl.state.canUndo).toBe(false);
  });

  it("keeps edits made during the request dirty and surfaces 400 and network errors", async () => {
    const { ctrl, server } = await loadedController();
    ctrl.dispatch({ type: "setTitle", title: "Uno" });
    const pending = ctrl.save();
    ctrl.dispatch({ type: "setTitle", title: "Dos" });
    expect(await pending).toEqual({ kind: "saved" });
    expect(ctrl.state.saveState).toBe("dirty");

    server.respond((_, init) => (init.method === "PUT" ? new Response(JSON.stringify({ error: "slides.0.id: bad" }), { status: 400 }) : undefined));
    expect(await ctrl.save()).toEqual({ kind: "invalid", error: "slides.0.id: bad" });
    expect(ctrl.state.saveState).toBe("error");
    expect(ctrl.state.error).toBe("slides.0.id: bad");
    ctrl.dispatch({ type: "setTitle", title: "Tres" });
    expect(ctrl.state.saveState).toBe("dirty");

    server.respond((_, init) => {
      if (init.method === "PUT") throw new TypeError("offline");
      return undefined;
    });
    expect((await ctrl.save()).kind).toBe("error");
    expect(ctrl.state.saveState).toBe("error");
    server.respond(() => undefined);
    expect((await ctrl.save()).kind).toBe("saved");
  });
});
