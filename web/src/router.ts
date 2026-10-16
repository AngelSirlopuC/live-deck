export type Route =
  | { page: "home" }
  | { page: "preview"; deckId: string }
  | { page: "not-found" };

const PATTERNS: Array<[RegExp, (m: RegExpExecArray) => Route]> = [
  [/^\/$/, () => ({ page: "home" })],
  [/^\/preview\/([a-z0-9-]+)\/?$/, (m) => ({ page: "preview", deckId: m[1]! })],
];

export function matchRoute(pathname: string): Route {
  for (const [re, build] of PATTERNS) {
    const m = re.exec(pathname);
    if (m) return build(m);
  }
  return { page: "not-found" };
}
