import { h, storage } from "../ui/dom.ts";
import { condor } from "./condor.ts";
import { Cabinet, type GameDef } from "./engine.ts";
import { signal } from "./signal.ts";

/** Available waiting-room games; the first one is the default. */
export const GAMES: GameDef[] = [condor, signal];

const local = storage("local");
const CHOICE_KEY = "ld:arcade:game";

/** Game picker plus the running cabinet. Remembers the last pick on this device. */
export function createArcade() {
  const stage = h("div", { class: "arcade-screen" });
  const status = h("p", { class: "arcade-best", role: "status", "aria-live": "polite" });
  const picker = h("div", { class: "arcade-picker", role: "group", "aria-label": "Elegir juego" });
  const el = h("section", { class: "arcade", "aria-label": "Juego de espera" }, picker, stage, status);
  let cabinet: Cabinet | null = null;

  const choose = (def: GameDef) => {
    cabinet?.destroy();
    cabinet = new Cabinet(def, (score, best) => (status.textContent = score >= best && score > 0 ? `¡Nuevo récord en ${def.name}: ${score}!` : `${def.name}: ${score} · récord ${best}`));
    stage.replaceChildren(cabinet.canvas);
    status.textContent = `${def.name}: ${def.hint}.`;
    local.write(CHOICE_KEY, def.id);
    picker.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.game === def.id)));
  };

  for (const def of GAMES) {
    const b = h("button", { type: "button", class: "arcade-pick", "data-game": def.id, "aria-pressed": "false" }, def.name);
    b.addEventListener("click", () => choose(def));
    picker.append(b);
  }
  const saved = local.read<string>(CHOICE_KEY);
  choose(GAMES.find((g) => g.id === saved) ?? GAMES[0]!);

  return {
    el,
    destroy() {
      cabinet?.destroy();
    },
  };
}
