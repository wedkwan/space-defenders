"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SpaceBackground from "@/components/SpaceBackground";
import { authService } from "@/utils/authService";
import { useWebRTCEngine, GameSnapshot } from "@/hooks/useGameEngine";

const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;

function createExplosion(x: number, y: number, color: string) {
  const particles: Array<{
    x: number; y: number; vx: number; vy: number;
    color: string; alpha: number; size: number;
  }> = [];
  for (let i = 0; i < 12; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.5 + Math.random() * 2;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color,
      alpha: 1.0,
      size: 1 + Math.random() * 1.5,
    });
  }
  return particles;
}

export default function PlaySolo() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const snapshotRef = useRef<GameSnapshot | null>(null);
  const prevSnapshotRef = useRef<GameSnapshot | null>(null);
  const particlesRef = useRef<Array<{
    x: number; y: number; vx: number; vy: number;
    color: string; alpha: number; size: number;
  }>>([]);
  const keysRef = useRef<Record<string, boolean>>({});

  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const playerImgRef = useRef<HTMLImageElement | null>(null);
  const enemyImgRef = useRef<HTMLImageElement | null>(null);
  const heartImgRef = useRef<HTMLImageElement | null>(null);

  // Auth
  const [playerId, setPlayerId] = useState("");
  const [playerName, setPlayerName] = useState("PILOTO");

  useEffect(() => {
    const user = authService.getCurrentUser();
    if (!user) {
      router.push("/auth");
      return;
    }
    const id = user.id?.toString() || Math.random().toString(36).substring(2, 12);
    setPlayerId(id);
    setPlayerName(authService.getDisplayName() || user.name || "PILOTO");
  }, [router]);

  // WebRTC engine
  const { snapshot, connected, status, error, roomId, playerIndex, sendInput, latestSnapshotRef } = useWebRTCEngine({
    playerId,
    playerName,
    mode: "solo",
  });

  const showMenu = snapshot?.status === "paused";

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(
        window.innerWidth < 1024 ||
        ("ontouchstart" in window) ||
        navigator.maxTouchPoints > 0
      );
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Load sprites with timeout fallback
  useEffect(() => {
    const playerImg = new Image();
    playerImg.src = "/player_spritesheet.png";
    const enemyImg = new Image();
    enemyImg.src = "/enemies-sprite.png";
    const heartImg = new Image();
    heartImg.src = "/heal-heart-pixilart.png";

    let loaded = 0;
    const onLoad = () => {
      loaded++;
      if (loaded === 3) {
        playerImgRef.current = playerImg;
        enemyImgRef.current = enemyImg;
        heartImgRef.current = heartImg;
        setImagesLoaded(true);
      }
    };
    playerImg.onload = onLoad;
    enemyImg.onload = onLoad;
    heartImg.onload = onLoad;

    // Timeout fallback: start game even if images fail to load (fallback to colored rects)
    const timeout = setTimeout(() => {
      if (loaded < 3) {
        playerImgRef.current = playerImg.complete ? playerImg : null;
        enemyImgRef.current = enemyImg.complete ? enemyImg : null;
        heartImgRef.current = heartImg.complete ? heartImg : null;
        setImagesLoaded(true);
      }
    }, 5000);

    return () => clearTimeout(timeout);
  }, []);

  // Keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        sendInput("pause");
      }
      if (e.key === "q" || e.key === "Q") {
        e.preventDefault();
        sendInput("rotate");
      }
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " ", "a", "A", "d", "D", "w", "W", "s", "S", "q", "Q"].includes(e.key)) {
        e.preventDefault();
      }
      keysRef.current[e.key] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key] = false;
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [sendInput]);

  // Input send loop — fixed 20Hz (50ms) to match server tick rate
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (!connected || status !== "connected") return;

      // Don't send inputs if game is over
      const snap = latestSnapshotRef.current;
      if (snap && snap.status === "gameover") return;

      const keys = keysRef.current;
      let dx = 0;
      let dy = 0;

      if (keys["ArrowLeft"] || keys["a"] || keys["A"]) {
        dx = -1;
      } else if (keys["ArrowRight"] || keys["d"] || keys["D"]) {
        dx = 1;
      }

      if (keys["ArrowUp"] || keys["w"] || keys["W"]) {
        dy = -1;
      } else if (keys["ArrowDown"] || keys["s"] || keys["S"]) {
        dy = 1;
      }

      // Only send move when there's actual movement
      if (dx !== 0 || dy !== 0) {
        sendInput("move", dx, dx, dy);
      }

      if (keys[" "]) {
        sendInput("shoot");
      }
    }, 50);

    return () => clearInterval(intervalId);
  }, [connected, status, sendInput]);

  // Store latest snapshot in ref for render loop
  useEffect(() => {
    if (snapshot) {
      // Particle generation from snapshot diffing
      if (snapshotRef.current) {
        prevSnapshotRef.current = snapshotRef.current;

        const prevEnemies = prevSnapshotRef.current.enemies || [];
        for (const prevEnemy of prevEnemies) {
          if (!snapshot.enemies.some((e) => e.id === prevEnemy.id)) {
            particlesRef.current.push(
              ...createExplosion(
                prevEnemy.x + prevEnemy.width / 2,
                prevEnemy.y + prevEnemy.height / 2,
                "#65c5de"
              )
            );
          }
        }

        const prevPlayers = prevSnapshotRef.current.players || [];
        for (const currPlayer of snapshot.players) {
          const prevPlayer = prevPlayers.find((p) => p.id === currPlayer.id);
          if (prevPlayer && currPlayer.lives < prevPlayer.lives) {
            particlesRef.current.push(
              ...createExplosion(
                currPlayer.x + currPlayer.width / 2,
                currPlayer.y + currPlayer.height / 2,
                "#ff4d4d"
              )
            );
          }
        }
      }

      snapshotRef.current = snapshot;
      latestSnapshotRef.current = snapshot;
    }
  }, [snapshot]);

  // Canvas rendering loop
  useEffect(() => {
    if (!imagesLoaded) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = GAME_WIDTH;
    canvas.height = GAME_HEIGHT;

    let animFrameId: number;

    const render = () => {
      const snap = latestSnapshotRef.current;

      ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

      if (!snap) {
        ctx.fillStyle = "#65c5de";
        ctx.font = "16px monospace";
        ctx.textAlign = "center";
        ctx.fillText("CONECTANDO AO SERVIDOR...", GAME_WIDTH / 2, GAME_HEIGHT / 2);
        animFrameId = requestAnimationFrame(render);
        return;
      }

      ctx.save();
      ctx.scale(2, 2);

      const playerImg = playerImgRef.current;
      const enemyImg = enemyImgRef.current;

      // Draw enemies (sprite sheet: 4 frames of 400x400)
      // Odd waves go down (flip), even waves go up (normal)
      const flipEnemies = snap.wave % 2 !== 0;
      for (const enemy of snap.enemies) {
        if (enemyImg) {
          ctx.save();
          if (flipEnemies) {
            ctx.translate(enemy.x, enemy.y + enemy.height);
            ctx.scale(1, -1);
            const sx = (enemy.frame ?? 0) * 400;
            ctx.drawImage(enemyImg, sx, 0, 400, 400, 0, 0, enemy.width, enemy.height);
          } else {
            const sx = (enemy.frame ?? 0) * 400;
            ctx.drawImage(enemyImg, sx, 0, 400, 400, enemy.x, enemy.y, enemy.width, enemy.height);
          }
          ctx.restore();
        } else {
          ctx.fillStyle = "#65c5de";
          ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
        }
      }

      // Draw players
      for (let pi = 0; pi < snap.players.length; pi++) {
        const player = snap.players[pi];
        const isMe = pi === playerIndex;
        if (player.lives <= 0) continue;
        if (player.invincible > 0 && Math.floor(Date.now() / 100) % 2 === 0) continue;

        ctx.save();
        // Mover para o centro do player para rotacionar
        const cx = player.x + player.width / 2;
        const cy = player.y + player.height / 2;
        ctx.translate(cx, cy);

        // Rotacionar com base na direção
        const dir = player.direction ?? 'UP';
        let angle = 0;
        if (dir === 'RIGHT') angle = Math.PI / 2;
        else if (dir === 'DOWN') angle = Math.PI;
        else if (dir === 'LEFT') angle = -Math.PI / 2;
        ctx.rotate(angle);

        if (playerImg) {
          const sx = (player.frame ?? 0) * 400;
          ctx.drawImage(playerImg, sx, 0, 400, 400, -player.width / 2, -player.height / 2, player.width, player.height);
        } else {
          ctx.fillStyle = "#65c5de";
          ctx.fillRect(-player.width / 2, -player.height / 2, player.width, player.height);
        }
        ctx.restore();
      }

      // Draw bullets
      for (const bullet of snap.bullets) {
        const color = !bullet.isPlayerBullet
          ? "#ff4d4d"
          : "#65c5de";

        ctx.save();
        ctx.translate(bullet.x, bullet.y);
        ctx.fillStyle = color;

        ctx.fillRect(-bullet.width / 2, -bullet.height / 2, bullet.width, bullet.height);
        ctx.restore();
      }

      // Draw hearts
      const heartImg = heartImgRef.current;
      for (const heart of snap.hearts) {
        ctx.save();
        // Bobbing animation
        const bob = Math.sin(Date.now() / 300) * 2;
        ctx.translate(heart.x + heart.width / 2, heart.y + heart.height / 2 + bob);

        if (heartImg) {
          ctx.drawImage(heartImg, -heart.width / 2, -heart.height / 2, heart.width, heart.height);
        } else {
          ctx.fillStyle = "#ff4d6a";
          ctx.fillRect(-heart.width / 2, -heart.height / 2, heart.width, heart.height);
        }
        ctx.restore();
      }

      // Draw particles (write-index to avoid splice GC pressure)
      const particles = particlesRef.current;
      let writeIdx = 0;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.02;
        if (p.alpha <= 0) continue;
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        ctx.restore();
        particles[writeIdx++] = p;
      }
      particles.length = writeIdx;

      ctx.restore();

      // Game Over overlay
      if (snap.status === "gameover") {
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        ctx.fillStyle = "#ff4d4d";
        ctx.font = "32px monospace";
        ctx.textAlign = "center";
        ctx.fillText("GAME OVER", GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20);
        ctx.fillStyle = "#65c5de";
        ctx.font = "14px monospace";
        ctx.fillText(`WAVE ${snap.wave}`, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20);
      }

      animFrameId = requestAnimationFrame(render);
    };

    animFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameId);
  }, [imagesLoaded, playerId]);

  // HUD data from snapshot
  const myScore = snapshot?.players[playerIndex]?.score ?? 0;
  const myLives = snapshot?.players[playerIndex]?.lives ?? 3;
  const wave = snapshot?.wave ?? 1;
  const isGameOver = snapshot?.status === "gameover";

  // Submit score on game over
  const hasSubmittedRef = useRef(false);

  useEffect(() => {
    if (isGameOver && myScore > 0 && !hasSubmittedRef.current) {
      hasSubmittedRef.current = true;
      authService.submitScore(myScore, wave).catch((err) => {
        console.error("Erro ao salvar score solo:", err);
      });
    }
    if (!isGameOver) {
      hasSubmittedRef.current = false;
    }
  }, [isGameOver, myScore, wave]);

  // Mobile touch handlers
  const handleMoveLeftStart = () => { keysRef.current["ArrowLeft"] = true; };
  const handleMoveLeftEnd = () => { keysRef.current["ArrowLeft"] = false; };
  const handleMoveRightStart = () => { keysRef.current["ArrowRight"] = true; };
  const handleMoveRightEnd = () => { keysRef.current["ArrowRight"] = false; };
  const handleMoveUpStart = () => { keysRef.current["ArrowUp"] = true; };
  const handleMoveUpEnd = () => { keysRef.current["ArrowUp"] = false; };
  const handleMoveDownStart = () => { keysRef.current["ArrowDown"] = true; };
  const handleMoveDownEnd = () => { keysRef.current["ArrowDown"] = false; };
  const handleShootStart = () => { keysRef.current[" "] = true; };
  const handleShootEnd = () => { keysRef.current[" "] = false; };

  return (
    <div className="relative min-h-screen w-screen overflow-hidden flex flex-col items-center justify-center bg-black">
      <SpaceBackground />

      {/* Top HUD */}
      <div className="relative z-10 w-full max-w-[800px] px-4 flex justify-between items-center mb-2 font-pixel select-none text-[10px] sm:text-xs">
        <div className="text-zinc-400">
          SCORE: <span className="text-[#65c5de]">{myScore.toString().padStart(6, "0")}</span>
        </div>
        <div className="text-zinc-400 text-center">
          WAVE: <span className="text-white">{wave}</span>
          {" | "}
          <span className={`text-[10px] ${connected ? "text-green-400" : "text-yellow-400"}`}>
            {connected ? "CONECTADO" : "CONECTANDO..."}
          </span>
        </div>
        <div className="text-zinc-400 flex items-center gap-1">
          LIVES:{" "}
          <span className="text-red-500 text-sm flex gap-0.5 leading-none">
            {Array.from({ length: 3 }).map((_, idx) => (
              <span key={idx} className={idx < myLives ? "opacity-100" : "opacity-20"}>
                ♥
              </span>
            ))}
          </span>
          {isMobile && !isGameOver && (
            <button
              onClick={() => sendInput("pause")}
              className="ml-2 bg-[#65c5de] hover:bg-[#4bb7d3] border-b-2 border-r-2 border-[#2d8fb4] text-white p-1.5 rounded-sm active:translate-y-[1px] active:translate-x-[1px] active:border-b active:border-r transition-all select-none touch-none flex items-center justify-center"
            >
              {showMenu ? (
                <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              ) : (
                <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                </svg>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Game Canvas */}
      <div className="relative z-10 w-full max-w-[800px] aspect-[4/3] border-4 border-[#2d8fb4] bg-black/80 rounded-md overflow-hidden shadow-[0_0_30px_rgba(45,143,180,0.3)]">
        <canvas ref={canvasRef} className="w-full h-full block touch-none" />

        {/* Loading overlay */}
        {!imagesLoaded && (
          <div className="absolute inset-0 bg-black flex flex-col items-center justify-center font-pixel text-xs text-[#65c5de] select-none">
            CARREGANDO ATIVOS...
          </div>
        )}

        {/* Connecting overlay */}
        {imagesLoaded && status === "connecting" && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center font-pixel text-xs text-[#65c5de] select-none animate-pulse">
            CONECTANDO AO SERVIDOR DE JOGO...
          </div>
        )}

        {/* Signaling overlay */}
        {status === "signaling" && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center font-pixel text-xs select-none z-20">
            <div className="text-[#65c5de] text-base mb-3 animate-pulse tracking-widest">
              ESTABELECENDO CONEXÃO WebRTC...
            </div>
            <div className="text-zinc-400 text-[10px]">
              MODO SOLO — AGUARDE
            </div>
          </div>
        )}

        {/* Pause menu */}
        {showMenu && !isGameOver && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-6 z-20 animate-fade-in select-none">
            <div className="bg-[#0b0c10]/95 border-4 border-[#65c5de] rounded-md p-8 max-w-sm w-full text-center shadow-[0_0_25px_rgba(101,197,222,0.4)]">
              <h2 className="text-[#65c5de] text-xl mb-4 tracking-widest font-pixel uppercase animate-pulse">
                JOGO PAUSADO
              </h2>
              <p className="text-zinc-400 text-[10px] font-pixel mb-6 uppercase">
                Pressione P para Retomar
              </p>
              <div className="flex flex-col gap-4">
                <button
                  onClick={() => sendInput("pause")}
                  className="w-full text-white bg-[#65c5de] border-b-4 border-r-4 border-[#2d8fb4] hover:bg-[#4bb7d3] active:border-b-2 active:border-r-2 active:translate-y-[2px] active:translate-x-[1px] py-3 px-4 text-xs tracking-wider transition-all duration-100 font-pixel uppercase cursor-pointer rounded-sm shadow-md"
                >
                  RETOMAR
                </button>
                <Link href="/" className="w-full">
                  <span className="block w-full text-white bg-[#ff4d4d] border-b-4 border-r-4 border-[#cc3333] hover:bg-[#ff6666] active:border-b-2 active:border-r-2 active:translate-y-[2px] active:translate-x-[1px] py-3 px-4 text-xs tracking-wider transition-all duration-100 font-pixel uppercase cursor-pointer rounded-sm shadow-md">
                    MENU PRINCIPAL
                  </span>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Game Over overlay */}
        {isGameOver && (
          <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center p-6 z-20 animate-fade-in select-none">
            <div className="bg-[#0b0c10]/90 border-4 border-[#ff4d4d] rounded-md p-8 max-w-sm w-full text-center shadow-[0_0_25px_rgba(255,77,77,0.5)]">
              <h2 className="text-[#ff4d4d] text-xl mb-4 tracking-widest font-pixel uppercase animate-pulse">
                GAME OVER
              </h2>
              <div className="text-zinc-400 text-[10px] font-pixel mb-6 uppercase">
                PONTUAÇÃO FINAL:
                <div className="text-white text-base mt-1 text-[#65c5de]">{myScore}</div>
              </div>
              <div className="flex flex-col gap-4">
                <button
                  onClick={() => window.location.reload()}
                  className="w-full text-white bg-[#65c5de] border-b-4 border-r-4 border-[#2d8fb4] hover:bg-[#4bb7d3] active:border-b-2 active:border-r-2 active:translate-y-[2px] active:translate-x-[1px] py-3 px-4 text-xs tracking-wider transition-all duration-100 font-pixel uppercase cursor-pointer rounded-sm shadow-md text-center"
                >
                  REPLAY
                </button>
                <Link href="/" className="w-full">
                  <span className="block w-full text-white bg-[#ff4d4d] border-b-4 border-r-4 border-[#cc3333] hover:bg-[#ff6666] active:border-b-2 active:border-r-2 active:translate-y-[2px] active:translate-x-[1px] py-3 px-4 text-xs tracking-wider transition-all duration-100 font-pixel uppercase cursor-pointer rounded-sm shadow-md text-center">
                    MENU PRINCIPAL
                  </span>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center p-6 z-20 select-none">
            <div className="bg-[#0b0c10]/90 border-4 border-[#ff4d4d] rounded-md p-8 max-w-sm w-full text-center">
              <h2 className="text-[#ff4d4d] text-lg mb-4 font-pixel uppercase">
                ERRO DE CONEXÃO
              </h2>
              <p className="text-zinc-400 text-[10px] font-pixel mb-6 uppercase">
                {error}
              </p>
              <Link href="/play" className="w-full">
                <span className="block w-full text-white bg-[#ff4d4d] border-b-4 border-r-4 border-[#cc3333] hover:bg-[#ff6666] py-3 px-4 text-xs tracking-wider transition-all duration-100 font-pixel uppercase cursor-pointer rounded-sm shadow-md">
                  VOLTAR
                </span>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Controls help */}
      <div className="relative z-10 mt-3 font-pixel text-[8px] sm:text-[10px] text-zinc-500 uppercase select-none text-center">
        Mover: WASD ou Setas | Atirar: Espaço | Pausar: P
      </div>

      {/* Mobile touch controls */}
      {isMobile && (
        <div className="relative z-20 w-full max-w-[800px] flex justify-between items-center px-6 mt-4 select-none">
          {/* D-Pad: up/down/left/right */}
          <div className="grid grid-cols-3 grid-rows-3 gap-1 w-28">
            {/* row 1: up */}
            <div />
            <button
              onTouchStart={handleMoveUpStart}
              onTouchEnd={handleMoveUpEnd}
              onMouseDown={handleMoveUpStart}
              onMouseUp={handleMoveUpEnd}
              onMouseLeave={handleMoveUpEnd}
              className="bg-[#65c5de] hover:bg-[#4bb7d3] border-b-4 border-r-4 border-[#2d8fb4] text-white py-2 active:border-b-2 active:border-r-2 active:translate-y-[2px] active:translate-x-[1px] transition-all duration-100 rounded-sm shadow-md cursor-pointer touch-none flex items-center justify-center"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 4l-8 8h5v8h6v-8h5z"/></svg>
            </button>
            <div />

            {/* row 2: left / center / right */}
            <button
              onTouchStart={handleMoveLeftStart}
              onTouchEnd={handleMoveLeftEnd}
              onMouseDown={handleMoveLeftStart}
              onMouseUp={handleMoveLeftEnd}
              onMouseLeave={handleMoveLeftEnd}
              className="bg-[#65c5de] hover:bg-[#4bb7d3] border-b-4 border-r-4 border-[#2d8fb4] text-white py-2 active:border-b-2 active:border-r-2 active:translate-y-[2px] active:translate-x-[1px] transition-all duration-100 rounded-sm shadow-md cursor-pointer touch-none flex items-center justify-center"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M4 12l8-8v5h8v6h-8v5z"/></svg>
            </button>
            <div />
            <button
              onTouchStart={handleMoveRightStart}
              onTouchEnd={handleMoveRightEnd}
              onMouseDown={handleMoveRightStart}
              onMouseUp={handleMoveRightEnd}
              onMouseLeave={handleMoveRightEnd}
              className="bg-[#65c5de] hover:bg-[#4bb7d3] border-b-4 border-r-4 border-[#2d8fb4] text-white py-2 active:border-b-2 active:border-r-2 active:translate-y-[2px] active:translate-x-[1px] transition-all duration-100 rounded-sm shadow-md cursor-pointer touch-none flex items-center justify-center"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M20 12l-8-8v5H4v6h8v5z"/></svg>
            </button>

            {/* row 3: down */}
            <div />
            <button
              onTouchStart={handleMoveDownStart}
              onTouchEnd={handleMoveDownEnd}
              onMouseDown={handleMoveDownStart}
              onMouseUp={handleMoveDownEnd}
              onMouseLeave={handleMoveDownEnd}
              className="bg-[#65c5de] hover:bg-[#4bb7d3] border-b-4 border-r-4 border-[#2d8fb4] text-white py-2 active:border-b-2 active:border-r-2 active:translate-y-[2px] active:translate-x-[1px] transition-all duration-100 rounded-sm shadow-md cursor-pointer touch-none flex items-center justify-center"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 20l8-8h-5V4H9v8H4z"/></svg>
            </button>
            <div />
          </div>

          <div className="flex gap-2">
            <button
              onTouchStart={handleShootStart}
              onTouchEnd={handleShootEnd}
              onMouseDown={handleShootStart}
              onMouseUp={handleShootEnd}
              onMouseLeave={handleShootEnd}
              className="bg-[#65c5de] hover:bg-[#4bb7d3] border-b-4 border-r-4 border-[#2d8fb4] text-white font-pixel text-xs tracking-wider py-4 px-8 active:border-b-2 active:border-r-2 active:translate-y-[2px] active:translate-x-[1px] transition-all duration-100 rounded-sm shadow-md cursor-pointer uppercase touch-none"
            >
              ATIRAR
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
