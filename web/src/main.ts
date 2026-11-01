import "./styles/base.css";
import "./styles/stage.css";
import "./styles/chrome.css";
import "./styles/editor.css";
import { mountAudience } from "./pages/audience.ts";
import { mountEditor } from "./pages/editor.ts";
import { mountHome } from "./pages/home.ts";
import { mountPresenter } from "./pages/presenter.ts";
import { mountPreview } from "./pages/preview.ts";
import { matchRoute } from "./router.ts";

const root = document.getElementById("app")!;
const route = matchRoute(location.pathname);

switch (route.page) {
  case "home":
    void mountHome(root);
    break;
  case "preview":
    void mountPreview(root, route.deckId);
    break;
  case "editor":
    void mountEditor(root, route.deckId);
    break;
  case "presenter":
    mountPresenter(root, route.token, route.surface);
    break;
  case "audience":
    void mountAudience(root, route.code);
    break;
  default:
    root.append(Object.assign(document.createElement("p"), { className: "page-message", textContent: "Página no encontrada." }));
}
