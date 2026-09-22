"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Camera, Pencil, ShieldOff, Trash2 } from "lucide-react";
import { FaceBadge, RegistrationBadge } from "@/components/player/PlayerBadges";
import { FaceEnrollModal } from "@/components/player/FaceEnrollModal";
import { PlayerFormModal } from "@/components/player/PlayerFormModal";
import { PlayerIdCard } from "@/components/player/PlayerIdCard";
import { RegistrationFormModal } from "@/components/team/RegistrationFormModal";
import { Avatar, Button, ConfirmDialog, ErrorState, Loading, PageHeader, useToast, ActionMenu } from "@/components/ui";
import { errorMessage, http } from "@/lib/client/http";
import { useRole } from "@/components/layout/RoleContext";
import { useFetch } from "@/lib/client/useFetch";
import { formatDate } from "@/lib/labels";
import type { PlayerCardDTO, PlayerDetailDTO } from "@/types/api";

type Dialog = "edit" | "face" | "registration" | "removeFace" | "delete" | null;

export default function PlayerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const player = useFetch<PlayerDetailDTO>(`/players/${id}`);
  const card = useFetch<PlayerCardDTO>(`/players/${id}/card`);
  const { can } = useRole();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);

  if (player.error) return <ErrorState message={player.error.message} onRetry={player.reload} />;
  if (!player.data) return <Loading />;
  const current = player.data;
  const liveRegistration = current.registrations.find((registration) => registration.status !== "inactive");

  const reloadAll = () => {
    player.reload();
    card.reload();
  };
  const closeAndReload = () => {
    setDialog(null);
    reloadAll();
  };

  async function run(action: () => Promise<void>, success: string, after: () => void) {
    setBusy(true);
    try {
      await action();
      toast.success(success);
      after();
    } catch (error) {
      toast.error(errorMessage(error));
      setDialog(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title={current.fullName}
        breadcrumb={[{ label: "Jugadores", href: "/players" }, { label: current.fullName }]}
        actions={can("player.manage") && (
          <ActionMenu
            label="Más acciones del jugador"
            actions={[
              { label: "Editar jugador", icon: <Pencil size={18} />, onClick: () => setDialog("edit") },
              { label: "Eliminar jugador", icon: <Trash2 size={18} />, danger: true, onClick: () => setDialog("delete") },
            ]}
          />
        )}
      />

      <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", alignItems: "start", gap: "var(--space-2xl)" }}>
        <section aria-label="Carnet digital">
          {card.error ? (
            <ErrorState message={card.error.message} onRetry={card.reload} />
          ) : card.data ? (
            <PlayerIdCard card={card.data} />
          ) : (
            <Loading />
          )}
        </section>

        <div className="stack">
          <section className="card stack">
            <h3>Datos personales</h3>
            <dl className="stack-sm">
              <Row label="Documento" value={current.documentId || "—"} />
              <Row label="Fecha de nacimiento" value={formatDate(current.birthDate)} />
              <Row label="Identificador" value={current.publicId} />
            </dl>
          </section>

          <section className="card stack">
            <div className="row-between">
              <h3>Inscripciones</h3>
              {liveRegistration && can("roster.manage") && <Button variant="ghost" size="small" onClick={() => setDialog("registration")}>Editar</Button>}
            </div>
            {current.registrations.length === 0 ? (
              <p className="text-secondary">El jugador no está inscrito en ningún equipo.</p>
            ) : (
              current.registrations.map((registration) => (
                <div key={registration._id} className="row">
                  <Avatar src={registration.teamId?.shieldUrl} name={registration.teamId?.name ?? "Equipo"} size={40} square />
                  <div className="grow">
                    <div className="text-strong">{registration.teamId?.name}{registration.shirtNumber != null && ` · #${registration.shirtNumber}`}</div>
                    <div className="text-secondary text-small">
                      {registration.position ?? "Sin posición"} · {registration.championshipId?.name} {registration.championshipId?.season}
                    </div>
                  </div>
                  <RegistrationBadge status={registration.status} />
                </div>
              ))
            )}
          </section>

          <section className="card stack">
            <div className="row-between">
              <h3>Verificación facial</h3>
              <FaceBadge hasFace={current.hasFace} />
            </div>
            <p className="text-secondary">
              {current.hasFace
                ? `Consentimiento registrado el ${formatDate(current.biometricConsentAt)}.`
                : "Registra el rostro del jugador para poder verificar su identidad en los partidos."}
            </p>
            {can("player.manage") && <div className="row-wrap">
              <Button icon={<Camera size={18} />} onClick={() => setDialog("face")}>
                {current.hasFace ? "Actualizar rostro" : "Registrar rostro"}
              </Button>
              {current.hasFace && (
                <Button variant="secondary" icon={<ShieldOff size={18} />} onClick={() => setDialog("removeFace")}>
                  Eliminar datos biométricos
                </Button>
              )}
            </div>}
          </section>
        </div>
      </div>

      <PlayerFormModal open={dialog === "edit"} player={current} onClose={() => setDialog(null)} onSaved={closeAndReload} />
      <FaceEnrollModal open={dialog === "face"} playerId={id} hasConsent={Boolean(current.biometricConsentAt)} onClose={() => setDialog(null)} onSaved={closeAndReload} />
      {dialog === "registration" && liveRegistration && (
        <RegistrationFormModal
          open
          registrationId={liveRegistration._id}
          playerName={current.fullName}
          initial={{ shirtNumber: liveRegistration.shirtNumber, position: liveRegistration.position, status: liveRegistration.status }}
          onClose={() => setDialog(null)}
          onSaved={closeAndReload}
        />
      )}
      <ConfirmDialog
        open={dialog === "removeFace"}
        title="Eliminar datos biométricos"
        message="Se borrarán la foto, el rostro registrado y el consentimiento del jugador. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        loading={busy}
        onConfirm={() => run(() => http(`/players/${id}/face`, { method: "DELETE" }), "Datos biométricos eliminados", closeAndReload)}
        onClose={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === "delete"}
        title="Eliminar jugador"
        message="Solo es posible si el jugador no tiene inscripciones ni asistencias. En otro caso, márcalo como inactivo."
        confirmLabel="Eliminar"
        loading={busy}
        onConfirm={() => run(() => http(`/players/${id}`, { method: "DELETE" }), "Jugador eliminado", () => router.push("/players"))}
        onClose={() => setDialog(null)}
      />
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="row-between">
      <dt className="text-secondary">{label}</dt>
      <dd className="text-strong">{value}</dd>
    </div>
  );
}
