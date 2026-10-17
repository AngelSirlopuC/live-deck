import type { CreateSessionResponse } from "../../../shared/protocol.ts";
import { TIME_LIMIT_MAX, TIME_LIMIT_MIN } from "../../../shared/pace.ts";
import { PIN } from "../../../shared/protocol.ts";
import { h, storage, trusted } from "../ui/dom.ts";
import { icon } from "../ui/icons.ts";

interface DeckSummary {
  id: string;
  title: string;
  slides: number;
}

const local = storage("local");
const session = storage("session");
const ADMIN_KEY = "ld:admin-key";

async function fetchDecks(adminKey: string | null): Promise<DeckSummary[] | "unauthorized"> {
  const res = await fetch("/api/decks", { headers: adminKey ? { "x-admin-key": adminKey } : {} });
  if (res.status === 401) return "unauthorized";
  if (!res.ok) throw new Error(`decks: ${res.status}`);
  return (await res.json()) as DeckSummary[];
}

export async function mountHome(root: HTMLElement) {
  let adminKey = local.read<string>(ADMIN_KEY);
  let decks = await fetchDecks(adminKey).catch(() => [] as DeckSummary[]);

  const keyInput = h("input", { id: "admin-key", type: "password", autocomplete: "off" });
  const keyField = h("div", { class: "field" }, h("label", { for: "admin-key", class: "legend" }, "Clave de administración"), keyInput);
  const deckSelect = h("select", { id: "deck" });
  const pinInput = h("input", { id: "pin", inputmode: "numeric", pattern: "[0-9]*", maxlength: 8, autocomplete: "off", required: true });
  const limitInput = h("input", { id: "time-limit", type: "number", inputmode: "numeric", min: TIME_LIMIT_MIN, max: TIME_LIMIT_MAX, step: 1, placeholder: "Sin límite" });
  const error = h("p", { class: "form-error", role: "alert" });
  const submit = h("button", { type: "submit", class: "key key-primary" }, "Crear sesión");

  const fillDecks = (list: DeckSummary[]) => {
    deckSelect.replaceChildren(...list.map((d) => h("option", { value: d.id }, `${d.title} · ${d.slides} diapositivas`)));
    const wanted = new URLSearchParams(location.search).get("deck");
    if (wanted && list.some((d) => d.id === wanted)) deckSelect.value = wanted;
    deckSelect.disabled = list.length === 0;
    if (!list.length) error.textContent = "No hay presentaciones en la carpeta decks/.";
  };
  keyField.hidden = decks !== "unauthorized";
  if (decks !== "unauthorized") fillDecks(decks);

  keyInput.addEventListener("change", async () => {
    adminKey = keyInput.value.trim() || null;
    decks = await fetchDecks(adminKey).catch(() => [] as DeckSummary[]);
    if (decks === "unauthorized") {
      error.textContent = "La clave no es válida.";
      return;
    }
    error.textContent = "";
    local.write(ADMIN_KEY, adminKey);
    fillDecks(decks);
  });

  const form = h(
    "form",
    { class: "home-form" },
    keyField,
    h("div", { class: "field" }, h("label", { for: "deck", class: "legend" }, "Presentación"), deckSelect),
    h("div", { class: "field" }, h("label", { for: "pin", class: "legend" }, "PIN del ponente (4 a 8 dígitos)"), pinInput, h("p", { class: "field-hint" }, "Lo pedirá la consola, la pantalla y el control móvil.")),
    h(
      "div",
      { class: "field" },
      h("label", { for: "time-limit", class: "legend" }, "Duración en minutos (opcional)"),
      limitInput,
      h("p", { class: "field-hint" }, "Tu cronómetro se pone amarillo al acercarte y rojo si te pasas. Puedes cambiarlo durante la sesión."),
    ),
    error,
    submit,
  );

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    error.textContent = "";
    if (!PIN.test(pinInput.value)) {
      error.textContent = "El PIN tiene de 4 a 8 dígitos.";
      return;
    }
    const limit = limitInput.value.trim() === "" ? null : Number(limitInput.value);
    if (limit !== null && (!Number.isInteger(limit) || limit < TIME_LIMIT_MIN || limit > TIME_LIMIT_MAX)) {
      error.textContent = `La duración va en minutos enteros, de ${TIME_LIMIT_MIN} a ${TIME_LIMIT_MAX}.`;
      return;
    }
    submit.disabled = true;
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json", ...(adminKey ? { "x-admin-key": adminKey } : {}) },
        body: JSON.stringify({ deckId: deckSelect.value, pin: pinInput.value, ...(limit !== null ? { timeLimitMin: limit } : {}) }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "No se pudo crear la sesión.");
      const created = body as CreateSessionResponse;
      session.write(`ld:pin:${created.presenterToken}`, pinInput.value);
      showCreated(root, created);
    } catch (err) {
      error.textContent = err instanceof Error ? err.message : "No se pudo crear la sesión.";
      submit.disabled = false;
    }
  });

  root.replaceChildren(
    h(
      "main",
      { class: "home" },
      h("h1", { class: "home-title" }, "Sal al aire con tu presentación"),
      h("p", { class: "home-lead" }, "Crea una sesión, proyecta la pantalla y comparte el código. El público sigue, vota y reacciona desde su celular."),
      form,
    ),
  );
}

function showCreated(root: HTMLElement, s: CreateSessionResponse) {
  const open = trusted("a", { class: "key key-primary", href: `/p/${s.presenterToken}` }, `${icon("play")}<span>Abrir consola</span>`);
  root.replaceChildren(
    h(
      "main",
      { class: "home" },
      h("h1", { class: "home-title" }, "Sesión creada"),
      h("p", { class: "home-lead" }, "Código de la sesión: ", h("strong", { class: "home-code" }, s.code)),
      h("dl", { class: "home-links" },
        h("dt", { class: "legend" }, "Enlace del público"),
        h("dd", {}, h("code", {}, s.joinUrl)),
        h("dt", { class: "legend" }, "Enlace del ponente (privado)"),
        h("dd", {}, h("code", {}, s.presenterUrl)),
      ),
      h("p", { class: "field-hint" }, "Guarda el enlace del ponente: con él y tu PIN puedes reconectarte desde cualquier dispositivo."),
      open,
    ),
  );
}
