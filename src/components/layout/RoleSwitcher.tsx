"use client";

import { useState } from "react";
import { signIn as nextAuthSignIn } from "next-auth/react";
import { AlertCircle, CheckCircle2, LogIn, LogOut, Mail } from "lucide-react";
import { Avatar, Button, Input, Modal, useToast } from "@/components/ui";
import { errorMessage, http } from "@/lib/client/http";
import { ROLE_LABEL } from "@/lib/roles";
import { useRole } from "./RoleContext";

type Mode = "default" | "login" | "register" | "forgot";

/**
 * Account panel: sign in with Google or with email/password (login, create account, forgot password), or
 * see who is signed in and sign out. The trigger button lives wherever it's placed (sidebar, or inside the
 * "Más" sheet), but the modal itself is rendered once at the app shell's top level so closing a parent
 * sheet never unmounts it.
 */
export function AccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { status, user, role, signIn, signOut } = useRole();
  const [mode, setMode] = useState<Mode>("default");

  const close = () => {
    onClose();
    // Next time it opens, start over instead of showing whatever form was mid-edit.
    setTimeout(() => setMode("default"), 200);
  };

  const title = user ? "Tu cuenta" : mode === "register" ? "Crear cuenta" : mode === "forgot" ? "Recuperar contraseña" : "Iniciar sesión";

  return (
    <Modal open={open} title={title} onClose={close}>
      <div className="stack">
        {status === "loading" ? (
          <p className="text-secondary">Cargando…</p>
        ) : user ? (
          <>
            <div className="row" style={{ gap: "var(--space-md)" }}>
              <Avatar src={user.image ?? undefined} name={user.name} size={48} />
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="text-strong truncate">{user.name}</div>
                <div className="text-secondary text-small truncate">{user.email}</div>
              </div>
            </div>
            <p className="text-secondary text-small">
              {user.isAdmin ? "Eres administrador: gestionas la app y todos los campeonatos." : `Tu rol aquí: ${ROLE_LABEL[role]}.`}
            </p>
            <button
              className="btn secondary block"
              onClick={() => {
                close();
                signOut();
              }}
            >
              <LogOut size={18} aria-hidden /> Cerrar sesión
            </button>
          </>
        ) : mode === "default" ? (
          <>
            <p className="text-secondary text-small">
              Inicia sesión para organizar campeonatos: crear el tuyo, o entrar a uno al que te invitaron. Para solo seguir un campeonato no hace falta cuenta.
            </p>
            <button className="btn primary block" onClick={signIn}>
              <LogIn size={18} aria-hidden /> Continuar con Google
            </button>
            <div className="row" style={{ gap: "var(--space-sm)", alignItems: "center" }}>
              <span className="grow" style={{ height: 1, background: "var(--color-border)" }} />
              <span className="text-secondary text-small">o</span>
              <span className="grow" style={{ height: 1, background: "var(--color-border)" }} />
            </div>
            <button className="btn secondary block" onClick={() => setMode("login")}>
              <Mail size={18} aria-hidden /> Iniciar sesión con correo
            </button>
            <button className="text-strong" style={{ alignSelf: "center" }} onClick={() => setMode("register")}>
              ¿No tienes cuenta? Crear una
            </button>
          </>
        ) : (
          <CredentialsForm mode={mode} onModeChange={setMode} onDone={close} />
        )}
      </div>
    </Modal>
  );
}

function CredentialsForm({ mode, onModeChange, onDone }: { mode: "login" | "register" | "forgot"; onModeChange: (mode: Mode) => void; onDone: () => void }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (mode === "login") {
        const result = await nextAuthSignIn("credentials", { email, password, redirect: false });
        if (result?.error) throw new Error("Correo o contraseña incorrectos");
        onDone();
      } else if (mode === "register") {
        await http("/auth/register", { json: { name, email, password } });
        const result = await nextAuthSignIn("credentials", { email, password, redirect: false });
        if (result?.error) throw new Error("La cuenta se creó, pero no se pudo iniciar sesión automáticamente. Intenta iniciar sesión.");
        toast.success("Cuenta creada");
        onDone();
      } else {
        await http("/auth/forgot-password", { json: { email } });
        setForgotSent(true);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (mode === "forgot" && forgotSent) {
    return (
      <>
        <div className="alert success" role="status"><CheckCircle2 size={18} /> Si ese correo tiene una cuenta, te enviamos un enlace para elegir una contraseña.</div>
        <button className="text-strong" style={{ alignSelf: "center" }} onClick={() => onModeChange("login")}>Volver a iniciar sesión</button>
      </>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="stack" noValidate>
      {error && <div className="alert error" role="alert"><AlertCircle size={18} /> {error}</div>}
      {mode === "register" && <Input label="Nombre completo" required value={name} onChange={(e) => setName(e.target.value)} />}
      <Input label="Correo" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      {mode !== "forgot" && (
        <Input label="Contraseña" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} hint={mode === "register" ? "Mínimo 8 caracteres" : undefined} />
      )}
      <Button type="submit" loading={saving}>
        {mode === "login" ? "Iniciar sesión" : mode === "register" ? "Crear cuenta" : "Enviar enlace"}
      </Button>
      <div className="stack-sm" style={{ alignItems: "center" }}>
        {mode === "login" && (
          <>
            <button className="text-strong" type="button" onClick={() => onModeChange("forgot")}>¿Olvidaste tu contraseña?</button>
            <button className="text-strong" type="button" onClick={() => onModeChange("register")}>¿No tienes cuenta? Crear una</button>
          </>
        )}
        {mode === "register" && (
          <button className="text-strong" type="button" onClick={() => onModeChange("login")}>¿Ya tienes cuenta? Iniciar sesión</button>
        )}
        {mode === "forgot" && (
          <button className="text-strong" type="button" onClick={() => onModeChange("login")}>Volver</button>
        )}
        <button className="text-secondary text-small" type="button" onClick={() => onModeChange("default")}>Cancelar</button>
      </div>
    </form>
  );
}
