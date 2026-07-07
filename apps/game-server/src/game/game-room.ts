import { GAME_CONFIG } from './config';
import { PlayerState, Bullet, Enemy, GameSnapshot, SpawnPattern } from './types';
import { encodeSnapshot } from './binary-protocol';

export type { PlayerState, Bullet, Enemy, GameSnapshot };

const PATTERN_ROTATION: SpawnPattern[] = ['FLANKING_H', 'FLANKING_V', 'V_FORMATION', 'V_FORMATION_INV'];

export class GameRoom {
  private players: Map<string, PlayerState> = new Map();
  private playerOrder: string[] = [];
  private enemies: Enemy[] = [];
  private bullets: Bullet[] = [];
  private wave = 1;
  private status: 'waiting' | 'playing' | 'gameover' = 'waiting';
  private tickInterval: NodeJS.Timeout | null = null;
  private minPlayers = 2;

  // Shared enemy state
  private enemyMoveTimer = 0;
  private enemySpeedMultiplier = 1;
  private enemyShootTimer = 0;
  private currentPattern: SpawnPattern = 'FLANKING_H';
  private enemiesEscaped = false;

  // FLANKING_H state
  private leftGroupDirection = 1;
  private rightGroupDirection = -1;

  // FLANKING_V state
  private flankVPhase: 'approach' | 'rise' | 'separate' = 'approach';
  private flankVRiseStartY = 0;  // Y onde a subida começou
  private bottomLeftGroupDirection = 1;
  private bottomRightGroupDirection = -1;

  // V_FORMATION state
  private vFormationPhase: 'descend' | 'dive' | 'close' = 'descend';

  constructor(
    public readonly roomId: string,
    private readonly emitToRoom: (event: string, data: unknown) => void,
  ) {}

  // ── API pública ──

  addPlayer(id: string, name: string): boolean {
    if (this.players.size >= GAME_CONFIG.MAX_PLAYERS) return false;
    if (this.players.has(id)) return false;

    // Calcular posição X baseada no número de jogadores
    const playerIndex = this.players.size;
    const spacing = GAME_CONFIG.GAME_WIDTH / (GAME_CONFIG.MAX_PLAYERS + 1);
    const startX = spacing * (playerIndex + 1) - GAME_CONFIG.PLAYER_SIZE / 2;

    this.players.set(id, {
      id,
      name,
      x: startX,
      y: GAME_CONFIG.GAME_HEIGHT - GAME_CONFIG.PLAYER_SIZE - 20,
      width: GAME_CONFIG.PLAYER_SIZE,
      height: GAME_CONFIG.PLAYER_SIZE,
      lives: GAME_CONFIG.PLAYER_LIVES,
      score: 0,
      shootCooldown: 0,
      invincible: 0,
      frame: 0,
      animCounter: 0,
      direction: 'UP',
    });
    this.playerOrder.push(id);

    // Iniciar o jogo quando houver jogadores suficientes
    if (this.players.size >= this.minPlayers && this.status === 'waiting') {
      this.start();
    }

    return true;
  }

  removePlayer(id: string) {
    this.players.delete(id);
    this.playerOrder = this.playerOrder.filter(pid => pid !== id);
    if (this.players.size === 0) {
      this.stop();
    }
  }

  hasPlayer(id: string): boolean {
    return this.players.has(id);
  }

  get playerCount(): number {
    return this.players.size;
  }

  getPlayerIndex(playerId: string): number {
    return this.playerOrder.indexOf(playerId);
  }

  getPlayerName(playerId: string): string | undefined {
    return this.players.get(playerId)?.name;
  }

  getPlayerIdByIndex(index: number): string | undefined {
    return this.playerOrder[index];
  }

  setMinPlayers(min: number) {
    this.minPlayers = min;
  }

