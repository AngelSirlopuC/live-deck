import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import type { CreateSessionResponse, ServerMessage } from "../shared/protocol.ts";
import { createApp } from "../server/app.ts";

const decksDir = fileURLToPath(new URL("../decks", import.meta.url));

let server: Server;
let app: ReturnType<typeof createApp>;
let base: string;

beforeEach(async () => {
  app = createApp({ decksDir, distDir: null, adminKey: "secret-admin", publicBaseUrl: null, trustProxy: false, allowedOrigins: [] });
  server = createServer(app.handle);
  app.attach(server);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(async () => {
  app.close();
  await new Promise((r) => server.close(r));
});

class TestClient {
  readonly messages: ServerMessage[] = [];
  readonly ws: WebSocket;
  closed = false;
  private waiters: Array<() => void> = [];

  constructor(origin = base) {
    this.ws = new WebSocket(`${base.replace("http", "ws")}/ws`, { origin });
    this.ws.on("message", (d) => {
      this.messages.push(JSON.parse(d.toString()));
      this.waiters.forEach((w) => w());
    });
    this.ws.on("close", () => {
      this.closed = true;
      this.waiters.forEach((w) => w());
    });
  }

  async open() {
    if (this.ws.readyState === WebSocket.OPEN) return;
    await new Promise<void>((resolve, reject) => {
      this.ws.once("open", () => resolve());
      this.ws.once("error", reject);
    });
  }

  send(msg: unknown) {
    this.ws.send(JSON.stringify(msg));
  }

  async waitFor<T extends ServerMessage>(pred: (m: ServerMessage) => m is T, timeoutMs?: number): Promise<T>;
  async waitFor(pred: (m: ServerMessage) => boolean, timeoutMs?: number): Promise<ServerMessage>;
  async waitFor(pred: (m: ServerMessage) => boolean, timeoutMs = 2000): Promise<ServerMessage> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const hit = this.messages.find(pred);
      if (hit) return hit;
      if (Date.now() > deadline) throw new Error(`timeout; got ${JSON.stringify(this.messages)}`);
      await new Promise<void>((r) => {
        this.waiters.push(r);
        setTimeout(r, 50);
      });
    }
  }

  async waitClosed(timeoutMs = 2000) {
    const deadline = Date.now() + timeoutMs;
    while (!this.closed) {
      if (Date.now() > deadline) throw new Error("socket did not close");
      await new Promise((r) => setTimeout(r, 20));
    }
  }
}

