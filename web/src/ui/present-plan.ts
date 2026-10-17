// Where the projection and the controls go, from the chosen options and the
// screens the browser reports (Window Management API). Pure: no DOM.

export interface ScreenChoice {
  id: string;
  label: string;
  left: number;
  top: number;
  width: number;
  height: number;
  availLeft: number;
  availTop: number;
  availWidth: number;
  availHeight: number;
  isPrimary: boolean;
  isInternal: boolean;
}

export interface PresentOptions {
  /** On a single screen: open the console in its own window while this tab projects. */
  presenterView: boolean;
  fullscreen: boolean;
  /** Screen id to project on; null = wherever this tab is. */
  target: string | null;
  /**
   * "tab": this tab is the projection (on this or another screen).
   * "display": Chrome's Presentation API picker (e.g. Chromecast).
   * "window": a projector window to drag manually (screens could not be listed).
   */
  mode: "tab" | "window" | "display";
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PresentPlan {
  /** This tab becomes the projection. */
  projectInTab: boolean;
  /** Present through the Presentation API (Chrome's display picker). */
  useDisplay: boolean;
  fullscreen: boolean;
  /** Screen id for requestFullscreen({ screen }) when projecting this tab on another screen. */
  fullscreenScreen: string | null;
  /** A separate projector window (fallback); the console stays in this tab. */
  projectorWindow: Rect | null;
  /** Human name of where the projection goes. */
  screenLabel: string;
  /** Console (presenter view) window. */
  presenterWindow: Rect | null;
  /** Auto-hiding control bar over an in-tab projection with no presenter view. */
  floatingControls: boolean;
}

const area = (s: ScreenChoice): Rect => ({ left: s.availLeft, top: s.availTop, width: s.availWidth, height: s.availHeight });
const DEFAULT_WINDOW = { width: 1280, height: 800 };

export function planPresentation(opts: PresentOptions, screens: readonly ScreenChoice[], currentId: string | null): PresentPlan {
  const target = screens.find((s) => s.id === opts.target) ?? null;
  const current = screens.find((s) => s.id === currentId) ?? null;
  const base = { useDisplay: false, fullscreenScreen: null, projectorWindow: null, presenterWindow: null, floatingControls: false };

  if (opts.mode === "display") {
    return { ...base, projectInTab: false, useDisplay: true, fullscreen: true, screenLabel: "la pantalla elegida en Chrome" };
  }
  if (opts.mode === "window") {
    return { ...base, projectInTab: false, fullscreen: false, projectorWindow: { left: 80, top: 80, width: 1280, height: 720 }, screenLabel: "una ventana aparte" };
  }
  if (target && target.id !== currentId) {
    // Google Slides model: this tab goes fullscreen on the chosen screen and the
    // console (presenter view) opens as a window on the presenter's screen.
    const home = current ?? screens.find((s) => s.id !== target.id) ?? null;
    return {
      ...base,
      projectInTab: true,
      fullscreen: true,
      fullscreenScreen: target.id,
      screenLabel: target.label,
      presenterWindow: home ? area(home) : { left: 80, top: 80, ...DEFAULT_WINDOW },
    };
  }
  return {
    ...base,
    projectInTab: true,
    fullscreen: opts.fullscreen,
    screenLabel: "esta pantalla",
    presenterWindow: opts.presenterView ? { left: (current?.availLeft ?? 0) + 80, top: (current?.availTop ?? 0) + 80, ...DEFAULT_WINDOW } : null,
    floatingControls: !opts.presenterView,
  };
}
