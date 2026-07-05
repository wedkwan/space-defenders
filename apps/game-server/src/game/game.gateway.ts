import {
  SubscribeMessage,
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameRoom } from './game-room';
import { setPlayerIdMapping } from './binary-protocol';

let roomCounter = 0;

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class GameGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly rooms: Map<string, GameRoom> = new Map();
  private server: Server;

  private readonly socketMap: Map<
    string,
    { roomId: string; playerId: string }
  > = new Map();

  // Matchmaking queue: socketId -> { playerId, name }
  private readonly matchmakingQueue: Map<
    string,
    { playerId: string; name: string }
  > = new Map();

  afterInit(server: Server) {
    this.server = server;
    console.log('🎮 GameGateway initialized');
  }

  handleConnection(client: Socket) {
    console.log(`🔌 Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`🔌 Client disconnected: ${client.id}`);

    // Remove from matchmaking queue if present
    if (this.matchmakingQueue.has(client.id)) {
      this.matchmakingQueue.delete(client.id);
      this.broadcastMatchmakingStatus();
      console.log(`❌ Player left matchmaking queue`);
    }

    const mapping = this.socketMap.get(client.id);
    if (mapping) {
      const room = this.rooms.get(mapping.roomId);
      if (room) {
        room.removePlayer(mapping.playerId);
        console.log(
          `🚪 Player ${mapping.playerId} removed from room ${mapping.roomId}`,
        );

        if (room.playerCount === 0) {
          room.stop();
          this.rooms.delete(mapping.roomId);
          console.log(`🗑️ Room ${mapping.roomId} destroyed (empty)`);
        }
      }
      this.socketMap.delete(client.id);
    }
  }

  // ── Matchmaking ──

  @SubscribeMessage('matchmaking:join')
  handleMatchmakingJoin(
    @MessageBody()
    data: { playerId: string; name: string },
    @ConnectedSocket() client: Socket,
  ) {
    // Don't allow duplicates
    if (this.matchmakingQueue.has(client.id)) return;

    this.matchmakingQueue.set(client.id, {
      playerId: data.playerId,
      name: data.name,
    });

    console.log(
      `🔍 Player "${data.name}" (${data.playerId}) joined matchmaking (${this.matchmakingQueue.size}/2)`,
    );

    if (this.matchmakingQueue.size >= 2) {
      // Match found! Create room with first 2 players
      const entries = Array.from(this.matchmakingQueue.entries());
      const [socket1, player1] = entries[0];
      const [socket2, player2] = entries[1];

      // Remove both from queue
      this.matchmakingQueue.delete(socket1);
      this.matchmakingQueue.delete(socket2);

      // Create room
      roomCounter++;
      const roomId = `room-${roomCounter}`;
      const room = new GameRoom(roomId, (event, payload) => {
        this.server.to(roomId).emit(event, payload);
      });
      this.rooms.set(roomId, room);

      // Get socket references
      const sock1 = this.server.sockets.sockets.get(socket1);
      const sock2 = this.server.sockets.sockets.get(socket2);

      if (!sock1 || !sock2) {
        console.log('❌ A player disconnected during matchmaking match');
        // Re-queue the remaining player
        if (sock1 && !sock2) {
          this.matchmakingQueue.set(socket1, player1);
          this.broadcastMatchmakingStatus();
        } else if (sock2 && !sock1) {
          this.matchmakingQueue.set(socket2, player2);
          this.broadcastMatchmakingStatus();
        }
        return;
      }

      // Join both to the room
      sock1.join(roomId);
      sock2.join(roomId);

      room.addPlayer(player1.playerId, player1.name);
      room.addPlayer(player2.playerId, player2.name);

      // Map sockets to room
      this.socketMap.set(socket1, { roomId, playerId: player1.playerId });
      this.socketMap.set(socket2, { roomId, playerId: player2.playerId });

      // Notify each player of their index
      const p1Index = room.getPlayerIndex(player1.playerId);
      const p2Index = room.getPlayerIndex(player2.playerId);

      sock1.emit('matchmaking:matched', {
        roomId,
        playerIndex: p1Index,
        playerName: player1.name,
      });
      sock2.emit('matchmaking:matched', {
        roomId,
        playerIndex: p2Index,
        playerName: player2.name,
      });

      // Update binary mapping and broadcast names
      this.updateBinaryMapping(room);
      const names: Record<number, string> = {};
      for (let i = 0; i < room.playerCount; i++) {
        const pid = room.getPlayerIdByIndex(i);
        if (pid) {
          names[i] = room.getPlayerName(pid) ?? 'PILOTO';
        }
      }
      this.server.to(roomId).emit('game:players', names);

      console.log(
        `✅ Match found! Room ${roomId}: "${player1.name}" vs "${player2.name}"`,
      );
    } else {
      // Not enough players yet
      client.emit('matchmaking:status', {
        count: this.matchmakingQueue.size,
        total: 2,
      });
    }
  }

  @SubscribeMessage('matchmaking:leave')
  handleMatchmakingLeave(
    @ConnectedSocket() client: Socket,
  ) {
    if (this.matchmakingQueue.has(client.id)) {
      this.matchmakingQueue.delete(client.id);
      this.broadcastMatchmakingStatus();
      console.log(`❌ Player left matchmaking queue`);
    }
  }

  private broadcastMatchmakingStatus() {
    for (const [socketId] of this.matchmakingQueue) {
      const sock = this.server.sockets.sockets.get(socketId);
      if (sock) {
        sock.emit('matchmaking:status', {
          count: this.matchmakingQueue.size,
          total: 2,
        });
      }
    }
  }

  // ── Game ──

  @SubscribeMessage('game:join')
  handleJoin(
    @MessageBody()
    data: { roomId?: string; playerId: string; name: string },
    @ConnectedSocket() client: Socket,
  ) {
    let roomId = data.roomId;

    // Solo mode: create a new room if no roomId provided
    if (!roomId || !this.rooms.has(roomId)) {
      if (!data.roomId) {
        roomId = this.createSoloRoom();
      } else {
        client.emit('game:error', { message: 'Sala não encontrada' });
        return;
      }
    }

    const room = this.rooms.get(roomId!);
    if (!room) {
      client.emit('game:error', { message: 'Sala não encontrada' });
      return;
    }

    client.join(roomId);

    const added = room.addPlayer(data.playerId, data.name);
    if (!added) {
      client.emit('game:error', { message: 'Sala cheia' });
      return;
    }

    const playerIndex = room.getPlayerIndex(data.playerId);

    this.socketMap.set(client.id, {
      roomId,
      playerId: data.playerId,
    });

    client.emit('game:joined', {
      roomId,
      playerIndex,
      playerName: data.name,
    });

    console.log(
      `✅ Player "${data.name}" (${data.playerId}) joined room ${roomId} as index ${playerIndex} (${room.playerCount}/2)`,
    );

    this.updateBinaryMapping(room);

    // Broadcast player names to all clients in the room
    const names: Record<number, string> = {};
    for (let i = 0; i < room.playerCount; i++) {
      const pid = room.getPlayerIdByIndex(i);
      if (pid) {
        const pName = room.getPlayerName(pid);
        names[i] = pName ?? 'PILOTO';
      }
    }
    this.server.to(roomId).emit('game:players', names);
  }

  @SubscribeMessage('game:input')
  handleInput(
    @MessageBody()
    data: { type: string; direction?: number },
    @ConnectedSocket() client: Socket,
  ) {
    const mapping = this.socketMap.get(client.id);
    if (!mapping) return;

    const room = this.rooms.get(mapping.roomId);
    if (!room) return;

    room.handleInput(mapping.playerId, data);
  }

  private updateBinaryMapping(room: GameRoom) {
    const players: Array<{ id: string; index: number }> = [];
    for (let i = 0; i < room.playerCount; i++) {
      const pid = room.getPlayerIdByIndex(i);
      if (pid) {
        players.push({ id: pid, index: i });
      }
    }
    setPlayerIdMapping(players);
  }

  private createSoloRoom(): string {
    roomCounter++;
    const newId = `room-${roomCounter}`;
    const newRoom = new GameRoom(newId, (event, payload) => {
      this.server.to(newId).emit(event, payload);
    });
    // Solo starts with 1 player
    newRoom.setMinPlayers(1);
    this.rooms.set(newId, newRoom);
    console.log(`🏠 Created solo room: ${newId}`);
    return newId;
  }
}
