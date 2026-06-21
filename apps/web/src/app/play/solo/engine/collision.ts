import { Particle } from "./types";
import { GameState } from "./gameState";
import { checkAABBCollision, createExplosion } from "./physics";
import { GAME_CONFIG } from "../config";

export interface CollisionResult {
  scoreGained: number;
  livesLost: number;
  newParticles: Particle[];
  gameOver: boolean;
}

// Process all bullet-enemy and bullet-player collisions in one pass
export function processCollisions(state: GameState): CollisionResult {
  const bulletsToDelete = new Set<number>();
  const enemiesToDelete = new Set<number>();
  let scoreGained = 0;
  let livesLost = 0;
  const newParticles: Particle[] = [];
  let gameOver = false;

  for (let bIdx = 0; bIdx < state.bullets.length; bIdx++) {
    const bullet = state.bullets[bIdx];

    if (bullet.isPlayerBullet) {
      // Player Bullet vs Enemies
      for (let eIdx = 0; eIdx < state.enemies.length; eIdx++) {
        if (enemiesToDelete.has(eIdx)) continue;
        const enemy = state.enemies[eIdx];

        if (checkAABBCollision(bullet, enemy)) {
          bulletsToDelete.add(bIdx);
          enemiesToDelete.add(eIdx);
          newParticles.push(
            ...createExplosion(
              enemy.x + enemy.width / 2,
              enemy.y + enemy.height / 2,
              GAME_CONFIG.PARTICLES_COLOR_ENEMY
            )
          );
          scoreGained += 100 * state.waveNumber;
          break;
        }
      }
    } else {
      // Enemy Bullet vs Player
      if (checkAABBCollision(bullet, state.player)) {
        bulletsToDelete.add(bIdx);
        newParticles.push(
          ...createExplosion(
            state.player.x + state.player.width / 2,
            state.player.y + state.player.height / 2,
            GAME_CONFIG.PARTICLES_COLOR_PLAYER
          )
        );
        livesLost += 1;

        if (state.livesCount - livesLost <= 0) {
          gameOver = true;
        }
      }
    }
  }

  // Apply deletions
  state.bullets = state.bullets.filter((_, idx) => !bulletsToDelete.has(idx));
  state.enemies = state.enemies.filter((_, idx) => !enemiesToDelete.has(idx));

  return { scoreGained, livesLost, newParticles, gameOver };
}

// Update particle positions and remove faded ones
export function updateParticles(state: GameState): void {
  state.particles.forEach((p) => {
    p.x += p.vx;
    p.y += p.vy;
    p.alpha -= GAME_CONFIG.PARTICLES_DECAY_RATE;
  });
  state.particles = state.particles.filter((p) => p.alpha > 0);
}
