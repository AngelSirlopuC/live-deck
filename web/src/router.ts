import type { PresenterSurface } from "../../shared/protocol.ts";

export type Route =
  | { page: "home" }
  | { page: "preview"; deckId: string }
  | { page: "presenter"; token: string; surface: PresenterSurface }
  | { page: "audience"; code: string }
  | { page: "not-found" };

const PATTERNS: Array<[RegExp, (m: RegExpExecArray) => Route]> = [
  [/^\/$/, () => ({ page: "home" })],
  [/^\/preview\/([a-z0-9-]+)\/?$/, (m) => ({ page: "preview", deckId: m[1]! })],
  [/^\/p\/([A-Za-z0-9_-]{22,64})\/?$/, (m) => ({ page: "presenter", token: m[1]!, surface: "console" })],
  [/^\/p\/([A-Za-z0-9_-]{22,64})\/(screen|remote)\/?$/, (m) => ({ page: "presenter", token: m[1]!, surface: m[2] as PresenterSurface })],
  [/^\/s\/([A-Za-z0-9]{6})\/?$/, (m) => ({ page: "audience", code: m[1]!.toUpperCase() })],
];

export function matchRoute(pathname: string): Route {
  for (const [re, build] of PATTERNS) {
    const m = re.exec(pathname);
    if (m) return build(m);
  }
  return { page: "not-found" };
}
