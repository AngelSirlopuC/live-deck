import { describe, expect, it } from "vitest";
import { lanAddress, publicOrigin } from "../server/base-url.ts";

const nets = {
  lo0: [{ address: "127.0.0.1", family: "IPv4", internal: true }],
  utun3: [{ address: "100.64.0.7", family: "IPv4", internal: false }],
  en0: [
    { address: "fe80::1", family: "IPv6", internal: false },
    { address: "192.168.1.34", family: "IPv4", internal: false },
  ],
} as any;

describe("public origin for links and QR codes", () => {
  it("prefers a private LAN IPv4 address over loopback and VPN ranges", () => {
    expect(lanAddress(() => nets)).toBe("192.168.1.34");
    expect(lanAddress(() => ({ lo0: nets.lo0 }))).toBeNull();
  });

  it("replaces localhost with the LAN address so phones can open the links", () => {
    const lan = () => "192.168.1.34";
    expect(publicOrigin({ host: "localhost:5180" }, { lan })).toBe("http://192.168.1.34:5180");
    expect(publicOrigin({ host: "127.0.0.1:8787" }, { lan })).toBe("http://192.168.1.34:8787");
    expect(publicOrigin({ host: "[::1]:5180" }, { lan })).toBe("http://192.168.1.34:5180");
  });

  it("keeps a host the browser already reached, and the configured public URL", () => {
    const lan = () => "192.168.1.34";
    expect(publicOrigin({ host: "10.0.0.5:5180" }, { lan })).toBe("http://10.0.0.5:5180");
    expect(publicOrigin({ host: "localhost:5180" }, { lan, publicBaseUrl: "https://deck.example.com/" })).toBe("https://deck.example.com");
  });

  it("uses forwarded headers only behind a trusted proxy", () => {
    const lan = () => null;
    const headers = { host: "127.0.0.1:8787", "x-forwarded-proto": "https", "x-forwarded-host": "deck.example.com" };
    expect(publicOrigin(headers, { lan, trustProxy: true })).toBe("https://deck.example.com");
    expect(publicOrigin(headers, { lan, trustProxy: false })).toBe("http://127.0.0.1:8787");
  });
});
