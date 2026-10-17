import type { ScreenChoice } from "./present-plan.ts";

// Thin wrapper over the Window Management API (Chrome 100+). Other browsers
// only get the current screen.

interface DetailedScreen extends Screen {
  label: string;
  left: number;
  top: number;
  availLeft: number;
  availTop: number;
  isPrimary: boolean;
  isInternal: boolean;
}

interface ScreenDetails extends EventTarget {
  screens: DetailedScreen[];
  currentScreen: DetailedScreen;
}

type WindowWithScreens = Window & { getScreenDetails?: () => Promise<ScreenDetails> };

export type ScreenPermission = "unsupported" | "prompt" | "granted" | "denied";

let details: ScreenDetails | null = null;

export function screensSupported(): boolean {
  return typeof (window as WindowWithScreens).getScreenDetails === "function";
}

export async function screenPermission(): Promise<ScreenPermission> {
  if (!screensSupported()) return "unsupported";
  try {
    const status = await navigator.permissions.query({ name: "window-management" as PermissionName });
    return status.state as ScreenPermission;
  } catch {
    return "prompt";
  }
}

const toChoice = (s: DetailedScreen, i: number): ScreenChoice => ({
  id: String(i),
  label: s.label || (s.isInternal ? "Pantalla integrada" : `Pantalla ${i + 1}`),
  left: s.left,
  top: s.top,
  width: s.width,
  height: s.height,
  availLeft: s.availLeft,
  availTop: s.availTop,
  availWidth: s.availWidth,
  availHeight: s.availHeight,
  isPrimary: s.isPrimary,
  isInternal: s.isInternal,
});

/** Lists screens. Calling it may show the browser permission prompt. */
export async function loadScreens(onChange?: () => void): Promise<{ screens: ScreenChoice[]; currentId: string } | null> {
  const w = window as WindowWithScreens;
  if (!w.getScreenDetails) return null;
  try {
    if (!details) {
      details = await w.getScreenDetails();
      if (onChange) details.addEventListener("screenschange", onChange);
    }
    const screens = details.screens.map(toChoice);
    return { screens, currentId: String(details.screens.indexOf(details.currentScreen)) };
  } catch {
    return null;
  }
}

/** The native Screen object for an id from loadScreens, for requestFullscreen({ screen }). */
export function nativeScreen(id: string): Screen | null {
  return details?.screens[Number(id)] ?? null;
}
