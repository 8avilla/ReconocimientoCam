"use client";

import { Modal } from "@/components/ui";
import { ROLES, ROLE_DESCRIPTION, ROLE_LABEL } from "@/lib/roles";
import { useRole } from "./RoleContext";

/**
 * "View as" selector: previews the app as visitor, organizer or admin (no login yet, nothing is enforced
 * by the API). The trigger button lives wherever it's placed (sidebar, or inside the "Más" sheet), but the
 * modal itself is rendered once at the app shell's top level so closing a parent sheet never unmounts it.
 */
export function RoleModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { role, setRole } = useRole();
  return (
    <Modal open={open} title="Ver la app como…" onClose={onClose}>
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
