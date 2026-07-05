"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import SpaceBackground from "@/components/SpaceBackground";
import { authService, User } from "@/utils/authService";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const originalName = useRef("");

  useEffect(() => {
    setUser(authService.getCurrentUser());
    const saved = authService.getDisplayName();
    if (saved) setDisplayName(saved);
  }, []);

  useEffect(() => {
    if (user) {
      originalName.current = user.name;
      if (!displayName) setDisplayName(user.name);
    }
  }, [user]);

  const handleSaveName = () => {
    const trimmed = displayName.trim();
    if (trimmed.length > 0 && trimmed.length <= 16) {
      authService.setDisplayName(trimmed);
    } else {
      setDisplayName(originalName.current);
      authService.setDisplayName(originalName.current);
    }
    setIsEditing(false);
  };

  const handleLogout = () => {
    authService.logout();
    setUser(null);
  };

  return (
    <div className="relative min-h-screen w-screen overflow-hidden flex flex-col items-center justify-center bg-black">
      {/* Background Starfield Canvas Component */}
      <SpaceBackground />

      {/* Pilot Status HUD */}
      {user && (
        <div className="absolute top-4 right-4 z-20 flex items-center gap-3 bg-black/85 border-2 border-[#2d8fb4] p-3 font-pixel text-[8px] sm:text-[10px] rounded-sm select-none">
          <div className="flex items-center gap-2">
            <span>PILOTO:</span>
            {isEditing ? (
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveName();
                  if (e.key === "Escape") {
                    setDisplayName(originalName.current);
                    setIsEditing(false);
                  }
                }}
                onBlur={handleSaveName}
                maxLength={16}
                autoFocus
                className="bg-black/80 border border-[#65c5de] text-[#65c5de] px-2 py-1 font-pixel text-[10px] w-28 outline-none rounded-sm"
              />
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="text-[#65c5de] hover:text-white cursor-pointer focus:outline-none uppercase flex items-center gap-1.5 transition-colors"
                title="Clique para editar"
              >
                {displayName.toUpperCase()}
                <svg className="w-3 h-3 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                  <path d="m15 5 4 4"/>
                </svg>
              </button>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="text-red-500 hover:text-red-400 cursor-pointer focus:outline-none uppercase border-l-2 border-[#2d8fb4] pl-3"
          >
            SAIR
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="relative z-10 flex flex-col items-center justify-center px-4 max-w-2xl w-full text-center">
        {/* Game Logo */}
        <div className="mb-12 select-none hover:scale-105 transition-transform duration-300 w-full max-w-[640px]">
          <Image
            src="/logo.webp"
            alt="Space Defenders Logo"
            width={640}
            height={320}
            priority
            sizes="(max-width: 640px) 100vw, 640px"
            style={{ width: "100%", height: "auto" }}
            className="drop-shadow-[0_0_25px_rgba(101,197,222,0.6)]"
          />
        </div>

        {/* Buttons Menu */}
        <div className="flex flex-col gap-6 w-72">
          {/* PLAY BUTTON */}
          <Link href={user ? "/play" : "/auth"} className="w-full">
            <span
              className="block w-full text-white bg-[#65c5de] border-b-6 border-r-6 border-[#2d8fb4] hover:bg-[#4bb7d3] active:border-b-2 active:border-r-2 active:translate-y-[4px] active:translate-x-[2px] py-4 px-6 text-lg tracking-widest transition-all duration-100 font-pixel uppercase cursor-pointer rounded-sm shadow-md"
            >
              PLAY
            </span>
          </Link>

          {/* ABOUT BUTTON */}
          <Link href="/about" className="w-full">
            <span
              className="block w-full text-white bg-[#65c5de] border-b-6 border-r-6 border-[#2d8fb4] hover:bg-[#4bb7d3] active:border-b-2 active:border-r-2 active:translate-y-[4px] active:translate-x-[2px] py-4 px-6 text-lg tracking-widest transition-all duration-100 font-pixel uppercase cursor-pointer rounded-sm shadow-md"
            >
              ABOUT
            </span>
          </Link>
        </div>
      </main>

      {/* Bottom overlay for retro grid feel */}
      <div className="absolute bottom-0 w-full h-32 bg-gradient-to-t from-black to-transparent pointer-events-none z-0" />
    </div>
  );
}
