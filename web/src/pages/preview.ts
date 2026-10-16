import type { PublicDeck } from "../../../shared/deck.ts";
import { nextPosition, prevPosition, type Position } from "../../../shared/nav.ts";
import { StageView } from "../render/stage-view.ts";
import { bindDeckKeys, bindSwipe } from "../ui/input.ts";

export async function mountPreview(root: HTMLElement, deckId: string) {
  const res = await fetch(`/api/decks/${deckId}`);
  if (!res.ok) {
    root.innerHTML = "";
    root.append(Object.assign(document.createElement("p"), { className: "page-message", textContent: "No se encontró la presentación." }));
    return;
  }
  const deck = (await res.json()) as PublicDeck;
  document.title = `${deck.title} · vista previa`;

  root.innerHTML = "";
  const shell = document.createElement("main");
  shell.className = "preview";
  const host = document.createElement("div");
  const counter = document.createElement("div");
  counter.className = "preview-counter";
  counter.setAttribute("aria-live", "polite");
  shell.append(host, counter);
  root.append(shell);

  const view = new StageView(host, deck, { assetBase: `/decks/${deckId}/` });
  let pos: Position = { slide: 0, step: 0 };
  const go = (p: Position) => {
    pos = p;
    view.show(pos);
    counter.textContent = `${pos.slide + 1} / ${deck.slides.length}`;
  };
  const next = () => go(nextPosition(deck.slides, pos));
  const prev = () => go(prevPosition(deck.slides, pos));

  go(pos);
  bindDeckKeys(window, { next, prev });
  bindSwipe(host, { next, prev });
  host.addEventListener("click", (e) => (e.clientX < host.clientWidth / 3 ? prev() : next()));
}
