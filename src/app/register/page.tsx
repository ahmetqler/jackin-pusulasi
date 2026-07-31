"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthLink, AuthShell, Field } from "@/components/AuthShell";

export default function RegisterPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, username, password, inviteCode }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error ?? "Kayıt olunamadı");
        return;
      }
      router.replace("/friends");
      router.refresh();
    } catch {
      setError("Bağlantı kurulamadı");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Kayıt ol"
      subtitle="Kayıt davetliye açık. Kodu bilmiyorsan Ahmet'e sor."
      footer={<>Hesabın var mı? <AuthLink href="/login">Giriş yap</AuthLink></>}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field
          label="Görünen ad"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Arkadaşlarının göreceği ad"
          required
        />
        <Field
          label="Kullanıcı adı"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="username"
          placeholder="küçük harf, rakam, alt çizgi"
          required
        />
        <Field
          label="Şifre"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          placeholder="en az 6 karakter"
          required
        />
        <Field
          label="Davet kodu"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          autoCapitalize="none"
          autoCorrect="off"
          required
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-accent px-4 py-3 font-semibold text-background disabled:opacity-50"
        >
          {busy ? "Kaydediliyor…" : "Kayıt ol"}
        </button>
      </form>
    </AuthShell>
  );
}
