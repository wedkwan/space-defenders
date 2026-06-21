import { GameState } from "./gameState";
import { GAME_CONFIG } from "../config";

// Draws the entire game frame onto the canvas context
export function drawGame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  playerImg: HTMLImageElement | null,
  enemyImg: HTMLImageElement | null
): void {
  ctx.clearRect(0, 0, GAME_CONFIG.GAME_WIDTH, GAME_CONFIG.GAME_HEIGHT);

  // --- Render Player ---
  if (playerImg) {
    const sx = state.player.frame * 400;
    const sy = 0;
    const sWidth = 400;
    const sHeight = 400;

    ctx.drawImage(
      playerImg,
      sx,
      sy,
      sWidth,
      sHeight,
      state.player.x,
      state.player.y,
      state.player.width,
      state.player.height
    );
  } else {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(state.player.x, state.player.y, state.player.width, state.player.height);
  }

  // --- Render Enemies ---
  state.enemies.forEach((enemy) => {
    if (enemyImg) {
      const sx = enemy.frame * 100;
      const sy = 0;
      const sWidth = 100;
      const sHeight = 100;

      ctx.drawImage(
        enemyImg,
        sx,
        sy,
        sWidth,
        sHeight,
        enemy.x,
        enemy.y,
        enemy.width,
        enemy.height
      );
    } else {
      ctx.fillStyle = GAME_CONFIG.PARTICLES_COLOR_ENEMY;
      ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
    }
  });

  // --- Render Bullets ---
  state.bullets.forEach((bullet) => {
    ctx.fillStyle = bullet.isPlayerBullet
      ? GAME_CONFIG.PARTICLES_COLOR_ENEMY
      : GAME_CONFIG.PARTICLES_COLOR_PLAYER;
    ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);

    ctx.shadowColor = bullet.isPlayerBullet
      ? GAME_CONFIG.PARTICLES_COLOR_ENEMY
      : GAME_CONFIG.PARTICLES_COLOR_PLAYER;
    ctx.shadowBlur = 8;
    ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
    ctx.shadowBlur = 0;
  });

  // --- Render Particles ---
  state.particles.forEach((p) => {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 5;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    ctx.restore();
  });
}
