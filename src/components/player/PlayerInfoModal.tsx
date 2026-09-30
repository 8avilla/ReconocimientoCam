"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AlertCircle, Camera, CheckCircle2, Copy, Download, FileText, Goal, MoreHorizontal, Pencil, ScanFace, ShieldAlert, ShieldCheck, ShieldOff, SquareStack, Trash2, UserRound } from "lucide-react";
import { useRole } from "@/components/layout/RoleContext";
import { FaceEnrollModal } from "@/components/player/FaceEnrollModal";
import { PlayerIdCardPrint } from "@/components/player/PlayerIdCardPrint";
import { PlayerPhotoGallery } from "@/components/player/PlayerPhotoGallery";
import { PlayerMatchHistory } from "@/components/player/PlayerMatchHistory";
import { PlayerFormModal } from "@/components/player/PlayerFormModal";
import { PlayerPhotoModal } from "@/components/player/PlayerPhotoModal";
import { FaceBadge, RegistrationBadge } from "@/components/player/PlayerBadges";
import { Avatar, Badge, Button, ConfirmDialog, ErrorState, Loading, Modal, useToast } from "@/components/ui";
import { downloadCarnetImage } from "@/lib/client/carnetExport";
import { errorMessage, http } from "@/lib/client/http";
import { useFetch } from "@/lib/client/useFetch";
import { ageFromBirthYear, formatDate, SUSPENSION_REASON_LABEL } from "@/lib/labels";
import type { Paginated, PlayerCardDTO, PlayerDetailDTO, PlayerStatsSummaryDTO, SuspensionDTO } from "@/types/api";

type Dialog = "edit" | "card" | "photo" | "face" | "faceDone" | "more" | "removeFace" | "delete" | null;

interface Props {
  /** Id of the player to show; null keeps the sheet closed. */
  playerId: string | null;
  onClose: () => void;
  /** Called after anything was changed, so the list behind can refresh. */
  onChanged?: () => void;
}

/**
 * Quick sheet for a player: who they are, what is missing, and the everyday actions (photo, face, edit data)
 * without leaving the list. Each action opens its own small dialog and returns to the sheet afterwards.
 */
