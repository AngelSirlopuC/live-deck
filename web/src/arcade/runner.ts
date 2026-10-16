import { storage } from "../ui/dom.ts";

// Waiting-room arcade: a signal blip runs along the desk and jumps over mic
// stands. One input (tap, click, space). Runs only while visible; no network.

const BEST_KEY = "ld:arcade:best";
const W = 640;
const H = 220;
const GROUND = 180;
const GRAVITY = 2400;
const JUMP = -760;

interface Obstacle {
  x: number;
  w: number;
  h: number;
}

const COLORS = { desk: "#2a241c", line: "#4a4031", blip: "#ffb547", stand: "#efe4cc", text: "#efe4cc", dim: "#a89a7e" };

export class Runner {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private last = 0;
  private y = GROUND;
  private vy = 0;
  private speed = 300;
  private obstacles: Obstacle[] = [];
  private spawnIn = 1.2;
  private score = 0;
  private best = storage("local").read<number>(BEST_KEY) ?? 0;
  private state: "ready" | "running" | "over" = "ready";
  private onScore?: (score: number, best: number) => void;
  private readonly onVisibility = () => (document.hidden ? this.pause() : this.resume());

  constructor(onScore?: (score: number, best: number) => void) {
    this.onScore = onScore;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "arcade-canvas";
    this.canvas.width = W * 2;
    this.canvas.height = H * 2;
    this.canvas.setAttribute("role", "img");
    this.canvas.setAttribute("aria-label", "Juego de espera: toca para saltar los obstáculos");
    this.ctx = this.canvas.getContext("2d")!;
    this.ctx.scale(2, 2);
    this.canvas.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.input();
    });
    document.addEventListener("visibilitychange", this.onVisibility);
    this.draw();
  }

  /** Jump, or (re)start when idle or after a crash. */
  input() {
    if (this.state !== "running") {
      this.reset();
      this.state = "running";
      this.resume();
      return;
    }
    if (this.y >= GROUND) this.vy = JUMP;
  }

  destroy() {
    this.pause();
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.canvas.remove();
  }

  private reset() {
    this.y = GROUND;
    this.vy = 0;
    this.speed = 300;
    this.obstacles = [];
    this.spawnIn = 1;
    this.score = 0;
  }

  private pause() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private resume() {
    if (this.raf || this.state !== "running") return;
    this.last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - this.last) / 1000);
      this.last = t;
      this.step(dt);
      this.draw();
      if (this.state === "running") this.raf = requestAnimationFrame(loop);
      else this.raf = 0;
    };
    this.raf = requestAnimationFrame(loop);
  }

  private step(dt: number) {
    this.vy += GRAVITY * dt;
    this.y = Math.min(GROUND, this.y + this.vy * dt);
    if (this.y >= GROUND) this.vy = 0;

    this.speed += 8 * dt;
    this.score += dt * 10;
    this.spawnIn -= dt;
    if (this.spawnIn <= 0) {
      const tall = Math.random() < 0.35;
      this.obstacles.push({ x: W + 10, w: tall ? 14 : 22, h: tall ? 48 : 28 });
      this.spawnIn = 0.75 + Math.random() * 0.9 - Math.min(0.35, this.speed / 2000);
    }
    for (const o of this.obstacles) o.x -= this.speed * dt;
    this.obstacles = this.obstacles.filter((o) => o.x + o.w > -10);

    const bx = 80;
    const r = 12;
    for (const o of this.obstacles) {
      if (bx + r - 3 > o.x && bx - r + 3 < o.x + o.w && this.y > GROUND - o.h + 3) {
        this.state = "over";
        const s = Math.floor(this.score);
        if (s > this.best) {
          this.best = s;
          storage("local").write(BEST_KEY, s);
        }
        this.onScore?.(s, this.best);
      }
    }
  }

  private draw() {
    const c = this.ctx;
    c.clearRect(0, 0, W, H);
    c.fillStyle = COLORS.desk;
    c.fillRect(0, GROUND + 12, W, H - GROUND - 12);
    c.strokeStyle = COLORS.line;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, GROUND + 12);
    c.lineTo(W, GROUND + 12);
    c.stroke();

    // Mic stands
    c.fillStyle = COLORS.stand;
    for (const o of this.obstacles) {
      const top = GROUND + 12 - o.h;
      c.fillRect(o.x + o.w / 2 - 2, top + 10, 4, o.h - 10);
      c.beginPath();
      c.roundRect(o.x, top, o.w, 14, 7);
      c.fill();
      c.fillRect(o.x - 2, GROUND + 9, o.w + 4, 3);
    }

    // Signal blip with its broadcast rings
    const bx = 80;
    c.fillStyle = COLORS.blip;
    c.beginPath();
    c.arc(bx, this.y, 12, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = COLORS.blip;
    c.globalAlpha = 0.35;
    c.beginPath();
    c.arc(bx, this.y, 19, -0.7, 0.7);
    c.stroke();
    c.globalAlpha = 1;

    c.fillStyle = COLORS.text;
    c.font = "600 16px 'JetBrains Mono', monospace";
    c.textAlign = "right";
    c.fillText(String(Math.floor(this.score)).padStart(4, "0"), W - 16, 28);
    c.fillStyle = COLORS.dim;
    c.fillText(`récord ${String(this.best).padStart(4, "0")}`, W - 16, 50);

    if (this.state !== "running") {
      c.textAlign = "center";
      c.fillStyle = COLORS.text;
      c.font = "600 20px 'Oswald', sans-serif";
      c.fillText(this.state === "ready" ? "TOCA PARA JUGAR MIENTRAS ESPERAS" : "¡SE CORTÓ LA SEÑAL! TOCA PARA REINTENTAR", W / 2, 100);
    }
  }
}
