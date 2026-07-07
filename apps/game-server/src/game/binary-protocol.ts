// Binary protocol for game data using ArrayBuffer
// All numbers are little-endian

import { GameSnapshot, PlayerState, Enemy, Bullet } from './types';

// ── Input (Client → Server): 3 bytes ──

export enum InputType {
  MOVE = 0,
  SHOOT = 1,
}

export function encodeInput(type: InputType, direction: number, playerIndex: number): ArrayBuffer {
  const buf = new ArrayBuffer(3);
  const v = new DataView(buf);
  v.setUint8(0, type);
  v.setInt8(1, direction);
  v.setUint8(2, playerIndex);
  return buf;
}

export function decodeInput(buf: ArrayBuffer): { type: InputType; direction: number; playerIndex: number } {
  const v = new DataView(buf);
  return {
    type: v.getUint8(0) as InputType,
    direction: v.getInt8(1),
    playerIndex: v.getUint8(2),
  };
}

// ── Snapshot (Server → Client) ──
//
// Header (6B) | Players (11B each) | Enemies (9B each) | Bullets (12B each)
//   wave:u8 status:u8 playerCount:u16 enemyCount:u16

const HDR = 6;
const REC_P = 16;
const REC_E = 11;
const REC_B = 12;

const STATUS_MAP: Record<string, number> = { waiting: 0, playing: 1, gameover: 2 };
const STATUS_INV: Array<'waiting' | 'playing' | 'gameover'> = ['waiting', 'playing', 'gameover'];

const DIR_MAP: Record<string, number> = { UP: 0, RIGHT: 1, DOWN: 2, LEFT: 3 };
const DIR_INV = ['UP', 'RIGHT', 'DOWN', 'LEFT'] as const;

// ── ID mapping ──

let _pMap = new Map<string, number>();
let _pRev = new Map<number, string>();

export function setPlayerIdMapping(players: Array<{ id: string; index: number }>) {
  _pMap.clear();
  _pRev.clear();
  for (const p of players) {
    _pMap.set(p.id, p.index);
    _pRev.set(p.index, p.id);
  }
}

function pIdx(id: string): number { return _pMap.get(id) ?? 0; }
function pId(idx: number, fallback: string): string { return _pRev.get(idx) ?? fallback; }
function ownerIdx(id: string): number { return id === 'enemy' ? 255 : pIdx(id); }
function ownerStr(idx: number, fallback: string): string { return idx === 255 ? 'enemy' : pId(idx, fallback); }

function enemyNum(id: string): number {
  const p = id.split('-');
  return p.length >= 3 ? (parseInt(p[1]) || 0) * 100 + (parseInt(p[2]) || 0) : 0;
}

// ── Encode ──

export function encodeSnapshot(snap: GameSnapshot): ArrayBuffer {
  const { players, enemies, bullets, wave, status } = snap;
  const size = HDR + players.length * REC_P + enemies.length * REC_E + bullets.length * REC_B;
  const buf = new ArrayBuffer(size);
  const v = new DataView(buf);
  let o = 0;

  // Header
  v.setUint8(o, wave); o++;
  v.setUint8(o, STATUS_MAP[status] ?? 0); o++;
  v.setUint16(o, players.length, true); o += 2;
  v.setUint16(o, enemies.length, true); o += 2;

  // Players
  for (const p of players) {
    v.setUint8(o, pIdx(p.id)); o++;
    v.setFloat32(o, p.x, true); o += 4;
    v.setFloat32(o, p.y, true); o += 4;
    v.setUint8(o, p.lives); o++;
    v.setUint32(o, p.score, true); o += 4;
    v.setUint8(o, p.frame); o++;
    v.setUint8(o, DIR_MAP[p.direction ?? 'UP'] ?? 0); o++;
  }

  // Enemies
  for (const e of enemies) {
    v.setUint16(o, enemyNum(e.id), true); o += 2;
    v.setFloat32(o, e.x, true); o += 4;
    v.setFloat32(o, e.y, true); o += 4;
    v.setUint8(o, e.frame); o++;
  }

  // Bullets
  for (const b of bullets) {
    v.setFloat32(o, b.x, true); o += 4;
    v.setFloat32(o, b.y, true); o += 4;
    v.setInt8(o, Math.round(b.vx * 10)); o++;
    v.setInt8(o, Math.round(b.vy * 10)); o++;
    v.setUint8(o, b.isPlayerBullet ? 1 : 0); o++;
    v.setUint8(o, ownerIdx(b.ownerId)); o++;
  }

  return buf;
}

// ── Decode ──

export function decodeSnapshot(
  buf: ArrayBuffer,
  myId: string,
  names: Map<number, string>,
): GameSnapshot {
  const v = new DataView(buf);
  let o = 0;

  const wave = v.getUint8(o); o++;
  const status = STATUS_INV[v.getUint8(o)] ?? 'waiting'; o++;
  const pCount = v.getUint16(o, true); o += 2;
  const eCount = v.getUint16(o, true); o += 2;

  const players: PlayerState[] = [];
  for (let i = 0; i < pCount; i++) {
    const idx = v.getUint8(o); o++;
    const x = v.getFloat32(o, true); o += 4;
    const y = v.getFloat32(o, true); o += 4;
    const lives = v.getUint8(o); o++;
    const score = v.getUint32(o, true); o += 4;
    const frame = v.getUint8(o); o++;
    const dirVal = v.getUint8(o); o++;

    players.push({
      id: pId(idx, myId),
      name: names.get(idx) ?? 'PILOTO',
      x, y,
      width: 64, height: 64,
      lives, score, frame,
      shootCooldown: 0,
      invincible: 0,
      animCounter: 0,
      direction: DIR_INV[dirVal] ?? 'UP',
    });
  }

  const enemies: Enemy[] = [];
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

  const bullets: Bullet[] = [];
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
      ownerId: ownerStr(ownerIdIdx, myId),
    });
  }

  return { players, enemies, bullets, wave, status };
}
