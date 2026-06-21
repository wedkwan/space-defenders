import { Enemy } from "./types";
import { GAME_CONFIG } from "../config";

interface MovementUpdateResult {
  leftDirection: number;
  rightDirection: number;
  enemies: Enemy[];
  gameOverTriggered: boolean;
}

export function updateEnemyMovement(
  enemies: Enemy[],
  leftDirection: number,
  rightDirection: number,
  speedMultiplier: number,
  playerY: number
): MovementUpdateResult {
  const stepLeft = 8 * leftDirection * speedMultiplier;
  const stepRight = 8 * rightDirection * speedMultiplier;

  let leftHitWall = false;
  let rightHitWall = false;
  let groupsCollided = false;
  let gameOverTriggered = false;

  // Predict next coordinates for collision checking
  const tempEnemies = enemies.map((enemy) => ({
    ...enemy,
    nextX: enemy.x + (enemy.group === "left" ? stepLeft : stepRight),
  }));

  // 1. Boundary checking
  for (const enemy of tempEnemies) {
    if (enemy.group === "left") {
      if (leftDirection === -1 && enemy.nextX < 10) {
        leftHitWall = true;
      }
      if (leftDirection === 1 && enemy.nextX > GAME_CONFIG.GAME_WIDTH - enemy.width - 10) {
        leftHitWall = true;
      }
    } else if (enemy.group === "right") {
      if (rightDirection === -1 && enemy.nextX < 10) {
        rightHitWall = true;
      }
      if (rightDirection === 1 && enemy.nextX > GAME_CONFIG.GAME_WIDTH - enemy.width - 10) {
        rightHitWall = true;
      }
    }
  }

  // 2. Collision checking between groups on similar Y levels
  for (let i = 0; i < tempEnemies.length; i++) {
    const eA = tempEnemies[i];
    if (eA.group !== "left") continue;

    for (let j = 0; j < tempEnemies.length; j++) {
      const eB = tempEnemies[j];
      if (eB.group !== "right") continue;

      const sameRow = Math.abs(eA.y - eB.y) < 15;
      if (sameRow) {
        // Left moves right, Right moves left -> check overlap
        if (eA.nextX + eA.width >= eB.nextX && eA.x < eB.x) {
          groupsCollided = true;
          break;
        }
      }
    }
    if (groupsCollided) break;
  }

  let nextLeftDir = leftDirection;
  let nextRightDir = rightDirection;
  let shiftDownLeft = false;
  let shiftDownRight = false;

  // Handle collision reactions
  if (groupsCollided) {
    nextLeftDir *= -1;
    nextRightDir *= -1;
    shiftDownLeft = true;
    shiftDownRight = true;
  } else {
    // Handle individual wall hits
    if (leftHitWall && leftDirection === -1) {
      nextLeftDir = 1;
      shiftDownLeft = true;
    } else if (leftHitWall && leftDirection === 1) {
      nextLeftDir = -1;
      shiftDownLeft = true;
    }
    if (rightHitWall && rightDirection === 1) {
      nextRightDir = -1;
      shiftDownRight = true;
    } else if (rightHitWall && rightDirection === -1) {
      nextRightDir = 1;
      shiftDownRight = true;
    }
  }

  // Map updated properties to the real enemies list
  const updatedEnemies = enemies
    .map((enemy) => {
      let newX = enemy.x;
      let newY = enemy.y;

      if (enemy.group === "left") {
        newX += 8 * nextLeftDir * speedMultiplier;
        if (shiftDownLeft) {
          newY += 24;
        }
      } else {
        newX += 8 * nextRightDir * speedMultiplier;
        if (shiftDownRight) {
          newY += 24;
        }
      }

      // Safe clamp position to prevent escaping the map boundaries
      const minX = 10;
      const maxX = GAME_CONFIG.GAME_WIDTH - enemy.width - 10;
      if (newX < minX) newX = minX;
      if (newX > maxX) newX = maxX;

      let frame = enemy.frame;
      if (Math.random() < 0.15) {
        frame = (frame + 1) % 3;
      }

      if (newY >= playerY - 10) {
        gameOverTriggered = true;
      }

      return {
        ...enemy,
        x: newX,
        y: newY,
        frame,
      };
    })
    .filter((enemy) => {
      // Delete any enemy that goes outside the defined map bounds as a fail-safe
      const isOutOfBounds =
        enemy.x < 0 ||
        enemy.x > GAME_CONFIG.GAME_WIDTH - enemy.width ||
        enemy.y < 0 ||
        enemy.y > GAME_CONFIG.GAME_HEIGHT;
      return !isOutOfBounds;
    });

  return {
    leftDirection: nextLeftDir,
    rightDirection: nextRightDir,
    enemies: updatedEnemies,
    gameOverTriggered,
  };
}
