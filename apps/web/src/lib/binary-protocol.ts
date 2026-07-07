// Binary protocol for game data — client side
// All numbers are little-endian

export enum InputType {
  MOVE = 0,
  SHOOT = 1,
}

const STATUS_INV: Array<'waiting' | 'playing' | 'gameover'> = ['waiting', 'playing', 'gameover'];

const REC_P = 16;
const REC_E = 11;
const REC_B = 12;

const DIR_MAP_INV = ['UP', 'RIGHT', 'DOWN', 'LEFT'] as const;

interface PlayerSnapshot {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  lives: number;
  score: number;
  invincible: number;
  frame: number;
  direction?: 'UP' | 'RIGHT' | 'DOWN' | 'LEFT';
}

interface EnemySnapshot {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  frame: number;
  group: string;
}

interface BulletSnapshot {
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  isPlayerBullet: boolean;
  ownerId: string;
}

export interface GameSnapshot {
  players: PlayerSnapshot[];
  enemies: EnemySnapshot[];
  bullets: BulletSnapshot[];
  wave: number;
  status: 'waiting' | 'playing' | 'gameover';
}

// ── Encode input (client → server): 3 bytes ──

export function encodeInput(type: InputType, direction: number, playerIndex: number): ArrayBuffer {
  const buf = new ArrayBuffer(3);
  const v = new DataView(buf);
  v.setUint8(0, type);
  v.setInt8(1, direction);
  v.setUint8(2, playerIndex);
  return buf;
}

// ── Decode snapshot (server → client) ──

export function decodeSnapshot(buf: ArrayBuffer, myId: string, names: Map<number, string>): GameSnapshot {
  const v = new DataView(buf);
  let o = 0;

  const wave = v.getUint8(o); o++;
  const status = STATUS_INV[v.getUint8(o)] ?? 'waiting'; o++;
  const pCount = v.getUint16(o, true); o += 2;
  const eCount = v.getUint16(o, true); o += 2;

  const players: PlayerSnapshot[] = [];
  for (let i = 0; i < pCount; i++) {
    const idx = v.getUint8(o); o++;
    const x = v.getFloat32(o, true); o += 4;
    const y = v.getFloat32(o, true); o += 4;
    const lives = v.getUint8(o); o++;
    const score = v.getUint32(o, true); o += 4;
    const frame = v.getUint8(o); o++;
    const dirIdx = v.getUint8(o); o++;

    players.push({
      id: String(idx),
      name: names.get(idx) ?? 'PILOTO',
      x, y,
      width: 64, height: 64,
      lives, score, frame,
      invincible: 0,
      direction: DIR_MAP_INV[dirIdx] ?? 'UP',
    });
  }

  const enemies: EnemySnapshot[] = [];
  for (let i = 0; i < eCount; i++) {
    const idNum = v.getUint16(o, true); o += 2;
    const x = v.getFloat32(o, true); o += 4;
    const y = v.getFloat32(o, true); o += 4;
    const frame = v.getUint8(o); o++;

    enemies.push({
      id: `enemy-${idNum}`,
      x, y,
      width: 56, height: 56,
      frame,
      group: 'left',
    });
  }

  const bullets: BulletSnapshot[] = [];
  const bCount = Math.floor((buf.byteLength - o) / REC_B);
  for (let i = 0; i < bCount; i++) {
    const x = v.getFloat32(o, true); o += 4;
    const y = v.getFloat32(o, true); o += 4;
    const vx = v.getInt8(o) / 10; o++;
    const vy = v.getInt8(o) / 10; o++;
    const isPlayerBullet = v.getUint8(o) === 1; o++;
    const ownerIdIdx = v.getUint8(o); o++;

    bullets.push({
      x, y,
      width: 4, height: 16,
      vx, vy,
      isPlayerBullet,
      ownerId: ownerIdIdx === 255 ? 'enemy' : String(ownerIdIdx),
    });
  }

  return { players, enemies, bullets, wave, status };
}
