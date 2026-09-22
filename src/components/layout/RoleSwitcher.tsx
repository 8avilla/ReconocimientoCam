"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { Modal } from "@/components/ui";
import { ROLES, ROLE_DESCRIPTION, ROLE_LABEL } from "@/lib/roles";
import { useRole } from "./RoleContext";

/** "View as" selector: previews the app as organizer, referee or delegate (no login yet, nothing is enforced by the API). */
export function RoleSwitcher({ variant = "icon", onOpen }: { variant?: "icon" | "menu"; onOpen?: () => void }) {
  const { role } = useRole();
  const [open, setOpen] = useState(false);
  const openModal = () => {
    onOpen?.();
    setOpen(true);
  };
  if (variant === "menu") {
    return (
      <>
        <button className="btn secondary block role-menu-button" onClick={openModal}>
          <Eye size={20} aria-hidden /> Ver como: {ROLE_LABEL[role]}
          {role !== "admin" && <span className="role-dot-inline" aria-hidden />}
        </button>
        {open && <RoleModal onClose={() => setOpen(false)} />}
      </>
    );
  }
  return (
    <>
      <button className="icon-button topbar-search role-button" aria-label={`Ver como: ${ROLE_LABEL[role]}`} title={`Ver como: ${ROLE_LABEL[role]}`} onClick={openModal}>
        <Eye size={22} />
        {role !== "admin" && <span className="role-dot" aria-hidden />}
      </button>
      {open && <RoleModal onClose={() => setOpen(false)} />}
    </>
  );
}

function RoleModal({ onClose }: { onClose: () => void }) {
  const { role, setRole } = useRole();
  return (
    <Modal open title="Ver la app como…" onClose={onClose}>
      <div className="stack">
        <p className="text-secondary text-small">Sirve para probar cada punto de vista. Todavía no hay inicio de sesión: es solo un selector en este navegador y no cambia lo que la API permite.</p>
        <div className="stack-sm" role="radiogroup" aria-label="Rol">
          {ROLES.map((item) => (
            <button key={item} role="radio" aria-checked={role === item} className={`role-option${role === item ? " active" : ""}`} onClick={() => setRole(item)}>
              <span className="text-strong">{ROLE_LABEL[item]}</span>
              <span className="text-secondary text-small">{ROLE_DESCRIPTION[item]}</span>
            </button>
          ))}
        </div>
        <button className="btn primary block" onClick={onClose}>Listo</button>
      </div>
    </Modal>
  );
}
