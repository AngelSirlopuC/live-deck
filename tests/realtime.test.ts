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
  app = createApp({ decksDir, distDir: null, adminKey: "secret-admin", publicBaseUrl: null, trustProxy: false, allowedOrigins: [], lan: () => null });
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
    expect(st).toMatchObject({ state: { status: "live", highWater: { slide: 1, step: 1 }, presenterOnline: true, audienceCount: null } });
    expect(await p.waitFor((m) => m.t === "state" && m.state.audienceCount === 1)).toBeTruthy();
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

describe("live effects", () => {
  it("broadcasts ripples and persistent effects to the audience", async () => {
    const s = await createSession();
    const p = await presenter(s);
    const a = await audience(s);
    await a.waitFor((m) => m.t === "welcome-audience");
    p.send({ t: "start" });
    p.send({ t: "ripple", x: 0.4, y: 0.6 });
    expect(await a.waitFor((m) => m.t === "ripple")).toEqual({ t: "ripple", slide: 0, x: 0.4, y: 0.6 });
    p.send({ t: "effect", effect: { kind: "focus", target: { elementId: "qr" } } });
    await a.waitFor((m) => m.t === "state" && m.state.effect?.kind === "focus");
  });

  it("rejects malformed effect coordinates", async () => {
    const s = await createSession();
    const p = await presenter(s);
    p.send({ t: "ripple", x: 4, y: 0 });
    expect(await p.waitFor((m) => m.t === "error")).toMatchObject({ code: "bad-request" });
  });
});

describe("quiz over the wire", () => {
  async function screen(s: CreateSessionResponse) {
    const c = new TestClient();
    await c.open();
    c.send({ t: "hello", role: "presenter", token: s.presenterToken, pin: "2468", surface: "screen" });
    await c.waitFor((m) => m.t === "welcome-presenter");
    return c;
  }

  it("keeps a secret quiz hidden from audience and projector until reveal, then scores", async () => {
    const s = await createSession();
    const p = await presenter(s);
    const scr = await screen(s);
    const a = await audience(s, "Ana");
    await a.waitFor((m) => m.t === "welcome-audience");
    p.send({ t: "start" });
    p.send({ t: "goto", pos: { slide: 4, step: 0 } }); // quiz-secreto, correct = 1
    await a.waitFor((m) => m.t === "state" && !!m.state.quizzes["quiz-secreto"]);

    a.send({ t: "vote", slideId: "quiz-secreto", option: 1 });
    const me = await a.waitFor((m) => m.t === "me" && m.me.votes["quiz-secreto"] === 1);
    expect(me).toBeTruthy();

    const pState = await p.waitFor((m) => m.t === "state" && m.state.quizzes["quiz-secreto"]?.total === 1);
    expect(pState).toMatchObject({ state: { quizzes: { "quiz-secreto": { counts: [0, 1, 0, 0], correctIndex: 1 } } } });
    const aState = await a.waitFor((m) => m.t === "state" && m.state.quizzes["quiz-secreto"]?.total === 1);
    expect(aState).toMatchObject({ state: { quizzes: { "quiz-secreto": { counts: null, correctIndex: null } } } });
    const sState = await scr.waitFor((m) => m.t === "state" && m.state.quizzes["quiz-secreto"]?.total === 1);
    expect(sState).toMatchObject({ state: { quizzes: { "quiz-secreto": { counts: null, correctIndex: null } } } });

    p.send({ t: "quiz", action: "reveal" });
    await a.waitFor((m) => m.t === "state" && m.state.quizzes["quiz-secreto"]?.correctIndex === 1);
    await a.waitFor((m) => m.t === "me" && m.me.score.correct === 1 && m.me.score.answered === 1);
  });

  it("refuses votes after the presenter closes voting", async () => {
    const s = await createSession();
    const p = await presenter(s);
    const a = await audience(s, "Luis");
    await a.waitFor((m) => m.t === "welcome-audience");
    p.send({ t: "start" });
    p.send({ t: "goto", pos: { slide: 3, step: 0 } });
    p.send({ t: "quiz", action: "close" });
    await a.waitFor((m) => m.t === "state" && m.state.quizzes["quiz-vivo"]?.status === "closed");
    a.send({ t: "vote", slideId: "quiz-vivo", option: 0 });
    expect(await a.waitFor((m) => m.t === "error")).toMatchObject({ code: "bad-request" });
  });

  it("shares the leaderboard with the audience only when the presenter enables it", async () => {
    const s = await createSession();
    const p = await presenter(s);
    const a = await audience(s, "Ana");
    await a.waitFor((m) => m.t === "welcome-audience");
    p.send({ t: "start" });
    p.send({ t: "goto", pos: { slide: 3, step: 0 } });
    a.send({ t: "vote", slideId: "quiz-vivo", option: 1 });
    await a.waitFor((m) => m.t === "me" && m.me.votes["quiz-vivo"] === 1);
    p.send({ t: "quiz", action: "reveal" });
    const hidden = await a.waitFor((m) => m.t === "state" && m.state.quizzes["quiz-vivo"]?.status === "revealed");
    expect(hidden).toMatchObject({ state: { leaderboard: null, showScore: false } });
    p.send({ t: "settings", showScore: true });
    const shown = await a.waitFor((m) => m.t === "state" && m.state.showScore);
    expect(shown).toMatchObject({ state: { leaderboard: [{ name: "Ana", correct: 1, rank: 1 }] } });
    await a.waitFor((m) => m.t === "me" && m.me.rank?.rank === 1);
  });
});

