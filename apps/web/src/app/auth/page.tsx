"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import SpaceBackground from "@/components/SpaceBackground";
import { authService } from "@/utils/authService";

const AUTH_API_URL = process.env.NEXT_PUBLIC_AUTH_SERVICE_URL;

export default function AuthPage() {
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      authService.setToken(token);
      setSuccessMsg("ACESSO VIA GOOGLE AUTORIZADO!");
      setTimeout(() => router.push("/play"), 1000);
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setIsLoading(true);

    try {
      if (isLoginMode) {
        // Fluxo de Login
        await authService.login(email, password);
        setSuccessMsg("ACESSO AUTORIZADO! INICIANDO...");
        setTimeout(() => {
          router.push("/play");
        }, 1000);
      } else {
        // Fluxo de Cadastro + Auto-login
        if (name.trim().length < 3) {
          throw new Error("O nome deve ter pelo menos 3 caracteres.");
        }
        await authService.register(name, email, password);
        setSuccessMsg("PILOTO CADASTRADO! INICIANDO...");
        setTimeout(() => {
          router.push("/play");
        }, 1000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Ocorreu um erro inesperado.");
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLoginMode(!isLoginMode);
    setErrorMsg("");
    setSuccessMsg("");
    setName("");
    setEmail("");
    setPassword("");
  };

  return (
    <div className="relative min-h-screen w-screen overflow-hidden flex flex-col items-center justify-center bg-black p-4">
      {/* Background Starfield Canvas Component */}
      <SpaceBackground />

      {/* Main Container Card */}
      <div className="w-full max-w-4xl bg-black/90 border-4 border-[#65c5de] rounded-md p-6 sm:p-8 shadow-[0_0_30px_rgba(101,197,222,0.3)] relative z-10 select-none flex flex-col md:flex-row items-center gap-8 md:gap-12">
        
        {/* Left Section: Logo & Info */}
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="mb-6 select-none hover:scale-105 transition-transform duration-300 w-full max-w-[320px] mx-auto">
            <Image
              src="/logo.webp"
              alt="Space Defenders Logo"
              width={320}
              height={160}
              priority
              sizes="(max-width: 640px) 100vw, 320px"
              style={{ width: "100%", height: "auto" }}
              className="drop-shadow-[0_0_15px_rgba(101,197,222,0.5)]"
            />
          </div>
          <h2 className="text-[#65c5de] text-xs sm:text-sm tracking-widest font-pixel uppercase">
            {isLoginMode ? "SISTEMA DE IDENTIFICAÇÃO" : "ALISTAMENTO DE RECRUTA"}
          </h2>
          <p className="text-zinc-500 font-pixel text-[8px] leading-relaxed uppercase mt-4 max-w-xs hidden md:block">
            {isLoginMode
              ? "FORNEÇA SUA ASSINATURA DE CRIPTOGRAFIA PARA ACESSAR OS CONTROLES DE VOO."
              : "INICIE SEU REGISTRO DE CADETE PARA PROTEGER OS SETORES DA ORBITA TERRESTRE."}
          </p>
        </div>

        {/* Right Section: Form */}
        <div className="w-full md:max-w-md flex-1">
          {/* Form */}
          <form onSubmit={handleSubmit} className="text-left">
            
            {/* Name Field (Only in Register mode) */}
            {!isLoginMode && (
              <div className="mb-4">
                <label className="block text-[#65c5de] text-[9px] sm:text-[10px] font-pixel mb-2 uppercase">
                  Nome do Piloto
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="EX: STAR-LORD"
                  required
                  disabled={isLoading}
                  className="w-full bg-black/80 border-4 border-[#2d8fb4] focus:border-[#65c5de] outline-none text-white p-3 font-pixel text-[10px] sm:text-xs rounded-sm transition-colors"
                />
              </div>
            )}

            {/* Email Field */}
            <div className="mb-4">
              <label className="block text-[#65c5de] text-[9px] sm:text-[10px] font-pixel mb-2 uppercase">
                Endereço de E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="EX: PILOTO@SPACE.COM"
                required
                disabled={isLoading}
                className="w-full bg-black/80 border-4 border-[#2d8fb4] focus:border-[#65c5de] outline-none text-white p-3 font-pixel text-[10px] sm:text-xs rounded-sm transition-colors"
              />
            </div>

            {/* Password Field */}
            <div className="mb-6">
              <label className="block text-[#65c5de] text-[9px] sm:text-[10px] font-pixel mb-2 uppercase">
                Senha de Acesso
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="******"
                required
                disabled={isLoading}
                className="w-full bg-black/80 border-4 border-[#2d8fb4] focus:border-[#65c5de] outline-none text-white p-3 font-pixel text-[10px] sm:text-xs rounded-sm transition-colors"
              />
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="mb-4 p-3 bg-red-950/80 border-2 border-red-500 text-red-400 font-pixel text-[8px] sm:text-[9px] leading-relaxed uppercase rounded-sm">
                ALERTA: {errorMsg}
              </div>
            )}

            {/* Success Message */}
            {successMsg && (
              <div className="mb-4 p-3 bg-cyan-950/80 border-2 border-[#65c5de] text-[#65c5de] font-pixel text-[8px] sm:text-[9px] leading-relaxed uppercase rounded-sm">
                SISTEMA: {successMsg}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full text-white bg-[#65c5de] border-b-6 border-r-6 border-[#2d8fb4] hover:bg-[#4bb7d3] active:border-b-2 active:border-r-2 active:translate-y-[4px] active:translate-x-[2px] disabled:opacity-50 disabled:cursor-not-allowed py-4 px-6 text-xs sm:text-sm tracking-widest transition-all duration-100 font-pixel uppercase cursor-pointer rounded-sm shadow-md"
            >
              {isLoading ? "PROCESSANDO..." : isLoginMode ? "DECOLAR" : "CADASTRAR E JOGAR"}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-[#2d8fb4]/50"></div>
            <span className="text-zinc-500 font-pixel text-[8px] uppercase">ou</span>
            <div className="flex-1 h-px bg-[#2d8fb4]/50"></div>
          </div>

          {/* Google Login Button */}
          <a
            href={`${AUTH_API_URL}/auth/google`}
            className="flex items-center justify-center gap-3 w-full bg-white hover:bg-gray-100 text-gray-800 py-3 px-6 text-xs sm:text-sm font-pixel uppercase tracking-widest rounded-sm shadow-md transition-all duration-100 cursor-pointer border-4 border-gray-300 hover:border-gray-400"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            ENTRAR COM GOOGLE
          </a>

          {/* Toggle Mode Link */}
          <div className="mt-6 text-[9px] sm:text-[10px] font-pixel text-zinc-500 uppercase text-center md:text-left">
            {isLoginMode ? (
              <>
                Novo piloto por aqui?{" "}
                <button
                  onClick={toggleMode}
                  disabled={isLoading}
                  className="text-[#65c5de] hover:underline cursor-pointer focus:outline-none"
                >
                  Cadastre-se
                </button>
              </>
            ) : (
              <>
                Já possui registro?{" "}
                <button
                  onClick={toggleMode}
                  disabled={isLoading}
                  className="text-[#65c5de] hover:underline cursor-pointer focus:outline-none"
                >
                  Entrar
                </button>
              </>
            )}
          </div>

          {/* Back Link */}
          <div className="mt-4 text-center md:text-left">
            <Link
              href="/"
              className="inline-block text-[8px] sm:text-[9px] font-pixel text-zinc-600 hover:text-zinc-400 uppercase tracking-widest"
            >
              &lt; VOLTAR AO MENU
            </Link>
          </div>
        </div>

      </div>

      {/* Bottom overlay for retro grid feel */}
      <div className="absolute bottom-0 w-full h-32 bg-gradient-to-t from-black to-transparent pointer-events-none z-0" />
    </div>
  );
}
