"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Status = "loading" | "success" | "error";

export default function VerifyEmailPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      setStatus("error");
      setMessage("Token não informado.");
      return;
    }

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

    fetch(`${apiUrl}/auth/verify-email?token=${token}`)
      .then(async (res) => {
        if (res.ok) {
          setStatus("success");
        } else {
          const data = await res.json().catch(() => null);
          setStatus("error");
          setMessage(data?.message ?? "Não foi possível verificar seu e-mail.");
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Erro ao conectar com o servidor.");
      });
  }, []);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="text-center">
        {status === "loading" && (
          <p className="text-[#65c5de] font-pixel text-xs uppercase tracking-widest animate-pulse">
            VERIFICANDO E-MAIL...
          </p>
        )}

        {status === "success" && (
          <>
            <p className="text-[#65c5de] font-pixel text-xs uppercase tracking-widest mb-4">
              E-MAIL VERIFICADO COM SUCESSO!
            </p>
            <button
              onClick={() => router.replace("/auth")}
              className="text-white font-pixel text-xs uppercase tracking-widest underline"
            >
              Ir para o login
            </button>
          </>
        )}

        {status === "error" && (
          <>
            <p className="text-red-500 font-pixel text-xs uppercase tracking-widest mb-4">
              FALHA NA VERIFICAÇÃO
            </p>
            <p className="text-white/70 font-pixel text-[10px] mb-4">{message}</p>
            <button
              onClick={() => router.replace("/auth")}
              className="text-white font-pixel text-xs uppercase tracking-widest underline"
            >
              Voltar ao login
            </button>
          </>
        )}
      </div>
    </div>
  );
}
