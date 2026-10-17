import { storage } from "../ui/dom.ts";

export type Phase = "ready" | "running" | "over";

/** One arcade game: a fixed logical canvas size, a model and a renderer. */
export interface Game {
  reset(): void;
  /** The single action (tap, click, space). */
  input(): void;
  /** Advances the model; returns true when the run just ended. */
  step(dt: number): boolean;
  draw(ctx: CanvasRenderingContext2D, phase: Phase, best: number): void;
  readonly score: number;
}

export interface GameDef {
  id: string;
  name: string;
  hint: string;
  width: number;
  height: number;
  create(): Game;
}

const local = storage("local");

/**
 * Hosts a game on a crisp canvas: runs the loop only while visible and
 * playing, keeps a per-game best score on the device, never uses the network.
 */
export class Cabinet {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly game: Game;
  private readonly def: GameDef;
  private phase: Phase = "ready";
  private raf = 0;
  private last = 0;
  private best: number;
  private readonly onScore: ((score: number, best: number) => void) | undefined;
  private readonly onVisibility = () => (document.hidden ? this.stop() : this.loop());

  constructor(def: GameDef, onScore?: (score: number, best: number) => void) {
    this.def = def;
    this.game = def.create();
    this.onScore = onScore;
    this.best = local.read<number>(`ld:arcade:${def.id}:best`) ?? 0;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "arcade-canvas";
    this.canvas.style.aspectRatio = `${def.width} / ${def.height}`;
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute("role", "img");
    this.canvas.setAttribute("aria-label", `${def.name}: ${def.hint}`);
    this.ctx = this.canvas.getContext("2d")!;
    this.resize();
    this.canvas.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.press();
    });
    this.canvas.addEventListener("keydown", (e) => {
      if (e.key === " " || e.key === "Enter" || e.key === "ArrowUp") {
        e.preventDefault();
        this.press();
      }
    });
    document.addEventListener("visibilitychange", this.onVisibility);
    this.draw();
    // Canvas text ignores web fonts that are still loading; redraw once ready.
    void Promise.all([document.fonts?.load("700 16px 'JetBrains Mono'"), document.fonts?.load("600 20px 'Oswald'")]).then(() => this.draw());
  }

  private resize() {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.def.width * dpr);
    this.canvas.height = Math.round(this.def.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  press() {
    if (this.phase !== "running") {
      this.game.reset();
      this.phase = "running";
      this.game.input();
      this.loop();
      return;
    }
    this.game.input();
  }

  private loop() {
    if (this.raf || this.phase !== "running" || document.hidden) return;
    this.last = performance.now();
    const tick = (t: number) => {
      this.raf = 0;
      const dt = Math.min(0.033, (t - this.last) / 1000);
      this.last = t;
      if (this.game.step(dt)) this.finish();
      this.draw();
      if (this.phase === "running") this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private finish() {
    this.phase = "over";
    const s = this.game.score;
    if (s > this.best) {
      this.best = s;
      local.write(`ld:arcade:${this.def.id}:best`, s);
    }
    this.onScore?.(s, this.best);
  }

  private stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private draw() {
    this.ctx.clearRect(0, 0, this.def.width, this.def.height);
    this.game.draw(this.ctx, this.phase, this.best);
  }

  destroy() {
    this.stop();
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.canvas.remove();
  }
}

/** Shared HUD and overlays so every game reads as one arcade. */
export const ARCADE_COLORS = { sky: "#17120d", skyLow: "#241a10", desk: "#2a241c", line: "#4a4031", amber: "#ffb547", cream: "#efe4cc", dim: "#b3a68b", red: "#ff3b2f" };

export function drawHud(ctx: CanvasRenderingContext2D, w: number, score: number, best: number) {
  // Dark plate so the score stays legible over light towers.
  ctx.fillStyle = "rgb(15 12 9 / 0.78)";
  ctx.beginPath();
  ctx.roundRect(w - 104, 10, 94, 50, 10);
  ctx.fill();
  ctx.textAlign = "right";
  ctx.fillStyle = ARCADE_COLORS.cream;
  ctx.font = "700 22px 'JetBrains Mono', monospace";
  ctx.fillText(String(score), w - 16, 34);
  ctx.fillStyle = ARCADE_COLORS.dim;
  ctx.font = "600 12px 'Oswald', sans-serif";
  ctx.fillText(`RÉCORD ${best}`, w - 16, 52);
}

export function drawBanner(ctx: CanvasRenderingContext2D, w: number, h: number, title: string, sub: string) {
  ctx.fillStyle = "rgb(15 12 9 / 0.72)";
  ctx.fillRect(0, h / 2 - 54, w, 108);
  ctx.textAlign = "center";
  ctx.fillStyle = ARCADE_COLORS.cream;
  ctx.font = "600 24px 'Oswald', sans-serif";
  ctx.fillText(title, w / 2, h / 2 - 8);
  ctx.fillStyle = ARCADE_COLORS.amber;
  ctx.font = "500 15px 'Oswald', sans-serif";
  ctx.fillText(sub, w / 2, h / 2 + 22);
}
