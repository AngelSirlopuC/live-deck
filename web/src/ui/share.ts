import { h, trusted } from "./dom.ts";
import { icon } from "./icons.ts";
import { qrSvg } from "./qr.ts";

/** Bottom sheet with the session QR, the link, copy and the native share action. */
export function openShareSheet(url: string, title: string) {
  if (!url) return;
  const qr = h("div", { class: "share-qr", role: "img", "aria-label": `Código QR de ${url}` });
  void qrSvg(url).then((svg) => (qr.innerHTML = svg));

  const copy = trusted("button", { type: "button", class: "key" }, `${icon("copy")}<span>Copiar enlace</span>`);
  const native = trusted("button", { type: "button", class: "key key-primary" }, `${icon("share")}<span>Compartir</span>`);
  const close = trusted("button", { type: "button", class: "key key-icon sheet-close", "aria-label": "Cerrar" }, icon("close"));
  const status = h("p", { class: "share-status", role: "status", "aria-live": "polite" });

  const sheet = h(
    "dialog",
    { class: "sheet share-sheet", "aria-labelledby": "share-title" },
    close,
    h("h2", { id: "share-title" }, "Invita a alguien más"),
    qr,
    h("p", { class: "share-url" }, url.replace(/^https?:\/\//, "")),
    h("div", { class: "sheet-actions" }, copy, typeof navigator.share === "function" ? native : null),
    status,
  );

  const dismiss = () => {
    sheet.close();
    sheet.remove();
  };
  close.addEventListener("click", dismiss);
  sheet.addEventListener("click", (e) => {
    if (e.target === sheet) dismiss();
  });
  sheet.addEventListener("close", () => sheet.remove());
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(url);
      status.textContent = "Enlace copiado.";
    } catch {
      status.textContent = "No se pudo copiar. Mantén presionado el enlace para copiarlo.";
    }
  });
  native.addEventListener("click", () => {
    navigator.share({ title, url }).catch(() => {
      /* user cancelled */
    });
  });

  document.body.append(sheet);
  sheet.showModal();
}
