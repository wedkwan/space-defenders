export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

const API_URL = "http://localhost:3001";

export const authService = {
  setToken(token: string): void {
    if (typeof window !== "undefined") {
      localStorage.setItem("space_defenders_token", token);
    }
  },

  getToken(): string | null {
    if (typeof window !== "undefined") {
      return localStorage.getItem("space_defenders_token");
    }
    return null;
  },

  logout(): void {
    if (typeof window !== "undefined") {
      localStorage.removeItem("space_defenders_token");
    }
  },

  decodeToken(token: string): User | null {
    try {
      const payloadBase64 = token.split(".")[1];
      if (!payloadBase64) return null;

      // Suporte para decodificação base64 no navegador (UTF-8 safe)
      const base64 = payloadBase64.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        window
          .atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );

      const payload = JSON.parse(jsonPayload);
      return {
        id: payload.sub || payload.id,
        email: payload.email,
        name: payload.name,
        role: payload.role,
      };
    } catch (e) {
      console.error("Erro ao decodificar token", e);
      return null;
    }
  },

  getCurrentUser(): User | null {
    const token = this.getToken();
    if (!token) return null;
    return this.decodeToken(token);
  },

  getDisplayName(): string {
    if (typeof window !== "undefined") {
      return localStorage.getItem("space_defenders_display_name") || "";
    }
    return "";
  },

  setDisplayName(name: string): void {
    if (typeof window !== "undefined") {
      localStorage.setItem("space_defenders_display_name", name);
    }
  },

  async register(name: string, email: string, password?: string): Promise<{ user: User; access_token: string }> {
    const response = await fetch(`${API_URL}/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        email,
        password,
        provider: "local",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || "Erro ao criar conta.");
    }

    // Após criar o usuário com sucesso, fazemos login automático
    const loginData = await this.login(email, password || "");
    return loginData;
  },

  async login(email: string, password?: string): Promise<{ user: User; access_token: string }> {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || "E-mail ou senha incorretos.");
    }

    const data = await response.json();
    this.setToken(data.access_token);

    return {
      user: data.user,
      access_token: data.access_token,
    };
  },

  async submitScore(score: number, wave: number): Promise<any> {
    const token = this.getToken();
    if (!token) throw new Error("Não autenticado");

    const response = await fetch(`${API_URL}/scores`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ score, wave }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || "Erro ao salvar recorde.");
    }

    return await response.json();
  },

  async getLeaderboard(): Promise<any> {
    const response = await fetch(`${API_URL}/scores/leaderboard`);
    if (!response.ok) {
      throw new Error("Erro ao buscar placar de líderes.");
    }
    return await response.json();
  },
};
