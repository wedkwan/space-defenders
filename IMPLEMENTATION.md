# Guia de Implementação — Space Invaders Multiplayer

## 1. Qual Tier isso se encaixa?

O projeto com a stack atual cruza **múltiplos tiers simultaneamente**:

| Tier | Por quê se aplica |
|---|---|
| **Tier 1** (Docker Compose, 4+ serviços) | 8 serviços no Compose: Nginx, Next.js, Auth, Matchmaking, Game Server, PostgreSQL, Redis, Kafka. Cobre com folga. |
| **Tier 1.5** (SOA, 3+ serviços se comunicando) | Auth, Matchmaking e Game Server são serviços NestJS distintos, se comunicando via REST (através do Nginx) e eventos assíncronos (Kafka). Definição literal do tier. |
| **Espírito do Tier 4** | Tolerância a falhas (reconexão de jogador, fila persistente em Redis), múltiplos protocolos de comunicação (HTTP REST + WebSocket + Kafka), e serviços desacoplados por eventos. Não é o tier formal, mas é um argumento honesto de complexidade distribuída. |

**Recomendação:** apresente como **Tier 1.5**, explicitando que também cobre o Tier 1, e mencione os elementos de Tier 4 (fault tolerance, event-driven) como decisões de arquitetura — não como obrigação, mas como escolha deliberada.

---

## 2. Visão Geral da Arquitetura

```
Browser
   │
   ▼
┌──────────────────────────────┐
│         Nginx :80             │  ← único ponto de entrada
│  (reverse proxy / API GW)    │
└──┬──────┬────────┬───────────┘
   │      │        │
   ▼      ▼        ▼
Next.js  NestJS  NestJS
:3000   Auth    Matchmaking
         :3001    :3002
   │      │        │
   │      └────────┘
   │           │
   │      NestJS Game Server :4000
   │      (WebSocket Gateway)
   │           │
   └───────────┤
               │
        ┌──────┴──────────────────┐
        │                         │
     Redis :6379              Kafka :9092
  (fila matchmaking,        (eventos pós-partida:
   salas ativas,             match.finished →
   pub/sub WS)               leaderboard, stats)
        │                         │
        └──────────┬──────────────┘
                   │
            PostgreSQL :5432
         (users, matches, scores)
```

### Responsabilidade de cada peça

- **Nginx:** único ponto de entrada exposto ao host. Roteia por path (`/` → Next.js, `/api/auth` → Auth Service, `/api/match` → Matchmaking, `/ws` → Game Server com WebSocket upgrade). Os demais serviços ficam isolados na rede interna Docker.
- **Next.js (App Router):** frontend completo — telas de login/registro, lobby, "procurando partida", tela do jogo (Canvas/Phaser consumindo o WS), histórico/ranking.
- **Auth Service (NestJS):** registro, login, emissão e validação de JWT. Stateless — qualquer outro serviço valida o token localmente.
- **Matchmaking Service (NestJS):** recebe pedidos de partida, gerencia fila em Redis, pareia jogadores e cria salas no Game Server. Publica evento `match.created` no Kafka.
- **Game Server (NestJS + WS Gateway):** mantém **estado autoritativo** da partida (posições, tiros, colisões, vidas), roda loop de tick (30Hz), envia snapshots via WebSocket, recebe apenas inputs dos clientes. Ao término de uma partida, publica `match.finished` no Kafka.
- **Redis:** fila de matchmaking (Sorted Set), estado efêmero de salas ativas (Hash), pub/sub entre instâncias do Game Server.
- **Kafka:** barramento de eventos assíncronos entre serviços. Desacopla o Game Server de quem precisa reagir ao resultado de uma partida (leaderboard, analytics, notificações futuras).
- **PostgreSQL:** persistência de longo prazo — usuários, histórico de partidas, leaderboard.

---

## 3. Stack Tecnológica