  handleInput(playerId: string, input: { type: string; direction?: number; directionX?: number; directionY?: number }) {
    const player = this.players.get(playerId);
    if (!player || this.status !== 'playing') return;
    if (player.lives <= 0) return;

    if (input.type === 'move') {
      const dx = input.directionX !== undefined ? input.directionX : (input.direction !== undefined ? input.direction : 0);
      const dy = input.directionY !== undefined ? input.directionY : 0;

      player.x += dx * GAME_CONFIG.PLAYER_SPEED;
      player.y += dy * GAME_CONFIG.PLAYER_SPEED;

      // Limites da tela
      if (player.x < 0) player.x = 0;
      if (player.x > GAME_CONFIG.GAME_WIDTH - player.width) {
        player.x = GAME_CONFIG.GAME_WIDTH - player.width;
      }
      if (player.y < 0) player.y = 0;
      if (player.y > GAME_CONFIG.GAME_HEIGHT - player.height) {
        player.y = GAME_CONFIG.GAME_HEIGHT - player.height;
      }
    }

    if (input.type === 'rotate') {
      const current = player.direction ?? 'UP';
      const rotations: Record<'UP' | 'RIGHT' | 'DOWN' | 'LEFT', 'UP' | 'RIGHT' | 'DOWN' | 'LEFT'> = {
        UP: 'RIGHT',
        RIGHT: 'DOWN',
        DOWN: 'LEFT',
        LEFT: 'UP'
      };
      player.direction = rotations[current];
    }

    if (input.type === 'shoot') {
      if (player.shootCooldown <= 0) {
        const dir = player.direction ?? 'UP';
        let bulletVx = 0;
        let bulletVy = 0;
        let bulletX = player.x + player.width / 2 - 2;
        let bulletY = player.y + player.height / 2 - 8;

        if (dir === 'UP') {
          bulletVy = -GAME_CONFIG.PLAYER_BULLET_SPEED;
          bulletY = player.y - 12;
        } else if (dir === 'DOWN') {
          bulletVy = GAME_CONFIG.PLAYER_BULLET_SPEED;
          bulletY = player.y + player.height + 4;
        } else if (dir === 'LEFT') {
          bulletVx = -GAME_CONFIG.PLAYER_BULLET_SPEED;
          bulletX = player.x - 12;
        } else if (dir === 'RIGHT') {
          bulletVx = GAME_CONFIG.PLAYER_BULLET_SPEED;
          bulletX = player.x + player.width + 4;
        }

        this.bullets.push({
          x: bulletX,
          y: bulletY,
          width: dir === 'LEFT' || dir === 'RIGHT' ? 16 : 4,
          height: dir === 'LEFT' || dir === 'RIGHT' ? 4 : 16,
          vx: bulletVx,
          vy: bulletVy,
          isPlayerBullet: true,
          ownerId: playerId,
        });
        player.shootCooldown = GAME_CONFIG.PLAYER_SHOOT_COOLDOWN;
      }
    }
  }

  getSnapshot(): GameSnapshot {
    return {
      players: Array.from(this.players.values()),
      enemies: this.enemies,
      bullets: this.bullets,
      wave: this.wave,
      status: this.status,
    };
  }

  // ── Controle do loop ──

  private start() {
    this.status = 'playing';
    this.wave = 1;
    this.spawnWave();
    this.tickInterval = setInterval(() => this.tick(), GAME_CONFIG.TICK_INTERVAL_MS);
  }

