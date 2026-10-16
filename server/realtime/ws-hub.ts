import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, type RawData, type WebSocket } from "ws";
import { publicDeck } from "../../shared/deck.ts";
import { AudienceCommandSchema, HelloSchema, PresenterCommandSchema } from "../../shared/protocol-schemas.ts";
import type { AudienceHello, CloseReason, ErrorCode, PresenterHello, ServerMessage } from "../../shared/protocol.ts";
import type { SessionEntry, SessionRegistry } from "../session/registry.ts";

export interface HubOptions {
  registry: SessionRegistry;
  now: () => number;
  /** Builds public URLs for a request (join link, presenter link). */
  baseUrl: (req: IncomingMessage) => string;
  /** Exact origins allowed to open sockets; empty = same host as the request. */
  allowedOrigins: string[];
  tickMs?: number;
}

type Client =
  | { kind: "presenter"; ws: WebSocket; entry: SessionEntry; bucket: Bucket }
  | { kind: "audience"; ws: WebSocket; entry: SessionEntry; id: string; bucket: Bucket };

const HELLO_TIMEOUT_MS = 10_000;
const HEARTBEAT_MS = 30_000;

/** Token bucket: `rate` messages per second, bursts up to `burst`. */
class Bucket {
  private tokens: number;
  private last: number;
  private readonly rate: number;
  private readonly burst: number;
  constructor(rate: number, burst: number, now: number) {
    this.rate = rate;
    this.burst = burst;
    this.tokens = burst;
    this.last = now;
  }
  take(now: number): boolean {
    this.tokens = Math.min(this.burst, this.tokens + ((now - this.last) / 1000) * this.rate);
    this.last = now;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}

function send(ws: WebSocket, msg: ServerMessage) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function parse(data: RawData): unknown {
  try {
    return JSON.parse(data.toString());
  } catch {
    return undefined;
  }
}

/**
 * WebSocket adapter for the session domain. It owns sockets, authentication
 * handshakes and fan-out; all presentation rules live in Session.
 */
export class WsHub {
  private readonly wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
  private readonly clients = new Map<string, Set<Client>>();
  private readonly timers: NodeJS.Timeout[] = [];
  private readonly opts: HubOptions;
  private readonly alive = new WeakSet<WebSocket>();

  constructor(opts: HubOptions) {
    this.opts = opts;
    this.timers.push(setInterval(() => this.tick(), opts.tickMs ?? 5_000));
    this.timers.push(setInterval(() => this.heartbeat(), HEARTBEAT_MS));
  }

  attach(server: Server) {
    server.on("upgrade", (req, socket, head) => this.upgrade(req, socket, head));
  }

  close() {
    for (const t of this.timers) clearInterval(t);
    for (const ws of this.wss.clients) ws.terminate();
    this.wss.close();
  }

  private originAllowed(req: IncomingMessage): boolean {
    const origin = req.headers.origin;
    if (!origin) return false;
    if (this.opts.allowedOrigins.length) return this.opts.allowedOrigins.includes(origin);
    try {
      return new URL(origin).host === req.headers.host;
    } catch {
      return false;
    }
  }

  private upgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
    const path = new URL(req.url ?? "/", "http://x").pathname;
    if (path !== "/ws" || !this.originAllowed(req)) {
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    this.wss.handleUpgrade(req, socket, head, (ws) => this.onConnection(ws, req));
  }

  private onConnection(ws: WebSocket, req: IncomingMessage) {
    this.alive.add(ws);
    ws.on("pong", () => this.alive.add(ws));
    const timeout = setTimeout(() => ws.close(4000, "hello timeout"), HELLO_TIMEOUT_MS);
    ws.once("message", (data) => {
      clearTimeout(timeout);
      const hello = HelloSchema.safeParse(parse(data));
      if (!hello.success) return this.reject(ws, "bad-request", "Invalid hello.");
      if (hello.data.role === "presenter") this.helloPresenter(ws, req, hello.data);
      else this.helloAudience(ws, req, hello.data);
    });
  }

  private reject(ws: WebSocket, code: ErrorCode, message: string) {
    send(ws, { t: "error", code, message });
    ws.close(4001, code);
  }

  private closeWith(ws: WebSocket, reason: CloseReason) {
    send(ws, { t: "closed", reason });
    ws.close(4002, reason);
  }

  private helloPresenter(ws: WebSocket, req: IncomingMessage, hello: PresenterHello) {
    const now = this.opts.now();
    const auth = this.opts.registry.authenticatePresenter(hello.token, hello.pin, now);
    if (!auth.ok) {
      const message = auth.reason === "locked" ? "Too many attempts. Try again in a few minutes." : auth.reason === "not-found" ? "Session not found." : "Wrong PIN.";
      return this.reject(ws, auth.reason, message);
    }
    const { entry } = auth;
    const client: Client = { kind: "presenter", ws, entry, bucket: new Bucket(15, 30, now) };
    this.add(client);
    entry.session.presenterJoined(now);
    send(ws, {
      t: "welcome-presenter",
      deck: entry.session.deck,
      deckId: entry.session.deckId,
      code: entry.session.code,
      joinUrl: `${this.opts.baseUrl(req)}/s/${entry.session.code}`,
      state: entry.session.snapshot(),
    });
    this.broadcast(entry);
    ws.on("message", (data) => this.onPresenterMessage(client, data));
    ws.on("close", () => {
      this.removeClient(client);
      entry.session.presenterLeft(this.opts.now());
      this.broadcast(entry);
    });
  }

