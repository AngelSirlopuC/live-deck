import { networkInterfaces } from "node:os";

type Interfaces = ReturnType<typeof networkInterfaces>;
type Headers = Record<string, string | string[] | undefined>;

const LOOPBACK = /^(localhost|127(?:\.\d{1,3}){3}|\[::1\]|::1)$/i;

function privateRank(ip: string): number {
  if (ip.startsWith("192.168.")) return 0;
  if (ip.startsWith("10.")) return 1;
  const m = /^172\.(\d+)\./.exec(ip);
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return 2;
  return -1; // public, CGNAT/VPN (100.64/10) and link-local are not LAN addresses
}

/** Best private LAN IPv4 address of this machine, or null. */
export function lanAddress(list: () => Interfaces = networkInterfaces): string | null {
  const candidates: Array<{ ip: string; rank: number }> = [];
  for (const addrs of Object.values(list())) {
    for (const a of addrs ?? []) {
      if (a.internal || a.family !== "IPv4") continue;
      const rank = privateRank(a.address);
      if (rank >= 0) candidates.push({ ip: a.address, rank });
    }
  }
  candidates.sort((x, y) => x.rank - y.rank);
  return candidates[0]?.ip ?? null;
}

export interface OriginOptions {
  publicBaseUrl?: string | null;
  trustProxy?: boolean;
  /** LAN address lookup; injectable for tests. */
  lan?: () => string | null;
}

const first = (v: string | string[] | undefined) => String(Array.isArray(v) ? v[0] : (v ?? "")).split(",")[0]!.trim();

/**
 * Origin used in join links, QR codes and the phone remote link. When the
 * browser reached us through localhost, phones could never open that, so the
 * host is swapped for this machine's LAN address (same port).
 */
export function publicOrigin(headers: Headers, opts: OriginOptions = {}): string {
  if (opts.publicBaseUrl) return opts.publicBaseUrl.replace(/\/+$/, "");
  const proto = (opts.trustProxy && first(headers["x-forwarded-proto"])) || "http";
  const host = (opts.trustProxy && first(headers["x-forwarded-host"])) || first(headers.host) || "localhost";
  const m = /^(\[[^\]]+\]|[^:]+)(?::(\d+))?$/.exec(host);
  if (m && LOOPBACK.test(m[1]!)) {
    const lan = (opts.lan ?? lanAddress)();
    if (lan) return `${proto}://${lan}${m[2] ? `:${m[2]}` : ""}`;
  }
  return `${proto}://${host}`;
}
