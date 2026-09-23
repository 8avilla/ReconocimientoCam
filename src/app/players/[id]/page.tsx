"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AlertCircle, Camera, Pencil, Printer, ShieldAlert, ShieldOff, Trash2 } from "lucide-react";
import { FaceBadge, RegistrationBadge } from "@/components/player/PlayerBadges";
import { FaceEnrollModal } from "@/components/player/FaceEnrollModal";
import { PlayerFormModal } from "@/components/player/PlayerFormModal";
import { PlayerIdCard } from "@/components/player/PlayerIdCard";
import { PlayerIdCardPrint } from "@/components/player/PlayerIdCardPrint";
import { PlayerPhotoGallery } from "@/components/player/PlayerPhotoGallery";
import { RegistrationFormModal } from "@/components/team/RegistrationFormModal";
import { Avatar, Button, ConfirmDialog, ErrorState, Loading, PageHeader, useToast, ActionMenu } from "@/components/ui";
import { errorMessage, http } from "@/lib/client/http";
import { useRole } from "@/components/layout/RoleContext";
import { useFetch } from "@/lib/client/useFetch";
import { useStoredState } from "@/lib/client/useStoredState";
import { formatDate, SUSPENSION_REASON_LABEL } from "@/lib/labels";
import type { Paginated, PlayerCardDTO, PlayerDetailDTO, SuspensionDTO } from "@/types/api";

type Dialog = "edit" | "face" | "registration" | "removeFace" | "delete" | null;
type Tab = "perfil" | "rostro" | "inscripciones";
const TABS: { id: Tab; label: string }[] = [
  { id: "perfil", label: "Perfil" },
  { id: "rostro", label: "Rostro y fotos" },
  { id: "inscripciones", label: "Inscripciones" },
];

