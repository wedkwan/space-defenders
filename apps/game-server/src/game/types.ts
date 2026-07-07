// Shared game types used by both game-room and binary-protocol

export type SpawnPattern = 'FLANKING_H' | 'FLANKING_V' | 'V_FORMATION' | 'V_FORMATION_INV';

export type EnemyGroup =
  | 'left' | 'right'                       // FLANKING_H
  | 'bottom-left' | 'bottom-right'         // FLANKING_V
  | 'v-left' | 'v-right' | 'v-center'      // V_FORMATION
  | 'v-inv-left' | 'v-inv-right' | 'v-inv-center'; // V_FORMATION_INV

export type PlayerDirection = 'UP' | 'RIGHT' | 'DOWN' | 'LEFT';

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
  direction?: PlayerDirection;
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
  group: EnemyGroup;
  vy?: number;    // velocidade vertical suave (FLANKING_V, V_FORMATION)
  phase?: number; // fase do padrão (0=aproximação, 1=subida/descida, 2=separação/mergulho)
}

export interface GameSnapshot {
  players: PlayerState[];
  enemies: Enemy[];
  bullets: Bullet[];
  wave: number;
  status: 'waiting' | 'playing' | 'gameover';
  message?: string;
}
