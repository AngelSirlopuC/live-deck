import { ARCADE_COLORS as C, drawBanner, drawHud, type GameDef } from "./engine.ts";

const W = 360;
const H = 540;
const GROUND = 430;

/** "Señal": a runner; the signal blip jumps over mic stands. */
export const signal: GameDef = {
  id: "senal",
  name: "Señal",
  hint: "toca para saltar los micrófonos",
  width: W,
  height: H,
  create() {
    let y = GROUND;
    let vy = 0;
    let speed = 220;
    let spawnIn = 1;
    let score = 0;
    let stands: Array<{ x: number; w: number; h: number }> = [];
    return {
      get score() {
        return Math.floor(score);
      },
      reset() {
        y = GROUND;
        vy = 0;
        speed = 220;
        spawnIn = 1;
        score = 0;
        stands = [];
      },
      input() {
        if (y >= GROUND) vy = -720;
      },
      step(dt) {
        vy += 2300 * dt;
        y = Math.min(GROUND, y + vy * dt);
        if (y >= GROUND) vy = 0;
        speed += 6 * dt;
        score += dt * 10;
        spawnIn -= dt;
        if (spawnIn <= 0) {
          const tall = Math.random() < 0.35;
          stands.push({ x: W + 10, w: tall ? 14 : 22, h: tall ? 56 : 32 });
          spawnIn = 0.9 + Math.random() * 0.9 - Math.min(0.35, speed / 1600);
        }
        for (const s of stands) s.x -= speed * dt;
        stands = stands.filter((s) => s.x + s.w > -10);
        return stands.some((s) => 80 + 9 > s.x && 80 - 9 < s.x + s.w && y > GROUND - s.h + 3);
      },
      draw(ctx, phase, best) {
        ctx.fillStyle = C.sky;
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = C.desk;
        ctx.fillRect(0, GROUND + 12, W, H - GROUND - 12);
        ctx.fillStyle = C.cream;
        for (const s of stands) {
          const top = GROUND + 12 - s.h;
          ctx.fillRect(s.x + s.w / 2 - 2, top + 10, 4, s.h - 10);
          ctx.beginPath();
          ctx.roundRect(s.x, top, s.w, 14, 7);
          ctx.fill();
        }
        ctx.fillStyle = C.amber;
        ctx.beginPath();
        ctx.arc(80, y, 12, 0, Math.PI * 2);
        ctx.fill();
        drawHud(ctx, W, Math.floor(score), best);
        if (phase === "ready") drawBanner(ctx, W, H, "SEÑAL", "Toca para saltar");
        if (phase === "over") drawBanner(ctx, W, H, `PUNTAJE ${Math.floor(score)}`, "Se cortó la señal · toca otra vez");
      },
    };
  },
};
