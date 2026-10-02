"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { AlertTriangle, LogOut, UserRound } from "lucide-react";
import { Avatar, Button, EmptyState, Input, Loading, Modal, PageHeader } from "@/components/ui";
import { useRole } from "@/components/layout/RoleContext";
import { errorMessage, http } from "@/lib/client/http";
import { ROLE_LABEL } from "@/lib/roles";

interface DeletionImpact {
  ownedChampionships: number;
  withoutCoOrganizer: number;
}

const CONFIRM_WORD = "ELIMINAR";

export default function ProfilePage() {
  const { status, user, role, signIn } = useRole();
  const [impact, setImpact] = useState<DeletionImpact | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    http<DeletionImpact>("/users/me").then(setImpact).catch(() => setImpact(null));
  }, [userId]);

  if (status === "loading") return <Loading />;
  if (!user) {
    return (
      <EmptyState
        icon={<UserRound size={28} />}
        title="Inicia sesión para ver tu perfil"
        description="Aquí puedes revisar tu cuenta y, si lo deseas, eliminarla."
        action={<button className="btn primary" onClick={signIn}>Iniciar sesión</button>}
      />
    );
  }

  function closeDialog() {
    if (deleting) return;
    setDialogOpen(false);
    setConfirm("");
    setError("");
  }

  async function deleteAccount() {
    setDeleting(true);
    setError("");
    try {
      await http("/users/me", { method: "DELETE", json: { confirm } });
      await signOut({ callbackUrl: "/" });
    } catch (err) {
      setError(errorMessage(err));
      setDeleting(false);
    }
  }

  return (
    <div className="stack">
      <PageHeader title="Mi perfil" breadcrumb={[{ label: "Inicio", href: "/" }, { label: "Mi perfil" }]} />

      <section className="card stack-sm">
        <div className="account-summary">
          <Avatar src={user.image ?? undefined} name={user.name} size={56} />
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="text-strong truncate">{user.name}</div>
            <div className="text-secondary text-small truncate">{user.email}</div>
          </div>
        </div>
        <p className="text-secondary text-small">
          {user.isAdmin ? "Eres administrador: gestionas la app y todos los torneos." : `Tu rol: ${ROLE_LABEL[role]}.`}
        </p>
        <p className="text-secondary text-small">
          Tu nombre, correo y foto vienen de tu cuenta de Google. Para cambiarlos, hazlo allí. Consulta cómo tratamos tus datos en la{" "}
          <Link href="/privacidad" className="link-button">Política de Privacidad</Link>.
        </p>
        <div>
          <button className="btn secondary" onClick={() => void signOut({ callbackUrl: "/" })}>
            <LogOut size={18} aria-hidden /> Cerrar sesión
          </button>
        </div>
      </section>

      <p className="text-secondary text-small" style={{ textAlign: "center", marginTop: "var(--space-lg)" }}>
        <button type="button" className="link-button" style={{ color: "inherit", textDecoration: "underline" }} onClick={() => setDialogOpen(true)}>
          Eliminar mi cuenta
        </button>
      </p>

      <Modal
        open={dialogOpen}
        title="¿Eliminar tu cuenta?"
        onClose={closeDialog}
        footer={
          <>
            <Button variant="secondary" onClick={closeDialog} disabled={deleting}>Cancelar</Button>
            <Button variant="danger" onClick={deleteAccount} loading={deleting} disabled={confirm !== CONFIRM_WORD}>
              Eliminar definitivamente
            </Button>
          </>
        }
      >
        <div className="stack-sm">
          <p className="text-secondary">
            Vas a eliminar la cuenta de <strong>{user.email}</strong>. No se puede deshacer.
          </p>
          <p className="text-secondary text-small">
            Se borra tu cuenta y tus datos personales: tu perfil, tu acceso y tus registros de uso, y tu nombre se quita de los registros de asistencia y verificación.
            El registro de auditoría de la plataforma conserva el nombre de quien hizo cada acción.
          </p>
          <p className="text-secondary text-small">
            Los torneos que organizas no se eliminan, porque pertenecen a quienes participan en ellos: pasan a un coorganizador si lo hay. Tus torneos de demostración sí se borran.
          </p>
          {impact && impact.withoutCoOrganizer > 0 && (
            <p className="text-small" role="note" style={{ color: "var(--color-error)" }}>
              <AlertTriangle size={14} aria-hidden /> {impact.withoutCoOrganizer === 1 ? "Un torneo tuyo no tiene coorganizador" : `${impact.withoutCoOrganizer} torneos tuyos no tienen coorganizador`}:
              quedará sin responsable hasta que un administrador lo asigne.
            </p>
          )}
          <Input
            label={`Escribe ${CONFIRM_WORD} para confirmar`}
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            error={error || undefined}
          />
        </div>
      </Modal>
    </div>
  );
}