export default function PlayerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const player = useFetch<PlayerDetailDTO>(`/players/${id}`);
  const suspensions = useFetch<Paginated<SuspensionDTO>>(`/suspensions?playerId=${id}&status=active&limit=10`);
  const { can } = useRole();
  const canSeeCarnet = can("player.manage");
  const card = useFetch<PlayerCardDTO>(canSeeCarnet ? `/players/${id}/card` : null);
  const [tab, setTab] = useStoredState<Tab>("super-torneos:player:tab", "perfil", (value) => TABS.some((item) => item.id === value));
  const [dialog, setDialog] = useState<Dialog>(null);
  const [editingRegistrationId, setEditingRegistrationId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (player.error) return <ErrorState message={player.error.message} onRetry={player.reload} />;
  if (!player.data) return <Loading />;
  const current = player.data;
  const liveRegistration = current.registrations.find((registration) => registration.status !== "inactive");
  const editingRegistration = current.registrations.find((registration) => registration._id === editingRegistrationId);
  const missingData = !current.documentId || !current.birthDate;
  const headerDescription = liveRegistration
    ? [liveRegistration.teamId?.name ?? "Sin equipo", liveRegistration.championshipId && `${liveRegistration.championshipId.name} ${liveRegistration.championshipId.season}`]
        .filter(Boolean)
        .join(" · ")
    : undefined;

  const reloadAll = () => {
    player.reload();
    card.reload();
  };
  const closeAndReload = () => {
    setDialog(null);
    setEditingRegistrationId(null);
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
        description={headerDescription}
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

      {suspensions.data && suspensions.data.data.length > 0 && (
        <div className="stack-sm" style={{ marginBottom: "var(--space-lg)" }}>
          {suspensions.data.data.map((suspension) => (
            <div key={suspension._id} className="alert error" role="alert">
              <ShieldAlert size={18} />
              <span className="grow">
                Suspendido en {suspension.teamId.name} — {SUSPENSION_REASON_LABEL[suspension.reason]}, cumplió {suspension.matchesServed} de {suspension.matchesToServe}{" "}
                {suspension.matchesToServe === 1 ? "partido" : "partidos"}.
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="tabs-line" role="tablist" aria-label="Secciones del jugador">
        {TABS.map((item) => (
          <button key={item.id} role="tab" aria-selected={tab === item.id} className={`tab-line${tab === item.id ? " active" : ""}`} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      {tab === "perfil" && (
        <div className="form-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", alignItems: "start", gap: "var(--space-2xl)" }}>
          {canSeeCarnet && (
            <section aria-label="Carnet digital" className="stack">
              {card.error ? (
                <ErrorState message={card.error.message} onRetry={card.reload} />
              ) : card.data ? (
                <>
                  <PlayerIdCard card={card.data} />
                  <Button variant="secondary" icon={<Printer size={18} />} onClick={() => window.print()} style={{ alignSelf: "center" }}>
                    Imprimir carnet
                  </Button>
                  <PlayerIdCardPrint card={card.data} />
                </>
              ) : (
                <Loading />
              )}
            </section>
          )}

          <section className="card stack">
            <h3>Datos personales</h3>
            {missingData && can("player.manage") && (
              <div className="alert warning" role="note">
                <AlertCircle size={18} />
                <span className="grow">Faltan datos: {[!current.documentId && "documento", !current.birthDate && "fecha de nacimiento"].filter(Boolean).join(", ")}.</span>
                <button className="text-strong" onClick={() => setDialog("edit")}>Completar</button>
              </div>
            )}
            <dl className="stack-sm">
              <Row label="Documento" value={current.documentId || "—"} />
              <Row label="Fecha de nacimiento" value={formatDate(current.birthDate)} />
              <Row label="Identificador" value={current.publicId} />
            </dl>
          </section>
        </div>
      )}

      {tab === "rostro" && (
        <div className="stack" style={{ gap: "var(--space-2xl)" }}>
          <section className="card stack">
            <div className="row-between">
              <h3>Verificación facial</h3>
              <FaceBadge hasFace={current.hasFace} />
            </div>
            <div className="row">
              {current.hasFace && <Avatar src={current.facePhotoUrl || current.photoUrl} name={current.fullName} size={56} />}
              <p className="text-secondary grow">
                {current.hasFace
                  ? `Rostro registrado el ${formatDate(current.biometricConsentAt)}.`
                  : "Registra el rostro del jugador para poder verificar su identidad en los partidos."}
              </p>
            </div>
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

          <PlayerPhotoGallery playerId={id} photos={current.photos ?? []} currentPhotoUrl={current.photoUrl} canManage={can("player.manage")} onChanged={reloadAll} />
        </div>
      )}

      {tab === "inscripciones" && (
        <section className="card stack">
          <h3>Inscripciones</h3>
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
                {registration.status !== "inactive" && can("roster.manage") && (
                  <Button variant="ghost" size="small" onClick={() => { setEditingRegistrationId(registration._id); setDialog("registration"); }}>Editar</Button>
                )}
              </div>
            ))
          )}
        </section>
      )}

      <PlayerFormModal open={dialog === "edit"} player={current} onClose={() => setDialog(null)} onSaved={closeAndReload} />
      <FaceEnrollModal open={dialog === "face"} playerId={id} onClose={() => setDialog(null)} onSaved={closeAndReload} />
      {dialog === "registration" && editingRegistration && (
        <RegistrationFormModal
          open
          registrationId={editingRegistration._id}
          playerName={current.fullName}
          initial={{ shirtNumber: editingRegistration.shirtNumber, position: editingRegistration.position, status: editingRegistration.status }}
          onClose={() => { setDialog(null); setEditingRegistrationId(null); }}
          onSaved={closeAndReload}
        />
      )}
      <ConfirmDialog
        open={dialog === "removeFace"}
        title="Eliminar datos biométricos"
        message="Se borrarán la foto y el rostro registrado del jugador. Esta acción no se puede deshacer."
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
