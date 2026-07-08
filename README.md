# Space Defenders

[![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socketdotio&logoColor=white)](https://socket.io/)

Jogo multiplayer retrô inspirado no Space Invaders com arquitetura server-authoritative e protocolo binário (ArrayBuffer).

---

## Arquitetura

```
Browser (Next.js + React)
    │
    └── Socket.io + ArrayBuffer binário
        ├── Client → Server:  inputs (3 bytes)
        └── Server → Client:  snapshots (~200-400 bytes)
                │
                ▼
        NestJS Game Server (:4000)
        ├── Game Room (estado autoritativo, game loop 60Hz)
        └── Binary Protocol (encode/decode ArrayBuffer)
```

### Conceitos Chave

- **Server-Authoritative**: O servidor roda toda a lógica do jogo (física, colisões, spawning). O cliente apenas envia inputs e renderiza snapshots.
- **Protocolo Binário (ArrayBuffer)**: Payloads ~80% menores que JSON. Inputs de 3 bytes fixos, snapshots de ~200-400 bytes (vs ~2-4KB em JSON).
- **Modo Solo e Multiplayer unificados**: Ambos usam a mesma arquitetura. Solo = sala com 1 jogador. Multiplayer = sala com 2 jogadores cooperativos.

---

## Stack Tecnológica

| Camada | Tecnologia | Função |
|--------|-----------|--------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4 | Interface, renderização Canvas 2D |
| Backend | NestJS 11 | Game server com WebSocket Gateway |
| Comunicação | Socket.io + ArrayBuffer binário | Dados de jogo compactos |
| Auth | NestJS + Prisma + PostgreSQL | JWT, OAuth, leaderboard |
| Renderização | Canvas 2D API + Sprite Sheets | Sprites animados do jogo |

---

## Estrutura do Projeto

```
space-defenders/
├── apps/
│   ├── web/                              # Frontend Next.js
│   │   └── src/
│   │       ├── app/play/
│   │       │   ├── solo/page.tsx         # Modo solo
│   │       │   └── multiplayer/page.tsx  # Modo multiplayer
│   │       ├── hooks/
│   │       │   └── useGameEngine.ts      # Hook de conexão + binário
│   │       └── lib/
│   │           └── binary-protocol.ts    # Decode client-side
│   ├── game-server/                      # NestJS Game Server
│   │   └── src/game/
│   │       ├── game.gateway.ts           # WebSocket Gateway
│   │       ├── game-room.ts              # Estado autoritativo + game loop
│   │       ├── binary-protocol.ts        # Encoder/decoder ArrayBuffer
│   │       ├── types.ts                  # Tipos compartilhados
│   │       └── config.ts                 # Constantes do jogo
│   └── auth/                             # NestJS Auth Service
└── IMPLEMENTATION.md                     # Guia de implementação detalhado
```

---

## Protocolo Binário

Todos os dados de jogo são transmitidos como `ArrayBuffer` (little-endian):

### Input (Client → Server): 3 bytes fixos
```
[0] uint8  tipo (0=move, 1=shoot)
[1] int8   direção (-1 ou 1)
[2] uint8  índice do jogador (0 ou 1)
```

### Snapshot (Server → Client): variável
```
Header (6B):  wave(u8) | status(u8) | playerCount(u16) | enemyCount(u16)
Players (12B cada):  index(u8) | x(f32) | y(f32) | lives(u8) | score(u8) | frame(u8)
Enemies (11B cada):  id(u16) | x(f32) | y(f32) | frame(u8)
Bullets (12B cada):  x(f32) | y(f32) | vx(i8) | vy(i8) | isPlayer(u8) | ownerId(u8)
```

---

## Como Rodar

### Pré-requisitos
- Node.js v18+

### Game Server
```bash
cd apps/game-server
npm install
npm run start:dev
# Rodando em http://localhost:4000
```

### Frontend
```bash
cd apps/web
npm install
npm run dev
# Rodando em http://localhost:3000
```

### Auth Service
```bash
cd apps/auth
npm install
# Configurar DATABASE_URL e JWT_SECRET
npm run start:dev
# Rodando em http://localhost:3001
```

---

## Fluxo de Conexão

```
1. Browser conecta Socket.io ao game-server:4000
2. Emite game:join { playerId, name } → recebe game:joined { roomId, playerIndex }
3. Client envia inputs binários via game:input-bin (ArrayBuffer, 3 bytes)
4. Server roda game loop a 60Hz, processa inputs, atualiza estado
5. Server emite snapshots binários via game:snapshot (ArrayBuffer)
6. Client decodifica binário, renderiza no canvas
```

---

## Decisões de Arquitetura

| Decisão | Justificativa |
|---------|--------------|
| Server-authoritative | Previne cheating, garante consistência entre jogadores |
| Socket.io + binário | Simples, confiável, binário reduz payload em ~80% |
| Binary protocol (ArrayBuffer) | Payload compacto, parsing mais rápido que JSON |
| Canvas 2d puro (sem Phaser) | Mais leve, controle total sobre renderização |
| Solo via servidor | Unifica lógica, mesmo código para ambos os modos |
| Game loop 60Hz | Suave para jogo de nave,同步 preciso |

---

## Dependências Principais

### Game Server
- `@nestjs/websockets` + `@nestjs/platform-socket.io` — WebSocket gateway
- `socket.io` — Comunicação real-time

### Frontend
- `next` 16 + `react` 19 — Framework e UI
- `socket.io-client` — Comunicação client
- `tailwindcss` 4 — Estilos

### Auth
- `@nestjs/jwt` + `@nestjs/passport` — Autenticação
- `@prisma/client` + `pg` — ORM e banco
- Estratégias OAuth: Google, GitHub, Facebook.
