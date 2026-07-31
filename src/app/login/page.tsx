"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthLink, AuthShell, Field } from "@/components/AuthShell";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error ?? "Giriş yapılamadı");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Bağlantı kurulamadı");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Jack'in Pusulası"
      subtitle="Arkadaşının nerede olduğunu değil, hangi yönde ve ne kadar uzakta olduğunu gösterir."
      footer={<>Hesabın yok mu? <AuthLink href="/register">Kayıt ol</AuthLink></>}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field
          label="Kullanıcı adı"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="username"
          required
        />
        <Field
          label="Şifre"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-accent px-4 py-3 font-semibold text-background disabled:opacity-50"
        >
          {busy ? "Giriliyor…" : "Giriş yap"}
        </button>
      </form>
    </AuthShell>
  );
}
