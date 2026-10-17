// Pure game model for the "Cóndor" arcade (Flappy Bird style): no canvas,
// no timers, so it can be tested and drawn by any renderer.

export const FLAPPY = {
  width: 360,
  height: 540,
  ground: 500,
  gravity: 1500,
  flap: -460,
  speed: 150,
  towerWidth: 58,
  gap: 150,
  spacing: 210,
  radius: 14,
} as const;

export interface Tower {
  x: number;
  /** Center of the gap. */
  gapY: number;
  passed: boolean;
}

export interface FlappyWorld {
  bird: { x: number; y: number; vy: number };
  towers: Tower[];
  score: number;
  over: boolean;
  distance: number;
}

export function createFlappy(): FlappyWorld {
  return { bird: { x: 96, y: FLAPPY.height * 0.42, vy: 0 }, towers: [], score: 0, over: false, distance: 0 };
}

export function flap(w: FlappyWorld) {
  if (!w.over) w.bird.vy = FLAPPY.flap;
}

/** Advances the world; reports scoring and crashes for sound/score UI. */
export function stepFlappy(w: FlappyWorld, dt: number, random: () => number = Math.random): { scored: boolean; crashed: boolean } {
  if (w.over) return { scored: false, crashed: false };
  const b = w.bird;
  b.vy = Math.min(900, b.vy + FLAPPY.gravity * dt);
  b.y += b.vy * dt;
  w.distance += FLAPPY.speed * dt;

  for (const t of w.towers) t.x -= FLAPPY.speed * dt;
  w.towers = w.towers.filter((t) => t.x + FLAPPY.towerWidth > -10);
  const last = w.towers[w.towers.length - 1];
  if (!last || last.x < FLAPPY.width - FLAPPY.spacing) {
    const margin = 70;
    const gapY = margin + FLAPPY.gap / 2 + random() * (FLAPPY.ground - margin * 2 - FLAPPY.gap);
    w.towers.push({ x: FLAPPY.width + 20, gapY, passed: false });
  }

  let scored = false;
  for (const t of w.towers) {
    if (!t.passed && t.x + FLAPPY.towerWidth < b.x - FLAPPY.radius) {
      t.passed = true;
      w.score++;
      scored = true;
    }
  }

  const r = FLAPPY.radius - 2; // forgiving hitbox
  let crashed = b.y + r >= FLAPPY.ground || b.y - r <= 0;
  for (const t of w.towers) {
    const overlapsX = b.x + r > t.x && b.x - r < t.x + FLAPPY.towerWidth;
    const inGap = b.y - r > t.gapY - FLAPPY.gap / 2 && b.y + r < t.gapY + FLAPPY.gap / 2;
    if (overlapsX && !inGap) crashed = true;
  }
  if (crashed) {
    w.over = true;
    b.y = Math.min(b.y, FLAPPY.ground - r);
  }
  return { scored, crashed };
}
