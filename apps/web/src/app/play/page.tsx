"use client";

import Image from "next/image";
import Link from "next/link";
import SpaceBackground from "@/components/SpaceBackground";

export default function PlaySelection() {
  return (
    <div className="relative min-h-screen w-screen overflow-hidden flex flex-col items-center justify-center bg-black">
      {/* Background Starfield Canvas Component */}
      <SpaceBackground />

      {/* Main Content Area */}
      <main className="relative z-10 flex flex-col items-center justify-center px-4 max-w-3xl w-full text-center">
        {/* Game Logo (Smaller size than menu) */}
        <div className="mb-10 select-none hover:scale-105 transition-transform duration-300 w-full max-w-[480px]">
          <Image
            src="/logo.webp"
            alt="Space Defenders Logo"
            width={480}
            height={240}
            priority
            sizes="(max-width: 480px) 100vw, 480px"
            style={{ width: "100%", height: "auto" }}
            className="drop-shadow-[0_0_15px_rgba(101,197,222,0.5)]"
          />
        </div>

        {/* Selection Cards Container */}
        <div className="flex flex-col sm:flex-row sm:items-stretch gap-8 w-full max-w-2xl justify-center mb-10">
          {/* PLAY SOLO CARD */}
          <Link href="/play/solo" className="flex-1 flex">
            <span
              className="flex flex-col w-full text-left bg-black/60 border-4 border-[#65c5de] hover:border-white rounded-md p-6 shadow-[0_0_15px_rgba(101,197,222,0.2)] hover:shadow-[0_0_25px_rgba(101,197,222,0.5)] transition-all duration-300 transform hover:-translate-y-1 cursor-pointer group"
            >
              <span className="block text-[#65c5de] group-hover:text-white text-base mb-3 font-pixel tracking-wider">
                PLAY SOLO
              </span>
              <span className="block text-zinc-400 group-hover:text-zinc-200 text-[10px] leading-relaxed font-pixel uppercase">
                DEFENDA O ESPAÇO SOZINHO. ACUMULE PONTOS E ESTABELEÇA SEU RECORD NO RECORD BOARD LOCAL.
              </span>
            </span>
          </Link>

          {/* MULTIPLAYER CARD */}
          <button
            onClick={() => alert("Em breve: Modo Multiplayer Online!")}
            className="flex-1 flex flex-col text-left bg-black/60 border-4 border-[#65c5de] hover:border-white rounded-md p-6 shadow-[0_0_15px_rgba(101,197,222,0.2)] hover:shadow-[0_0_25px_rgba(101,197,222,0.5)] transition-all duration-300 transform hover:-translate-y-1 cursor-pointer group"
          >
            <div className="text-[#65c5de] group-hover:text-white text-base mb-3 font-pixel tracking-wider">
              MULTIPLAYER
            </div>
            <p className="text-zinc-400 group-hover:text-zinc-200 text-[10px] leading-relaxed font-pixel uppercase">
              JOGUE EM DUPLA COOPERATIVA ONLINE. ENFRENTE VAGAS DE ALIENS JUNTO COM OUTRO JOGADOR EM TEMPO REAL.
            </p>
          </button>
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

      {/* Bottom overlay for retro grid feel */}
      <div className="absolute bottom-0 w-full h-32 bg-gradient-to-t from-black to-transparent pointer-events-none z-0" />
    </div>
  );
}
