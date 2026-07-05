// Shared game types used by both game-room and binary-protocol

export interface PlayerState {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  lives: number;
  score: number;
  shootCooldown: number;
  invincible: number;
  frame: number;
  animCounter: number;
}

export interface Bullet {
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  isPlayerBullet: boolean;
  ownerId: string;
}

export interface Enemy {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  frame: number;
  group: 'left' | 'right';
}

export interface GameSnapshot {
  players: PlayerState[];
  enemies: Enemy[];
  bullets: Bullet[];
  wave: number;
  status: 'waiting' | 'playing' | 'gameover';
  message?: string;
}
