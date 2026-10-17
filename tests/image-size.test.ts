import { describe, expect, it } from "vitest";
import { imageSize, isSixteenByNine } from "../bin/image-size.ts";

const u32be = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const u16be = (n: number) => [(n >>> 8) & 255, n & 255];
const u16le = (n: number) => [n & 255, (n >>> 8) & 255];
const u24le = (n: number) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255];
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

function png(w: number, h: number): Uint8Array {
  return Uint8Array.from([0x89, ...ascii("PNG"), 0x0d, 0x0a, 0x1a, 0x0a, ...u32be(13), ...ascii("IHDR"), ...u32be(w), ...u32be(h), 8, 6, 0, 0, 0]);
}

function jpeg(w: number, h: number, sof = 0xc0): Uint8Array {
  const app0 = [0xff, 0xe0, ...u16be(16), ...ascii("JFIF"), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0];
  const sofSeg = [0xff, sof, ...u16be(17), 8, ...u16be(h), ...u16be(w), 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1];
  return Uint8Array.from([0xff, 0xd8, ...app0, 0xff, ...sofSeg, 0xff, 0xd9]);
}

function riff(chunk: string, data: number[]): Uint8Array {
  return Uint8Array.from([...ascii("RIFF"), ...u32be(0).reverse(), ...ascii("WEBP"), ...ascii(chunk), ...u24le(data.length), 0, ...data]);
}

const webpLossy = (w: number, h: number) => riff("VP8 ", [0, 0, 0, 0x9d, 0x01, 0x2a, ...u16le(w), ...u16le(h)]);
function webpLossless(w: number, h: number) {
  const bits = (w - 1) | ((h - 1) << 14);
  return riff("VP8L", [0x2f, bits & 255, (bits >>> 8) & 255, (bits >>> 16) & 255, (bits >>> 24) & 255]);
}
const webpExtended = (w: number, h: number) => riff("VP8X", [0, 0, 0, 0, ...u24le(w - 1), ...u24le(h - 1)]);

describe("imageSize", () => {
  it("reads PNG dimensions from IHDR", () => {
    expect(imageSize(png(1920, 1080))).toEqual({ width: 1920, height: 1080 });
  });

  it("reads JPEG dimensions from SOF0, SOF1 and SOF2 after other segments", () => {
    expect(imageSize(jpeg(1280, 720))).toEqual({ width: 1280, height: 720 });
    expect(imageSize(jpeg(800, 600, 0xc1))).toEqual({ width: 800, height: 600 });
    expect(imageSize(jpeg(3840, 2160, 0xc2))).toEqual({ width: 3840, height: 2160 });
  });

  it("reads WebP dimensions from VP8, VP8L and VP8X", () => {
    expect(imageSize(webpLossy(1600, 900))).toEqual({ width: 1600, height: 900 });
    expect(imageSize(webpLossless(1024, 768))).toEqual({ width: 1024, height: 768 });
    expect(imageSize(webpExtended(2560, 1440))).toEqual({ width: 2560, height: 1440 });
  });

  it("returns null for unknown or truncated headers", () => {
    expect(imageSize(Uint8Array.from(ascii("not an image at all, sorry")))).toBeNull();
    expect(imageSize(png(10, 10).subarray(0, 20))).toBeNull();
    expect(imageSize(jpeg(10, 10).subarray(0, 12))).toBeNull();
    expect(imageSize(webpLossy(10, 10).subarray(0, 24))).toBeNull();
    expect(imageSize(new Uint8Array())).toBeNull();
  });
});

describe("isSixteenByNine", () => {
  it("accepts 16:9 within 2% and rejects other ratios", () => {
    expect(isSixteenByNine(1920, 1080)).toBe(true);
    expect(isSixteenByNine(1366, 768)).toBe(true);
    expect(isSixteenByNine(1024, 768)).toBe(false);
    expect(isSixteenByNine(1920, 1200)).toBe(false);
  });
});
