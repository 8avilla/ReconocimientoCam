"use client";

import { useState } from "react";
import { signIn as nextAuthSignIn } from "next-auth/react";
import { AlertCircle, CheckCircle2, LogOut, Mail } from "lucide-react";
import { Avatar, Button, Input, Modal, useToast } from "@/components/ui";
import { errorMessage, http } from "@/lib/client/http";
import { ROLE_LABEL } from "@/lib/roles";
import { useRole } from "./RoleContext";

type Mode = "default" | "login" | "register" | "forgot";

/** Google's official "G" logomark — the asset Google's own branding guidelines call for on a third-party "Sign in with Google" button. */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden focusable="false">
      <path
        fill="#FFC107"
        d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"
      />
      <path
        fill="#FF3D00"
        d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"
      />
      <path
        fill="#1976D2"
        d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"
      />
    </svg>
  );
}

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
            <div className="account-summary">
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
            <button className="btn google block" onClick={signIn}>
              <GoogleIcon /> Continuar con Google
            </button>
            <div className="auth-divider">o</div>
            <button className="btn secondary block" onClick={() => setMode("login")}>
              <Mail size={18} aria-hidden /> Iniciar sesión con correo
            </button>
            <button className="link-button" onClick={() => setMode("register")}>
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
        <button className="link-button" style={{ alignSelf: "center" }} onClick={() => onModeChange("login")}>Volver a iniciar sesión</button>
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
            <button className="link-button" type="button" onClick={() => onModeChange("forgot")}>¿Olvidaste tu contraseña?</button>
            <button className="link-button" type="button" onClick={() => onModeChange("register")}>¿No tienes cuenta? Crear una</button>
          </>
        )}
        {mode === "register" && (
          <button className="link-button" type="button" onClick={() => onModeChange("login")}>¿Ya tienes cuenta? Iniciar sesión</button>
        )}
        {mode === "forgot" && (
          <button className="link-button" type="button" onClick={() => onModeChange("login")}>Volver</button>
        )}
        <button className="text-secondary text-small" type="button" onClick={() => onModeChange("default")}>Cancelar</button>
      </div>
    </form>
  );
}