| Camada | Tecnologia | Motivo |
|---|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript | SSR/SSG pra telas estáticas, client components pra jogo |
| Engine do jogo | Phaser.js 3 | Evita reescrever física/colisão/sprites do zero; foco no multiplayer |
| API Gateway | Nginx (alpine) | Roteamento, WebSocket proxy, isolamento de rede |
| Serviços backend | NestJS + TypeScript | DI, módulos prontos pra WS/JWT/Redis/Kafka, estrutura SOA natural |
| Comunicação real-time | `@nestjs/websockets` + `socket.io` | WebSocket com fallback automático, rooms nativas (ideal pra salas de jogo) |
| Auth | `@nestjs/jwt` + `@nestjs/passport` + `bcrypt` | JWT stateless, validação simples em qualquer serviço |
| ORM | Prisma | Migrations tipadas, integra limpo com TS/NestJS |
| Banco | PostgreSQL 16 | Relacional, robusto, bem suportado pelo Prisma |
| Cache / fila | Redis 7 + `ioredis` | Matchmaking queue, estado efêmero, pub/sub |
| Message broker | Apache Kafka (Bitnami) | Eventos assíncronos pós-partida, desacoplamento entre serviços |
| Orquestração | Docker Compose | Um `docker compose up` sobe tudo |
| Observabilidade (opcional) | Prometheus + Grafana | Métricas do game server (tick rate, players online, latência) |

> 💡 **Por que Phaser.js e não Canvas puro?** O Phaser tem gerenciamento de cena, input, física arcade e loop de game embutidos. Você já conhece a lógica do space invaders — o Phaser deixa você focar no multiplayer (que é o diferencial real) sem reinventar a roda do motor 2D.

> 💡 **Por que Kafka e não só Redis pub/sub pra tudo?** Redis pub/sub é fire-and-forget (sem persistência, sem replay). Kafka mantém log dos eventos — se o serviço de leaderboard cair e voltar, ele consome os eventos que perdeu. É uma decisão de arquitetura que vale ouro na apresentação: "escolhemos Kafka especificamente para eventos pós-partida porque precisamos de garantia de entrega; WebSocket direto para o caminho crítico de sincronização porque latência importa."

---

## 4. Modelagem de Dados (PostgreSQL + Prisma)

```prisma
// schema.prisma

model User {
  id           String   @id @default(uuid())
  username     String   @unique
  email        String   @unique
  passwordHash String
  elo          Int      @default(1000)
  createdAt    DateTime @default(now())

  participations MatchParticipant[]
  wonMatches     Match[] @relation("winner")
}

model Match {
  id         String      @id @default(uuid())
  status     MatchStatus @default(WAITING)
  startedAt  DateTime?
  finishedAt DateTime?

  winner   User?   @relation("winner", fields: [winnerId], references: [id])
  winnerId String?

  participants MatchParticipant[]
}

model MatchParticipant {
  match    Match        @relation(fields: [matchId], references: [id])
  matchId  String
  user     User         @relation(fields: [userId], references: [id])
  userId   String
  score    Int          @default(0)
  result   MatchResult?

  @@id([matchId, userId])
}

enum MatchStatus {
  WAITING
  IN_PROGRESS
  FINISHED
}

enum MatchResult {
  WIN
  LOSS
  DRAW
}
```

---

## 5. Nginx — Configuração

```nginx
# nginx/nginx.conf
events { worker_connections 1024; }

http {
  upstream nextjs    { server web:3000; }
  upstream auth      { server auth:3001; }
  upstream matchmaking { server matchmaking:3002; }
  upstream gameserver  { server game-server:4000; }

  server {
    listen 80;

    # Frontend — Next.js
    location / {
      proxy_pass http://nextjs;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
    }

    # Auth API
    location /api/auth/ {
      proxy_pass http://auth/;
      proxy_set_header Host $host;
    }

    # Matchmaking API
    location /api/matchmaking/ {
      proxy_pass http://matchmaking/;
      proxy_set_header Host $host;
    }

    # WebSocket — Game Server
    # Nginx precisa de upgrade explícito pra WS funcionar
    location /ws/ {
      proxy_pass http://gameserver/;
      proxy_http_version 1.1;
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
      proxy_set_header Host $host;
      proxy_read_timeout 3600s;  # partidas longas não caem por timeout
    }
  }
}
```

> ⚠️ O `proxy_read_timeout 3600s` na rota `/ws/` é importante — sem ele, o Nginx encerra conexões WebSocket ociosas depois de 60s, o que derrubaria jogadores no meio de uma partida.

---

## 6. Estrutura NestJS por Serviço

### Auth Service (`apps/auth`)
```
auth/
├── src/
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts   # POST /register, POST /login
│   │   ├── auth.service.ts      # bcrypt, JWT sign
│   │   └── jwt.strategy.ts      # validação de token
│   ├── users/
│   │   ├── users.module.ts
│   │   └── users.service.ts     # CRUD básico de usuário
│   └── main.ts                  # listen :3001
```

