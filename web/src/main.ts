import "./styles/base.css";
import "./styles/stage.css";
import { mountPreview } from "./pages/preview.ts";
import { matchRoute } from "./router.ts";

const root = document.getElementById("app")!;
const route = matchRoute(location.pathname);

function message(text: string) {
  root.append(Object.assign(document.createElement("p"), { className: "page-message", textContent: text }));
}

switch (route.page) {
  case "preview":
    void mountPreview(root, route.deckId);
    break;
  case "home":
    message("Live Deck");
    break;
  default:
    message("Página no encontrada.");
}
