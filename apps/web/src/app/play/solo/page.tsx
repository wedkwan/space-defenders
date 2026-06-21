"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import SpaceBackground from "@/components/SpaceBackground";
import { GAME_CONFIG } from "./config";
import { GameState, createInitialGameState, resetGameState } from "./engine/gameState";
import { spawnEnemies } from "./engine/spawner";
import { handlePlayerShooting, handleEnemyShooting, updateBullets } from "./engine/shooting";
import { processCollisions, updateParticles } from "./engine/collision";
import { updateEnemyMovement } from "./engine/movement";
import { drawGame } from "./engine/renderer";

export default function PlaySolo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [wave, setWave] = useState(1);
  const [lives, setLives] = useState(GAME_CONFIG.PLAYER_LIVES);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Use ref for game loop to avoid state re-render latency
  const gameStateRef = useRef<GameState>(createInitialGameState());

  const [imagesLoaded, setImagesLoaded] = useState(false);
  const playerImgRef = useRef<HTMLImageElement | null>(null);
  const enemyImgRef = useRef<HTMLImageElement | null>(null);

  // Initialize and load images
  useEffect(() => {
    const playerImg = new Image();
    playerImg.src = "/player_spritesheet.png";
    const enemyImg = new Image();
    enemyImg.src = "/enemy_spritesheet.png";

    let loadedCount = 0;
    const onImageLoad = () => {
      loadedCount++;
      if (loadedCount === 2) {
        playerImgRef.current = playerImg;
        enemyImgRef.current = enemyImg;
        setImagesLoaded(true);
      }
    };

    playerImg.onload = onImageLoad;
    enemyImg.onload = onImageLoad;
  }, []);

  // Set up Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle pause key
      if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        const state = gameStateRef.current;
        if (!state.gameOver) {
          state.isPaused = !state.isPaused;
          setIsPaused(state.isPaused);
        }
      }

      // Prevent browser scrolling on space / arrow keys
      if (["Space", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(e.key)) {
        e.preventDefault();
      }
      gameStateRef.current.keys[e.key] = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      gameStateRef.current.keys[e.key] = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Spawn enemies helper (applies result to gameStateRef)
  const applySpawnEnemies = (waveNum: number) => {
    const state = gameStateRef.current;
    const result = spawnEnemies(waveNum);
    state.enemies = result.enemies;
    state.leftGroupDirection = 1;
    state.rightGroupDirection = -1;
    state.enemySpeedMultiplier = result.speedMultiplier;
  };

  // Reset Game state
  const resetGame = () => {
    const state = gameStateRef.current;
    resetGameState(state);

    setScore(0);
    setWave(1);
    setLives(GAME_CONFIG.PLAYER_LIVES);
    setIsGameOver(false);
    setIsPaused(false);

    applySpawnEnemies(1);
  };

  // Main game loop logic
  useEffect(() => {
    if (!imagesLoaded) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set virtual resolution
    canvas.width = GAME_CONFIG.GAME_WIDTH;
    canvas.height = GAME_CONFIG.GAME_HEIGHT;

    // Reset game initially
    resetGame();

    let animationFrameId: number;

    const gameLoop = () => {
      const state = gameStateRef.current;

      if (!state.gameOver && !state.isPaused) {
        updateGame();
      }

      drawGame(ctx, state, playerImgRef.current, enemyImgRef.current);

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    // Physics/Positions Update
    const updateGame = () => {
      const state = gameStateRef.current;

      // 1. Move Player
      if (state.keys["ArrowLeft"] || state.keys["a"] || state.keys["A"]) {
        state.player.x -= state.player.speed;
      }
      if (state.keys["ArrowRight"] || state.keys["d"] || state.keys["D"]) {
        state.player.x += state.player.speed;
      }

      // Bound checking for player
      if (state.player.x < 0) state.player.x = 0;
      if (state.player.x > GAME_CONFIG.GAME_WIDTH - state.player.width) {
        state.player.x = GAME_CONFIG.GAME_WIDTH - state.player.width;
      }

      // Player Animation Counter (Animate thruster fire)
      state.player.animCounter++;
      if (state.player.animCounter >= 8) {
        state.player.frame = state.player.frame === 0 ? 1 : 0;
        state.player.animCounter = 0;
      }

      // 2. Player Shooting
      handlePlayerShooting(state);

      // 3. Move Enemies
      state.enemyMoveTimer++;
      const baseMoveInterval = Math.max(10, GAME_CONFIG.ENEMY_BASE_MOVE_INTERVAL - (wave - 1) * 3);
      const enemyCount = state.enemies.length;
      const liveMoveInterval = Math.max(
        GAME_CONFIG.ENEMY_MIN_MOVE_INTERVAL,
        Math.floor((baseMoveInterval * (enemyCount + 3)) / 10)
      );

      if (state.enemyMoveTimer >= liveMoveInterval) {
        state.enemyMoveTimer = 0;

        const moveResult = updateEnemyMovement(
          state.enemies,
          state.leftGroupDirection,
          state.rightGroupDirection,
          state.enemySpeedMultiplier,
          state.player.y
        );

        state.leftGroupDirection = moveResult.leftDirection;
        state.rightGroupDirection = moveResult.rightDirection;
        state.enemies = moveResult.enemies;

        if (moveResult.gameOverTriggered) {
          state.gameOver = true;
          setIsGameOver(true);
        }
      }

      // 4. Enemy Shooting
      handleEnemyShooting(state);

      // 5. Update Bullets
      updateBullets(state);

      // 6. Collision Detection
      const collisionResult = processCollisions(state);

      if (collisionResult.scoreGained > 0) {
        state.scoreValue += collisionResult.scoreGained;
        setScore(state.scoreValue);
      }

      if (collisionResult.livesLost > 0) {
        state.livesCount -= collisionResult.livesLost;
        setLives(state.livesCount);
      }

      if (collisionResult.newParticles.length > 0) {
        state.particles.push(...collisionResult.newParticles);
      }

      if (collisionResult.gameOver) {
        state.gameOver = true;
        setIsGameOver(true);
      }

      // 7. Check Wave Completed (All enemies dead)
      if (state.enemies.length === 0 && !state.gameOver) {
        state.waveNumber += 1;
        setWave(state.waveNumber);
        applySpawnEnemies(state.waveNumber);
      }

      // 8. Update Particles
      updateParticles(state);
    };

    // Run Game
    animationFrameId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [imagesLoaded]);

  return (
    <div className="relative min-h-screen w-screen overflow-hidden flex flex-col items-center justify-center bg-black">
      {/* Background Starfield Canvas Component */}
      <SpaceBackground />

      {/* Top HUD Area */}
      <div className="relative z-10 w-full max-w-[800px] px-4 flex justify-between items-center mb-2 font-pixel select-none text-[10px] sm:text-xs">
        <div className="text-zinc-400">
          SCORE: <span className="text-[#65c5de]">{score.toString().padStart(6, "0")}</span>
        </div>
        <div className="text-zinc-400 text-center">
          WAVE: <span className="text-white">{wave}</span>
        </div>
        <div className="text-zinc-400 flex items-center gap-1">
          LIVES:{" "}
          <span className="text-red-500 text-sm flex gap-0.5 leading-none">
            {Array.from({ length: GAME_CONFIG.PLAYER_LIVES }).map((_, idx) => (
              <span key={idx} className={idx < lives ? "opacity-100" : "opacity-20"}>
                ♥
              </span>
            ))}
          </span>
        </div>
      </div>

      {/* Main Game Frame Container */}
      <div className="relative z-10 w-full max-w-[800px] aspect-[4/3] border-4 border-[#2d8fb4] bg-black/80 rounded-md overflow-hidden shadow-[0_0_30px_rgba(45,143,180,0.3)]">
        <canvas ref={canvasRef} className="w-full h-full block" />

        {/* Loading Overlay */}
        {!imagesLoaded && (
          <div className="absolute inset-0 bg-black flex flex-col items-center justify-center font-pixel text-xs text-[#65c5de] select-none">
            CARREGANDO ATIVOS...
          </div>
        )}

        {/* Pause Overlay */}
        {isPaused && !isGameOver && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-6 z-20 animate-fade-in select-none">
            <div className="bg-[#0b0c10]/95 border-4 border-[#65c5de] rounded-md p-8 max-w-sm w-full text-center shadow-[0_0_25px_rgba(101,197,222,0.4)]">
              <h2 className="text-[#65c5de] text-xl mb-4 tracking-widest font-pixel uppercase animate-pulse">
                JOGO PAUSADO
              </h2>
              
              <p className="text-zinc-400 text-[10px] font-pixel mb-6 uppercase">
                Pressione P para Retomar
              </p>

              <div className="flex flex-col gap-4">
                {/* RESUME BUTTON */}
                <button
                  onClick={() => {
                    const state = gameStateRef.current;
                    state.isPaused = false;
                    setIsPaused(false);
                  }}
                  className="w-full text-white bg-[#65c5de] border-b-4 border-r-4 border-[#2d8fb4] hover:bg-[#4bb7d3] active:border-b-2 active:border-r-2 active:translate-y-[2px] active:translate-x-[1px] py-3 px-4 text-xs tracking-wider transition-all duration-100 font-pixel uppercase cursor-pointer rounded-sm shadow-md"
                >
                  RETOMAR
                </button>

                {/* VOLTAR MENU BUTTON */}
                <Link href="/" className="w-full">
                  <span className="block w-full text-white bg-[#ff4d4d] border-b-4 border-r-4 border-[#cc3333] hover:bg-[#ff6666] active:border-b-2 active:border-r-2 active:translate-y-[2px] active:translate-x-[1px] py-3 px-4 text-xs tracking-wider transition-all duration-100 font-pixel uppercase cursor-pointer rounded-sm shadow-md">
                    MENU PRINCIPAL
                  </span>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Game Over Popup Overlay */}
        {isGameOver && (
          <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center p-6 z-20 animate-fade-in select-none">
            <div className="bg-[#0b0c10]/90 border-4 border-[#ff4d4d] rounded-md p-8 max-w-sm w-full text-center shadow-[0_0_25px_rgba(255,77,77,0.5)]">
              <h2 className="text-[#ff4d4d] text-xl mb-4 tracking-widest font-pixel uppercase animate-pulse">
                GAME OVER
              </h2>
              
              <div className="text-zinc-400 text-[10px] font-pixel mb-6 uppercase">
                PONTUAÇÃO FINAL:
                <div className="text-white text-base mt-1 text-[#65c5de]">{score}</div>
              </div>

              <div className="flex flex-col gap-4">
                {/* REPLAY BUTTON */}
                <button
                  onClick={resetGame}
                  className="w-full text-white bg-[#65c5de] border-b-4 border-r-4 border-[#2d8fb4] hover:bg-[#4bb7d3] active:border-b-2 active:border-r-2 active:translate-y-[2px] active:translate-x-[1px] py-3 px-4 text-xs tracking-wider transition-all duration-100 font-pixel uppercase cursor-pointer rounded-sm shadow-md"
                >
                  REPLAY
                </button>

                {/* VOLTAR MENU BUTTON */}
                <Link href="/" className="w-full">
                  <span className="block w-full text-white bg-[#ff4d4d] border-b-4 border-r-4 border-[#cc3333] hover:bg-[#ff6666] active:border-b-2 active:border-r-2 active:translate-y-[2px] active:translate-x-[1px] py-3 px-4 text-xs tracking-wider transition-all duration-100 font-pixel uppercase cursor-pointer rounded-sm shadow-md">
                    MENU PRINCIPAL
                  </span>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom controls help indicator */}
      <div className="relative z-10 mt-3 font-pixel text-[8px] sm:text-[10px] text-zinc-500 uppercase select-none">
        Mover: A/D ou Setas | Atirar: Espaço | Pausar: P
      </div>
    </div>
  );
}