### Matchmaking Service (`apps/matchmaking`)
```
matchmaking/
├── src/
│   ├── queue/
│   │   ├── queue.module.ts
│   │   ├── queue.controller.ts  # POST /join, DELETE /leave
│   │   ├── queue.service.ts     # ZADD/ZPOPMIN no Redis
│   │   └── queue.worker.ts      # @Cron() a cada 1s: verificar pares
│   ├── rooms/
│   │   └── rooms.service.ts     # criar sala no Redis + registro no Postgres
│   └── main.ts                  # listen :3002
```

### Game Server (`apps/game-server`)
```
game-server/
├── src/
│   ├── gateway/
│   │   ├── game.gateway.ts      # @WebSocketGateway(), @SubscribeMessage()
│   │   └── game.gateway.spec.ts
│   ├── game/
│   │   ├── game.module.ts
│   │   ├── game.service.ts      # gerencia instâncias de GameRoom
│   │   └── game-room.ts         # estado autoritativo + game loop
│   ├── kafka/
│   │   └── kafka.producer.ts    # publica match.finished
│   └── main.ts                  # listen :4000
```

---

## 7. Game Loop — Lógica Autoritativa

```typescript
// game-room.ts (simplificado)
export class GameRoom {
  private state: GameState;
  private inputs: Map<string, PlayerInput[]> = new Map();
  private tickInterval: NodeJS.Timeout;

  constructor(
    private readonly roomId: string,
    private readonly players: string[],
    private readonly emitToRoom: (event: string, data: unknown) => void,
  ) {
    this.state = this.initState(players);
  }

  start() {
    // 60 ticks por segundo = ~16.6ms por tick (config.ts: TICK_RATE = 60)
    this.tickInterval = setInterval(() => this.tick(), 1000 / 60);
  }

  receiveInput(playerId: string, input: PlayerInput) {
    // Apenas enfileira o input; o tick decide o resultado
    const queue = this.inputs.get(playerId) ?? [];
    queue.push(input);
    this.inputs.set(playerId, queue);
  }

  private tick() {
    // 1. Processa todos os inputs recebidos desde o último tick
    for (const [playerId, inputQueue] of this.inputs) {
      inputQueue.forEach(input => this.applyInput(playerId, input));
      this.inputs.set(playerId, []); // limpa a fila
    }

    // 2. Atualiza física (tiros, inimigos, colisões)
    this.updatePhysics();

    // 3. Verifica condição de fim de jogo
    const result = this.checkEndCondition();
    if (result) {
      this.end(result);
      return;
    }

    // 4. Envia snapshot do estado para todos os clients na sala
    this.emitToRoom('game:snapshot', this.state);
  }

  private applyInput(playerId: string, input: PlayerInput) {
    // Servidor decide o que o input faz — cliente não decide nada
    const player = this.state.players[playerId];
    if (input.type === 'MOVE') player.x += input.direction * PLAYER_SPEED;
    if (input.type === 'SHOOT') this.spawnBullet(playerId, player.x, player.y);
  }

  // ...updatePhysics, checkEndCondition, end()
}
```

**Por que estado autoritativo?** O cliente só envia `{ type: 'MOVE', direction: 1 }` ou `{ type: 'SHOOT' }`. O servidor aplica, calcula colisões, e manda de volta o estado verdadeiro. Isso:
1. Previne cheating (cliente não pode dizer "eu matei o inimigo").
2. Garante consistência entre os dois jogadores.
3. É o argumento de design mais forte da apresentação.

---

## 8. Fluxo Kafka (Eventos Pós-Partida)

```
Game Server                 Kafka                  Matchmaking / Leaderboard
    │                         │                           │
    │── match.finished ──────▶│                           │
    │   { matchId,            │────── consume ───────────▶│
    │     winnerId,           │                           │
    │     scores,             │                    atualiza ELO,
    │     duration }          │                    leaderboard,
    │                         │                    histórico
```

Tópicos Kafka sugeridos:
- `match.created` — publicado pelo Matchmaking quando forma uma sala
- `match.finished` — publicado pelo Game Server ao término da partida
- `player.ranked` — publicado pelo Leaderboard após atualizar ELO (útil pra notificações futuras)