describe("reactions and chat", () => {
  it("shares reactions between audience members but not with the presenter unless enabled", async () => {
    const s = await createSession();
    const p = await presenter(s);
    const a = await audience(s, "Ana");
    const b = await audience(s, "Bea");
    await a.waitFor((m) => m.t === "welcome-audience");
    await b.waitFor((m) => m.t === "welcome-audience");
    p.send({ t: "start" });
    a.send({ t: "react", i: 0 });
    a.send({ t: "react", i: 0 });
    expect(await b.waitFor((m) => m.t === "reactions")).toMatchObject({ counts: [2, 0, 0, 0, 0, 0] });
    await new Promise((r) => setTimeout(r, 450));
    expect(p.messages.some((m) => m.t === "reactions")).toBe(false);

    p.send({ t: "view", view: { showReactions: true, showReactionCounter: true } });
    await p.waitFor((m) => m.t === "state" && m.state.presenterView.showReactions);
    b.send({ t: "react", i: 1 });
    expect(await p.waitFor((m) => m.t === "reactions")).toMatchObject({ counts: [0, 1, 0, 0, 0, 0], totals: [2, 1, 0, 0, 0, 0] });
  });

  it("delivers chat once the presenter opens it, with moderation", async () => {
    const s = await createSession();
    const p = await presenter(s);
    const a = await audience(s, "Ana");
    const b = await audience(s, "Bea");
    await a.waitFor((m) => m.t === "welcome-audience");
    await b.waitFor((m) => m.t === "welcome-audience");

    a.send({ t: "chat", text: "hola" });
    expect(await a.waitFor((m) => m.t === "error")).toMatchObject({ code: "chat-closed" });

    p.send({ t: "chat-mode", mode: "text" });
    await a.waitFor((m) => m.t === "state" && m.state.chat.mode === "text");
    a.send({ t: "chat", text: "<b>hola</b>" });
    const msg = await b.waitFor((m): m is Extract<ServerMessage, { t: "chat" }> => m.t === "chat");
    expect(msg.message).toMatchObject({ name: "Ana", text: "<b>hola</b>" });
    await p.waitFor((m) => m.t === "chat");

    p.send({ t: "chat-delete", id: msg.message.id });
    await b.waitFor((m) => m.t === "chat-delete" && m.id === msg.message.id);
    p.send({ t: "chat-mute", participantId: msg.message.from });
    await new Promise((r) => setTimeout(r, 50));
    a.send({ t: "chat", text: "otra vez" });
    expect(await a.waitFor((m) => m.t === "error" && m.code === "chat-muted")).toBeTruthy();

    const late = await audience(s, "Carl");
    expect(await late.waitFor((m) => m.t === "chat-history")).toMatchObject({ messages: [] });
  });

  it("rejects stickers when no GIPHY key is configured", async () => {
    const s = await createSession();
    const p = await presenter(s);
    const a = await audience(s, "Ana");
    const w = await a.waitFor((m): m is Extract<ServerMessage, { t: "welcome-audience" }> => m.t === "welcome-audience");
    expect(w.features.stickers).toBe(false);
    p.send({ t: "chat-mode", mode: "mixed" });
    await a.waitFor((m) => m.t === "state" && m.state.chat.mode === "mixed");
    a.send({ t: "chat", stickerId: "abc" });
    expect(await a.waitFor((m) => m.t === "error")).toMatchObject({ code: "chat-sticker" });
    const res = await fetch(`${base}/api/sessions/${s.code}/stickers?q=hola`);
    expect(res.status).toBe(503);
  });
});

describe("robustness", () => {
  it("survives garbage frames and keeps serving the session", async () => {
    const s = await createSession();
    const p = await presenter(s);
    const a = await audience(s, "Ana");
    await a.waitFor((m) => m.t === "welcome-audience");
    for (const junk of ["not json", "{}", '{"t":"vote"}', '{"t":"chat","text":1}', "[]", "null", '{"t":"react","i":-1}']) a.ws.send(junk);
    p.send({ t: "start" });
    await a.waitFor((m) => m.t === "state" && m.state.status === "live");
    const health = await (await fetch(`${base}/api/health`)).json();
    expect(health.ok).toBe(true);
  });
});

describe("end of session", () => {
  it("gives the presenter a summary and deletes the session on request", async () => {
    const s = await createSession();
    const p = await presenter(s);
    p.send({ t: "start" });
    p.send({ t: "end" });
    await p.waitFor((m) => m.t === "state" && m.state.status === "ended");
    p.send({ t: "summary" });
    const sum = await p.waitFor((m): m is Extract<ServerMessage, { t: "summary" }> => m.t === "summary");
    expect(sum.summary.title).toBe("Live Deck — demo");
    p.send({ t: "purge" });
    await p.waitFor((m) => m.t === "closed" && m.reason === "ended");
    expect((await fetch(`${base}/api/sessions/${s.code}`)).status).toBe(404);
  });

  it("does not hand summaries to the audience", async () => {
    const s = await createSession();
    const a = await audience(s, "Ana");
    await a.waitFor((m) => m.t === "welcome-audience");
    a.send({ t: "summary" });
    expect(await a.waitFor((m) => m.t === "error")).toMatchObject({ code: "bad-request" });
  });
});

describe("chat before the presentation starts", () => {
  it("delivers messages while the session is still waiting", async () => {
    const s = await createSession();
    const p = await presenter(s);
    const a = await audience(s, "Ana");
    const b = await audience(s, "Bea");
    await a.waitFor((m) => m.t === "welcome-audience");
    await b.waitFor((m) => m.t === "welcome-audience");
    p.send({ t: "chat-mode", mode: "text" });
    await a.waitFor((m) => m.t === "state" && m.state.status === "waiting" && m.state.chat.mode === "text");
    a.send({ t: "chat", text: "¿Ya empieza?" });
    expect(await b.waitFor((m) => m.t === "chat")).toMatchObject({ message: { text: "¿Ya empieza?" } });
  });
});
