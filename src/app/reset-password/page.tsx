"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { errorMessage, http } from "@/lib/client/http";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 8) return setError("Debe tener al menos 8 caracteres");
    if (password !== confirm) return setError("Las contraseñas no coinciden");

    setSaving(true);
    try {
      await http("/auth/reset-password", { json: { token, password } });
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "10vh auto", padding: "var(--space-lg)" }}>
      <div className="card stack">
        <h1>Elige una nueva contraseña</h1>
        {!token ? (
          <div className="alert error" role="alert"><AlertCircle size={18} /> Este enlace no incluye un token válido. Pide uno nuevo desde &ldquo;¿Olvidaste tu contraseña?&rdquo;.</div>
        ) : done ? (
          <>
            <div className="alert success" role="status"><CheckCircle2 size={18} /> Contraseña actualizada. Ya puedes iniciar sesión.</div>
            <Link href="/" className="btn primary block">Ir al inicio</Link>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="stack" noValidate>
            {error && <div className="alert error" role="alert"><AlertCircle size={18} /> {error}</div>}
            <Input label="Nueva contraseña" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} hint="Mínimo 8 caracteres" />
            <Input label="Confirmar contraseña" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            <Button type="submit" loading={saving}>Guardar contraseña</Button>
          </form>
        )}
      </div>
    </div>
  );
}
