"use client";
                        
import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import {
  decodeSnapshot,
  GameSnapshot,
} from "@/lib/binary-protocol";

export type { GameSnapshot };

// ── Types ──

interface UseGameEngineOptions {
  playerId: string;
  playerName: string;
  mode: "solo" | "multi";
  gameServerUrl?: string;
}

interface UseGameEngineResult {
  snapshot: GameSnapshot | null;
  connected: boolean;
  status: "connecting" | "signaling" | "connected" | "error";
  error: string | null;
  roomId: string;
  playerIndex: number;
  sendInput: (
    type: "move" | "shoot" | "rotate" | "pause",
    direction?: number,
    directionX?: number,
    directionY?: number
  ) => void;
  // Matchmaking (only used in multi mode)
  matchmakingStatus: { count: number; total: number } | null;
  isMatched: boolean;
  joinMatchmaking: () => void;
  leaveMatchmaking: () => void;
  // Ref for direct access without React re-render (use in rAF loops)
  latestSnapshotRef: React.MutableRefObject<GameSnapshot | null>;
}

export function useWebRTCEngine({
  playerId,
  playerName,
  mode,
  gameServerUrl = process.env.NEXT_PUBLIC_GAME_SERVER_URL
}: UseGameEngineOptions): UseGameEngineResult {
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<"connecting" | "signaling" | "connected" | "error">("connecting");
  const [error, setError] = useState<string | null>(null);
  const [roomId, setRoomId] = useState("");
  const [playerIndex, setPlayerIndex] = useState(0);
  const [matchmakingStatus, setMatchmakingStatus] = useState<{ count: number; total: number } | null>(null);
  const [isMatched, setIsMatched] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const playerIndexRef = useRef(0);
  const playerNamesRef = useRef<Map<number, string>>(new Map());
  const latestSnapshotRef = useRef<GameSnapshot | null>(null);

  const sendInput = useCallback((type: "move" | "shoot" | "rotate" | "pause", direction?: number, directionX?: number, directionY?: number) => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;

    socket.emit("game:input", {
      type,
      direction: direction ?? 0,
      directionX,
      directionY
    });
  }, []);

  const joinMatchmaking = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;

    socket.emit("matchmaking:join", { playerId, name: playerName });
  }, [playerId, playerName]);

  const leaveMatchmaking = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || !socket.connected) return;

    socket.emit("matchmaking:leave");
    socket.disconnect();
    setMatchmakingStatus(null);
    setIsMatched(false);
    setConnected(false);
    setStatus("connecting");
  }, []);

  useEffect(() => {
    if (!playerId || !playerName) return;

    let cancelled = false;

    const socket = io(gameServerUrl, { transports: ["polling", "websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      if (cancelled) return;
      console.log("🔌 Connected to game server");

      if (mode === "solo") {
        // Solo: join room immediately
        socket.emit("game:join", { playerId, name: playerName });
      } else {
        // Multi: join matchmaking queue immediately
        socket.emit("matchmaking:join", { playerId, name: playerName });
      }
    });

    // ── Matchmaking events ──

    socket.on("matchmaking:status", (data: { count: number; total: number }) => {
      if (cancelled) return;
      setMatchmakingStatus(data);
      console.log(`🔍 Matchmaking: ${data.count}/${data.total}`);
    });

    socket.on("matchmaking:matched", (data: { roomId: string; playerIndex: number; playerName: string }) => {
      if (cancelled) return;
      setRoomId(data.roomId);
      setPlayerIndex(data.playerIndex);
      playerIndexRef.current = data.playerIndex;
      playerNamesRef.current.set(data.playerIndex, data.playerName);
      setIsMatched(true);
      setMatchmakingStatus(null);
      setStatus("signaling");
      console.log(`✅ Matched! Room ${data.roomId} as index ${data.playerIndex}`);
    });

    // ── Game events ──

    socket.on("game:joined", (data: { roomId: string; playerIndex: number; playerName: string }) => {
      if (cancelled) return;
      setRoomId(data.roomId);
      setPlayerIndex(data.playerIndex);
      playerIndexRef.current = data.playerIndex;
      playerNamesRef.current.set(data.playerIndex, data.playerName);
      setStatus("signaling");
      console.log(`✅ Joined room ${data.roomId} as index ${data.playerIndex}`);
    });

    socket.on("game:players", (names: Record<number, string>) => {
      if (cancelled) return;
      for (const [idx, name] of Object.entries(names)) {
        playerNamesRef.current.set(Number(idx), name);
      }
    });

    socket.on("game:error", (err: { message: string }) => {
      if (cancelled) return;
      setError(err.message);
      setStatus("error");
    });

    let lastSnapshotTime = 0;
    let lastStatus = "";
    const SNAPSHOT_THROTTLE_MS = 100;

    socket.on("game:snapshot", (data: ArrayBuffer | GameSnapshot) => {
      if (cancelled) return;

      let snap: GameSnapshot;
      if (data instanceof ArrayBuffer) {
        snap = decodeSnapshot(data, playerId, playerNamesRef.current);
      } else {
        snap = data as GameSnapshot;
      }

      // Always store in ref for render loop (runs at 60fps via rAF)
      latestSnapshotRef.current = snap;

      // Always update state immediately when status changes (gameover, paused, etc)
      // Only throttle position-only updates to reduce React overhead
      const statusChanged = snap.status !== lastStatus;
      if (statusChanged) {
        lastStatus = snap.status;
        setSnapshot(snap);
        lastSnapshotTime = 0; // Reset throttle so next frame also updates
      } else {
        const now = Date.now();
        if (now - lastSnapshotTime >= SNAPSHOT_THROTTLE_MS) {
          lastSnapshotTime = now;
          setSnapshot(snap);
        }
      }

      setConnected(true);
      setStatus("connected");
    });

    socket.on("connect_error", (err: Error) => {
      if (cancelled) return;
      setError(err.message);
      setStatus("error");
    });

    socket.on("disconnect", () => {
      if (cancelled) return;
      setConnected(false);
      setMatchmakingStatus(null);
      setIsMatched(false);
      setStatus("connecting");
    });

    return () => {
      cancelled = true;
      socket.disconnect();
    };
  }, [playerId, playerName, mode, gameServerUrl]);

  return {
    snapshot,
    connected,
    status,
    error,
    roomId,
    playerIndex,
    sendInput,
    matchmakingStatus,
    isMatched,
    joinMatchmaking,
    leaveMatchmaking,
    latestSnapshotRef,
  };
}
