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
    const speed = 1 + Math.random() * 4;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      color,
      alpha: 1.0,
      size: 2 + Math.random() * 3,
    });
  }
  return particles;
}

export default function MultiplayerPage() {
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
  const [showMenu, setShowMenu] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const playerImgRef = useRef<HTMLImageElement | null>(null);
  const enemyImgRef = useRef<HTMLImageElement | null>(null);

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

  // Game engine
  const {
    snapshot, connected, status, error, roomId, playerIndex, sendInput,
    matchmakingStatus, isMatched, leaveMatchmaking,
  } = useWebRTCEngine({
    playerId,
    playerName,
    mode: "multi",
  });

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

  // Load images
  useEffect(() => {
    const playerImg = new Image();
    const enemyImg = new Image();
    playerImg.src = "/player_spritesheet.png";
    enemyImg.src = "/enemy_spritesheet.png";
    playerImgRef.current = playerImg;
    enemyImgRef.current = enemyImg;

    let loaded = 0;
    const onLoad = () => {
      loaded++;
      if (loaded >= 2) setImagesLoaded(true);
    };
    playerImg.onload = onLoad;
    enemyImg.onload = onLoad;
  }, []);

  // Keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        setShowMenu((prev) => !prev);
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

  // Input send loop (60Hz)
  useEffect(() => {
    const sendInputs = () => {
      if (!connected || status !== "connected" || !isMatched) {
        requestAnimationFrame(sendInputs);
        return;
      }

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

      sendInput("move", dx, dx, dy);

      if (keys[" "]) {
        sendInput("shoot");
      }

      requestAnimationFrame(sendInputs);
    };

    const id = requestAnimationFrame(sendInputs);
    return () => cancelAnimationFrame(id);
  }, [connected, status, sendInput, isMatched]);

  // Store latest snapshot in ref for render loop
  useEffect(() => {
    if (snapshot) {
      if (snapshotRef.current) {
        prevSnapshotRef.current = snapshotRef.current;

        const prevEnemies = prevSnapshotRef.current.enemies || [];
        for (const prevEnemy of prevEnemies) {
          if (!snapshot.enemies.find((e) => e.id === prevEnemy.id)) {
            particlesRef.current.push(
              ...createExplosion(prevEnemy.x + prevEnemy.width / 2, prevEnemy.y + prevEnemy.height / 2, "#65c5de")
            );
          }
        }

        const prevPlayers = prevSnapshotRef.current.players || [];
        for (const prevPlayer of prevPlayers) {
          const currPlayer = snapshot.players.find((p) => p.id === prevPlayer.id);
          if (currPlayer && currPlayer.lives < prevPlayer.lives) {
            particlesRef.current.push(
              ...createExplosion(currPlayer.x + currPlayer.width / 2, currPlayer.y + currPlayer.height / 2, "#ff4d4d")
            );
          }
        }
      }
      snapshotRef.current = snapshot;
    }
  }, [snapshot]);

  // Canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = GAME_WIDTH;
    canvas.height = GAME_HEIGHT;

    let animFrameId: number;

    const render = () => {
      const snap = snapshotRef.current;

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

      const playerImg = playerImgRef.current;
      const enemyImg = enemyImgRef.current;

      // Draw enemies
      for (const enemy of snap.enemies) {
        if (enemyImg) {
          const sx = (enemy.frame ?? 0) * 100;
          ctx.drawImage(enemyImg, sx, 0, 100, 100, enemy.x, enemy.y, enemy.width, enemy.height);
        } else {
          ctx.fillStyle = "#65c5de";
          ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
        }
      }

      // Draw players
      for (let pi = 0; pi < snap.players.length; pi++) {
        const player = snap.players[pi];
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

        // Player name tag (não rotaciona com a nave, desenha acima)
        ctx.fillStyle = "#65c5de";
        ctx.font = "10px monospace";
        ctx.textAlign = "center";
        ctx.fillText(player.name, player.x + player.width / 2, player.y - 8);
      }

      // Draw bullets
      for (const bullet of snap.bullets) {
        const color = !bullet.isPlayerBullet
          ? "#ff4d4d"
          : "#65c5de";

        ctx.save();
        ctx.translate(bullet.x, bullet.y);
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        
        // Se a bala se move em X, desenha na horizontal, senão vertical
        const isHorizontal = Math.abs(bullet.vx) > 0;
        if (isHorizontal) {
          ctx.fillRect(-8, -2, 16, 4);
        } else {
          ctx.fillRect(-2, -8, 4, 16);
        }
        ctx.restore();
      }

      // Draw particles
      particlesRef.current = particlesRef.current.filter((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.02;
        if (p.alpha <= 0) return false;

        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        return true;
      });

      animFrameId = requestAnimationFrame(render);
    };

    animFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameId);
  }, [imagesLoaded, playerId]);

  // HUD data
  const myScore = snapshot?.players[playerIndex]?.score ?? 0;
  const myLives = snapshot?.players[playerIndex]?.lives ?? 3;
  const wave = snapshot?.wave ?? 1;
  const playerCount = snapshot?.players.length ?? 0;
  const isGameOver = snapshot?.status === "gameover";

  // Submit score on game over
  useEffect(() => {
    if (isGameOver && myScore > 0) {
      authService.submitScore(myScore, wave).catch(() => {});
    }
  }, [isGameOver]);

  // Mobile touch handlers
  const handleMoveLeftStart = () => { keysRef.current["ArrowLeft"] = true; };
  const handleMoveLeftEnd = () => { keysRef.current["ArrowLeft"] = false; };
  const handleMoveRightStart = () => { keysRef.current["ArrowRight"] = true; };
  const handleMoveRightEnd = () => { keysRef.current["ArrowRight"] = false; };
  const handleShootStart = () => { keysRef.current[" "] = true; };
  const handleShootEnd = () => { keysRef.current[" "] = false; };

  return (
    <div className="relative min-h-screen w-screen overflow-hidden flex flex-col items-center justify-center bg-black">
      <SpaceBackground />

      {/* ── Matchmaking Overlay ── */}
      {!isMatched && (
        <div className="absolute inset-0 z-30 bg-black/90 flex flex-col items-center justify-center select-none">
          <div className="flex flex-col items-center">
            {/* Animated ship icon */}
            <div className="mb-8 relative">
              <div className="w-20 h-20 border-4 border-[#65c5de] rounded-full flex items-center justify-center animate-pulse shadow-[0_0_30px_rgba(101,197,222,0.4)] overflow-hidden">
                <div className="w-12 h-12 animate-bounce" style={{
                  backgroundImage: 'url(/player_spritesheet.png)',
                  backgroundSize: '200% 100%',
                  backgroundPosition: 'left center',
                  backgroundRepeat: 'no-repeat',
                  imageRendering: 'pixelated',
                }} />
              </div>
              <div className="absolute inset-0 border-2 border-transparent border-t-[#65c5de] rounded-full animate-spin" style={{ animationDuration: '2s' }} />
            </div>

            <h1 className="text-[#65c5de] text-lg sm:text-xl font-pixel tracking-widest mb-2 uppercase">
              PROCURANDO ADVERSÁRIO
            </h1>

            <div className="flex items-baseline gap-2 mb-6">
              <span className="text-white text-5xl font-pixel font-bold">
                {matchmakingStatus?.count ?? 0}
              </span>
              <span className="text-[#65c5de] text-2xl font-pixel">/</span>
              <span className="text-[#65c5de] text-2xl font-pixel">
                {matchmakingStatus?.total ?? 2}
              </span>
            </div>

            <p className="text-zinc-500 text-[10px] font-pixel tracking-wider uppercase mb-8">
              PILOTOS ENCONTRADOS
            </p>

            <div className="flex gap-2 mb-8">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 bg-[#65c5de] rounded-full animate-pulse"
                  style={{ animationDelay: `${i * 0.3}s` }}
                />
              ))}
            </div>

            {error && (
              <div className="text-[#ff4d4d] text-[10px] font-pixel mb-4 uppercase">
                {error}
              </div>
            )}

            <Link href="/play">
              <button
                onClick={leaveMatchmaking}
                className="bg-transparent border-2 border-[#65c5de] text-[#65c5de] font-pixel text-xs tracking-wider py-3 px-8 hover:bg-[#65c5de]/10 transition-all duration-200 rounded-sm cursor-pointer uppercase"
              >
                CANCELAR
              </button>
            </Link>
          </div>
        </div>
      )}

      {/* Top HUD */}
      <div className="relative z-10 w-full max-w-[800px] px-4 flex justify-between items-center mb-2 font-pixel select-none text-[10px] sm:text-xs">
        <div className="text-zinc-400">
          SCORE: <span className="text-[#65c5de]">{myScore.toString().padStart(6, "0")}</span>
        </div>
        <div className="text-zinc-400 text-center">
          WAVE: <span className="text-white">{wave}</span>
          {" | "}
          <span className="text-[#65c5de]">JOGADORES: {playerCount}</span>
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
              onClick={() => setShowMenu((prev) => !prev)}
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
        <canvas ref={canvasRef} className="w-full h-full block" />

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

        {/* Exit Menu */}
        {showMenu && !isGameOver && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-6 z-20 animate-fade-in select-none">
            <div className="bg-[#0b0c10]/95 border-4 border-[#65c5de] rounded-md p-8 max-w-sm w-full text-center shadow-[0_0_25px_rgba(101,197,222,0.4)]">
              <h2 className="text-[#65c5de] text-xl mb-4 tracking-widest font-pixel uppercase animate-pulse">
                MENU DE PARTIDA
              </h2>
              <p className="text-zinc-400 text-[10px] font-pixel mb-6 uppercase">
                O jogo continua rodando em segundo plano!
              </p>
              <div className="flex flex-col gap-4">
                <button
                  onClick={() => setShowMenu(false)}
                  className="w-full text-white bg-[#65c5de] border-b-4 border-r-4 border-[#2d8fb4] hover:bg-[#4bb7d3] active:border-b-2 active:border-r-2 active:translate-y-[2px] active:translate-x-[1px] py-3 px-4 text-xs tracking-wider transition-all duration-100 font-pixel uppercase cursor-pointer rounded-sm shadow-md"
                >
                  RETOMAR PARTIDA
                </button>
                <Link href="/play" className="w-full">
                  <span className="block w-full text-white bg-[#ff4d4d] border-b-4 border-r-4 border-[#cc3333] hover:bg-[#ff6666] active:border-b-2 active:border-r-2 active:translate-y-[2px] active:translate-x-[1px] py-3 px-4 text-xs tracking-wider transition-all duration-100 font-pixel uppercase cursor-pointer rounded-sm shadow-md text-center">
                    SAIR PARA O LOBBY
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

              {snapshotRef.current && (
                <div className="mb-6">
                  {snapshotRef.current.players.map((p, idx) => (
                    <div key={p.id} className="flex justify-between font-pixel text-[9px] text-zinc-300 mb-1">
                      <span className="text-[#65c5de]">
                        {p.name}
                      </span>
                      <span className="text-[#65c5de]">{p.score} PTS</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-4">
                <Link href="/play" className="w-full">
                  <span className="block w-full text-white bg-[#65c5de] border-b-4 border-r-4 border-[#2d8fb4] hover:bg-[#4bb7d3] active:border-b-2 active:border-r-2 active:translate-y-[2px] active:translate-x-[1px] py-3 px-4 text-xs tracking-wider transition-all duration-100 font-pixel uppercase cursor-pointer rounded-sm shadow-md text-center">
                    VOLTAR AO LOBBY
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
        Mover: WASD ou Setas | Atirar: Espaço | Mirar/Girar: Q
      </div>

      {/* Mobile touch controls */}
      {isMobile && (
        <div className="relative z-20 w-full max-w-[800px] flex justify-between items-center px-6 mt-4 select-none">
          <div className="flex gap-4">
            <button
              onTouchStart={handleMoveLeftStart}
              onTouchEnd={handleMoveLeftEnd}
              onMouseDown={handleMoveLeftStart}
              onMouseUp={handleMoveLeftEnd}
              onMouseLeave={handleMoveLeftEnd}
              className="bg-[#65c5de] hover:bg-[#4bb7d3] border-b-4 border-r-4 border-[#2d8fb4] text-white font-pixel text-lg py-3 px-6 active:border-b-2 active:border-r-2 active:translate-y-[2px] active:translate-x-[1px] transition-all duration-100 rounded-sm shadow-md cursor-pointer touch-none"
            >
              ◀
            </button>
            <button
              onTouchStart={handleMoveRightStart}
              onTouchEnd={handleMoveRightEnd}
              onMouseDown={handleMoveRightStart}
              onMouseUp={handleMoveRightEnd}
              onMouseLeave={handleMoveRightEnd}
              className="bg-[#65c5de] hover:bg-[#4bb7d3] border-b-4 border-r-4 border-[#2d8fb4] text-white font-pixel text-lg py-3 px-6 active:border-b-2 active:border-r-2 active:translate-y-[2px] active:translate-x-[1px] transition-all duration-100 rounded-sm shadow-md cursor-pointer touch-none"
            >
              ▶
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => sendInput("rotate")}
              className="bg-[#2d8fb4] hover:bg-[#4bb7d3] border-b-4 border-r-4 border-[#005f73] text-white font-pixel text-xs py-3 px-4 active:border-b-2 active:border-r-2 active:translate-y-[2px] active:translate-x-[1px] transition-all duration-100 rounded-sm shadow-md cursor-pointer uppercase touch-none"
            >
              GIRAR (Q)
            </button>
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