  private helloAudience(ws: WebSocket, req: IncomingMessage, hello: AudienceHello) {
    const entry = this.opts.registry.get(hello.code);
    if (!entry) return this.closeWith(ws, "not-found");
    const s = entry.session;
    if (s.isEnded) return this.closeWith(ws, "ended");
    if (s.isRestricted) return this.closeWith(ws, "restricted");

    const you = s.join({ name: hello.name ?? null, ...(hello.resume ? { resume: hello.resume } : {}) });
    const client: Client = { kind: "audience", ws, entry, id: you.id, bucket: new Bucket(5, 15, this.opts.now()) };
    this.add(client);
    s.audienceConnected(you.id);
    send(ws, {
      t: "welcome-audience",
      you,
      deck: publicDeck(s.deck),
      deckId: s.deckId,
      joinUrl: `${this.opts.baseUrl(req)}/s/${s.code}`,
      state: s.snapshot(),
    });
    this.broadcast(entry);
    ws.on("message", (data) => this.onAudienceMessage(client, data));
    ws.on("close", () => {
      this.removeClient(client);
      s.audienceDisconnected(you.id);
      this.broadcast(entry);
    });
  }

  private onPresenterMessage(client: Extract<Client, { kind: "presenter" }>, data: RawData) {
    if (!client.bucket.take(this.opts.now())) return send(client.ws, { t: "error", code: "rate-limited", message: "Slow down." });
    const cmd = PresenterCommandSchema.safeParse(parse(data));
    if (!cmd.success) return send(client.ws, { t: "error", code: "bad-request", message: "Unknown command." });
    const { entry } = client;
    const s = entry.session;
    switch (cmd.data.t) {
      case "start":
        s.start(this.opts.now());
        break;
      case "next":
        s.next();
        break;
      case "prev":
        s.prev();
        break;
      case "goto":
        s.goto(cmd.data.pos);
        break;
      case "restrict":
        s.restrict(cmd.data.restricted);
        if (cmd.data.restricted) this.closeAudience(entry, "restricted");
        break;
      case "effect":
        s.setEffect(cmd.data.effect);
        break;
      case "ripple": {
        const ev = s.ripple(cmd.data.x, cmd.data.y);
        if (ev) this.broadcastMessage(entry, { t: "ripple", ...ev });
        return;
      }
      case "end":
        s.end();
        this.opts.registry.markEnded(entry, this.opts.now());
        this.closeAudience(entry, "ended");
        break;
    }
    this.broadcast(entry);
  }

  private onAudienceMessage(client: Extract<Client, { kind: "audience" }>, data: RawData) {
    if (!client.bucket.take(this.opts.now())) return send(client.ws, { t: "error", code: "rate-limited", message: "Slow down." });
    const cmd = AudienceCommandSchema.safeParse(parse(data));
    if (!cmd.success) return send(client.ws, { t: "error", code: "bad-request", message: "Unknown command." });
    // ping: liveness only; later tasks add votes, reactions and chat here.
  }

  private add(client: Client) {
    const code = client.entry.session.code;
    let set = this.clients.get(code);
    if (!set) this.clients.set(code, (set = new Set()));
    set.add(client);
  }

  private removeClient(client: Client) {
    const set = this.clients.get(client.entry.session.code);
    set?.delete(client);
    if (set?.size === 0) this.clients.delete(client.entry.session.code);
  }

  private closeAudience(entry: SessionEntry, reason: CloseReason) {
    for (const c of this.clients.get(entry.session.code) ?? []) if (c.kind === "audience") this.closeWith(c.ws, reason);
  }

  private broadcast(entry: SessionEntry) {
    this.broadcastMessage(entry, { t: "state", state: entry.session.snapshot() });
  }

  private broadcastMessage(entry: SessionEntry, msg: ServerMessage) {
    const payload = JSON.stringify(msg);
    for (const c of this.clients.get(entry.session.code) ?? []) if (c.ws.readyState === c.ws.OPEN) c.ws.send(payload);
  }

  private tick() {
    const { changed, removed } = this.opts.registry.tick(this.opts.now());
    for (const entry of changed) this.broadcast(entry);
    for (const entry of removed) for (const c of this.clients.get(entry.session.code) ?? []) this.closeWith(c.ws, "not-found");
  }

  private heartbeat() {
    for (const ws of this.wss.clients) {
      if (!this.alive.has(ws)) {
        ws.terminate();
        continue;
      }
      this.alive.delete(ws);
      ws.ping();
    }
  }
}
