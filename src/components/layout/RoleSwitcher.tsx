"use client";

import { LogIn, LogOut } from "lucide-react";
import { Avatar, Modal } from "@/components/ui";
import { ROLE_LABEL } from "@/lib/roles";
import { useRole } from "./RoleContext";

/**
 * Account panel: sign in with Google, or see who is signed in and sign out. The trigger button lives
 * wherever it's placed (sidebar, or inside the "Más" sheet), but the modal itself is rendered once at the
 * app shell's top level so closing a parent sheet never unmounts it.
 */
export function AccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { status, user, role, signIn, signOut } = useRole();
  return (
    <Modal open={open} title={user ? "Tu cuenta" : "Iniciar sesión"} onClose={onClose}>
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
                onClose();
                signOut();
              }}
            >
              <LogOut size={18} aria-hidden /> Cerrar sesión
            </button>
          </>
        ) : (
          <>
            <p className="text-secondary text-small">
              Inicia sesión con tu cuenta de Google para organizar campeonatos: crear el tuyo, o entrar a uno al que te invitaron. Para solo seguir un campeonato no hace falta cuenta.
            </p>
            <button className="btn primary block" onClick={signIn}>
              <LogIn size={18} aria-hidden /> Continuar con Google
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
