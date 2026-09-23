"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { Camera, CircleCheck, Paperclip, SquareUser, Trash2 } from "lucide-react";
import { Button, ConfirmDialog, Modal, useToast } from "@/components/ui";
import { errorMessage, http } from "@/lib/client/http";
import { fileToResizedDataUrl } from "@/lib/client/image";
import type { PlayerPhotoDTO } from "@/types/api";

// getUserMedia only runs in the browser.
const SimpleCameraCapture = dynamic(() => import("@/components/camera/SimpleCameraCapture").then((mod) => mod.SimpleCameraCapture), { ssr: false });

const MAX_PHOTOS = 8;

/**
 * General photos of the player (identification, posters): no face detection, no embedding, and
 * kept apart from the biometric photo/consent above.
 */
export function PlayerPhotoGallery({
  playerId,
  photos,
  currentPhotoUrl,
  canManage,
  onChanged,
}: {
  playerId: string;
  photos: PlayerPhotoDTO[];
  /** The player's current ID card / avatar photo, to mark which gallery photo (if any) is already it. */
  currentPhotoUrl: string;
  canManage: boolean;
  onChanged: () => void;
}) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [toDelete, setToDelete] = useState<PlayerPhotoDTO | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [settingCarnet, setSettingCarnet] = useState<string | null>(null);

  async function setAsCarnet(photo: PlayerPhotoDTO) {
    setSettingCarnet(photo._id);
    try {
      await http(`/players/${playerId}/photos/${photo._id}/carnet`, { method: "POST" });
      toast.success("Foto de carnet actualizada");
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSettingCarnet(null);
    }
  }

  async function upload(image: string) {
    setUploading(true);
    try {
      await http(`/players/${playerId}/photos`, { json: { image } });
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setUploading(false);
    }
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // lets the same file be picked again right after
    if (!file) return;
    try {
      await upload(await fileToResizedDataUrl(file, 1280, "image/jpeg"));
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function handleCamera(image: string) {
    setCameraOpen(false);
    await upload(image);
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await http(`/players/${playerId}/photos/${toDelete._id}`, { method: "DELETE" });
      setToDelete(null);
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="card stack">
      <div className="row-between">
        <h3>Fotos</h3>
        {canManage && photos.length < MAX_PHOTOS && (
          <div className="row-wrap" style={{ gap: "var(--space-xs)" }}>
            <Button variant="ghost" size="small" icon={<Camera size={16} />} loading={uploading} onClick={() => setCameraOpen(true)}>
              Tomar foto
            </Button>
            <Button variant="ghost" size="small" icon={<Paperclip size={16} />} loading={uploading} onClick={() => inputRef.current?.click()}>
              Adjuntar
            </Button>
          </div>
        )}
      </div>
      <p className="text-secondary text-small">
        Fotos generales del jugador, para identificarlo o para afiches. No se usan para verificar su identidad en los partidos.
        {canManage && photos.length > 0 && " Toca el ícono de persona en una foto para usarla como foto de carnet."}
      </p>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={handleFile} />
      <Modal open={cameraOpen} title="Tomar foto" onClose={() => setCameraOpen(false)}>
        <SimpleCameraCapture onCapture={handleCamera} onCancel={() => setCameraOpen(false)} />
      </Modal>
      {photos.length === 0 ? (
        <p className="text-secondary">Sin fotos todavía.</p>
      ) : (
        <div className="row-wrap" style={{ gap: "var(--space-sm)" }}>
          {photos.map((photo) => {
            const isCarnet = Boolean(currentPhotoUrl) && photo.url === currentPhotoUrl;
            return (
              <div key={photo._id} style={{ position: "relative" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt="Foto del jugador" style={{ width: 96, height: 96, objectFit: "cover", borderRadius: "var(--radius-md)", outline: isCarnet ? "2px solid var(--color-primary)" : undefined }} />
                {canManage && (
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Eliminar foto"
                    style={{ position: "absolute", top: -8, right: -8, width: 28, height: 28, background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
                    onClick={() => setToDelete(photo)}
                  >
                    <Trash2 size={14} color="var(--color-error)" />
                  </button>
                )}
                {canManage && (
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={isCarnet ? "Ya es la foto del carnet" : "Usar como foto del carnet"}
                    disabled={isCarnet || settingCarnet === photo._id}
                    title={isCarnet ? "Foto de carnet actual" : "Usar como foto del carnet"}
                    style={{
                      position: "absolute", bottom: -8, left: -8, width: 28, height: 28,
                      background: isCarnet ? "var(--color-primary)" : "var(--color-surface)",
                      border: "1px solid var(--color-border)",
                    }}
                    onClick={() => setAsCarnet(photo)}
                  >
                    {isCarnet ? <CircleCheck size={14} color="#fff" /> : <SquareUser size={14} />}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Eliminar foto"
        message="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        loading={deleting}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />
    </section>
  );
}
