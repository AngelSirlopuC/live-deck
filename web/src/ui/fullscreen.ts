/**
 * Fullscreen for the slide. Uses the Fullscreen API and a landscape
 * orientation lock where the browser allows it (Android, desktop). iPhone
 * Safari has no element fullscreen, so the slide also gets a CSS "theater"
 * mode that fills the viewport and, when the phone is held upright, turns the
 * slide 90° so it is shown as large as possible.
 */
export function createTheater(shell: HTMLElement, onChange: (on: boolean) => void) {
  let on = false;
  let native = false;
  const portrait = window.matchMedia("(orientation: portrait)");

  const sync = () => {
    shell.classList.toggle("is-theater", on);
    shell.classList.toggle("is-rotated", on && portrait.matches);
    onChange(on);
    // Let the stage refit to its new box.
    window.dispatchEvent(new Event("resize"));
  };

  portrait.addEventListener("change", () => on && sync());
  document.addEventListener("fullscreenchange", () => {
    if (native && !document.fullscreenElement) {
      native = false;
      if (on) {
        on = false;
        sync();
      }
    }
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && on) api.exit();
  });

  const api = {
    get active() {
      return on;
    },
    get rotated() {
      return on && portrait.matches;
    },
    async enter() {
      if (on) return;
      on = true;
      sync();
      const root = document.documentElement;
      if (root.requestFullscreen && !document.fullscreenElement) {
        try {
          await root.requestFullscreen({ navigationUI: "hide" });
          native = true;
          const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
          await orientation.lock?.("landscape").catch(() => {});
        } catch {
          // Not allowed here (e.g. iPhone): the CSS theater mode still applies.
        }
      }
      sync();
    },
    exit() {
      if (!on) return;
      on = false;
      if (native && document.fullscreenElement) void document.exitFullscreen().catch(() => {});
      native = false;
      sync();
    },
    toggle() {
      return on ? api.exit() : api.enter();
    },
  };
  return api;
}
