import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  delete (globalThis as any).PresentationRequest;
});

describe("presentation api wrapper", () => {
  it("reports no support without PresentationRequest", async () => {
    const api = await import("../web/src/ui/present-api.ts");
    expect(api.presentationApiSupported()).toBe(false);
    expect(await api.displaysAvailable("/x")).toBeNull();
    expect(await api.startProjection("/x", () => {}, () => {})).toBeNull();
  });

  it("starts a projection, sends the first message once connected and stops it", async () => {
    const conn = Object.assign(new EventTarget(), { state: "connecting", send: vi.fn(), terminate: vi.fn() });
    (globalThis as any).PresentationRequest = class {
      urls: string[];
      constructor(urls: string[]) {
        this.urls = urls;
      }
      getAvailability() {
        return Promise.resolve({ value: true, onchange: null });
      }
      start() {
        return Promise.resolve(conn);
      }
    };
    const api = await import("../web/src/ui/present-api.ts");
    expect(await api.displaysAvailable("/x")).toBe(true);
    const onEnd = vi.fn();
    const projection = await api.startProjection("/x", (send) => send({ t: "auth", pin: "1234" }), onEnd);
    conn.dispatchEvent(new Event("connect"));
    expect(conn.send).toHaveBeenCalledWith(JSON.stringify({ t: "auth", pin: "1234" }));
    projection!.stop();
    expect(conn.terminate).toHaveBeenCalled();
    conn.dispatchEvent(new Event("terminate"));
    expect(onEnd).toHaveBeenCalled();
  });

  it("returns null when the picker is dismissed", async () => {
    (globalThis as any).PresentationRequest = class {
      getAvailability() {
        return Promise.resolve({ value: false, onchange: null });
      }
      start() {
        return Promise.reject(new DOMException("dismissed", "NotAllowedError"));
      }
    };
    const api = await import("../web/src/ui/present-api.ts");
    expect(await api.startProjection("/x", () => {}, () => {})).toBeNull();
  });
});

describe("pin handshake", () => {
  it("re-sends the first message when the presented page says it is ready", async () => {
    const conn = Object.assign(new EventTarget(), { state: "connected", send: vi.fn(), terminate: vi.fn() });
    (globalThis as any).PresentationRequest = class {
      getAvailability() {
        return Promise.resolve({ value: true, onchange: null });
      }
      start() {
        return Promise.resolve(conn);
      }
    };
    const api = await import("../web/src/ui/present-api.ts");
    await api.startProjection("/x", (send) => send({ t: "auth", pin: "9" }), () => {});
    conn.dispatchEvent(new MessageEvent("message", { data: JSON.stringify({ t: "ready" }) }));
    expect(conn.send).toHaveBeenCalledTimes(2);
  });

  it("the presented page announces it is ready once it listens", async () => {
    const conn = Object.assign(new EventTarget(), { send: vi.fn() });
    const list = Object.assign(new EventTarget(), { connections: [conn] });
    Object.defineProperty(globalThis, "navigator", { value: { presentation: { receiver: { connectionList: Promise.resolve(list) } } }, configurable: true });
    const api = await import("../web/src/ui/present-api.ts");
    const msg = api.receiverMessage()!;
    await Promise.resolve();
    await Promise.resolve();
    expect(conn.send).toHaveBeenCalledWith(JSON.stringify({ t: "ready" }));
    conn.dispatchEvent(new MessageEvent("message", { data: JSON.stringify({ t: "auth", pin: "9" }) }));
    expect(await msg).toEqual({ t: "auth", pin: "9" });
  });
});
