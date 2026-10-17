// Reads pixel dimensions from PNG, JPEG and WebP file headers without any
// dependency. Returns null when the header is unknown, truncated or corrupt.

export interface ImageSize {
  width: number;
  height: number;
}

const ascii = (b: Uint8Array, at: number, s: string) => s.split("").every((c, i) => b[at + i] === c.charCodeAt(0));

function valid(width: number, height: number): ImageSize | null {
  return width > 0 && height > 0 ? { width, height } : null;
}

function png(b: Uint8Array, v: DataView): ImageSize | null {
  if (b.length < 24 || !ascii(b, 12, "IHDR")) return null;
  return valid(v.getUint32(16), v.getUint32(20));
}

// Walks the marker segments until a baseline, extended or progressive SOF.
function jpeg(b: Uint8Array, v: DataView): ImageSize | null {
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) return null;
    while (b[i] === 0xff) i++; // fill bytes
    const marker = b[i];
    i++;
    if (marker === undefined) return null;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue; // no length
    if (marker === 0xd9 || marker === 0xda) return null; // end or scan data before any SOF
    if (i + 2 > b.length) return null;
    const len = v.getUint16(i);
    if (len < 2) return null;
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      if (i + 7 > b.length) return null;
      return valid(v.getUint16(i + 5), v.getUint16(i + 3));
    }
    i += len;
  }
  return null;
}

function webp(b: Uint8Array, v: DataView): ImageSize | null {
  if (ascii(b, 12, "VP8 ")) {
    if (b.length < 30 || b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return valid(v.getUint16(26, true) & 0x3fff, v.getUint16(28, true) & 0x3fff);
  }
  if (ascii(b, 12, "VP8L")) {
    if (b.length < 25 || b[20] !== 0x2f) return null;
    const bits = v.getUint32(21, true);
    return valid((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
  }
  if (ascii(b, 12, "VP8X")) {
    if (b.length < 30) return null;
    const u24 = (at: number) => (b[at] ?? 0) | ((b[at + 1] ?? 0) << 8) | ((b[at + 2] ?? 0) << 16);
    return valid(u24(24) + 1, u24(27) + 1);
  }
  return null;
}

/** Detects the format from the file signature, not the extension. */
export function imageSize(b: Uint8Array): ImageSize | null {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (b.length >= 8 && b[0] === 0x89 && ascii(b, 1, "PNG\r\n\x1a\n")) return png(b, v);
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return jpeg(b, v);
  if (b.length >= 16 && ascii(b, 0, "RIFF") && ascii(b, 8, "WEBP")) return webp(b, v);
  return null;
}

/** True when width/height is within ±2% of 16:9. */
export function isSixteenByNine(width: number, height: number): boolean {
  return Math.abs(width / height / (16 / 9) - 1) <= 0.02;
}