async function createSession(pin = "2468"): Promise<CreateSessionResponse> {
  const res = await fetch(`${base}/api/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-key": "secret-admin" },
    body: JSON.stringify({ deckId: "demo", pin }),
  });
  expect(res.status).toBe(201);
  return (await res.json()) as CreateSessionResponse;
}

async function presenter(s: CreateSessionResponse, pin = "2468") {
  const c = new TestClient();
  await c.open();
  c.send({ t: "hello", role: "presenter", token: s.presenterToken, pin, surface: "console" });
  await c.waitFor((m) => m.t === "welcome-presenter");
  return c;
}

async function audience(s: CreateSessionResponse, name: string | null = "Ana", resume?: { id: string; key: string }) {
  const c = new TestClient();
  await c.open();
  c.send({ t: "hello", role: "audience", code: s.code, name, ...(resume ? { resume } : {}) });
  return c;
}

describe("session HTTP API", () => {
  it("requires the admin key to create sessions", async () => {
    const res = await fetch(`${base}/api/sessions`, { method: "POST", body: JSON.stringify({ deckId: "demo", pin: "1234" }) });
    expect(res.status).toBe(401);
  });

  it("rejects a malformed PIN", async () => {
    const res = await fetch(`${base}/api/sessions`, {
      method: "POST",
      headers: { "x-admin-key": "secret-admin" },
      body: JSON.stringify({ deckId: "demo", pin: "12" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns presenter and join urls, and public session info", async () => {
    const s = await createSession();
    expect(s.joinUrl).toBe(`${base}/s/${s.code}`);
    expect(s.presenterUrl).toBe(`${base}/p/${s.presenterToken}`);
    const info = await (await fetch(`${base}/api/sessions/${s.code}`)).json();
    expect(info).toEqual({ code: s.code, title: "Live Deck — demo", status: "waiting", restricted: false });
  });
});

describe("realtime session", () => {
  it("refuses sockets from a foreign origin", async () => {
    const c = new TestClient("https://evil.example");
    await expect(c.open()).rejects.toThrow();
  });

  it("rejects a wrong presenter PIN", async () => {
    const s = await createSession();
    const c = new TestClient();
    await c.open();
    c.send({ t: "hello", role: "presenter", token: s.presenterToken, pin: "0000", surface: "console" });
    const err = await c.waitFor((m) => m.t === "error");
    expect(err).toMatchObject({ code: "unauthorized" });
    await c.waitClosed();
  });

  it("gives the audience a public deck without answers or notes", async () => {
    const s = await createSession();
    const a = await audience(s, null);
    const welcome = await a.waitFor((m): m is Extract<ServerMessage, { t: "welcome-audience" }> => m.t === "welcome-audience");
    expect(JSON.stringify(welcome.deck)).not.toMatch(/correctIndex|notes/);
    expect(welcome.you.anonymous).toBe(true);
    expect(welcome.state.status).toBe("waiting");
    expect(welcome.joinUrl).toBe(s.joinUrl);
  });

  it("mirrors presenter navigation to the audience in real time", async () => {
    const s = await createSession();
    const p = await presenter(s);
    const a = await audience(s);
    await a.waitFor((m) => m.t === "welcome-audience");
    p.send({ t: "start" });
    p.send({ t: "next" });
    p.send({ t: "next" });
    const st = await a.waitFor((m) => m.t === "state" && m.state.position.slide === 1 && m.state.position.step === 1);
    expect(st).toMatchObject({ state: { status: "live", highWater: { slide: 1, step: 1 }, presenterOnline: true, audienceCount: 1 } });
  });

  it("resumes the same identity after a reconnect", async () => {
    const s = await createSession();
    const a1 = await audience(s, null);
    const w1 = await a1.waitFor((m): m is Extract<ServerMessage, { t: "welcome-audience" }> => m.t === "welcome-audience");
    a1.ws.close();
    const a2 = await audience(s, null, { id: w1.you.id, key: w1.you.resumeKey });
    const w2 = await a2.waitFor((m): m is Extract<ServerMessage, { t: "welcome-audience" }> => m.t === "welcome-audience");
    expect(w2.you).toEqual(w1.you);
  });

  it("restricting access closes every audience socket and refuses new joins", async () => {
    const s = await createSession();
    const p = await presenter(s);
    const a = await audience(s);
    await a.waitFor((m) => m.t === "welcome-audience");
    p.send({ t: "restrict", restricted: true });
    await a.waitFor((m) => m.t === "closed" && m.reason === "restricted");
    await a.waitClosed();
    const late = await audience(s, "Luis");
    await late.waitFor((m) => m.t === "closed" && m.reason === "restricted");
  });

  it("ending the session closes the audience channel", async () => {
    const s = await createSession();
    const p = await presenter(s);
    const a = await audience(s);
    await a.waitFor((m) => m.t === "welcome-audience");
    p.send({ t: "end" });
    await a.waitFor((m) => m.t === "closed" && m.reason === "ended");
    await p.waitFor((m) => m.t === "state" && m.state.status === "ended");
  });

  it("ignores audience attempts to drive the presentation", async () => {
    const s = await createSession();
    const a = await audience(s);
    await a.waitFor((m) => m.t === "welcome-audience");
    a.send({ t: "next" });
    const err = await a.waitFor((m) => m.t === "error");
    expect(err).toMatchObject({ code: "bad-request" });
  });
});
