import { Bullet, Enemy, Particle } from "./types";
import { GAME_CONFIG } from "../config";

export interface PlayerState {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  frame: number;
  animCounter: number;
}

export interface GameState {
  player: PlayerState;
  bullets: Bullet[];
  enemies: Enemy[];
  particles: Particle[];
  keys: Record<string, boolean>;
  lastShotTime: number;
  leftGroupDirection: number;
  rightGroupDirection: number;
  enemyMoveTimer: number;
  enemyShootTimer: number;
  waveNumber: number;
  scoreValue: number;
  livesCount: number;
  gameOver: boolean;
  isPaused: boolean;
  enemySpeedMultiplier: number;
}

// Factory: creates a fresh initial game state
export function createInitialGameState(): GameState {
  return {
    player: {
      x: GAME_CONFIG.GAME_WIDTH / 2 - GAME_CONFIG.PLAYER_SIZE / 2,
      y: 500,
      width: GAME_CONFIG.PLAYER_SIZE,
      height: GAME_CONFIG.PLAYER_SIZE,
      speed: GAME_CONFIG.PLAYER_SPEED,
      frame: 0,
      animCounter: 0,
    },
    bullets: [],
    enemies: [],
    particles: [],
    keys: {},
    lastShotTime: 0,
    leftGroupDirection: 1,
    rightGroupDirection: -1,
    enemyMoveTimer: 0,
    enemyShootTimer: 0,
    waveNumber: 1,
    scoreValue: 0,
    livesCount: GAME_CONFIG.PLAYER_LIVES,
    gameOver: false,
    isPaused: false,
    enemySpeedMultiplier: 1.0,
  };
}

// Resets an existing state object in-place for a new game
export function resetGameState(state: GameState): void {
  state.scoreValue = 0;
  state.waveNumber = 1;
  state.livesCount = GAME_CONFIG.PLAYER_LIVES;
  state.gameOver = false;
  state.bullets = [];
  state.particles = [];
  state.player.x = GAME_CONFIG.GAME_WIDTH / 2 - GAME_CONFIG.PLAYER_SIZE / 2;
  state.player.y = 500;
  state.player.frame = 0;
  state.player.animCounter = 0;
  state.leftGroupDirection = 1;
  state.rightGroupDirection = -1;
  state.isPaused = false;
  state.enemyMoveTimer = 0;
  state.enemyShootTimer = 0;
  state.lastShotTime = 0;
  state.enemySpeedMultiplier = 1.0;
}
