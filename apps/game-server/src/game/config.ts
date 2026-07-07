// Configurações do Game Server — Lógica autoritativa de jogo multiplayer

export const GAME_CONFIG = {
  // Resolução virtual
  GAME_WIDTH: 800,
  GAME_HEIGHT: 600,

  // Tick rate
  TICK_RATE: 60, // 60 FPS servidor
  TICK_INTERVAL_MS: 1000 / 60, // ~16.6ms

  // Configurações do Player
  PLAYER_SPEED: 5.2,
  PLAYER_LIVES: 3,
  PLAYER_SIZE: 64,
  PLAYER_SHOOT_COOLDOWN: 22, // em ticks (300ms a 60 ticks/s)
  PLAYER_BULLET_SPEED: 14.5,

  // Configurações dos Inimigos
  ENEMY_SIZE: 56,
  ENEMY_SPACING_X: 75,
  ENEMY_SPACING_Y: 65,
  ENEMY_SPAWN_LEFT_MARGIN: 40,
  ENEMY_SPAWN_RIGHT_MARGIN: 40,
  ENEMY_SPAWN_TOP_MARGIN: 80,
  ENEMY_BASE_MOVE_INTERVAL: 45,
  ENEMY_MIN_MOVE_INTERVAL: 12,
  ENEMY_SPEED_WAVE_GROWTH: 0.15,

  ENEMY_SHOOT_COOLDOWN_BASE: 90,
  ENEMY_SHOOT_COOLDOWN_MIN: 30,
  ENEMY_SHOOT_COOLDOWN_WAVE_DECREASE: 8,
  ENEMY_BULLET_SPEED_BASE: 4.5,
  ENEMY_BULLET_SPEED_WAVE_GROWTH: 0.15,

  // Flanking Vertical
  FLANKING_V_HORIZONTAL_SPEED: 2.0,  // velocidade horizontal na aproximação
  FLANKING_V_VERTICAL_SPEED: 1.8,    // velocidade vertical na subida
  FLANKING_V_MEET_MARGIN: 30,        // margem para considerar que os grupos se encontraram (px)
  FLANKING_V_RISE_DISTANCE: 250,     // distância que sobem antes de separar (px)
  FLANKING_V_SPAWN_OFFSET: 80,       // offset fora da tela para spawn

  // V Formation
  V_FORMATION_DESCENT_SPEED: 0.45,    // velocidade de descida gradual da formação
  V_FORMATION_DIVE_SPEED: 4.5,       // velocidade de mergulho dos inimigos das pontas
  V_FORMATION_ANGLE: 35,             // ângulo da formação V em graus
  V_FORMATION_SPACING: 55,           // espaçamento entre inimigos na formação
  V_FORMATION_DIVE_TRIGGER_Y: 200,   // Y onde as pontas começam a mergulhar
  V_FORMATION_CLOSE_SPEED: 2.5,      // velocidade lateral do fechamento do centro

  // Waves
  WAVE_INITIAL_ENEMIES: 6,
  WAVE_ENEMIES_GROWTH_PER_LEVEL: 2,
  WAVE_MAX_ENEMIES: 16,

  // Máximo de jogadores por sala
  MAX_PLAYERS: 2,
};
