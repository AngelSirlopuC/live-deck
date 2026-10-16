import type { CloseReason, Hello, ServerMessage } from "../../../shared/protocol.ts";

export type ConnectionStatus = "connecting" | "open" | "reconnecting" | "closed";

export interface ConnectionHandlers {
  /** Builds the hello for each (re)connect, so resume data stays current. */
  hello: () => Hello;
  onMessage: (msg: ServerMessage) => void;
  onStatus?: (status: ConnectionStatus) => void;
  /** Terminal close: the server ended, restricted or rejected the session. No retry follows. */
  onClosed?: (reason: CloseReason | "rejected") => void;
}

const TERMINAL_ERRORS = new Set(["unauthorized", "locked", "not-found", "bad-request"]);

/** WebSocket with automatic reconnect (exponential backoff with jitter, capped at 10 s). */
export class Connection {
  private ws: WebSocket | null = null;
  private attempt = 0;
  private stopped = false;
  private retryTimer: number | undefined;
  private readonly h: ConnectionHandlers;

  constructor(handlers: ConnectionHandlers) {
    this.h = handlers;
    window.addEventListener("online", () => this.retryNow());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") this.retryNow();
    });
    this.open();
  }

  send(msg: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.retryTimer);
    this.ws?.close();
  }

  private retryNow() {
    if (this.stopped || (this.ws && this.ws.readyState <= WebSocket.OPEN)) return;
    clearTimeout(this.retryTimer);
    this.open();
  }

  private open() {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    this.ws = ws;
    this.h.onStatus?.(this.attempt === 0 ? "connecting" : "reconnecting");

    ws.addEventListener("open", () => ws.send(JSON.stringify(this.h.hello())));
    ws.addEventListener("message", (ev) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      if (msg.t === "welcome-audience" || msg.t === "welcome-presenter") {
        this.attempt = 0;
        this.h.onStatus?.("open");
      }
      if (msg.t === "closed") {
        this.stopped = true;
        this.h.onStatus?.("closed");
        this.h.onClosed?.(msg.reason);
      }
      if (msg.t === "error" && TERMINAL_ERRORS.has(msg.code)) this.stopped = true;
      this.h.onMessage(msg);
      if (msg.t === "error" && this.stopped) this.h.onClosed?.("rejected");
    });
    ws.addEventListener("close", () => {
      if (this.ws !== ws) return;
      if (this.stopped) return;
      this.attempt++;
      this.h.onStatus?.("reconnecting");
      const delay = Math.min(10_000, 500 * 2 ** Math.min(this.attempt, 5)) * (0.7 + Math.random() * 0.6);
      this.retryTimer = window.setTimeout(() => this.open(), delay);
    });
  }
}
