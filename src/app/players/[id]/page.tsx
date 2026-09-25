"use client";

import dynamic from "next/dynamic";
import { useRef, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { AlertCircle, Camera, CheckCircle2, Copy, Download, Goal, Paperclip, Pencil, Printer, ScanFace, ShieldAlert, ShieldOff, Sparkles, SquareStack, Trash2 } from "lucide-react";
import { FaceBadge, RegistrationBadge } from "@/components/player/PlayerBadges";
import { FaceEnrollModal } from "@/components/player/FaceEnrollModal";
import { PlayerFormModal } from "@/components/player/PlayerFormModal";
import { PlayerIdCardPrint } from "@/components/player/PlayerIdCardPrint";
import { PlayerMatchHistory } from "@/components/player/PlayerMatchHistory";
import { PlayerPhotoGallery } from "@/components/player/PlayerPhotoGallery";
import { ActionMenu, Avatar, Badge, Button, ConfirmDialog, ErrorState, Loading, Modal, PageHeader, useToast } from "@/components/ui";
import { errorMessage, http } from "@/lib/client/http";
import { fileToResizedDataUrl, urlToCoverDataUrl } from "@/lib/client/image";
import { useRole } from "@/components/layout/RoleContext";
import { useFetch } from "@/lib/client/useFetch";
import { useStoredState } from "@/lib/client/useStoredState";
import { formatDate, SUSPENSION_REASON_LABEL } from "@/lib/labels";
import type { Paginated, PlayerCardDTO, PlayerDetailDTO, PlayerStatsSummaryDTO, SuspensionDTO } from "@/types/api";

// getUserMedia only runs in the browser.
const SimpleCameraCapture = dynamic(() => import("@/components/camera/SimpleCameraCapture").then((mod) => mod.SimpleCameraCapture), { ssr: false });

type Dialog = "edit" | "face" | "removeFace" | "delete" | null;
type Tab = "perfil" | "rostro" | "actividad";
const TABS: { id: Tab; label: string }[] = [
  { id: "perfil", label: "Perfil" },
  { id: "rostro", label: "Rostro y fotos" },
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
  const [tab, setTab] = useStoredState<Tab>("super-torneos:player:tab", "perfil", (value) => TABS.some((item) => item.id === value));
  const liveChampionshipId = player.data?.registrations.find((registration) => registration.status !== "inactive")?.championshipId?._id;
  const stats = useFetch<PlayerStatsSummaryDTO>(`/players/${id}/stats${liveChampionshipId ? `?championshipId=${liveChampionshipId}` : ""}`);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [photoCameraOpen, setPhotoCameraOpen] = useState(false);
  const [changingPhoto, setChangingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

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
    const node = document.querySelector<HTMLElement>(".print-target");
    if (!node) return;
    const EXPORT_SCALE = 4;
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(node, {
        backgroundColor: "#ffffff",
        scale: EXPORT_SCALE,
        useCORS: true,
        onclone: async (clonedDoc) => {
          const targets = Array.from(clonedDoc.querySelectorAll<HTMLElement>('[style*="background-image"]'));
          await Promise.all(
            targets.map(async (element) => {
              const match = /url\("?(https?:[^")]+)"?\)/.exec(element.style.backgroundImage);
              if (!match) return;
              const boxWidth = (Number(element.dataset.carnetW) || 170) * EXPORT_SCALE;
              const boxHeight = (Number(element.dataset.carnetH) || 170) * EXPORT_SCALE;
              try {
                const dataUrl = await urlToCoverDataUrl(match[1], boxWidth, boxHeight);
                const img = clonedDoc.createElement("img");
                img.src = dataUrl;
                img.className = element.className;
                element.replaceWith(img);
              } catch {
                // Leave original
              }
            })
          );
        },
      });
      const link = document.createElement("a");
      link.download = `carnet-${current.publicId}-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function setProfilePhoto(image: string) {
    setChangingPhoto(true);
    try {
      const { detectFaceCropsInImage } = await import("@/components/camera/faceCrop");
      const crops = await detectFaceCropsInImage(image).catch(() => null);
      await http(`/players/${id}/carnet-photo`, { json: { image: crops?.carnet ?? image } });
      toast.success("Foto de perfil actualizada");
      reloadAll();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setChangingPhoto(false);
    }
  }

  async function handleProfilePhotoFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      await setProfilePhoto(await fileToResizedDataUrl(file, 1280, "image/jpeg"));
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function handleProfilePhotoCamera(image: string) {
    setPhotoCameraOpen(false);
    await setProfilePhoto(image);
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
                    { label: "Imprimir carnet", icon: <Printer size={18} />, onClick: () => window.print() },
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

      {tab === "perfil" && (
        <div className="form-grid player-carnet" style={{ alignItems: "start" }}>
          {/* Player Hero Summary Card */}
          <section className="player-hero-card" aria-label="Resumen del jugador">
            <div className="player-hero-cover">
              <div className="player-hero-cover-accent" />
            </div>

            <div className="player-hero-body">
              {/* Avatar with touch photo trigger */}
              <div className="player-avatar-touchable">
                <Avatar src={current.photoUrl || current.facePhotoUrl} name={current.fullName} size={130} square />
                {can("player.manage") && (
                  <button
                    className="player-avatar-camera-btn"
                    title="Cambiar foto de perfil"
                    aria-label="Cambiar foto de perfil"
                    disabled={changingPhoto}
                    onClick={() => setPhotoCameraOpen(true)}
                  >
                    <Camera size={18} />
                  </button>
                )}
              </div>

              {can("player.manage") && (
                <div className="row-wrap" style={{ justifyContent: "center", gap: "var(--space-xs)", marginTop: "var(--space-sm)" }}>
                  <Button variant="ghost" size="small" icon={<Camera size={14} />} loading={changingPhoto} onClick={() => setPhotoCameraOpen(true)}>
                    Tomar foto
                  </Button>
                  <Button variant="ghost" size="small" icon={<Paperclip size={14} />} loading={changingPhoto} onClick={() => photoInputRef.current?.click()}>
                    Adjuntar
                  </Button>
                  <input ref={photoInputRef} type="file" accept="image/*" hidden onChange={handleProfilePhotoFile} />
                  <Modal open={photoCameraOpen} title="Tomar foto de perfil" onClose={() => setPhotoCameraOpen(false)}>
                    <SimpleCameraCapture onCapture={handleProfilePhotoCamera} onCancel={() => setPhotoCameraOpen(false)} />
                  </Modal>
                </div>
              )}

              <div className="row-wrap" style={{ justifyContent: "center", gap: "var(--space-xs)", marginTop: "var(--space-md)" }}>
                {liveRegistration && <RegistrationBadge status={liveRegistration.status} />}
                {liveRegistration?.shirtNumber != null && (
                  <span className="number-badge-hero">#{liveRegistration.shirtNumber}</span>
                )}
              </div>

              <h2 style={{ marginTop: "var(--space-xs)", fontSize: 22 }}>{current.fullName}</h2>

              {liveRegistration?.teamId && (
                <div className="row" style={{ justifyContent: "center", marginTop: 4 }}>
                  <Avatar src={liveRegistration.teamId.shieldUrl} name={liveRegistration.teamId.name} size={20} square />
                  <span className="text-secondary" style={{ fontWeight: 600 }}>{liveRegistration.teamId.name}</span>
                  {liveRegistration.position && (
                    <span className="text-secondary">· {liveRegistration.position}</span>
                  )}
                </div>
              )}

              {/* Biometric Status Callout inside summary */}
              {current.hasFace ? (
                <div className="face-alert-callout success">
                  <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
                  <div>
                    <strong>Rostro biométrico registrado</strong>
                    <div className="text-small" style={{ opacity: 0.85 }}>Listo para verificación automática en cancha</div>
                  </div>
                </div>
              ) : (
                <div className="face-alert-callout">
                  <ScanFace size={20} style={{ flexShrink: 0 }} />
                  <div className="grow">
                    <strong>Sin registro de rostro</strong>
                    <div className="text-small">Requerido para la toma de asistencia</div>
                  </div>
                  {can("player.manage") && (
                    <Button size="small" icon={<Camera size={14} />} onClick={() => setDialog("face")}>
                      Enrolar
                    </Button>
                  )}
                </div>
              )}
            </div>
          </section>

          <div className="stack" style={{ gap: "var(--space-2xl)" }}>
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
                <Row label="Identificador" value={current.publicId} action={<button className="icon-button" aria-label="Copiar identificador" onClick={copyIdentifier}><Copy size={14} /></button>} />
              </dl>
              {missingData && can("player.manage") && (
                <Button variant="secondary" size="small" onClick={() => setDialog("edit")} style={{ alignSelf: "flex-start" }}>Completar datos</Button>
              )}
            </section>

            <section className="card stack">
              <h3>Estadísticas en el campeonato</h3>
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

      {tab === "actividad" && <PlayerMatchHistory playerId={id} />}

      {canSeeCarnet && card.data && <PlayerIdCardPrint card={card.data} />}

      <PlayerFormModal open={dialog === "edit"} player={current} registration={liveRegistration} onClose={() => setDialog(null)} onSaved={closeAndReload} />
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

