type Attrs = Record<string, string | number | boolean | undefined | null>;
type Child = Node | string | null | undefined | false;

/** Tiny element builder: attributes are set as attributes, strings become text nodes. */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") el.className = String(v);
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of children) if (c) el.append(c);
  return el;
}

/** Element with trusted inner markup (our own icons/QR only). */
export function trusted<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs, markup: string): HTMLElementTagNameMap[K] {
  const el = h(tag, attrs);
  el.innerHTML = markup;
  return el;
}

export function storage(kind: "local" | "session") {
  const get = (): Storage | null => {
    try {
      return kind === "local" ? window.localStorage : window.sessionStorage;
    } catch {
      return null;
    }
  };
  return {
    read<T>(key: string): T | null {
      try {
        const raw = get()?.getItem(key);
        return raw ? (JSON.parse(raw) as T) : null;
      } catch {
        return null;
      }
    },
    write(key: string, value: unknown) {
      try {
        get()?.setItem(key, JSON.stringify(value));
      } catch {
        /* storage unavailable: the app still works without persistence */
      }
    },
    remove(key: string) {
      try {
        get()?.removeItem(key);
      } catch {
        /* ignore */
      }
    },
  };
}
