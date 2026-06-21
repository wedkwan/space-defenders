import { Particle } from "./types";
import { GAME_CONFIG } from "../config";

interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Axis-Aligned Bounding Box (AABB) collision check
export function checkAABBCollision(rect1: Rectangle, rect2: Rectangle): boolean {
  return (
    rect1.x < rect2.x + rect2.width &&
    rect1.x + rect1.width > rect2.x &&
    rect1.y < rect2.y + rect2.height &&
    rect1.y + rect1.height > rect2.y
  );
}

// Generate explosion particles at a coordinate
export function createExplosion(
  x: number,
  y: number,
  color: string = GAME_CONFIG.PARTICLES_COLOR_ENEMY
): Particle[] {
  const pCount = GAME_CONFIG.PARTICLES_COUNT;
  const particles: Particle[] = [];
  for (let i = 0; i < pCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 4;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color,
      alpha: 1.0,
      size: 2 + Math.random() * 3,
    });
  }
  return particles;
}
