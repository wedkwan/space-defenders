"use client";

import Link from "next/link";
import SpaceBackground from "@/components/SpaceBackground";

export default function About() {
  return (
    <div className="relative min-h-screen w-screen overflow-hidden flex flex-col items-center justify-center bg-black">
      {/* Background Starfield Canvas Component */}
      <SpaceBackground />

      {/* Main Content Area */}
      <main className="relative z-10 flex flex-col items-center justify-center px-4 max-w-lg w-full text-center">
        <div className="bg-[#0b0c10]/80 border-4 border-[#00b4d8] rounded-md p-8 shadow-[0_0_20px_rgba(0,180,216,0.3)] mb-8">
          <h1 className="text-[#00b4d8] text-2xl mb-6 tracking-widest font-pixel uppercase animate-pulse">
            ABOUT
          </h1>
          <p className="text-white text-xs leading-relaxed mb-6 font-pixel text-left leading-6">
            SPACE DEFENDERS É UM JOGO RETRÔ ONDE VOCÊ E UM PARCEIRO DEVEM PROTEGER A GALÁXIA CONTRA AMEAÇAS ALIENÍGENAS EM TEMPO REAL.
          </p>
          <div className="text-left text-[10px] text-zinc-400 font-pixel space-y-2">
            <p>CONTROLES:</p>
            <p>• SETAS / A D - MOVER</p>
            <p>• ESPAÇO - ATIRAR</p>
          </div>
        </div>

        {/* BACK BUTTON */}
        <div className="w-72">
          <Link href="/" className="w-full">
            <span
              className="block w-full text-white bg-[#65c5de] border-b-6 border-r-6 border-[#2d8fb4] hover:bg-[#4bb7d3] active:border-b-2 active:border-r-2 active:translate-y-[4px] active:translate-x-[2px] py-4 px-6 text-sm tracking-widest transition-all duration-100 font-pixel uppercase cursor-pointer rounded-sm shadow-md"
            >
              VOLTAR
            </span>
          </Link>
        </div>
      </main>
    </div>
  );
}