Configuração mínima no Docker Compose (Bitnami Kafka, sem Zookeeper via KRaft):
```yaml
kafka:
  image: bitnami/kafka:3.7
  environment:
    - KAFKA_CFG_NODE_ID=0
    - KAFKA_CFG_PROCESS_ROLES=controller,broker
    - KAFKA_CFG_LISTENERS=PLAINTEXT://:9092,CONTROLLER://:9093
    - KAFKA_CFG_ADVERTISED_LISTENERS=PLAINTEXT://kafka:9092
    - KAFKA_CFG_LISTENER_SECURITY_PROTOCOL_MAP=CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT
    - KAFKA_CFG_CONTROLLER_QUORUM_VOTERS=0@kafka:9093
    - KAFKA_CFG_CONTROLLER_LISTENER_NAMES=CONTROLLER
```

> 💡 Bitnami Kafka com KRaft mode (sem Zookeeper) é muito mais simples de subir no Compose — um único container em vez de dois.

---

## 9. Docker Compose Completo

```yaml
version: "3.9"

services:
  nginx:
    image: nginx:alpine
    ports: ["80:80"]
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on: [web, auth, matchmaking, game-server]

  web:
    build: ./apps/web
    expose: ["3000"]
    environment:
      - NEXTAUTH_URL=http://localhost
      - AUTH_SERVICE_URL=http://auth:3001
    depends_on: [auth]

  auth:
    build: ./apps/auth
    expose: ["3001"]
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/spaceinvaders
      - JWT_SECRET=changeme_in_production
    depends_on: [db]

  matchmaking:
    build: ./apps/matchmaking
    expose: ["3002"]
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/spaceinvaders
      - REDIS_URL=redis://redis:6379
      - KAFKA_BROKERS=kafka:9092
    depends_on: [db, redis, kafka]

  game-server:
    build: ./apps/game-server
    expose: ["4000"]
    environment:
      - REDIS_URL=redis://redis:6379
      - KAFKA_BROKERS=kafka:9092
      - JWT_SECRET=changeme_in_production
    depends_on: [redis, kafka]

  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=spaceinvaders
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports: ["5432:5432"]   # expõe pra debug local; remover em prod

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]   # expõe pra debug local

  kafka:
    image: bitnami/kafka:3.7
    environment:
      - KAFKA_CFG_NODE_ID=0
      - KAFKA_CFG_PROCESS_ROLES=controller,broker
      - KAFKA_CFG_LISTENERS=PLAINTEXT://:9092,CONTROLLER://:9093
      - KAFKA_CFG_ADVERTISED_LISTENERS=PLAINTEXT://kafka:9092
      - KAFKA_CFG_LISTENER_SECURITY_PROTOCOL_MAP=CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT
      - KAFKA_CFG_CONTROLLER_QUORUM_VOTERS=0@kafka:9093
      - KAFKA_CFG_CONTROLLER_LISTENER_NAMES=CONTROLLER
    ports: ["9092:9092"]   # expõe pra debug local

volumes:
  pgdata:
```

**Total: 8 serviços** (Nginx, Next.js, Auth, Matchmaking, Game Server, PostgreSQL, Redis, Kafka).

---

## 10. Estrutura de Pastas (Monorepo)

```
space-invaders-multiplayer/
├── apps/
│   ├── web/                   # Next.js (frontend)
│   ├── auth/                  # NestJS Auth Service
│   ├── matchmaking/           # NestJS Matchmaking Service
│   └── game-server/           # NestJS Game Server (WS)
├── packages/
│   ├── shared-types/          # tipos TS compartilhados
│   │   ├── src/
│   │   │   ├── events.ts      # eventos WS (GameSnapshot, PlayerInput...)
│   │   │   ├── dto.ts         # DTOs das APIs REST
│   │   │   └── kafka.ts       # payloads dos tópicos Kafka
│   │   └── package.json
│   └── game-logic/            # lógica pura (colisão, física)
│       ├── src/
│       │   ├── collision.ts
│       │   └── physics.ts
│       └── package.json
├── nginx/
│   └── nginx.conf
├── docker-compose.yml
├── docker-compose.dev.yml     # volumes bind-mount + hot reload
├── package.json               # workspaces root (pnpm/npm)
└── README.md
```

O pacote `shared-types` é a peça que une tudo: o cliente Next.js e o game server importam os mesmos tipos dos eventos WebSocket — zero duplicação, zero desincronização de contrato.

---

## 11. Roteiro de Implementação por Fases

**Fase 1 — Fundação (prioridade máxima)**
- Setup monorepo com pnpm workspaces.
- Docker Compose com todos os 8 serviços subindo (mesmo que "hello world").
- Schema Prisma + primeira migration rodando.
- `shared-types` package com tipos básicos.

