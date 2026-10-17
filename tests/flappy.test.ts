import { describe, expect, it } from "vitest";
import { FLAPPY, createFlappy, flap, stepFlappy } from "../web/src/arcade/flappy-model.ts";

const fixed = () => 0.5;

describe("flappy model", () => {
  it("falls under gravity and rises on flap", () => {
    const w = createFlappy();
    const y0 = w.bird.y;
    stepFlappy(w, 0.2, fixed);
    expect(w.bird.y).toBeGreaterThan(y0);
    flap(w);
    stepFlappy(w, 0.05, fixed);
    expect(w.bird.vy).toBeLessThan(0);
  });

  it("ends the run when the bird hits the ground", () => {
    const w = createFlappy();
    let crashed = false;
    for (let i = 0; i < 400 && !crashed; i++) crashed = stepFlappy(w, 1 / 60, fixed).crashed;
    expect(crashed).toBe(true);
    expect(w.over).toBe(true);
  });

  it("scores once per tower passed and crashes into a tower", () => {
    const w = createFlappy();
    w.towers.push({ x: w.bird.x - FLAPPY.radius - FLAPPY.towerWidth - 1, gapY: w.bird.y, passed: false });
    const ev = stepFlappy(w, 1 / 60, fixed);
    expect(ev.scored).toBe(true);
    expect(w.score).toBe(1);
    expect(stepFlappy(w, 1 / 60, fixed).scored).toBe(false);

    const hit = createFlappy();
    hit.towers.push({ x: hit.bird.x - 5, gapY: hit.bird.y + FLAPPY.gap, passed: false });
    expect(stepFlappy(hit, 1 / 60, fixed).crashed).toBe(true);
  });

  it("does not move after the run is over", () => {
    const w = createFlappy();
    w.over = true;
    const y = w.bird.y;
    stepFlappy(w, 0.5, fixed);
    expect(w.bird.y).toBe(y);
  });
});
