import { GAME_CONFIG } from './config';
import { PlayerState, Bullet, Enemy, GameSnapshot } from './types';
import { encodeSnapshot } from './binary-protocol';

export type { PlayerState, Bullet, Enemy, GameSnapshot };

export class GameRoom {
  private players: Map<string, PlayerState> = new Map();
  private playerOrder: string[] = [];
  private enemies: Enemy[] = [];
  private bullets: Bullet[] = [];
  private wave = 1;
  private status: 'waiting' | 'playing' | 'gameover' = 'waiting';
  private tickInterval: NodeJS.Timeout | null = null;
  private minPlayers = 2;

  private enemyMoveTimer = 0;
  private leftGroupDirection = 1;
  private rightGroupDirection = -1;
  private enemySpeedMultiplier = 1;
  private enemyShootTimer = 0;

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

  handleInput(playerId: string, input: { type: string; direction?: number }) {
    const player = this.players.get(playerId);
    if (!player || this.status !== 'playing') return;
    if (player.lives <= 0) return;

    if (input.type === 'move' && input.direction !== undefined) {
      player.x += input.direction * GAME_CONFIG.PLAYER_SPEED;
      // Limites da tela
      if (player.x < 0) player.x = 0;
      if (player.x > GAME_CONFIG.GAME_WIDTH - player.width) {
        player.x = GAME_CONFIG.GAME_WIDTH - player.width;
      }
    }

    if (input.type === 'shoot') {
      if (player.shootCooldown <= 0) {
        this.bullets.push({
          x: player.x + player.width / 2 - 2,
          y: player.y - 12,
          width: 4,
          height: 16,
          vx: 0,
          vy: -GAME_CONFIG.PLAYER_BULLET_SPEED,
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
    const count = Math.min(
      GAME_CONFIG.WAVE_INITIAL_ENEMIES + (this.wave - 1) * GAME_CONFIG.WAVE_ENEMIES_GROWTH_PER_LEVEL,
      GAME_CONFIG.WAVE_MAX_ENEMIES,
    );
    this.enemySpeedMultiplier = 1 + (this.wave - 1) * GAME_CONFIG.ENEMY_SPEED_WAVE_GROWTH;

    const half = Math.floor(count / 2);
    const colsHalf = Math.ceil(half / 2); // grid columns per group
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
    this.enemyMoveTimer = 0;
  }

  // ── Movimentação de Inimigos ──

  private updateEnemyMovement() {
    this.enemyMoveTimer++;
    const baseMoveInterval = Math.max(10, GAME_CONFIG.ENEMY_BASE_MOVE_INTERVAL - (this.wave - 1) * 3);
    const liveMoveInterval = Math.max(
      GAME_CONFIG.ENEMY_MIN_MOVE_INTERVAL,
      Math.floor((baseMoveInterval * (this.enemies.length + 3)) / 10),
    );

    if (this.enemyMoveTimer < liveMoveInterval) return;
    this.enemyMoveTimer = 0;

    // Obter a posição Y mínima dos jogadores ativos
    let minPlayerY = GAME_CONFIG.GAME_HEIGHT - GAME_CONFIG.PLAYER_SIZE - 20;
    for (const p of this.players.values()) {
      if (p.lives > 0 && p.y < minPlayerY) {
        minPlayerY = p.y;
      }
    }

    const stepLeft = 8 * this.leftGroupDirection * this.enemySpeedMultiplier;
    const stepRight = 8 * this.rightGroupDirection * this.enemySpeedMultiplier;

    let leftHitWall = false;
    let rightHitWall = false;
    let groupsCollided = false;
    let gameOverTriggered = false;

    // Prever próximas coordenadas para verificar colisão
    const tempEnemies = this.enemies.map((enemy) => ({
      ...enemy,
      nextX: enemy.x + (enemy.group === 'left' ? stepLeft : stepRight),
    }));

    // 1. Verificação de limites
    for (const enemy of tempEnemies) {
      if (enemy.group === 'left') {
        if (this.leftGroupDirection === -1 && enemy.nextX < 10) {
          leftHitWall = true;
        }
        if (this.leftGroupDirection === 1 && enemy.nextX > GAME_CONFIG.GAME_WIDTH - enemy.width - 10) {
          leftHitWall = true;
        }
      } else if (enemy.group === 'right') {
        if (this.rightGroupDirection === -1 && enemy.nextX < 10) {
          rightHitWall = true;
        }
        if (this.rightGroupDirection === 1 && enemy.nextX > GAME_CONFIG.GAME_WIDTH - enemy.width - 10) {
          rightHitWall = true;
        }
      }
    }

    // 2. Verificação de colisão entre grupos em níveis de Y semelhantes
    for (let i = 0; i < tempEnemies.length; i++) {
      const eA = tempEnemies[i];
      if (eA.group !== 'left') continue;

      for (let j = 0; j < tempEnemies.length; j++) {
        const eB = tempEnemies[j];
        if (eB.group !== 'right') continue;

        const sameRow = Math.abs(eA.y - eB.y) < 15;
        if (sameRow) {
          if (eA.nextX + eA.width >= eB.nextX && eA.x < eB.x) {
            groupsCollided = true;
            break;
          }
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
      if (leftHitWall && this.leftGroupDirection === -1) {
        nextLeftDir = 1;
        shiftDownLeft = true;
      } else if (leftHitWall && this.leftGroupDirection === 1) {
        nextLeftDir = -1;
        shiftDownLeft = true;
      }
      if (rightHitWall && this.rightGroupDirection === 1) {
        nextRightDir = -1;
        shiftDownRight = true;
      } else if (rightHitWall && this.rightGroupDirection === -1) {
        nextRightDir = 1;
        shiftDownRight = true;
      }
    }

    this.leftGroupDirection = nextLeftDir;
    this.rightGroupDirection = nextRightDir;

    this.enemies = this.enemies
      .map((enemy) => {
        let newX = enemy.x;
        let newY = enemy.y;

        if (enemy.group === 'left') {
          newX += 8 * this.leftGroupDirection * this.enemySpeedMultiplier;
          if (shiftDownLeft) {
            newY += 24;
          }
        } else {
          newX += 8 * this.rightGroupDirection * this.enemySpeedMultiplier;
          if (shiftDownRight) {
            newY += 24;
          }
        }

        const minX = 10;
        const maxX = GAME_CONFIG.GAME_WIDTH - enemy.width - 10;
        if (newX < minX) newX = minX;
        if (newX > maxX) newX = maxX;

        let frame = enemy.frame;
        if (Math.random() < 0.15) {
          frame = (frame + 1) % 3;
        }

        if (newY >= minPlayerY - 10) {
          gameOverTriggered = true;
        }

        return {
          id: enemy.id,
          x: newX,
          y: newY,
          frame,
          group: enemy.group,
          width: enemy.width,
          height: enemy.height,
        };
      })
      .filter((enemy) => {
        const isOutOfBounds =
          enemy.x < 0 ||
          enemy.x > GAME_CONFIG.GAME_WIDTH - enemy.width ||
          enemy.y < 0 ||
          enemy.y > GAME_CONFIG.GAME_HEIGHT;
        return !isOutOfBounds;
      });

    if (gameOverTriggered) {
      for (const player of this.players.values()) {
        player.lives = 0;
      }
    }
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

    this.bullets.push({
      x: shooter.x + shooter.width / 2 - 2,
      y: shooter.y + shooter.height,
      width: 4,
      height: 16,
      vx: 0,
      vy: bulletSpeed,
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
          player.invincible = 120; // 2 segundos de invencibilidade @ 60 FPS é 120 ticks
          return false; // Remove a bala
        }
      }
      return true;
    });
  }

  // ── Broadcast via Socket.io ──

  private broadcastSnapshot() {
    const snapshot = this.getSnapshot();
    this.emitToRoom('game:snapshot', encodeSnapshot(snapshot));
  }
}
