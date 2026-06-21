# Space Defenders 🚀

[![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

**Space Defenders** é um jogo multiplayer retrô inspirado no clássico Space Invaders. Projetado sob uma arquitetura distribuída moderna, o projeto foca em escalabilidade, sincronização de estado em tempo real e alta disponibilidade para entregar uma experiência cooperativa ou solo fluida diretamente do navegador.

---

## 🗺️ Arquitetura do Sistema

O projeto é estruturado em microsserviços integrados através de um API Gateway único, garantindo isolamento de rede e desacoplamento orientado a eventos.

```
                     Browser
                        │
                        ▼
            ┌──────────────────────────────┐
            │         Nginx :80             │  ← Único ponto de entrada
            │   (Reverse Proxy / API GW)   │
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
              (Fila matchmaking,        (Eventos pós-partida:
               salas ativas)             match.finished)
                    │                         │
                    └──────────┬──────────────┘
                               │
                        PostgreSQL :5432
                     (Users, Matches, Scores)
```

### Principais Componentes e Responsabilidades:

- **Next.js (App Router):** Interface web moderna para o lobby, seleção de modos, página "Sobre" e renderização do jogo usando Phaser.js/Canvas.
- **API Gateway (Nginx):** Único entrypoint exposto. Gerencia o roteamento de tráfego HTTP e faz o upgrade das conexões WebSocket de forma transparente.
- **Auth Service (NestJS):** Autenticação stateless via JWT com hashing de senha robusto.
- **Matchmaking (NestJS):** Fila concorrente estruturada com Redis Sorted Sets para pareamento rápido de jogadores.
- **Game Server (NestJS + Socket.io):** Loop autoritativo de física e detecção de colisões a 30Hz com envio contínuo de snapshots de estado para mitigar cheating.
- **Kafka:** Barramento de mensagens persistentes para ações assíncronas pós-jogo (atualizações de ranking/ELO e estatísticas).
- **PostgreSQL:** Persistência relacional de histórico de partidas, usuários e tabela de pontuação (leaderboard).

---

## 🛠️ Stack Tecnológica

| Camada | Tecnologia | Função |
| --- | --- | --- |
| **Frontend** | Next.js 14, Tailwind CSS, TypeScript | Roteamento, interface e visual retrô |
| **Engine Gráfica** | Phaser.js 3 / Canvas | Renderização 2D do gameplay e efeitos |
| **Backend** | NestJS | Estrutura modular dos microsserviços |
| **Mensageria** | Apache Kafka | Logs de eventos e desacoplamento pós-partida |
| **Cache/Fila** | Redis | Gerenciamento de filas de matchmaking |
| **Banco de Dados** | PostgreSQL + ORM Prisma | Armazenamento persistente relacional |
| **Containerização**| Docker Compose | Orquestração simplificada de toda a stack |

---

## 📂 Estrutura do Monorepo

```
space-defender/
├── apps/
│   ├── web/                   # Frontend Next.js (Menu, Play Cards, About)
│   ├── auth/                  # Microsserviço de Autenticação NestJS
│   ├── matchmaking/           # Microsserviço de Fila/Pareamento
│   └── game-server/           # Servidor Autoritativo de Gameplay (WebSocket)
├── packages/
│   ├── shared-types/          # Tipos TypeScript comuns e DTOs
│   └── game-logic/            # Física e regras compartilhadas do jogo
├── nginx/
│   └── nginx.conf             # Configuração de rotas e gateway do Nginx
├── docker-compose.yml         # Orquestrador de serviços em produção
└── README.md
```

---

## 🚀 Como Iniciar Localmente

### Pré-requisitos
- Node.js instalado (v18+)
- Docker e Docker Compose

### 1. Clonar o Repositório
```bash
git clone https://github.com/seu-usuario/space-defender.git
cd space-defender
```

<<<<<<< HEAD
=======

>>>>>>> 88bd81d (feat: logica pro modo solo)
### 2. Rodar o Frontend (Desenvolvimento)
Para testar apenas as telas iniciais do frontend:
```bash
cd apps/web
npm install
npm run dev
```
Acesse `http://localhost:3000` no seu navegador.

### 3. Rodar a Stack Completa via Docker (Em breve)
Assim que os demais serviços backend forem implementados, você poderá subir toda a arquitetura distribuída com um único comando:
```bash
docker compose up --build
```
<<<<<<< HEAD
=======
### npx next dev -H 0.0.0.0 -p 3000 
>>>>>>> 88bd81d (feat: logica pro modo solo)