export function PlayerInfoModal({ playerId, onClose, onChanged }: Props) {
  const toast = useToast();
  const { can } = useRole();
  const manage = can("player.manage");
  const player = useFetch<PlayerDetailDTO>(playerId ? `/players/${playerId}` : null);
  const suspensions = useFetch<Paginated<SuspensionDTO>>(playerId ? `/suspensions?playerId=${playerId}&status=active&limit=10` : null);
  const liveChampionshipId = player.data?.registrations.find((item) => item.status !== "inactive")?.championshipId?._id;
  const stats = useFetch<PlayerStatsSummaryDTO>(playerId ? `/players/${playerId}/stats${liveChampionshipId ? `?championshipId=${liveChampionshipId}` : ""}` : null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"general" | "actividad">("general");
  const [tabPlayerId, setTabPlayerId] = useState(playerId);
  // A different player always opens on "General" (state adjusted during render, not in an effect).
  if (tabPlayerId !== playerId) {
    setTabPlayerId(playerId);
    setTab("general");
  }

  const data = player.data?._id === playerId ? player.data : null;
  const registration = data?.registrations.find((item) => item.status !== "inactive") ?? null;
  const missingData = data ? !data.documentId || !data.birthDate : false;
  const age = ageFromBirthYear(data?.birthDate);

  const changed = () => {
    player.reload();
    onChanged?.();
  };

  async function copyIdentifier() {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.publicId);
      toast.success("Identificador copiado");
    } catch {
      toast.error("No se pudo copiar");
    }
  }

  async function deletePlayer() {
    if (!data) return;
    setBusy(true);
    try {
      await http(`/players/${data._id}`, { method: "DELETE" });
      toast.success("Jugador eliminado");
      setDialog(null);
      onChanged?.();
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
      setDialog(null);
    } finally {
      setBusy(false);
    }
  }

  async function removeFace() {
    if (!data) return;
    setBusy(true);
    try {
      await http(`/players/${data._id}/face`, { method: "DELETE" });
      toast.success("Datos biométricos eliminados");
      setDialog(null);
      changed();
    } catch (error) {
      toast.error(errorMessage(error));
      setDialog(null);
    } finally {
      setBusy(false);
    }
  }

  const subtitle = registration ? [registration.shirtNumber != null && `#${registration.shirtNumber}`, registration.teamId?.name, registration.position].filter(Boolean).join(" · ") : "Sin equipo";

  return (
    <>
      <Modal open={Boolean(playerId) && dialog === null} title="Ficha del jugador" onClose={onClose}>
        {player.error ? (
          <ErrorState message={player.error.message} onRetry={player.reload} />
        ) : !data ? (
          <Loading />
        ) : (
          <div className="stack" style={{ gap: "var(--space-lg)" }}>
            <div className="row" style={{ gap: "var(--space-md)" }}>
              <span className="player-quick-avatar">
                <Avatar src={data.photoUrl || data.facePhotoUrl} name={data.fullName} size={64} />
                {data.hasFace && <span className="player-quick-avatar-dot" aria-hidden><Camera size={12} /></span>}
              </span>
              <div className="grow" style={{ minWidth: 0 }}>
                <h3 style={{ margin: 0 }} className="truncate">{data.fullName}</h3>
                <div className="text-secondary truncate">{subtitle}</div>
              </div>
            </div>

            <div className="row-wrap" style={{ gap: "var(--space-xs)" }}>
              {data.hasFace ? (
                <Badge tone="success" icon={<ShieldCheck size={12} aria-hidden />}>Rostro registrado</Badge>
              ) : (
                <Badge tone="warning" icon={<ScanFace size={12} aria-hidden />}>Sin rostro</Badge>
              )}
              {missingData && <Badge tone="warning" icon={<UserRound size={12} aria-hidden />}>Datos incompletos</Badge>}
              {registration && registration.status !== "active" && <RegistrationBadge status={registration.status} />}
            </div>

            {suspensions.data?.data.map((suspension) => (
              <div key={suspension._id} className="alert error" role="alert">
                <ShieldAlert size={18} />
                <span className="grow">
                  Suspendido en {suspension.teamId.name} — {SUSPENSION_REASON_LABEL[suspension.reason]}, cumplió {suspension.matchesServed} de {suspension.matchesToServe}{" "}
                  {suspension.matchesToServe === 1 ? "partido" : "partidos"}.
                </span>
              </div>
            ))}

            {manage && (
              <div className="tabs-line" role="tablist" aria-label="Secciones de la ficha">
                {([["general", "General"], ["actividad", "Actividades"]] as const).map(([id, label]) => (
                  <button key={id} type="button" role="tab" aria-selected={tab === id} className={`tab-line${tab === id ? " active" : ""}`} onClick={() => setTab(id)}>
                    {label}
                  </button>
                ))}
              </div>
            )}

            {manage && tab === "general" && (
              <>
            {manage && (
              <div className="player-quick-actions">
                <button type="button" className="player-quick-action primary" onClick={() => setDialog("photo")}>
                  <Camera size={22} aria-hidden /> Imagen del perfil
                </button>
                <button type="button" className="player-quick-action" onClick={() => setDialog("face")}>
                  <ScanFace size={22} aria-hidden /> {data.hasFace ? "Actualizar identidad facial" : "Registrar identidad facial"}
                </button>
                <button type="button" className="player-quick-action" onClick={() => setDialog("edit")}>
                  <Pencil size={22} aria-hidden /> Editar datos
                </button>
                <button type="button" className="player-quick-action" onClick={() => setDialog("more")}>
                  <MoreHorizontal size={22} aria-hidden /> Más opciones
                </button>
              </div>
            )}

            <section className="stack-sm">
              <h4 style={{ margin: 0 }}>Información rápida</h4>
              <dl className="stack-sm" style={{ margin: 0 }}>
                <InfoRow label="Documento" value={data.documentId} pending={manage} />
                <InfoRow label="Fecha de nacimiento" value={data.birthDate ? formatDate(data.birthDate) : undefined} pending={manage} />
                <InfoRow label="Edad" value={age != null ? `${age} años` : undefined} />
                <InfoRow
                  label="Identificador"
                  value={data.publicId}
                  action={<button type="button" className="icon-button" aria-label="Copiar identificador" onClick={copyIdentifier}><Copy size={14} /></button>}
                />
                <InfoRow
                  label="Equipo"
                  value={registration?.teamId?.name}
                  leading={registration?.teamId && <Avatar src={registration.teamId.shieldUrl} name={registration.teamId.name} size={20} square />}
                />
                <InfoRow label="Número" value={registration?.shirtNumber != null ? String(registration.shirtNumber) : undefined} />
                <InfoRow label="Posición" value={registration?.position ?? undefined} />
              </dl>
            </section>

            <section className="stack-sm">
              <div className="row-between">
                <h4 style={{ margin: 0 }}>Verificación facial</h4>
                <FaceBadge hasFace={data.hasFace} />
              </div>
              <p className="text-secondary text-small" style={{ margin: 0 }}>
                {data.hasFace
                  ? `Rostro registrado el ${formatDate(data.biometricConsentAt)}. Solo se usa para verificar su identidad en los partidos; no cambia la imagen del perfil.`
                  : "Registra la identidad facial para verificar su identidad en los partidos. Es independiente de la imagen del perfil."}
              </p>
            </section>

            <PlayerPhotoGallery playerId={data._id} photos={data.photos ?? []} currentPhotoUrl={data.photoUrl} canManage={manage} onChanged={changed} />
              </>
            )}

            {(!manage || tab === "actividad") && (
              <>
                <section className="stack-sm">
                  <h4 style={{ margin: 0 }}>Estadísticas en el torneo</h4>
                  {stats.data ? (
                    <div className="stat-grid-enhanced">
                      <StatTile color="blue" icon={<SquareStack size={20} />} label="Partidos" value={stats.data.matchesPlayed} />
                      <StatTile
                        color="green"
                        icon={<Goal size={20} />}
                        label="Goles"
                        value={stats.data.goals}
                        sub={stats.data.matchesPlayed > 0 ? `${(stats.data.goals / stats.data.matchesPlayed).toFixed(2)} por p.` : undefined}
                      />
                      <StatTile
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
                <PlayerMatchHistory playerId={data._id} />
              </>
            )}
          </div>
        )}
      </Modal>

      {data && (
        <>
          <PlayerFormModal open={dialog === "edit"} player={data} registration={registration} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); changed(); }} />
          <PlayerPhotoModal open={dialog === "photo"} player={data} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); changed(); }} />
          <FaceEnrollModal open={dialog === "face"} playerId={data._id} onClose={() => setDialog(null)} onSaved={() => { changed(); setDialog("faceDone"); }} />

          <Modal open={dialog === "faceDone"} title="Rostro registrado" onClose={() => setDialog(null)}>
            <div className="stack" style={{ alignItems: "center", textAlign: "center", gap: "var(--space-md)" }}>
              <CheckCircle2 size={64} color="var(--color-success)" aria-hidden />
              <p className="text-secondary" style={{ margin: 0 }}>El rostro del jugador ha sido guardado correctamente.</p>
              <Avatar src={data.facePhotoUrl || data.photoUrl} name={data.fullName} size={96} />
              <div>
                <div className="text-strong">{data.fullName}</div>
                <div className="text-secondary">{subtitle}</div>
              </div>
              <div className="stack-sm" style={{ width: "100%" }}>
                <Button size="large" onClick={() => setDialog(null)}>Continuar</Button>
                <Button variant="secondary" onClick={() => setDialog("face")}>Tomar otra foto</Button>
              </div>
            </div>
          </Modal>

          <Modal open={dialog === "more"} title="Más opciones" onClose={() => setDialog(null)}>
            <div className="stack">
              {manage && (
                <div className="manage-config-list">
                  <button type="button" className="manage-config-row" onClick={() => setDialog("card")}>
                    <span className="manage-config-icon"><FileText size={20} aria-hidden /></span>
                    <span className="grow text-strong">Ver o descargar carnet</span>
                  </button>
                  {data.hasFace && (
                    <button type="button" className="manage-config-row" onClick={() => setDialog("removeFace")}>
                      <span className="manage-config-icon"><ShieldOff size={20} aria-hidden /></span>
                      <span className="grow text-strong">Eliminar datos biométricos</span>
                    </button>
                  )}
                </div>
              )}
              <div className="manage-config-list">
                <button type="button" className="manage-config-row" onClick={() => setDialog("delete")} style={{ color: "var(--color-error)" }}>
                  <span className="manage-config-icon" style={{ color: "var(--color-error)" }}><Trash2 size={20} aria-hidden /></span>
                  <span className="grow text-strong">Eliminar jugador</span>
                </button>
              </div>
            </div>
          </Modal>

          <CardModal open={dialog === "card"} playerId={data._id} onClose={() => setDialog(null)} />

          <ConfirmDialog
            open={dialog === "removeFace"}
            title="Eliminar datos biométricos"
            message="Se borrarán la foto y el rostro registrado del jugador. Esta acción no se puede deshacer."
            confirmLabel="Eliminar"
            loading={busy}
            onConfirm={removeFace}
            onClose={() => setDialog(null)}
          />

          <ConfirmDialog
            open={dialog === "delete"}
            title="Eliminar jugador"
            message="Solo es posible si el jugador no tiene inscripciones ni asistencias. En otro caso, márcalo como inactivo."
            confirmLabel="Eliminar"
            loading={busy}
            onConfirm={deletePlayer}
            onClose={() => setDialog(null)}
          />
        </>
      )}
    </>
  );
}