  stop() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    this.status = 'waiting';
    this.enemies = [];
    this.bullets = [];
    this.wave = 1;
  }

  // ── Game Tick (60Hz) ──

  private tick() {
    if (this.status !== 'playing') return;

    // 1. Atualizar cooldowns e frames dos jogadores
    for (const player of this.players.values()) {
      if (player.shootCooldown > 0) player.shootCooldown--;
      if (player.invincible > 0) player.invincible--;

      player.animCounter++;
      if (player.animCounter >= 8) {
        player.frame = player.frame === 0 ? 1 : 0;
        player.animCounter = 0;
      }
    }

    // 2. Mover inimigos
    this.updateEnemyMovement();

    // 2.1. Verificar se algum inimigo saiu da tela
    if (this.enemiesEscaped) {
      this.status = 'gameover';
      this.broadcastSnapshot();
      this.stop();
      return;
    }

    // 3. Tiros inimigos
    this.handleEnemyShooting();

    // 4. Mover balas
    this.bullets = this.bullets.filter((b) => {
      b.x += b.vx;
      b.y += b.vy;
      return (
        b.y > -20 &&
        b.y < GAME_CONFIG.GAME_HEIGHT + 20 &&
        b.x > -20 &&
        b.x < GAME_CONFIG.GAME_WIDTH + 20
      );
    });

    // 5. Colisões
    this.processCollisions();

    // 6. Verificar fim de wave
    if (this.enemies.length === 0) {
      this.wave++;
      this.spawnWave();
    }

    // 7. Verificar game over (todos os jogadores sem vidas)
    const allDead = Array.from(this.players.values()).every((p) => p.lives <= 0);
    if (allDead && this.players.size > 0) {
      this.status = 'gameover';
      this.broadcastSnapshot();
      this.stop();
      return;
    }

    // 8. Enviar snapshot para todos
    this.broadcastSnapshot();
  }

  // ── Spawner ──

  private spawnWave() {
    this.enemies = [];
    this.enemyMoveTimer = 0;
    this.enemiesEscaped = false;
    this.enemySpeedMultiplier = 1 + (this.wave - 1) * GAME_CONFIG.ENEMY_SPEED_WAVE_GROWTH;

    // Selecionar padrão ciclicamente
    this.currentPattern = PATTERN_ROTATION[(this.wave - 1) % PATTERN_ROTATION.length];

    switch (this.currentPattern) {
      case 'FLANKING_H':
        this.spawnFlankingH();
        break;
      case 'FLANKING_V':
        this.spawnFlankingV();
        break;
      case 'V_FORMATION':
        this.spawnVFormation();
        break;
      case 'V_FORMATION_INV':
        this.spawnVFormationInv();
        break;
    }
  }

  // ── Spawn: FLANKING_H (Padrão 1 — horizontal) ──

  private spawnFlankingH() {
    const count = Math.min(
      GAME_CONFIG.WAVE_INITIAL_ENEMIES + (this.wave - 1) * GAME_CONFIG.WAVE_ENEMIES_GROWTH_PER_LEVEL,
      GAME_CONFIG.WAVE_MAX_ENEMIES,
    );

    const half = Math.floor(count / 2);
    const colsHalf = Math.ceil(half / 2);
    const spacingX = GAME_CONFIG.ENEMY_SPACING_X;
    const spacingY = GAME_CONFIG.ENEMY_SPACING_Y;

    let enemyIdCounter = 0;

    // Left group (starts left, moves right)
    const startXLeft = GAME_CONFIG.ENEMY_SPAWN_LEFT_MARGIN;
    for (let i = 0; i < half; i++) {
      const row = Math.floor(i / colsHalf);
      const col = i % colsHalf;
      this.enemies.push({
        id: `enemy-${this.wave}-${enemyIdCounter++}`,
        x: startXLeft + col * spacingX,
        y: GAME_CONFIG.ENEMY_SPAWN_TOP_MARGIN + row * spacingY,
        width: GAME_CONFIG.ENEMY_SIZE,
        height: GAME_CONFIG.ENEMY_SIZE,
        frame: Math.floor(Math.random() * 3),
        group: 'left',
      });
    }

    // Right group (starts right, moves left)
    const startXRight = GAME_CONFIG.GAME_WIDTH - GAME_CONFIG.ENEMY_SPAWN_RIGHT_MARGIN - GAME_CONFIG.ENEMY_SIZE;
    for (let i = 0; i < half; i++) {
      const row = Math.floor(i / colsHalf);
      const col = i % colsHalf;
      this.enemies.push({
        id: `enemy-${this.wave}-${enemyIdCounter++}`,
        x: startXRight - col * spacingX,
        y: GAME_CONFIG.ENEMY_SPAWN_TOP_MARGIN + row * spacingY,
        width: GAME_CONFIG.ENEMY_SIZE,
        height: GAME_CONFIG.ENEMY_SIZE,
        frame: Math.floor(Math.random() * 3),
        group: 'right',
      });
    }

    this.leftGroupDirection = 1;
    this.rightGroupDirection = -1;
  }

  // ── Spawn: FLANKING_V (Padrão 2 — vertical) ──

  private spawnFlankingV() {
    const count = Math.min(
      GAME_CONFIG.WAVE_INITIAL_ENEMIES + (this.wave - 1) * GAME_CONFIG.WAVE_ENEMIES_GROWTH_PER_LEVEL,
      GAME_CONFIG.WAVE_MAX_ENEMIES,
    );

    const half = Math.floor(count / 2);
    const colsHalf = Math.ceil(half / 2);
    const spacingX = GAME_CONFIG.ENEMY_SPACING_X;
    const spacingY = GAME_CONFIG.ENEMY_SPACING_Y;

    // Espelho do FLANKING_H: em vez de spawnar no topo (ENEMY_SPAWN_TOP_MARGIN),
    // spawna na base da tela visível, com linhas subindo
    const baseY = GAME_CONFIG.GAME_HEIGHT - GAME_CONFIG.ENEMY_SPAWN_TOP_MARGIN - GAME_CONFIG.ENEMY_SIZE;

    let enemyIdCounter = 0;

    // Bottom-left group
    const startXLeft = GAME_CONFIG.ENEMY_SPAWN_LEFT_MARGIN;
    for (let i = 0; i < half; i++) {
      const row = Math.floor(i / colsHalf);
      const col = i % colsHalf;
      this.enemies.push({
        id: `enemy-${this.wave}-${enemyIdCounter++}`,
        x: startXLeft + col * spacingX,
        y: baseY - row * spacingY,
        width: GAME_CONFIG.ENEMY_SIZE,
        height: GAME_CONFIG.ENEMY_SIZE,
        frame: Math.floor(Math.random() * 3),
        group: 'bottom-left',
        phase: 0,
      });
    }

    // Bottom-right group
    const startXRight = GAME_CONFIG.GAME_WIDTH - GAME_CONFIG.ENEMY_SPAWN_RIGHT_MARGIN - GAME_CONFIG.ENEMY_SIZE;
    for (let i = 0; i < half; i++) {
      const row = Math.floor(i / colsHalf);
      const col = i % colsHalf;
      this.enemies.push({
        id: `enemy-${this.wave}-${enemyIdCounter++}`,
        x: startXRight - col * spacingX,
        y: baseY - row * spacingY,
        width: GAME_CONFIG.ENEMY_SIZE,
        height: GAME_CONFIG.ENEMY_SIZE,
        frame: Math.floor(Math.random() * 3),
        group: 'bottom-right',
        phase: 0,
      });
    }

    // Mover o player para cima para evitar nascer em cima dos inimigos
    for (const player of this.players.values()) {
      if (player.lives > 0) {
        player.y = GAME_CONFIG.GAME_HEIGHT / 2 - GAME_CONFIG.PLAYER_SIZE;
      }
    }

    this.bottomLeftGroupDirection = 1;
    this.bottomRightGroupDirection = -1;
  }

  // ── Spawn: V_FORMATION (Padrão 3 — formação em V) ──

  private spawnVFormation() {
    const count = Math.min(
      GAME_CONFIG.WAVE_INITIAL_ENEMIES + (this.wave - 1) * GAME_CONFIG.WAVE_ENEMIES_GROWTH_PER_LEVEL,
      GAME_CONFIG.WAVE_MAX_ENEMIES,
    );

    // Garantir número ímpar para ter vértice central
    const total = count % 2 === 0 ? count + 1 : count;
    const centerX = GAME_CONFIG.GAME_WIDTH / 2;
    const angleRad = (GAME_CONFIG.V_FORMATION_ANGLE * Math.PI) / 180;
    const spacing = GAME_CONFIG.V_FORMATION_SPACING;
    const spawnTopY = -GAME_CONFIG.FLANKING_V_SPAWN_OFFSET; // acima da tela

    let enemyIdCounter = 0;
    const halfSide = Math.floor(total / 2);

    // Vértice do V (centro, ponto mais abaixo)
    this.enemies.push({
      id: `enemy-${this.wave}-${enemyIdCounter++}`,
      x: centerX - GAME_CONFIG.ENEMY_SIZE / 2,
      y: spawnTopY,
      width: GAME_CONFIG.ENEMY_SIZE,
      height: GAME_CONFIG.ENEMY_SIZE,
      frame: Math.floor(Math.random() * 3),
      group: 'v-center',
      phase: 0,
    });

    // Braço esquerdo do V (sobe e vai para esquerda)
    for (let i = 1; i <= halfSide; i++) {
      const offsetX = i * spacing * Math.sin(angleRad);
      const offsetY = i * spacing * Math.cos(angleRad);
      this.enemies.push({
        id: `enemy-${this.wave}-${enemyIdCounter++}`,
        x: centerX - GAME_CONFIG.ENEMY_SIZE / 2 - offsetX,
        y: spawnTopY - offsetY,
        width: GAME_CONFIG.ENEMY_SIZE,
        height: GAME_CONFIG.ENEMY_SIZE,
        frame: Math.floor(Math.random() * 3),
        group: 'v-left',
        phase: 0,
      });
    }

    // Braço direito do V (sobe e vai para direita)
    for (let i = 1; i <= halfSide; i++) {
      const offsetX = i * spacing * Math.sin(angleRad);
      const offsetY = i * spacing * Math.cos(angleRad);
      this.enemies.push({
        id: `enemy-${this.wave}-${enemyIdCounter++}`,
        x: centerX - GAME_CONFIG.ENEMY_SIZE / 2 + offsetX,
        y: spawnTopY - offsetY,
        width: GAME_CONFIG.ENEMY_SIZE,
        height: GAME_CONFIG.ENEMY_SIZE,
        frame: Math.floor(Math.random() * 3),
        group: 'v-right',
        phase: 0,
      });
    }

    this.vFormationPhase = 'descend';
  }

  // ── Spawn: V_FORMATION_INV (Padrão 4 — formação em V invertida) ──

  private spawnVFormationInv() {
    const count = Math.min(
      GAME_CONFIG.WAVE_INITIAL_ENEMIES + (this.wave - 1) * GAME_CONFIG.WAVE_ENEMIES_GROWTH_PER_LEVEL,
      GAME_CONFIG.WAVE_MAX_ENEMIES,
    );

    const total = count % 2 === 0 ? count + 1 : count;
    const centerX = GAME_CONFIG.GAME_WIDTH / 2;
    const angleRad = (GAME_CONFIG.V_FORMATION_ANGLE * Math.PI) / 180;
    const spacing = GAME_CONFIG.V_FORMATION_SPACING;
    const spawnBottomY = GAME_CONFIG.GAME_HEIGHT + GAME_CONFIG.FLANKING_V_SPAWN_OFFSET;

    let enemyIdCounter = 0;
    const halfSide = Math.floor(total / 2);

    // Vértice do V invertido (ponto mais acima no spawn, ou seja, menor Y do grupo)
    this.enemies.push({
      id: `enemy-${this.wave}-${enemyIdCounter++}`,
      x: centerX - GAME_CONFIG.ENEMY_SIZE / 2,
      y: spawnBottomY,
      width: GAME_CONFIG.ENEMY_SIZE,
      height: GAME_CONFIG.ENEMY_SIZE,
      frame: Math.floor(Math.random() * 3),
      group: 'v-inv-center',
      phase: 0,
    });

    // Braço esquerdo do V invertido (desce Y e vai para esquerda)
    for (let i = 1; i <= halfSide; i++) {
      const offsetX = i * spacing * Math.sin(angleRad);
      const offsetY = i * spacing * Math.cos(angleRad);
      this.enemies.push({
        id: `enemy-${this.wave}-${enemyIdCounter++}`,
        x: centerX - GAME_CONFIG.ENEMY_SIZE / 2 - offsetX,
        y: spawnBottomY + offsetY,
        width: GAME_CONFIG.ENEMY_SIZE,
        height: GAME_CONFIG.ENEMY_SIZE,
        frame: Math.floor(Math.random() * 3),
        group: 'v-inv-left',
        phase: 0,
      });
    }

    // Braço direito do V invertido (desce Y e vai para direita)
    for (let i = 1; i <= halfSide; i++) {
      const offsetX = i * spacing * Math.sin(angleRad);
      const offsetY = i * spacing * Math.cos(angleRad);
      this.enemies.push({
        id: `enemy-${this.wave}-${enemyIdCounter++}`,
        x: centerX - GAME_CONFIG.ENEMY_SIZE / 2 + offsetX,
        y: spawnBottomY + offsetY,
        width: GAME_CONFIG.ENEMY_SIZE,
        height: GAME_CONFIG.ENEMY_SIZE,
        frame: Math.floor(Math.random() * 3),
        group: 'v-inv-right',
        phase: 0,
      });
    }

    // Reposiciona jogadores no meio da tela
    for (const player of this.players.values()) {
      if (player.lives > 0) {
        player.y = GAME_CONFIG.GAME_HEIGHT / 2 - GAME_CONFIG.PLAYER_SIZE;
      }
    }

    this.vFormationPhase = 'descend'; // Reutilizaremos a variável de fase, mas para subida
  }

  // ── Movimentação de Inimigos (delegador) ──

  private updateEnemyMovement() {
    switch (this.currentPattern) {
      case 'FLANKING_H':
        this.updateFlankingH();
        break;
      case 'FLANKING_V':
        this.updateFlankingV();
        break;
      case 'V_FORMATION':
        this.updateVFormation();
        break;
      case 'V_FORMATION_INV':
        this.updateVFormationInv();
        break;
    }
  }

  // ── Helpers compartilhados ──

  private getMinPlayerY(): number {
    let minPlayerY = GAME_CONFIG.GAME_HEIGHT - GAME_CONFIG.PLAYER_SIZE - 20;
    for (const p of this.players.values()) {
      if (p.lives > 0 && p.y < minPlayerY) {
        minPlayerY = p.y;
      }
    }
    return minPlayerY;
  }

  private triggerGameOver() {
    for (const player of this.players.values()) {
      player.lives = 0;
    }
  }

  private animateFrame(enemy: Enemy): number {
    if (Math.random() < 0.15) {
      return (enemy.frame + 1) % 3;
    }
    return enemy.frame;
  }

  // ── Movimento: FLANKING_H (Padrão 1) ──

  private updateFlankingH() {
    this.enemyMoveTimer++;
    const baseMoveInterval = Math.max(10, GAME_CONFIG.ENEMY_BASE_MOVE_INTERVAL - (this.wave - 1) * 3);
    const liveMoveInterval = Math.max(
      GAME_CONFIG.ENEMY_MIN_MOVE_INTERVAL,
      Math.floor((baseMoveInterval * (this.enemies.length + 3)) / 10),
    );

    if (this.enemyMoveTimer < liveMoveInterval) return;
    this.enemyMoveTimer = 0;

    const stepLeft = 8 * this.leftGroupDirection * this.enemySpeedMultiplier;
    const stepRight = 8 * this.rightGroupDirection * this.enemySpeedMultiplier;

    let leftHitWall = false;
    let rightHitWall = false;
    let groupsCollided = false;

    const tempEnemies = this.enemies.map((enemy) => ({
      ...enemy,
      nextX: enemy.x + (enemy.group === 'left' ? stepLeft : stepRight),
    }));

    // 1. Verificação de limites
    for (const enemy of tempEnemies) {
      if (enemy.group === 'left') {
        if (this.leftGroupDirection === -1 && enemy.nextX < 10) leftHitWall = true;
        if (this.leftGroupDirection === 1 && enemy.nextX > GAME_CONFIG.GAME_WIDTH - enemy.width - 10) leftHitWall = true;
      } else if (enemy.group === 'right') {
        if (this.rightGroupDirection === -1 && enemy.nextX < 10) rightHitWall = true;
        if (this.rightGroupDirection === 1 && enemy.nextX > GAME_CONFIG.GAME_WIDTH - enemy.width - 10) rightHitWall = true;
      }
    }

    // 2. Verificação de colisão entre grupos
    for (let i = 0; i < tempEnemies.length; i++) {
      const eA = tempEnemies[i];
      if (eA.group !== 'left') continue;
      for (let j = 0; j < tempEnemies.length; j++) {
        const eB = tempEnemies[j];
        if (eB.group !== 'right') continue;
        const sameRow = Math.abs(eA.y - eB.y) < 15;
        if (sameRow && eA.nextX + eA.width >= eB.nextX && eA.x < eB.x) {
          groupsCollided = true;
          break;
        }
      }
      if (groupsCollided) break;
    }

    let nextLeftDir = this.leftGroupDirection;
    let nextRightDir = this.rightGroupDirection;
    let shiftDownLeft = false;
    let shiftDownRight = false;

    if (groupsCollided) {
      nextLeftDir *= -1;
      nextRightDir *= -1;
      shiftDownLeft = true;
      shiftDownRight = true;
    } else {
      if (leftHitWall && this.leftGroupDirection === -1) { nextLeftDir = 1; shiftDownLeft = true; }
      else if (leftHitWall && this.leftGroupDirection === 1) { nextLeftDir = -1; shiftDownLeft = true; }
      if (rightHitWall && this.rightGroupDirection === 1) { nextRightDir = -1; shiftDownRight = true; }
      else if (rightHitWall && this.rightGroupDirection === -1) { nextRightDir = 1; shiftDownRight = true; }
    }

    this.leftGroupDirection = nextLeftDir;
    this.rightGroupDirection = nextRightDir;

    this.enemies = this.enemies
      .map((enemy) => {
        let newX = enemy.x;
        let newY = enemy.y;

        if (enemy.group === 'left') {
          newX += 8 * this.leftGroupDirection * this.enemySpeedMultiplier;
          if (shiftDownLeft) newY += 24;
        } else {
          newX += 8 * this.rightGroupDirection * this.enemySpeedMultiplier;
          if (shiftDownRight) newY += 24;
        }

        const minX = 10;
        const maxX = GAME_CONFIG.GAME_WIDTH - enemy.width - 10;
        if (newX < minX) newX = minX;
        if (newX > maxX) newX = maxX;

        // Verificar se saiu da tela
        if (newY > GAME_CONFIG.GAME_HEIGHT) {
          this.enemiesEscaped = true;
        }

        return {
          ...enemy,
          x: newX,
          y: newY,
          frame: this.animateFrame(enemy),
        };
      });
  }

  // ── Movimento: FLANKING_V (Padrão 2 — vertical) ──

  private updateFlankingV() {
    this.enemyMoveTimer++;
    const baseMoveInterval = Math.max(10, GAME_CONFIG.ENEMY_BASE_MOVE_INTERVAL - (this.wave - 1) * 3);
    const liveMoveInterval = Math.max(
      GAME_CONFIG.ENEMY_MIN_MOVE_INTERVAL,
      Math.floor((baseMoveInterval * (this.enemies.length + 3)) / 10),
    );

    if (this.enemyMoveTimer < liveMoveInterval) return;
    this.enemyMoveTimer = 0;

    const stepLeft = 8 * this.bottomLeftGroupDirection * this.enemySpeedMultiplier;
    const stepRight = 8 * this.bottomRightGroupDirection * this.enemySpeedMultiplier;

    let leftHitWall = false;
    let rightHitWall = false;
    let groupsCollided = false;

    const tempEnemies = this.enemies.map((enemy) => ({
      ...enemy,
      nextX: enemy.x + (enemy.group === 'bottom-left' ? stepLeft : stepRight),
    }));

    // 1. Verificação de limites
    for (const enemy of tempEnemies) {
      if (enemy.group === 'bottom-left') {
        if (this.bottomLeftGroupDirection === -1 && enemy.nextX < 10) leftHitWall = true;
        if (this.bottomLeftGroupDirection === 1 && enemy.nextX > GAME_CONFIG.GAME_WIDTH - enemy.width - 10) leftHitWall = true;
      } else if (enemy.group === 'bottom-right') {
        if (this.bottomRightGroupDirection === -1 && enemy.nextX < 10) rightHitWall = true;
        if (this.bottomRightGroupDirection === 1 && enemy.nextX > GAME_CONFIG.GAME_WIDTH - enemy.width - 10) rightHitWall = true;
      }
    }

    // 2. Verificação de colisão entre grupos
    for (let i = 0; i < tempEnemies.length; i++) {
      const eA = tempEnemies[i];
      if (eA.group !== 'bottom-left') continue;
      for (let j = 0; j < tempEnemies.length; j++) {
        const eB = tempEnemies[j];
        if (eB.group !== 'bottom-right') continue;
        const sameRow = Math.abs(eA.y - eB.y) < 15;
        if (sameRow && eA.nextX + eA.width >= eB.nextX && eA.x < eB.x) {
          groupsCollided = true;
          break;
        }
      }
      if (groupsCollided) break;
    }

    let nextLeftDir = this.bottomLeftGroupDirection;
    let nextRightDir = this.bottomRightGroupDirection;
    let shiftUpLeft = false;
    let shiftUpRight = false;

    if (groupsCollided) {
      nextLeftDir *= -1;
      nextRightDir *= -1;
      shiftUpLeft = true;
      shiftUpRight = true;
    } else {
      if (leftHitWall && this.bottomLeftGroupDirection === -1) { nextLeftDir = 1; shiftUpLeft = true; }
      else if (leftHitWall && this.bottomLeftGroupDirection === 1) { nextLeftDir = -1; shiftUpLeft = true; }
      if (rightHitWall && this.bottomRightGroupDirection === 1) { nextRightDir = -1; shiftUpRight = true; }
      else if (rightHitWall && this.bottomRightGroupDirection === -1) { nextRightDir = 1; shiftUpRight = true; }
    }

    this.bottomLeftGroupDirection = nextLeftDir;
    this.bottomRightGroupDirection = nextRightDir;

    this.enemies = this.enemies
      .map((enemy) => {
        let newX = enemy.x;
        let newY = enemy.y;

        if (enemy.group === 'bottom-left') {
          newX += 8 * this.bottomLeftGroupDirection * this.enemySpeedMultiplier;
          if (shiftUpLeft) newY -= 24;
        } else {
          newX += 8 * this.bottomRightGroupDirection * this.enemySpeedMultiplier;
          if (shiftUpRight) newY -= 24;
        }

        const minX = 10;
        const maxX = GAME_CONFIG.GAME_WIDTH - enemy.width - 10;
        if (newX < minX) newX = minX;
        if (newX > maxX) newX = maxX;

        // Verificar se saiu da tela (FLANKING_V sobe, então checa topo)
        if (newY + enemy.height < 0) {
          this.enemiesEscaped = true;
        }

        return {
          ...enemy,
          x: newX,
          y: newY,
          frame: this.animateFrame(enemy),
        };
      });
  }

  // ── Movimento: V_FORMATION (Padrão 3 — formação em V) ──

  private updateVFormation() {
    const descentSpeed = GAME_CONFIG.V_FORMATION_DESCENT_SPEED * this.enemySpeedMultiplier;

    this.enemies = this.enemies
      .map((enemy) => {
        let newX = enemy.x;
        let newY = enemy.y + descentSpeed;

        // Clamp X
        const minX = 0;
        const maxX = GAME_CONFIG.GAME_WIDTH - enemy.width;
        if (newX < minX) newX = minX;
        if (newX > maxX) newX = maxX;

        // Verificar se saiu da tela por baixo
        if (newY > GAME_CONFIG.GAME_HEIGHT) {
          this.enemiesEscaped = true;
        }

        return {
          ...enemy,
          x: newX,
          y: newY,
          frame: this.animateFrame(enemy),
        };
      });
  }

  // ── Movimento: V_FORMATION_INV (Padrão 4 — formação em V invertida) ──

  private updateVFormationInv() {
    const ascentSpeed = GAME_CONFIG.V_FORMATION_DESCENT_SPEED * this.enemySpeedMultiplier;

    this.enemies = this.enemies
      .map((enemy) => {
        let newX = enemy.x;
        let newY = enemy.y - ascentSpeed;

        // Clamp X
        const minX = 0;
        const maxX = GAME_CONFIG.GAME_WIDTH - enemy.width;
        if (newX < minX) newX = minX;
        if (newX > maxX) newX = maxX;

        // Verificar se saiu da tela por cima
        if (newY + enemy.height < 0) {
          this.enemiesEscaped = true;
        }

        return {
          ...enemy,
          x: newX,
          y: newY,
          frame: this.animateFrame(enemy),
        };
      });
  }

  // ── Tiros Inimigos ──

  private handleEnemyShooting() {
    this.enemyShootTimer++;
    const cooldown = Math.max(
      GAME_CONFIG.ENEMY_SHOOT_COOLDOWN_MIN,
      GAME_CONFIG.ENEMY_SHOOT_COOLDOWN_BASE - this.wave * GAME_CONFIG.ENEMY_SHOOT_COOLDOWN_WAVE_DECREASE,
    );

    if (this.enemyShootTimer < cooldown || this.enemies.length === 0) return;
    this.enemyShootTimer = 0;

    const shooter = this.enemies[Math.floor(Math.random() * this.enemies.length)];
    const bulletSpeed = GAME_CONFIG.ENEMY_BULLET_SPEED_BASE + this.wave * GAME_CONFIG.ENEMY_BULLET_SPEED_WAVE_GROWTH;

    // Verificar se o inimigo spawna embaixo
    const isBottomEnemy = ['bottom-left', 'bottom-right', 'v-inv-left', 'v-inv-right', 'v-inv-center'].includes(shooter.group);

    const bulletVy = isBottomEnemy ? -bulletSpeed : bulletSpeed;
    const bulletY = isBottomEnemy ? shooter.y - 12 : shooter.y + shooter.height;

    this.bullets.push({
      x: shooter.x + shooter.width / 2 - 2,
      y: bulletY,
      width: 4,
      height: 16,
      vx: 0,
      vy: bulletVy,
      isPlayerBullet: false,
      ownerId: 'enemy',
    });
  }

  // ── Colisões AABB ──

  private collides(
    rect1: { x: number; y: number; width: number; height: number },
    rect2: { x: number; y: number; width: number; height: number },
  ): boolean {
    return (
      rect1.x < rect2.x + rect2.width &&
      rect1.x + rect1.width > rect2.x &&
      rect1.y < rect2.y + rect2.height &&
      rect1.y + rect1.height > rect2.y
    );
  }

  private processCollisions() {
    // Balas dos jogadores vs Inimigos
    this.bullets = this.bullets.filter((bullet) => {
      if (!bullet.isPlayerBullet) return true;

      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const enemy = this.enemies[i];
        if (this.collides(bullet, enemy)) {
          this.enemies.splice(i, 1);
          // Adicionar pontuação ao jogador dono da bala
          const player = this.players.get(bullet.ownerId);
          if (player) {
            player.score += 100 * this.wave;
          }
          return false; // Remove a bala
        }
      }
      return true;
    });

    // Balas inimigas vs Jogadores
    this.bullets = this.bullets.filter((bullet) => {
      if (bullet.isPlayerBullet) return true;

      for (const player of this.players.values()) {
        if (player.lives <= 0 || player.invincible > 0) continue;
        if (this.collides(bullet, player)) {
          player.lives--;
          player.invincible = 120;
          return false; // Remove a bala
        }
      }
      return true;
    });

    // Colisão direta: Jogador vs Inimigo (bounding box)
    for (const player of this.players.values()) {
      if (player.lives <= 0 || player.invincible > 0) continue;
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const enemy = this.enemies[i];
        if (this.collides(player, enemy)) {
          player.lives--;
          player.invincible = 120;
          this.enemies.splice(i, 1);
          break; // Só perde 1 vida por tick
        }
      }
    }
  }

  // ── Broadcast via Socket.io ──

  private broadcastSnapshot() {
    const snapshot = this.getSnapshot();
    this.emitToRoom('game:snapshot', encodeSnapshot(snapshot));
  }
}
