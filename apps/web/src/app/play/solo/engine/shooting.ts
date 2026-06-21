import { GameState } from "./gameState";
import { GAME_CONFIG } from "../config";

// Find the nearest enemy to the player's current position
function findNearestEnemy(state: GameState): { x: number; y: number } | null {
  if (state.enemies.length === 0) return null;

  const playerCenterX = state.player.x + state.player.width / 2;
  const playerCenterY = state.player.y + state.player.height / 2;

  let nearestDist = Infinity;
  let nearestPos = { x: 0, y: 0 };

  for (const enemy of state.enemies) {
    const enemyCenterX = enemy.x + enemy.width / 2;
    const enemyCenterY = enemy.y + enemy.height / 2;
    const dx = enemyCenterX - playerCenterX;
    const dy = enemyCenterY - playerCenterY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < nearestDist) {
      nearestDist = dist;
      nearestPos = { x: enemyCenterX, y: enemyCenterY };
    }
  }

  return nearestPos;
}

// Handles player shooting — aims bullet toward nearest enemy (no tracking)
export function handlePlayerShooting(state: GameState): void {
  const now = Date.now();
  if (
    (state.keys["Space"] || state.keys[" "]) &&
    now - state.lastShotTime > GAME_CONFIG.PLAYER_SHOOT_COOLDOWN
  ) {
    const bulletOriginX = state.player.x + state.player.width / 2 - 2;
    const bulletOriginY = state.player.y - 12;
    const bulletSpeed = Math.abs(GAME_CONFIG.PLAYER_BULLET_SPEED);

    let vx = 0;
    let vy = -bulletSpeed; // Default: straight up

    // Aimbot: aim toward the nearest enemy
    const target = findNearestEnemy(state);
    if (target) {
      const dx = target.x - bulletOriginX;
      const dy = target.y - bulletOriginY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 0) {
        // Normalize direction and apply bullet speed
        vx = (dx / dist) * bulletSpeed;
        vy = (dy / dist) * bulletSpeed;
      }
    }

    state.bullets.push({
      x: bulletOriginX,
      y: bulletOriginY,
      width: 4,
      height: 16,
      vx,
      vy,
      isPlayerBullet: true,
    });
    state.lastShotTime = now;
  }
}

// Handles enemy auto-shooting based on timer and wave difficulty
export function handleEnemyShooting(state: GameState): void {
  state.enemyShootTimer++;
  const shootInterval = Math.max(
    GAME_CONFIG.ENEMY_SHOOT_COOLDOWN_MIN,
    GAME_CONFIG.ENEMY_SHOOT_COOLDOWN_BASE - state.waveNumber * GAME_CONFIG.ENEMY_SHOOT_COOLDOWN_WAVE_DECREASE
  );

  if (state.enemyShootTimer >= shootInterval && state.enemies.length > 0) {
    state.enemyShootTimer = 0;
    const randomEnemy = state.enemies[Math.floor(Math.random() * state.enemies.length)];
    const enemyBulletSpeed = GAME_CONFIG.ENEMY_BULLET_SPEED_BASE + state.waveNumber * GAME_CONFIG.ENEMY_BULLET_SPEED_WAVE_GROWTH;

    state.bullets.push({
      x: randomEnemy.x + randomEnemy.width / 2 - 2,
      y: randomEnemy.y + randomEnemy.height,
      width: 4,
      height: 16,
      vx: 0,
      vy: enemyBulletSpeed, // Straight down
      isPlayerBullet: false,
    });
  }
}

// Move all bullets and remove off-screen ones
export function updateBullets(state: GameState): void {
  state.bullets.forEach((bullet) => {
    bullet.x += bullet.vx;
    bullet.y += bullet.vy;
  });

  state.bullets = state.bullets.filter(
    (b) =>
      b.y > -20 &&
      b.y < GAME_CONFIG.GAME_HEIGHT + 20 &&
      b.x > -20 &&
      b.x < GAME_CONFIG.GAME_WIDTH + 20
  );
}
