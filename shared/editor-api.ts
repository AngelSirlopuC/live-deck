import type { Deck } from "./deck.ts";
import type { PresetName } from "./themes.ts";

// Editor HTTP API (authenticated with x-admin-key like the admin routes).
// Plain types only: the browser client imports this file, zod stays server-side.

export interface ErrorResponse {
  error: string;
}

/** GET /api/editor/decks/:id → 200 */
export interface EditorDeckResponse {
  deck: Deck;
  /** sha256 hex of the deck.json bytes on disk. */
  revision: string;
}

/** GET /api/editor/decks/:id → 422 when the file exists but does not parse. */
export interface InvalidDeckFileResponse extends ErrorResponse {
  raw: string;
}

/** PUT /api/editor/decks/:id body (≤ 2 MB) */
export interface SaveDeckRequest {
  deck: Deck;
  /** Revision the editor loaded; the save is refused with 409 when the file moved on. */
  revision: string;
}

/** PUT /api/editor/decks/:id → 200 */
export interface SaveDeckResponse {
  revision: string;
}

/** PUT /api/editor/decks/:id → 409 */
export interface ConflictResponse {
  error: "conflict";
  /** Current revision on disk. */
  revision: string;
}

/** POST /api/editor/decks body */
export interface CreateDeckRequest {
  id: string;
  title: string;
  /** Theme preset; defaults to "estudio". */
  preset?: PresetName;
}

/** POST /api/editor/decks → 201 */
export interface CreateDeckResponse {
  id: string;
  revision: string;
}

export interface AssetInfo {
  name: string;
  size: number;
}

/** GET /api/editor/decks/:id/assets → 200 */
export interface AssetListResponse {
  assets: AssetInfo[];
}

/** POST /api/editor/decks/:id/assets?name=<file> (raw image bytes, ≤ 8 MB) → 201 */
export interface UploadAssetResponse {
  /** Ready to use as an image element `src`: "assets/<name>". */
  src: string;
  name: string;
  size: number;
}

export const EDITOR_DECK_BODY_LIMIT = 2 * 1024 * 1024;
export const EDITOR_ASSET_BODY_LIMIT = 8 * 1024 * 1024;

export const editorDecksPath = () => "/api/editor/decks";
export const editorDeckPath = (id: string) => `/api/editor/decks/${encodeURIComponent(id)}`;
export const editorAssetsPath = (id: string) => `${editorDeckPath(id)}/assets`;
export const editorUploadPath = (id: string, name: string) => `${editorAssetsPath(id)}?name=${encodeURIComponent(name)}`;
