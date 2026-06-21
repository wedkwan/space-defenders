// Configurações Globais do Modo Solo - Space Defenders

export const GAME_CONFIG = {
  // Resolução virtual interna do Canvas
  GAME_WIDTH: 800,
  GAME_HEIGHT: 600,

  // Configurações do Player
  PLAYER_SPEED: 5.2,
  PLAYER_LIVES: 3,
  PLAYER_SIZE: 64, // Largura e Altura da nave
  PLAYER_SHOOT_COOLDOWN: 300, // Cooldown de disparo em milissegundos
  PLAYER_BULLET_SPEED: -6.5,

  // Configurações dos Inimigos (Aliens)
  ENEMY_SIZE: 56, // Largura e Altura do inimigo
  ENEMY_SPACING_X: 75, // Distância horizontal entre inimigos
  ENEMY_SPACING_Y: 65, // Distância vertical entre inimigos
  ENEMY_SPAWN_LEFT_MARGIN: 40, // Recuo de spawn da parede esquerda
  ENEMY_SPAWN_RIGHT_MARGIN: 40, // Recuo de spawn da parede direita
  ENEMY_SPAWN_TOP_MARGIN: 80, // Distância vertical inicial do topo

  // Configurações de IA e Movimentação dos Inimigos
  ENEMY_BASE_MOVE_INTERVAL: 45, // Velocidade inicial do movimento (quanto maior, mais lento)
  ENEMY_MIN_MOVE_INTERVAL: 12, // Limite máximo de velocidade (velocidade final no 1v1)
  ENEMY_SPEED_WAVE_GROWTH: 0.15, // Aumento de velocidade de movimentação por wave (15% por wave)

  // Configurações de Ataque dos Inimigos
  ENEMY_SHOOT_COOLDOWN_BASE: 90, // Intervalo base para tiros (em frames)
  ENEMY_SHOOT_COOLDOWN_MIN: 30, // Intervalo mínimo de tiro dos inimigos
  ENEMY_SHOOT_COOLDOWN_WAVE_DECREASE: 8, // Diminuição do tempo de recarga de tiro dos inimigos por wave
  ENEMY_BULLET_SPEED_BASE: 3.0,
  ENEMY_BULLET_SPEED_WAVE_GROWTH: 0.15, // Aumento da velocidade do tiro por wave (15% por wave)

  // Sistema de Ondas (Waves)
  WAVE_INITIAL_ENEMIES: 6,
  WAVE_ENEMIES_GROWTH_PER_LEVEL: 2,
  WAVE_MAX_ENEMIES: 16,

  // Efeitos Visuais (Partículas da Explosão)
  PARTICLES_COUNT: 12,
  PARTICLES_COLOR_ENEMY: "#65c5de",
  PARTICLES_COLOR_PLAYER: "#ff4d4d",
  PARTICLES_DECAY_RATE: 0.02, // Velocidade com que as partículas somem (alpha)
};
