import { Enemy } from "./types";
import { GAME_CONFIG } from "../config";

// Spawns enemies in two groups (left & right) based on the wave number
export function spawnEnemies(waveNum: number): {
  enemies: Enemy[];
  speedMultiplier: number;
} {
  const totalEnemies = Math.min(
    GAME_CONFIG.WAVE_INITIAL_ENEMIES + (waveNum - 1) * GAME_CONFIG.WAVE_ENEMIES_GROWTH_PER_LEVEL,
    GAME_CONFIG.WAVE_MAX_ENEMIES
  );
  const half = Math.floor(totalEnemies / 2);
  const colsHalf = Math.ceil(half / 2); // grid columns per group
  const spacingX = GAME_CONFIG.ENEMY_SPACING_X;
  const spacingY = GAME_CONFIG.ENEMY_SPACING_Y;

  const newEnemies: Enemy[] = [];

  // Left group (starts left, moves right)
  const startXLeft = GAME_CONFIG.ENEMY_SPAWN_LEFT_MARGIN;
  for (let i = 0; i < half; i++) {
    const row = Math.floor(i / colsHalf);
    const col = i % colsHalf;
    newEnemies.push({
      x: startXLeft + col * spacingX,
      y: GAME_CONFIG.ENEMY_SPAWN_TOP_MARGIN + row * spacingY,
      width: GAME_CONFIG.ENEMY_SIZE,
      height: GAME_CONFIG.ENEMY_SIZE,
      frame: Math.floor(Math.random() * 3),
      group: "left",
    });
  }

  // Right group (starts right, moves left)
  const startXRight = GAME_CONFIG.GAME_WIDTH - GAME_CONFIG.ENEMY_SPAWN_RIGHT_MARGIN - GAME_CONFIG.ENEMY_SIZE;
  for (let i = 0; i < half; i++) {
    const row = Math.floor(i / colsHalf);
    const col = i % colsHalf;
    newEnemies.push({
      x: startXRight - col * spacingX,
      y: GAME_CONFIG.ENEMY_SPAWN_TOP_MARGIN + row * spacingY,
      width: GAME_CONFIG.ENEMY_SIZE,
      height: GAME_CONFIG.ENEMY_SIZE,
      frame: Math.floor(Math.random() * 3),
      group: "right",
    });
  }

  const speedMultiplier = 1.0 + (waveNum - 1) * GAME_CONFIG.ENEMY_SPEED_WAVE_GROWTH;

  return { enemies: newEnemies, speedMultiplier };
}
