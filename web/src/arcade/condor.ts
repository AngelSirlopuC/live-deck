import { ARCADE_COLORS as C, drawBanner, drawHud, type GameDef } from "./engine.ts";
import { FLAPPY, createFlappy, flap, stepFlappy, type FlappyWorld } from "./flappy-model.ts";

/** "Cóndor": Flappy Bird style, the condor glides between radio towers. */
export const condor: GameDef = {
  id: "condor",
  name: "Cóndor",
  hint: "toca para aletear entre las antenas",
  width: FLAPPY.width,
  height: FLAPPY.height,
  create() {
    let w: FlappyWorld = createFlappy();
    let wing = 0;
    return {
      get score() {
        return w.score;
      },
      reset() {
        w = createFlappy();
      },
      input() {
        flap(w);
        wing = 1;
      },
      step(dt) {
        wing = Math.max(0, wing - dt * 5);
        return stepFlappy(w, dt).crashed;
      },
      draw(ctx, phase, best) {
        const W = FLAPPY.width;
        const H = FLAPPY.height;
        const sky = ctx.createLinearGradient(0, 0, 0, H);
        sky.addColorStop(0, C.sky);
        sky.addColorStop(1, C.skyLow);
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, H);

        // Distant mountain ridge, parallax.
        ctx.fillStyle = "#2b2116";
        ctx.beginPath();
        ctx.moveTo(0, FLAPPY.ground);
        const off = (w.distance * 0.25) % 180;
        for (let i = 0; i * 90 - off <= W + 90; i++) {
          const x = i * 90 - off;
          ctx.lineTo(x + 45, FLAPPY.ground - 90 - (i % 2 ? 40 : 0));
          ctx.lineTo(x + 90, FLAPPY.ground - 30);
        }
        ctx.lineTo(W, FLAPPY.ground);
        ctx.fill();

        // Radio towers with an amber lamp on each tip.
        for (const t of w.towers) {
          const top = t.gapY - FLAPPY.gap / 2;
          const bottom = t.gapY + FLAPPY.gap / 2;
          ctx.fillStyle = C.cream;
          ctx.fillRect(t.x, 0, FLAPPY.towerWidth, top);
          ctx.fillRect(t.x, bottom, FLAPPY.towerWidth, FLAPPY.ground - bottom);
          ctx.strokeStyle = C.line;
          ctx.lineWidth = 2;
          for (let y = 12; y < top; y += 22) {
            ctx.beginPath();
            ctx.moveTo(t.x, y);
            ctx.lineTo(t.x + FLAPPY.towerWidth, y + 11);
            ctx.stroke();
          }
          for (let y = bottom + 12; y < FLAPPY.ground; y += 22) {
            ctx.beginPath();
            ctx.moveTo(t.x, y);
            ctx.lineTo(t.x + FLAPPY.towerWidth, y + 11);
            ctx.stroke();
          }
          ctx.fillStyle = C.amber;
          ctx.fillRect(t.x - 4, top - 10, FLAPPY.towerWidth + 8, 10);
          ctx.fillRect(t.x - 4, bottom, FLAPPY.towerWidth + 8, 10);
        }

        // Ground.
        ctx.fillStyle = C.desk;
        ctx.fillRect(0, FLAPPY.ground, W, H - FLAPPY.ground);
        ctx.fillStyle = C.line;
        const stripe = (w.distance % 24) | 0;
        for (let x = -stripe; x < W; x += 24) ctx.fillRect(x, FLAPPY.ground + 8, 12, 3);

        // The condor: dark body with a cream outline so it reads on the night
        // sky, a wing that beats on each tap, the white collar and an amber beak.
        const b = w.bird;
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(Math.max(-0.5, Math.min(1.1, b.vy / 600)));
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = C.cream;
        ctx.fillStyle = "#3a3026";
        ctx.beginPath();
        ctx.moveTo(-8, -2);
        ctx.lineTo(-30, -10 - wing * 18);
        ctx.lineTo(-22, 2);
        ctx.lineTo(-4, 8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#241c14";
        ctx.beginPath();
        ctx.ellipse(0, 0, 20, 14, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = C.cream;
        ctx.beginPath();
        ctx.ellipse(12, -4, 7, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#14110d";
        ctx.beginPath();
        ctx.arc(14, -5, 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = C.amber;
        ctx.beginPath();
        ctx.moveTo(19, -5);
        ctx.lineTo(29, -1);
        ctx.lineTo(19, 3);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        drawHud(ctx, W, w.score, best);
        if (phase === "ready") drawBanner(ctx, W, H, "CÓNDOR", "Toca para aletear");
        if (phase === "over") drawBanner(ctx, W, H, `PUNTAJE ${w.score}`, "Toca para volar otra vez");
      },
    };
  },
};
