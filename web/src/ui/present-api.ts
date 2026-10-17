// Presentation API (Chrome desktop): renders a page fullscreen on an attached
// display or a Cast device chosen in Chrome's own picker. No browser window is
// opened; the console keeps running in its tab.

interface PresentationConnectionLike extends EventTarget {
  state: string;
  send(data: string): void;
  terminate(): void;
}

interface PresentationRequestLike {
  getAvailability(): Promise<{ value: boolean; onchange: (() => void) | null }>;
  start(): Promise<PresentationConnectionLike>;
}

type PresentationRequestCtor = new (urls: string[]) => PresentationRequestLike;

const Ctor = (globalThis as { PresentationRequest?: PresentationRequestCtor }).PresentationRequest;

export function presentationApiSupported(): boolean {
  return typeof Ctor === "function";
}

/** Whether Chrome currently sees a display it can present to (null when unknown). */
export async function displaysAvailable(url: string, onChange?: (v: boolean) => void): Promise<boolean | null> {
  if (!Ctor) return null;
  try {
    const availability = await new Ctor([url]).getAvailability();
    if (onChange) availability.onchange = () => onChange(availability.value);
    return availability.value;
  } catch {
    return null;
  }
}

export interface Projection {
  /** Ends the presentation on the display. */
  stop(): void;
}

/**
 * Opens Chrome's display picker (needs the click that triggered it) and
 * presents `url` there. `onOpen` receives a sender for the first message (the
 * PIN); `onEnd` fires when the display closes or the user stops it in Chrome.
 */
export async function startProjection(url: string, onOpen: (send: (msg: unknown) => void) => void, onEnd: () => void): Promise<Projection | null> {
  if (!Ctor) return null;
  let connection: PresentationConnectionLike;
  try {
    connection = await new Ctor([url]).start();
  } catch {
    return null; // picker dismissed or no display
  }
  const send = (msg: unknown) => connection.send(JSON.stringify(msg));
  if (connection.state === "connected") onOpen(send);
  else connection.addEventListener("connect", () => onOpen(send), { once: true });
  // The presented page may start listening after our first message: when it
  // says "ready", send the first message again.
  connection.addEventListener("message", (e) => {
    try {
      if (JSON.parse(String((e as MessageEvent).data))?.t === "ready") onOpen(send);
    } catch {
      /* ignore */
    }
  });
  connection.addEventListener("terminate", onEnd);
  connection.addEventListener("close", onEnd);
  return { stop: () => connection.terminate() };
}

interface ReceiverLike {
  connectionList: Promise<{ connections: Array<EventTarget & { send(d: string): void }>; addEventListener(t: "connectionavailable", cb: (e: Event & { connection: EventTarget }) => void): void }>;
}

/** On the presented page: resolves with the first message the console sends (null when not presented). */
export function receiverMessage(): Promise<unknown> | null {
  const receiver = (navigator as Navigator & { presentation?: { receiver?: ReceiverLike } }).presentation?.receiver;
  if (!receiver) return null;
  return new Promise((resolve) => {
    void receiver.connectionList.then((list) => {
      const listen = (c: EventTarget) =>
        c.addEventListener("message", (e) => {
          try {
            resolve(JSON.parse(String((e as MessageEvent).data)));
          } catch {
            /* ignore malformed */
          }
        });
      const ready = (c: EventTarget & { send?: (d: string) => void }) => {
        listen(c);
        c.send?.(JSON.stringify({ t: "ready" }));
      };
      list.connections.forEach(ready);
      list.addEventListener("connectionavailable", (e) => ready(e.connection as EventTarget & { send?: (d: string) => void }));
    });
  });
}
