export interface Bullet {
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  isPlayerBullet: boolean;
}

export interface Enemy {
  x: number;
  y: number;
  width: number;
  height: number;
  frame: number;
  group: "left" | "right";
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  size: number;
}