**Fase 2 — Auth funcionando ponta a ponta**
- NestJS Auth Service: registro, login, JWT.
- Next.js: telas de login/registro consumindo o Auth via Nginx.
- Middleware de autenticação nos demais serviços NestJS.

**Fase 3 — Jogo single-player no browser**
- Lógica do space invaders no `game-logic` package (sem rede ainda).
- Phaser.js no Next.js consumindo o `game-logic`.
- Garantir que o core loop (mover, atirar, colidir, pontuar) funciona.

**Fase 4 — Multiplayer básico (sem matchmaking)**
- NestJS Game Server com `@WebSocketGateway()`.
- Nginx configurado pra WebSocket upgrade na rota `/ws/`.
- Dois clientes conectando na mesma sala hardcoded.
- Sincronização de estado via snapshots funcionando.

→ **Ponto de corte ideal pra apresentação intermediária (02/05):** Docker up, auth, jogo multiplayer básico ao vivo — já demonstra arquitetura, decisões de design e comunicação em tempo real.

**Fase 5 — Matchmaking real**
- Redis queue no Matchmaking Service.
- Worker de pareamento (NestJS `@Cron`).
- Frontend: tela "procurando partida" com polling/WS esperando `matchId`.
- Kafka: eventos `match.created` e `match.finished` fluindo.

**Fase 6 — Polimento e Demo Week**
- Leaderboard consumindo eventos Kafka.
- Reconexão de jogador (janela de 15s).
- Tratamento de erros e edge cases visíveis.
- README completo + roteiro de demo.
- (Opcional) Prometheus + Grafana pra métricas do Game Server.

---

## 12. O que o README final precisa ter

1. **Visão geral** — o que é o projeto e qual problema resolve.
2. **Diagrama de arquitetura** — reaproveite o da Seção 2.
3. **Tecnologias** — lista com justificativa de cada escolha relevante.
4. **Como rodar** — pré-requisitos (Docker, pnpm), variáveis de ambiente, `docker compose up --build`.
5. **Decisões de arquitetura** — estado autoritativo no servidor, Kafka pra eventos assíncronos x WebSocket pro caminho crítico, Nginx como único ponto de entrada.
6. **Desafios** — sincronização de estado em tempo real, matchmaking com Redis, WebSocket upgrade pelo Nginx.
7. **Limitações e próximos passos** — escalonamento horizontal do Game Server, ELO mais sofisticado, modo espectador, replay.

---

## 13. Mapeando pros Critérios da Apresentação

| Critério | Onde aparece no projeto |
|---|---|
| Overview e objetivos | Reescrita de jogo legado em arquitetura distribuída moderna com multiplayer real-time |
| Tecnologias usadas | Nginx, Next.js, NestJS (×3 serviços), PostgreSQL, Redis, Kafka, Docker Compose, Phaser.js |
| Arquitetura e decisões | Estado autoritativo, Kafka x Redis pra diferentes casos de uso, Nginx como API Gateway, serviços isolados na rede Docker |
| Desafios | Sincronização de estado a 30Hz, WebSocket upgrade pelo Nginx, matchmaking com garantia de entrega via Kafka, reconexão de jogador |
| Demonstração | Dois jogadores entrando na fila → matchmaking ao vivo → partida → leaderboard atualizado |
| Melhorias futuras | Escalonamento horizontal do Game Server com Redis pub/sub, modo espectador, replay de partidas, ranking ELO sofisticado |

---

## 14. Riscos e Como Mitigar

| Risco | Mitigação |
|---|---|
| Syncronização de estado consumir todo o tempo | Trave a Fase 4 com sala hardcoded antes de qualquer matchmaking; um MVP 1v1 funcional é mais valioso que matchmaking sem jogo |
| Kafka complexo demais pra configurar | Bitnami KRaft mode (sem Zookeeper) reduz pra 1 container; se travar, use Redis Streams como fallback e explique a troca na apresentação |
| Nginx derrubando conexões WebSocket | `proxy_read_timeout 3600s` + `proxy_http_version 1.1` com headers de upgrade — já está na config da Seção 5 |
| NestJS curva de aprendizado | Resolver na Fase 1: subir um "Hello World" em cada serviço antes de escrever qualquer regra de negócio |
| Escopo creep no jogo em si | O jogo não é o diferencial — é a infraestrutura. Space Invaders básico (mover, atirar, inimigos simples, vidas) é suficiente; gaste a energia no multiplayer |