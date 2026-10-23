// Editor HTTP client: typed outcomes instead of thrown errors so the UI can
// show the right Spanish state for each one. The admin key travels in the
// same header and localStorage slot the home page uses.
import type { Deck } from "../../../../shared/deck.ts";
import {
  editorAssetsPath,
  editorDeckPath,
  editorUploadPath,
  type AssetInfo,
  type AssetListResponse,
  type ConflictResponse,
  type EditorDeckResponse,
  type ErrorResponse,
  type InvalidDeckFileResponse,
  type SaveDeckResponse,
  type UploadAssetResponse,
} from "../../../../shared/editor-api.ts";
import { storage } from "../../ui/dom.ts";

export const ADMIN_KEY_SLOT = "ld:admin-key";

export type LoadResult =
  | { kind: "ok"; deck: Deck; revision: string }
  | { kind: "unauthorized" }
  | { kind: "not-found" }
  | { kind: "invalid"; error: string; raw: string }
  | { kind: "error"; message: string };

export type SaveResult =
  | { kind: "ok"; revision: string }
  | { kind: "conflict"; revision: string }
  | { kind: "invalid"; error: string }
  | { kind: "unauthorized" }
  | { kind: "error"; message: string };

export type UploadResult = { kind: "ok"; src: string; name: string } | { kind: "unauthorized" } | { kind: "error"; message: string };

export type AssetsResult = { kind: "ok"; assets: AssetInfo[] } | { kind: "unauthorized" } | { kind: "error"; message: string };

export interface KeyStore {
  get(): string | null;
  set(key: string | null): void;
}

export function localKeyStore(): KeyStore {
  const local = storage("local");
  return {
    get: () => local.read<string>(ADMIN_KEY_SLOT),
    set: (key) => (key ? local.write(ADMIN_KEY_SLOT, key) : local.remove(ADMIN_KEY_SLOT)),
  };
}

const NETWORK_ERROR = "No se pudo conectar con el servidor.";

/** Spanish message for an upload failure status. */
export function uploadErrorMessage(status: number, serverError?: string): string {
  switch (status) {
    case 413: return "La imagen pesa más de 8 MB.";
    case 415: return "Solo se aceptan imágenes PNG, JPEG, WebP o GIF.";
    case 409: return "Ya hay demasiados archivos con ese nombre.";
    case 400: return "El archivo no es válido.";
    default: return serverError ? `No se pudo subir la imagen: ${serverError}` : "No se pudo subir la imagen.";
  }
}

export class EditorApi {
  readonly keys: KeyStore;
  readonly fetcher: typeof fetch;

  constructor(keys: KeyStore = localKeyStore(), fetcher: typeof fetch = (...args) => fetch(...args)) {
    this.keys = keys;
    this.fetcher = fetcher;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    const key = this.keys.get();
    return { ...extra, ...(key ? { "x-admin-key": key } : {}) };
  }

  private async json<T>(res: Response): Promise<T | undefined> {
    try {
      return (await res.json()) as T;
    } catch {
      return undefined;
    }
  }

  async load(id: string): Promise<LoadResult> {
    let res: Response;
    try {
      res = await this.fetcher(editorDeckPath(id), { headers: this.headers() });
    } catch {
      return { kind: "error", message: NETWORK_ERROR };
    }
    if (res.status === 401) return { kind: "unauthorized" };
    if (res.status === 404) return { kind: "not-found" };
    if (res.status === 422) {
      const body = await this.json<InvalidDeckFileResponse>(res);
      return { kind: "invalid", error: body?.error ?? "deck.json no es válido", raw: body?.raw ?? "" };
    }
    if (!res.ok) {
      const body = await this.json<ErrorResponse>(res);
      return { kind: "error", message: body?.error ?? `Error ${res.status}` };
    }
    const body = await this.json<EditorDeckResponse>(res);
    if (!body?.deck || typeof body.revision !== "string") return { kind: "error", message: "Respuesta inesperada del servidor." };
    return { kind: "ok", deck: body.deck, revision: body.revision };
  }

  async save(id: string, deck: Deck, revision: string): Promise<SaveResult> {
    let res: Response;
    try {
      res = await this.fetcher(editorDeckPath(id), {
        method: "PUT",
        headers: this.headers({ "content-type": "application/json" }),
        body: JSON.stringify({ deck, revision }),
      });
    } catch {
      return { kind: "error", message: NETWORK_ERROR };
    }
    if (res.status === 401) return { kind: "unauthorized" };
    if (res.status === 409) {
      const body = await this.json<ConflictResponse>(res);
      return { kind: "conflict", revision: body?.revision ?? "" };
    }
    if (res.status === 400) {
      const body = await this.json<ErrorResponse>(res);
      return { kind: "invalid", error: body?.error ?? "El deck no es válido." };
    }
    if (!res.ok) {
      const body = await this.json<ErrorResponse>(res);
      return { kind: "error", message: body?.error ?? `Error ${res.status}` };
    }
    const body = await this.json<SaveDeckResponse>(res);
    return { kind: "ok", revision: body?.revision ?? "" };
  }

  async listAssets(id: string): Promise<AssetsResult> {
    let res: Response;
    try {
      res = await this.fetcher(editorAssetsPath(id), { headers: this.headers() });
    } catch {
      return { kind: "error", message: NETWORK_ERROR };
    }
    if (res.status === 401) return { kind: "unauthorized" };
    if (!res.ok) return { kind: "error", message: `Error ${res.status}` };
    const body = await this.json<AssetListResponse>(res);
    return { kind: "ok", assets: body?.assets ?? [] };
  }

  async upload(id: string, file: Blob, name: string): Promise<UploadResult> {
    let res: Response;
    try {
      res = await this.fetcher(editorUploadPath(id, name), {
        method: "POST",
        headers: this.headers(file.type ? { "content-type": file.type } : {}),
        body: file,
      });
    } catch {
      return { kind: "error", message: NETWORK_ERROR };
    }
    if (res.status === 401) return { kind: "unauthorized" };
    if (!res.ok) {
      const body = await this.json<ErrorResponse>(res);
      return { kind: "error", message: uploadErrorMessage(res.status, body?.error) };
    }
    const body = await this.json<UploadAssetResponse>(res);
    if (!body?.src) return { kind: "error", message: "Respuesta inesperada del servidor." };
    return { kind: "ok", src: body.src, name: body.name };
  }
}
