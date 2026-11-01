import { EditorApi } from "../editor/ui/api.ts";
import { EditorController, memoryClipboard, type ClipboardPort } from "../editor/ui/controller.ts";
import { createShell } from "../editor/ui/shell.ts";

/** System clipboard when available (secure context, permission granted), in-memory otherwise. */
function systemClipboard(): ClipboardPort {
  const memory = memoryClipboard();
  const sys = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
  return {
    async write(text) {
      await memory.write(text);
      try {
        await sys?.writeText(text);
      } catch {
        /* denied: the in-memory copy still works inside this tab */
      }
    },
    async read() {
      try {
        const text = await sys?.readText();
        if (text) return text;
      } catch {
        /* denied or unsupported */
      }
      return memory.read();
    },
  };
}

export async function mountEditor(root: HTMLElement, deckId: string) {
  const api = new EditorApi();
  const ctrl = new EditorController(api, deckId, { clipboard: systemClipboard() });
  const shell = createShell(ctrl, { assetBase: `/decks/${deckId}/`, previewUrl: `/preview/${deckId}`, homeUrl: "/" });
  shell.mount(root);
  await ctrl.load();
}
