// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountHome } from "../web/src/pages/home.ts";

const DECKS = [
  { id: "demo", title: "Demo", slides: 7 },
  { id: "otra", title: "Otra", slides: 2 },
];

function stubFetch(create: { status: number; body: unknown } = { status: 201, body: { id: "mi-charla", revision: "x" } }) {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (url === "/api/decks") return new Response(JSON.stringify(DECKS), { status: 200 });
    if (url === "/api/editor/decks") return new Response(JSON.stringify(create.body), { status: create.status });
    return new Response("{}", { status: 404 });
  });
  return calls;
}

async function mount() {
  const root = document.createElement("div");
  document.body.replaceChildren(root);
  const visited: string[] = [];
  await mountHome(root, (url) => void visited.push(url));
  return { root, visited };
}

afterEach(() => vi.unstubAllGlobals());

describe("home editor entry points", () => {
  it("links Editar to the selected deck's editor", async () => {
    stubFetch();
    const { root } = await mount();
    const edit = root.querySelector<HTMLAnchorElement>("a.home-edit")!;
    expect(edit.getAttribute("href")).toBe("/edit/demo");
    const select = root.querySelector<HTMLSelectElement>("#deck")!;
    select.value = "otra";
    select.dispatchEvent(new Event("change"));
    expect(edit.getAttribute("href")).toBe("/edit/otra");
  });

  it("creates a new deck and opens it in the editor", async () => {
    const calls = stubFetch();
    const { root, visited } = await mount();
    root.querySelector<HTMLButtonElement>("button.home-new")!.click();
    const form = root.querySelector<HTMLFormElement>("form.home-new-form")!;
    expect(form.hidden).toBe(false);
    form.querySelector<HTMLInputElement>("#new-title")!.value = "Mi charla";
    form.querySelector<HTMLInputElement>("#new-title")!.dispatchEvent(new Event("input"));
    expect(form.querySelector<HTMLInputElement>("#new-id")!.value).toBe("mi-charla");
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    await vi.waitFor(() => expect(visited).toEqual(["/edit/mi-charla"]));
    const post = calls.find((c) => c.url === "/api/editor/decks")!;
    expect(post.init?.method).toBe("POST");
    // The preset is always explicit; the mode travels only when it differs from the preset's native one.
    expect(JSON.parse(String(post.init?.body))).toEqual({ id: "mi-charla", title: "Mi charla", preset: "estudio" });
  });

  it("offers the six presets with the native mode preselected and sends mode only when flipped", async () => {
    const calls = stubFetch();
    const { root } = await mount();
    root.querySelector<HTMLButtonElement>("button.home-new")!.click();
    const form = root.querySelector<HTMLFormElement>("form.home-new-form")!;
    const preset = form.querySelector<HTMLSelectElement>("#new-preset")!;
    expect([...preset.options].map((o) => o.value)).toEqual(["estudio", "editorial", "neon", "papel", "brutalista", "corporativo"]);
    expect([...preset.options].map((o) => o.textContent)).toEqual(["Estudio", "Editorial", "Neón", "Papel", "Brutalista", "Corporativo"]);
    const mode = (value: string) => form.querySelector<HTMLButtonElement>(`.home-mode [data-mode="${value}"]`)!;
    expect(mode("dark").getAttribute("aria-pressed")).toBe("true");
    expect(mode("light").getAttribute("aria-pressed")).toBe("false");
    preset.value = "papel";
    preset.dispatchEvent(new Event("change"));
    expect(mode("light").getAttribute("aria-pressed")).toBe("true");
    mode("dark").click();
    expect(mode("dark").getAttribute("aria-pressed")).toBe("true");
    form.querySelector<HTMLInputElement>("#new-title")!.value = "Papel";
    form.querySelector<HTMLInputElement>("#new-title")!.dispatchEvent(new Event("input"));
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    await vi.waitFor(() => expect(calls.some((c) => c.url === "/api/editor/decks")).toBe(true));
    expect(JSON.parse(String(calls.find((c) => c.url === "/api/editor/decks")!.init?.body))).toEqual({ id: "papel", title: "Papel", preset: "papel", mode: "dark" });
  });

  it("sends no mode when the preset's native mode is chosen again", async () => {
    const calls = stubFetch();
    const { root } = await mount();
    root.querySelector<HTMLButtonElement>("button.home-new")!.click();
    const form = root.querySelector<HTMLFormElement>("form.home-new-form")!;
    form.querySelector<HTMLButtonElement>('.home-mode [data-mode="light"]')!.click();
    form.querySelector<HTMLButtonElement>('.home-mode [data-mode="dark"]')!.click();
    form.querySelector<HTMLInputElement>("#new-title")!.value = "Otra vez";
    form.querySelector<HTMLInputElement>("#new-title")!.dispatchEvent(new Event("input"));
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    await vi.waitFor(() => expect(calls.some((c) => c.url === "/api/editor/decks")).toBe(true));
    expect(JSON.parse(String(calls.find((c) => c.url === "/api/editor/decks")!.init?.body))).toEqual({ id: "otra-vez", title: "Otra vez", preset: "estudio" });
  });

  it("shows the server's error when the deck already exists", async () => {
    stubFetch({ status: 409, body: { error: "deck already exists" } });
    const { root, visited } = await mount();
    root.querySelector<HTMLButtonElement>("button.home-new")!.click();
    const form = root.querySelector<HTMLFormElement>("form.home-new-form")!;
    form.querySelector<HTMLInputElement>("#new-title")!.value = "Demo";
    form.querySelector<HTMLInputElement>("#new-title")!.dispatchEvent(new Event("input"));
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    await vi.waitFor(() => expect(form.querySelector(".form-error")!.textContent).toBe("Ya existe una presentación con ese identificador."));
    expect(visited).toEqual([]);
  });

  it("still lists decks and keeps the session form", async () => {
    stubFetch();
    const { root } = await mount();
    expect(root.querySelectorAll("#deck option")).toHaveLength(2);
    expect(root.querySelector("form.home-form button[type=submit]")!.textContent).toBe("Crear sesión");
  });
});
