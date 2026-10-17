// Where the projection and the presenter view go, from the chosen options and
// the screens the browser reports (Window Management API). Pure: no DOM.

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
  /** Open the console (notes, next slide, quiz, chat, controls) in its own window. */
  presenterView: boolean;
  fullscreen: boolean;
  /** Screen id to project on; null = wherever this tab is. */
  target: string | null;
  /** "tab": this tab becomes the projection. "window": open a separate projector window. */
  mode: "tab" | "window";
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PresentPlan {
  /** Project in this tab (false when a separate projector window is used). */
  projectInTab: boolean;
  fullscreen: boolean;
  /** Screen id for requestFullscreen({ screen }); null = current screen. */
  fullscreenScreen: string | null;
  presenterWindow: Rect | null;
  projectorWindow: Rect | null;
  /** Show the auto-hiding control bar over the projection (no separate presenter view). */
  floatingControls: boolean;
}

const DEFAULT_WINDOW = { width: 1280, height: 800 };

const area = (s: ScreenChoice): Rect => ({ left: s.availLeft, top: s.availTop, width: s.availWidth, height: s.availHeight });

export function planPresentation(opts: PresentOptions, screens: readonly ScreenChoice[], currentId: string | null): PresentPlan {
  const target = screens.find((s) => s.id === opts.target) ?? null;
  const current = screens.find((s) => s.id === currentId) ?? null;
  // The presenter view goes to a screen that is not showing the projection.
  const other = screens.find((s) => s.id !== (target?.id ?? currentId)) ?? null;
  const presenterHome = target && current && target.id !== current.id ? current : other;

  const presenterWindow = opts.presenterView
    ? presenterHome
      ? area(presenterHome)
      : { left: (current?.availLeft ?? 0) + 80, top: (current?.availTop ?? 0) + 80, ...DEFAULT_WINDOW }
    : null;

  if (opts.mode === "window") {
    const place = target ?? other;
    return {
      projectInTab: false,
      fullscreen: false,
      fullscreenScreen: null,
      projectorWindow: place ? area(place) : { left: 80, top: 80, ...DEFAULT_WINDOW },
      presenterWindow: null,
      floatingControls: false,
    };
  }

  return {
    projectInTab: true,
    fullscreen: opts.fullscreen,
    fullscreenScreen: opts.fullscreen && target ? target.id : null,
    presenterWindow,
    projectorWindow: null,
    floatingControls: !opts.presenterView,
  };
}
