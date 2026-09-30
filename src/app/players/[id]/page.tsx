"use client";

import { useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { AlertCircle, Camera, CheckCircle2, Copy, Download, Goal, Pencil, ScanFace, ShieldAlert, ShieldOff, SquareStack, Trash2 } from "lucide-react";
import { FaceBadge, RegistrationBadge } from "@/components/player/PlayerBadges";
import { FaceEnrollModal } from "@/components/player/FaceEnrollModal";
import { PlayerFormModal } from "@/components/player/PlayerFormModal";
import { PlayerIdCardPrint } from "@/components/player/PlayerIdCardPrint";
import { PlayerMatchHistory } from "@/components/player/PlayerMatchHistory";
import { PlayerPhotoModal } from "@/components/player/PlayerPhotoModal";
import { PlayerPhotoGallery } from "@/components/player/PlayerPhotoGallery";
import { ActionMenu, Avatar, Badge, Button, ConfirmDialog, ErrorState, Loading, PageHeader, useToast } from "@/components/ui";
import { errorMessage, http } from "@/lib/client/http";
import { downloadCarnetImage } from "@/lib/client/carnetExport";
import { useSyncChampionship } from "@/components/layout/ChampionshipContext";
import { useRole } from "@/components/layout/RoleContext";
import { useFetch } from "@/lib/client/useFetch";
import { useStoredState } from "@/lib/client/useStoredState";
import { ageFromBirthYear, formatDate, SUSPENSION_REASON_LABEL } from "@/lib/labels";
import type { Paginated, PlayerCardDTO, PlayerDetailDTO, PlayerStatsSummaryDTO, SuspensionDTO } from "@/types/api";


type Dialog = "edit" | "photo" | "face" | "removeFace" | "delete" | null;
type Tab = "general" | "actividad";
const TABS: { id: Tab; label: string }[] = [
  { id: "general", label: "General" },
  { id: "actividad", label: "Actividad" },
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
  const [tab, setTab] = useStoredState<Tab>("super-torneos:player:tab", "general", (value) => TABS.some((item) => item.id === value));
  const liveChampionshipId = player.data?.registrations.find((registration) => registration.status !== "inactive")?.championshipId?._id;
  useSyncChampionship(liveChampionshipId);
  const stats = useFetch<PlayerStatsSummaryDTO>(`/players/${id}/stats${liveChampionshipId ? `?championshipId=${liveChampionshipId}` : ""}`);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);

  if (player.error) return <ErrorState message={player.error.message} onRetry={player.reload} />;
  if (!player.data) return <Loading />;
  const current = player.data;
  const liveRegistration = current.registrations.find((registration) => registration.status !== "inactive");
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
    reloadAll();
  };

  async function downloadCarnet() {
    try {
      await downloadCarnetImage(current.publicId);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function copyIdentifier() {
    try {
      await navigator.clipboard.writeText(current.publicId);
      toast.success("Identificador copiado");
    } catch {
      toast.error("No se pudo copiar");
    }
  }

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
        avatar={<Avatar src={current.facePhotoUrl || current.photoUrl} name={current.fullName} size={44} />}
        actions={(canSeeCarnet || can("player.manage")) && (
          <ActionMenu
            label="Más acciones del jugador"
            actions={[
              ...(canSeeCarnet
                ? [
                    { label: "Descargar carnet", icon: <Download size={18} />, onClick: downloadCarnet },
                  ]
                : []),
              ...(can("player.manage")
                ? [
                    { label: "Editar jugador", icon: <Pencil size={18} />, onClick: () => setDialog("edit") },
                    { label: "Eliminar jugador", icon: <Trash2 size={18} />, danger: true, onClick: () => setDialog("delete") },
                  ]
                : []),
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

      {tab === "general" && (
        <div className="stack">
          <section className="card row" style={{ gap: "var(--space-lg)", alignItems: "center" }} aria-label="Resumen del jugador">
            <div className="player-avatar-touchable">
              <Avatar src={current.photoUrl || current.facePhotoUrl} name={current.fullName} size={88} square />
              {can("player.manage") && (
                <button className="player-avatar-camera-btn" title="Cambiar imagen del perfil" aria-label="Cambiar imagen del perfil" onClick={() => setDialog("photo")}>
                  <Camera size={18} />
                </button>
              )}
            </div>
            <div className="stack-xs grow" style={{ minWidth: 0 }}>
              <h2 className="truncate" style={{ fontSize: 20, margin: 0 }}>{current.fullName}</h2>
              {liveRegistration?.teamId && (
                <div className="row" style={{ gap: 6 }}>
                  <Avatar src={liveRegistration.teamId.shieldUrl} name={liveRegistration.teamId.name} size={20} square />
                  <span className="text-secondary truncate" style={{ fontWeight: 700 }}>
                    {liveRegistration.teamId.name}{liveRegistration.position ? ` · ${liveRegistration.position}` : ""}
                  </span>
                </div>
              )}
              <div className="row-wrap" style={{ gap: "var(--space-xs)" }}>
                {liveRegistration && <RegistrationBadge status={liveRegistration.status} />}
                {liveRegistration?.shirtNumber != null && <span className="number-badge-hero">#{liveRegistration.shirtNumber}</span>}
                <FaceBadge hasFace={current.hasFace} />
              </div>
            </div>
          </section>

          <div className="form-grid two" style={{ alignItems: "start" }}>
          <div className="stack">
            <section className="card stack">
              <div className="row-between">
                <h3>Datos personales</h3>
                {can("player.manage") && (
                  <button className="icon-button" aria-label="Editar datos personales" onClick={() => setDialog("edit")}>
                    <Pencil size={16} />
                  </button>
                )}
              </div>
              {missingData && can("player.manage") && (
                <Badge tone="warning" icon={<AlertCircle size={14} />}>
                  {[!current.documentId, !current.birthDate].filter(Boolean).length} campos pendientes
                </Badge>
              )}
              <dl className="stack-sm">
                <Row label="Documento" value={current.documentId || "—"} pending={!current.documentId && can("player.manage")} />
                <Row label="Fecha de nacimiento" value={formatDate(current.birthDate)} pending={!current.birthDate && can("player.manage")} />
                <Row label="Edad" value={ageFromBirthYear(current.birthDate) != null ? `${ageFromBirthYear(current.birthDate)} años` : "—"} />
                <Row label="Identificador" value={current.publicId} action={<button className="icon-button" aria-label="Copiar identificador" onClick={copyIdentifier}><Copy size={14} /></button>} />
              </dl>
              {missingData && can("player.manage") && (
                <Button variant="secondary" size="small" onClick={() => setDialog("edit")} style={{ alignSelf: "flex-start" }}>Completar datos</Button>
              )}
            </section>

            <section className="card stack">
              <h3>Estadísticas en el torneo</h3>
              {stats.data ? (
                <div className="stat-grid-enhanced">
                  <StatTileEnhanced
                    color="blue"
                    icon={<SquareStack size={20} />}
                    label="Partidos"
                    value={stats.data.matchesPlayed}
                  />
                  <StatTileEnhanced
                    color="green"
                    icon={<Goal size={20} />}
                    label="Goles"
                    value={stats.data.goals}
                    sub={stats.data.matchesPlayed > 0 ? `${(stats.data.goals / stats.data.matchesPlayed).toFixed(2)} por p.` : undefined}
                  />
                  <StatTileEnhanced
                    color="amber"
                    icon={<AlertCircle size={20} />}
                    label="Tarjetas"
                    value={stats.data.yellowCards + stats.data.redCards}
                    sub={`${stats.data.yellowCards} amarillas / ${stats.data.redCards} rojas`}
                  />
                </div>
              ) : (
                <Loading />
              )}
            </section>

          </div>
          <div className="stack">
            <section className="card stack">
              <div className="row-between">
                <h3>Verificación facial</h3>
                <FaceBadge hasFace={current.hasFace} />
              </div>
              <div className="row">
                {current.hasFace && <Avatar src={current.facePhotoUrl || current.photoUrl} name={current.fullName} size={56} />}
                <p className="text-secondary grow">
                  {current.hasFace
                    ? `Rostro registrado el ${formatDate(current.biometricConsentAt)}. Solo se usa para verificar su identidad en los partidos; no cambia la imagen del perfil.`
                    : "Registra la identidad facial del jugador para poder verificar su identidad en los partidos. Es independiente de la imagen del perfil."}
                </p>
              </div>
              {can("player.manage") && <div className="row-wrap">
                <Button icon={<Camera size={18} />} onClick={() => setDialog("face")}>
                  {current.hasFace ? "Actualizar identidad facial" : "Registrar identidad facial"}
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

        <PlayerPhotoGallery playerId={id} photos={current.photos ?? []} currentPhotoUrl={current.photoUrl} canManage={can("player.manage")} onChanged={reloadAll} />
        </div>
      )}

      {tab === "actividad" && <PlayerMatchHistory playerId={id} />}

      {canSeeCarnet && card.data && <PlayerIdCardPrint card={card.data} />}

      <PlayerFormModal open={dialog === "edit"} player={current} registration={liveRegistration} onClose={() => setDialog(null)} onSaved={closeAndReload} />
      <PlayerPhotoModal open={dialog === "photo"} player={current} onClose={() => setDialog(null)} onSaved={closeAndReload} />
      <FaceEnrollModal open={dialog === "face"} playerId={id} onClose={() => setDialog(null)} onSaved={closeAndReload} />
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

function Row({ label, value, pending, action }: { label: string; value: string; pending?: boolean; action?: ReactNode }) {
  return (
    <div className="row-between">
      <dt className="text-secondary">{label}</dt>
      <dd className="row" style={{ gap: 6 }}>
        <span className="text-strong">{value}</span>
        {pending && <Badge tone="warning">Pendiente</Badge>}
        {action}
      </dd>
    </div>
  );
}

function StatTileEnhanced({ icon, label, value, color, sub }: { icon: ReactNode; label: string; value: number; color: "blue" | "green" | "amber" | "red"; sub?: string }) {
  return (
    <div className="stat-tile-enhanced">
      <div className={`stat-tile-icon-box ${color}`}>{icon}</div>
      <div className="val">{value}</div>
      <div className="lbl">{label}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