function StatTile({ icon, label, value, color, sub }: { icon: ReactNode; label: string; value: number; color: "blue" | "green" | "amber" | "red"; sub?: string }) {
  return (
    <div className="stat-tile-enhanced">
      <div className={`stat-tile-icon-box ${color}`}>{icon}</div>
      <div className="val">{value}</div>
      <div className="lbl">{label}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

function InfoRow({ label, value, pending, action, leading }: { label: string; value?: string; pending?: boolean; action?: ReactNode; leading?: ReactNode }) {
  return (
    <div className="row-between">
      <dt className="text-secondary">{label}</dt>
      <dd className="row" style={{ gap: 6, margin: 0, minWidth: 0 }}>
        {leading}
        <span className="text-strong truncate">{value || "—"}</span>
        {!value && pending && <Badge tone="warning">Pendiente</Badge>}
        {action}
      </dd>
    </div>
  );
}

/** The player's ID card on screen, with download, without leaving the sheet. */
function CardModal({ open, playerId, onClose }: { open: boolean; playerId: string; onClose: () => void }) {
  const toast = useToast();
  const card = useFetch<PlayerCardDTO>(open ? `/players/${playerId}/card` : null);
  const [downloading, setDownloading] = useState(false);

  async function download() {
    if (!card.data) return;
    setDownloading(true);
    try {
      await downloadCarnetImage(card.data.publicId);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Carnet"
      onClose={onClose}
      footer={
        <>
          <Button icon={<Download size={18} />} loading={downloading} disabled={!card.data} onClick={download}>Descargar</Button>
        </>
      }
    >
      {card.error ? (
        <ErrorState message={card.error.message} onRetry={card.reload} />
      ) : !card.data ? (
        <Loading />
      ) : (
        <>
          <CardPreview card={card.data} />
          {/* The export renders this true-size copy; the preview above is scaled to fit the screen. */}
          <PlayerIdCardPrint card={card.data} />
        </>
      )}
    </Modal>
  );
}

const CARD_WIDTH = 480;
const CARD_HEIGHT = 300;

/** Shows the card scaled down to the width available, so it never overflows the dialog. */
function CardPreview({ card }: { card: PlayerCardDTO }) {
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!box) return;
    const update = () => setScale(Math.min(1, box.clientWidth / CARD_WIDTH));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(box);
    return () => observer.disconnect();
  }, [box]);

  return (
    <div ref={setBox} style={{ width: "100%", height: CARD_HEIGHT * scale, overflow: "hidden" }}>
      <div style={{ width: CARD_WIDTH, height: CARD_HEIGHT, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        <PlayerIdCardPrint card={card} preview />
      </div>
    </div>
  );
}
