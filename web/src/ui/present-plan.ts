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
   * "display": Chrome's Presentation API picker renders the slide fullscreen on
   * the chosen monitor or Cast device, with no browser window.
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
  /** This tab becomes the projection (current screen). */
  projectInTab: boolean;
  /** Present through the Presentation API (Chrome's display picker). */
  useDisplay: boolean;
  fullscreen: boolean;
  /** A projector window covering another screen; the console stays in this tab. */
  projectorWindow: Rect | null;
  /** Human name of where the projection goes, for the console banner. */
  screenLabel: string;
  /** Console window when projecting on the only screen with presenter view. */
  presenterWindow: Rect | null;
  /** Auto-hiding control bar over an in-tab projection. */
  floatingControls: boolean;
}

const full = (s: ScreenChoice): Rect => ({ left: s.left, top: s.top, width: s.width, height: s.height });

export function planPresentation(opts: PresentOptions, screens: readonly ScreenChoice[], currentId: string | null): PresentPlan {
  const target = screens.find((s) => s.id === opts.target) ?? null;
  const current = screens.find((s) => s.id === currentId) ?? null;

  if (opts.mode === "display") {
    return { projectInTab: false, useDisplay: true, fullscreen: true, projectorWindow: null, screenLabel: "la pantalla elegida en Chrome", presenterWindow: null, floatingControls: false };
  }
  if (opts.mode === "window") {
    return { projectInTab: false, useDisplay: false, fullscreen: false, projectorWindow: { left: 80, top: 80, width: 1280, height: 720 }, screenLabel: "una ventana aparte", presenterWindow: null, floatingControls: false };
  }
  if (target && target.id !== currentId) {
    return { projectInTab: false, useDisplay: false, fullscreen: false, projectorWindow: full(target), screenLabel: target.label, presenterWindow: null, floatingControls: false };
  }
  return {
    projectInTab: true,
    useDisplay: false,
    fullscreen: opts.fullscreen,
    projectorWindow: null,
    screenLabel: "esta pantalla",
    presenterWindow: opts.presenterView ? { left: (current?.availLeft ?? 0) + 80, top: (current?.availTop ?? 0) + 80, width: 1280, height: 800 } : null,
    floatingControls: !opts.presenterView,
  };
}
