// @vitest-environment jsdom
import type { Deck } from "../../shared/deck.ts";
import { EditorApi, type KeyStore } from "../../web/src/editor/ui/api.ts";
import { EditorController } from "../../web/src/editor/ui/controller.ts";

export function sampleDeck(): Deck {
  return {
    version: 1,
    title: "Prueba",
    theme: { preset: "estudio" },
    slides: [
      {
        id: "portada",
        notes: "Saluda",
        elements: [
          { id: "titulo", type: "text", box: { x: 0.1, y: 0.1, w: 0.5, h: 0.2 }, text: "Hola\nmundo", style: { fontSize: 80, fontWeight: 800 } },
          { id: "caja", type: "shape", box: { x: 0.6, y: 0.5, w: 0.2, h: 0.2 }, shape: "rect", style: { fill: "#ff0000" } },
          { id: "paso", type: "text", box: { x: 0.1, y: 0.6, w: 0.3, h: 0.1 }, text: "Luego", fragment: 1 },
        ],
      },
      { id: "quiz", layout: "quiz", elements: [], quiz: { question: "¿Sí?", options: ["A", "B", "C"], correctIndex: 1, display: "live" } },
      { id: "abierta", layout: "ask", elements: [], ask: { question: "¿Qué tal?" } },
    ],
  };
}

export interface FakeServer {
  fetcher: typeof fetch;
  calls: Array<{ url: string; method: string; body?: string; headers: Record<string, string> }>;
  /** Overrides the next responses by URL+method; returns a Response. */
  respond: (fn: (url: string, init: RequestInit) => Response | undefined) => void;
  deck: Deck;
  revision: string;
}

const jsonResponse = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Minimal in-memory editor API: GET returns the deck, PUT checks the revision. */
export function fakeServer(deck: Deck = sampleDeck()): FakeServer {
  let override: ((url: string, init: RequestInit) => Response | undefined) | undefined;
  const server: FakeServer = {
    calls: [],
    deck,
    revision: "rev-1",
    respond: (fn) => (override = fn),
    fetcher: async (input, init = {}) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const method = init.method ?? "GET";
      const headers = Object.fromEntries(new Headers(init.headers as HeadersInit).entries());
      server.calls.push({ url, method, body: typeof init.body === "string" ? init.body : undefined, headers });
      const custom = override?.(url, init);
      if (custom) return custom;
      if (url.endsWith("/assets") && method === "GET") return jsonResponse(200, { assets: [{ name: "foto.png", size: 10 }] });
      if (url.includes("/assets?name=") && method === "POST") return jsonResponse(201, { src: "assets/foto.png", name: "foto.png", size: 10 });
      if (method === "GET") return jsonResponse(200, { deck: server.deck, revision: server.revision });
      if (method === "PUT") {
        const body = JSON.parse(String(init.body)) as { deck: Deck; revision: string };
        if (body.revision !== server.revision) return jsonResponse(409, { error: "conflict", revision: server.revision });
        server.deck = body.deck;
        server.revision = `rev-${server.calls.length}`;
        return jsonResponse(200, { revision: server.revision });
      }
      return jsonResponse(404, { error: "not found" });
    },
  };
  return server;
}

export function memoryKeys(initial: string | null = null): KeyStore {
  let key = initial;
  return { get: () => key, set: (k) => (key = k) };
}

export async function loadedController(server = fakeServer(), key: string | null = "secret") {
  const api = new EditorApi(memoryKeys(key), server.fetcher);
  const ctrl = new EditorController(api, "prueba");
  await ctrl.load();
  return { ctrl, api, server };
}
