import QRCode from "qrcode";

const cache = new Map<string, string>();

/** QR code for a URL as SVG markup (generated locally from our own URL). */
export async function qrSvg(url: string, dark = "#14110d", light = "#00000000"): Promise<string> {
  const key = `${url}|${dark}|${light}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const svg = await QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark, light } });
  cache.set(key, svg);
  return svg;
}
