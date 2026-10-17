// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import type { Sticker } from "../shared/protocol.ts";
import { createChatPanel } from "../web/src/ui/chat.ts";

const sticker = (id: string): Sticker => ({ id, url: `https://media1.giphy.com/media/${id}/200w.webp`, width: 200, height: 150, title: `t-${id}` });
const flush = () => new Promise((r) => setTimeout(r, 0));

function setup() {
  const onSend = vi.fn();
  const searchStickers = vi.fn(async () => [sticker("a"), sticker("b")]);
  const chat = createChatPanel({ onSend, searchStickers, stickersEnabled: true, myId: "me" });
  document.body.replaceChildren(chat.el);
  chat.setState({ mode: "mixed", paused: false });
  const gif = chat.el.querySelector<HTMLButtonElement>(".chat-sticker-btn")!;
  return { chat, onSend, searchStickers, gif };
}

describe("chat sticker tray", () => {
  it("opens inside the chat, not as a separate dialog", async () => {
    const { chat, gif } = setup();
    const tray = chat.el.querySelector<HTMLElement>(".sticker-tray")!;
    expect(tray.hidden).toBe(true);
    gif.click();
    await flush();
    expect(tray.hidden).toBe(false);
    expect(gif.getAttribute("aria-expanded")).toBe("true");
    expect(document.querySelector("dialog")).toBeNull();
    expect(tray.querySelectorAll(".sticker-pick")).toHaveLength(2);
  });

  it("sends the picked sticker and closes the tray", async () => {
    const { chat, gif, onSend } = setup();
    gif.click();
    await flush();
    chat.el.querySelector<HTMLButtonElement>(".sticker-pick")!.click();
    expect(onSend).toHaveBeenCalledWith({ stickerId: "a" });
    expect(chat.el.querySelector<HTMLElement>(".sticker-tray")!.hidden).toBe(true);
    expect(gif.getAttribute("aria-expanded")).toBe("false");
  });

  it("toggles closed on a second press and with Escape", async () => {
    const { chat, gif } = setup();
    const tray = chat.el.querySelector<HTMLElement>(".sticker-tray")!;
    gif.click();
    gif.click();
    expect(tray.hidden).toBe(true);
    gif.click();
    await flush();
    tray.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(tray.hidden).toBe(true);
  });

  it("closes when the chat stops accepting stickers", async () => {
    const { chat, gif } = setup();
    gif.click();
    await flush();
    chat.setState({ mode: "text", paused: false });
    expect(chat.el.querySelector<HTMLElement>(".sticker-tray")!.hidden).toBe(true);
  });

  it("gives every result a square tile that keeps the GIF's proportions", async () => {
    const { chat, gif } = setup();
    gif.click();
    await flush();
    const img = chat.el.querySelector<HTMLImageElement>(".sticker-pick img")!;
    expect(img.getAttribute("src")).toContain("giphy.com");
    expect(img.getAttribute("alt")).toBe("");
    expect(chat.el.querySelector(".sticker-pick")!.getAttribute("aria-label")).toBe("t-a");
  });
});
