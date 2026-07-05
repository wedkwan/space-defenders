"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { authService } from "@/utils/authService";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      authService.setToken(token);
      router.replace("/play");
    } else {
      router.replace("/auth");
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <p className="text-[#65c5de] font-pixel text-xs uppercase tracking-widest animate-pulse">
        AUTENTICANDO...
      </p>
    </div>
  );
}
