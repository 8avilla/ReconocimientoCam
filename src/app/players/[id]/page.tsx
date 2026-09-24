"use client";

import dynamic from "next/dynamic";
import { useRef, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { AlertCircle, Camera, Copy, Download, Goal, Paperclip, Pencil, Printer, ShieldAlert, ShieldOff, SquareStack, Trash2 } from "lucide-react";
import { FaceBadge, RegistrationBadge } from "@/components/player/PlayerBadges";
import { FaceEnrollModal } from "@/components/player/FaceEnrollModal";
import { PlayerFormModal } from "@/components/player/PlayerFormModal";
import { PlayerIdCardPrint } from "@/components/player/PlayerIdCardPrint";
import { PlayerMatchHistory } from "@/components/player/PlayerMatchHistory";
import { PlayerPhotoGallery } from "@/components/player/PlayerPhotoGallery";
import { RegistrationFormModal } from "@/components/team/RegistrationFormModal";
import { Avatar, Badge, Button, ConfirmDialog, ErrorState, Loading, Modal, PageHeader, useToast, ActionMenu } from "@/components/ui";
import { errorMessage, http } from "@/lib/client/http";
import { fileToResizedDataUrl, urlToResizedDataUrl } from "@/lib/client/image";
import { useRole } from "@/components/layout/RoleContext";
import { useFetch } from "@/lib/client/useFetch";
import { useStoredState } from "@/lib/client/useStoredState";
import { formatDate, SUSPENSION_REASON_LABEL } from "@/lib/labels";
import type { Paginated, PlayerCardDTO, PlayerDetailDTO, PlayerPhotoDTO, PlayerStatsSummaryDTO, SuspensionDTO } from "@/types/api";

// getUserMedia only runs in the browser.
const SimpleCameraCapture = dynamic(() => import("@/components/camera/SimpleCameraCapture").then((mod) => mod.SimpleCameraCapture), { ssr: false });

type Dialog = "edit" | "face" | "registration" | "removeFace" | "delete" | null;
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
  const [editingRegistrationId, setEditingRegistrationId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [photoCameraOpen, setPhotoCameraOpen] = useState(false);
  const [changingPhoto, setChangingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

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

  async function downloadCarnet() {
    const node = document.querySelector<HTMLElement>(".print-target");
    if (!node) return;
    // Print-quality, not screen-quality: at scale 2 the ~480x300 card exports at only ~192 DPI for
    // a physical card-sized print, soft enough to read as "pixelated" once printed or zoomed in.
    const EXPORT_SCALE = 4;
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(node, {
        backgroundColor: "#ffffff",
        scale: EXPORT_SCALE,
        useCORS: true,
        // html2canvas can't reliably load a CSS background-image cross-origin (Azure Blob), even
        // with useCORS — it fails silently with "Error loading background-image" and skips it. The
        // clone it captures from is a detached document, so inlining the images there as data URLs
        // sidesteps the cross-origin fetch entirely instead of depending on html2canvas's own loader.
        // Resizing them here (not just re-encoding at full size) also matters: html2canvas's own
        // downscaling of a full-size source into a small badge/photo comes out visibly blockier
        // than doing that scaling ourselves with the canvas's high-quality smoothing.
        onclone: async (clonedDoc) => {
          const targets = Array.from(clonedDoc.querySelectorAll<HTMLElement>('[style*="background-image"]'));
          await Promise.all(
            targets.map(async (element) => {
              const match = /url\("?(https?:[^")]+)"?\)/.exec(element.style.backgroundImage);
              if (!match) return;
              // Sized to the element's own box, scaled by EXPORT_SCALE plus some headroom — not a
              // flat constant: a badge and the player photo need very different source resolutions,
              // and oversizing the small ones just leaves html2canvas to do most of the shrinking itself.
              const rect = element.getBoundingClientRect();
              const maxSize = Math.max(rect.width, rect.height, 60) * (EXPORT_SCALE * 1.5);
              try {
                element.style.backgroundImage = `url("${await urlToResizedDataUrl(match[1], maxSize)}")`;
              } catch {
                // Leave the original URL: html2canvas will just render that spot blank.
              }
            })
          );
        },
      });
      const link = document.createElement("a");
      link.download = `carnet-${current.publicId}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  /** Uploads the photo to the gallery and immediately points the profile/carnet photo at it. */
  async function setProfilePhoto(image: string) {
    setChangingPhoto(true);
    try {
      const photo = await http<PlayerPhotoDTO>(`/players/${id}/photos`, { json: { image } });
      await http(`/players/${id}/photos/${photo._id}/carnet`, { method: "POST" });
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
          <section className="card stack" aria-label="Resumen del jugador" style={{ alignItems: "center", textAlign: "center" }}>
            <Avatar src={current.photoUrl || current.facePhotoUrl} name={current.fullName} size={140} square />
            {can("player.manage") && (
              <div className="row-wrap" style={{ justifyContent: "center", gap: "var(--space-xs)" }}>
                <Button variant="ghost" size="small" icon={<Camera size={16} />} loading={changingPhoto} onClick={() => setPhotoCameraOpen(true)}>
                  Tomar foto
                </Button>
                <Button variant="ghost" size="small" icon={<Paperclip size={16} />} loading={changingPhoto} onClick={() => photoInputRef.current?.click()}>
                  Adjuntar
                </Button>
                <input ref={photoInputRef} type="file" accept="image/*" hidden onChange={handleProfilePhotoFile} />
                <Modal open={photoCameraOpen} title="Tomar foto de perfil" onClose={() => setPhotoCameraOpen(false)}>
                  <SimpleCameraCapture onCapture={handleProfilePhotoCamera} onCancel={() => setPhotoCameraOpen(false)} />
                </Modal>
              </div>
            )}
            {liveRegistration && <RegistrationBadge status={liveRegistration.status} />}
            <h2 style={{ marginTop: "var(--space-sm)" }}>{current.fullName}</h2>
            {liveRegistration?.teamId && (
              <div className="row" style={{ justifyContent: "center" }}>
                <Avatar src={liveRegistration.teamId.shieldUrl} name={liveRegistration.teamId.name} size={22} square />
                <span className="text-secondary">{liveRegistration.teamId.name}</span>
              </div>
            )}
            {(liveRegistration?.shirtNumber != null || liveRegistration?.position) && (
              <div>
                {liveRegistration?.shirtNumber != null && <div style={{ fontSize: 28, fontWeight: 800 }}>#{liveRegistration.shirtNumber}</div>}
                {liveRegistration?.position && <div className="text-secondary">{liveRegistration.position}</div>}
              </div>
            )}
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
                <div className="stat-grid">
                  <StatTile icon={<SquareStack size={20} />} label="Partidos" value={stats.data.matchesPlayed} />
                  <StatTile icon={<Goal size={20} />} label="Goles" value={stats.data.goals} />
                  <StatTile icon={<AlertCircle size={20} />} label="Tarjetas" value={stats.data.yellowCards + stats.data.redCards} />
                </div>
              ) : (
                <Loading />
              )}
            </section>

            <section className="card stack">
              <h3>Inscripciones</h3>
              {current.registrations.length === 0 ? (
                <p className="text-secondary">No está inscrito en ningún equipo.</p>
              ) : (
                <div className="stack-sm">
                  {current.registrations.map((registration) => (
                    <div key={registration._id} className="row">
                      <Avatar src={registration.teamId?.shieldUrl} name={registration.teamId?.name ?? "Equipo"} size={36} square />
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
                  ))}
                </div>
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

function StatTile({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="stat-tile">
      {icon}
      <span className="value">{value}</span>
      <span className="text-secondary text-small">{label}</span>
    </div>
  );
}
