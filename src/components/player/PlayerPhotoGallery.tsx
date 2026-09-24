"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { Camera, Paperclip, ScanFace, SquareUser, Trash2 } from "lucide-react";
import { Button, ConfirmDialog, Modal, useToast } from "@/components/ui";
import { errorMessage, http } from "@/lib/client/http";
import { fileToResizedDataUrl, urlToDataUrl } from "@/lib/client/image";
import type { PlayerPhotoDTO } from "@/types/api";

// getUserMedia and the face detector only run in the browser.
const SimpleCameraCapture = dynamic(() => import("@/components/camera/SimpleCameraCapture").then((mod) => mod.SimpleCameraCapture), { ssr: false });

const MAX_PHOTOS = 8;

/**
 * General photos of the player (identification, posters): no face detection, no embedding, and
 * kept apart from the biometric photo/consent above. Tap a thumbnail to see it larger; that's
 * where the "use as ID photo" / "use for face recognition" actions live.
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
  const [viewing, setViewing] = useState<PlayerPhotoDTO | null>(null);
  const [toDelete, setToDelete] = useState<PlayerPhotoDTO | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [settingCarnet, setSettingCarnet] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [pendingBiometric, setPendingBiometric] = useState<{ photo: PlayerPhotoDTO; crops: { face: string; carnet: string } } | null>(null);
  const [savingBiometric, setSavingBiometric] = useState(false);

  async function detectBiometricFromPhoto(photo: PlayerPhotoDTO) {
    setDetecting(true);
    try {
      const { detectFaceCropsInImage } = await import("@/components/camera/faceCrop");
      const crops = await detectFaceCropsInImage(await urlToDataUrl(photo.url));
      if (!crops) {
        toast.error("No se detectó un rostro claro en esta foto. Prueba con otra o usa la cámara.");
        return;
      }
      setViewing(null);
      setPendingBiometric({ photo, crops });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setDetecting(false);
    }
  }

  async function confirmBiometric() {
    if (!pendingBiometric) return;
    setSavingBiometric(true);
    try {
      await http(`/players/${playerId}/face`, { json: { image: pendingBiometric.crops.face, carnetImage: pendingBiometric.crops.carnet } });
      toast.success("Rostro registrado a partir de la foto");
      setPendingBiometric(null);
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSavingBiometric(false);
    }
  }

  async function setAsCarnet(photo: PlayerPhotoDTO) {
    setSettingCarnet(true);
    try {
      await http(`/players/${playerId}/photos/${photo._id}/carnet`, { method: "POST" });
      toast.success("Foto de carnet actualizada");
      setViewing(null);
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSettingCarnet(false);
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

  const viewingIsCarnet = Boolean(viewing) && Boolean(currentPhotoUrl) && viewing?.url === currentPhotoUrl;

  return (
    <section className="card stack">
      <div className="row-between">
        <h3>Galería</h3>
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
        {photos.length > 0 && " Toca una foto para verla más grande."}
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
              <button
                key={photo._id}
                type="button"
                aria-label="Ver foto ampliada"
                style={{ padding: 0, border: 0, background: "none", cursor: "pointer" }}
                onClick={() => setViewing(photo)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt="Foto del jugador"
                  style={{ width: 96, height: 96, objectFit: "cover", borderRadius: "var(--radius-md)", outline: isCarnet ? "2px solid var(--color-primary)" : undefined }}
                />
              </button>
            );
          })}
        </div>
      )}

      <Modal open={Boolean(viewing)} title="Foto" onClose={() => setViewing(null)}>
        {viewing && (
          <div className="stack" style={{ alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={viewing.url} alt="Foto del jugador ampliada" style={{ width: "100%", maxWidth: 360, borderRadius: "var(--radius-lg)" }} />
            {canManage && (
              <div className="stack-sm" style={{ width: "100%" }}>
                <Button
                  variant="secondary"
                  icon={<SquareUser size={18} />}
                  disabled={viewingIsCarnet || settingCarnet}
                  loading={settingCarnet}
                  onClick={() => setAsCarnet(viewing)}
                >
                  {viewingIsCarnet ? "Ya es la foto del carnet" : "Usar como foto del carnet"}
                </Button>
                <Button
                  variant="secondary"
                  icon={<ScanFace size={18} />}
                  loading={detecting}
                  onClick={() => detectBiometricFromPhoto(viewing)}
                >
                  Usar para reconocimiento facial
                </Button>
                <Button
                  variant="ghost"
                  icon={<Trash2 size={18} color="var(--color-error)" />}
                  onClick={() => { setToDelete(viewing); setViewing(null); }}
                >
                  Eliminar foto
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Eliminar foto"
        message="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        loading={deleting}
        onConfirm={confirmDelete}
        onClose={() => setToDelete(null)}
      />
      <ConfirmDialog
        open={Boolean(pendingBiometric)}
        title="Registrar rostro desde esta foto"
        message="Se detectó un rostro en la foto. Al confirmar, reemplaza el rostro y la foto de referencia usados para verificar la identidad del jugador en los partidos."
        confirmLabel="Usar esta foto"
        loading={savingBiometric}
        onConfirm={confirmBiometric}
        onClose={() => setPendingBiometric(null)}
      />
    </section>
  );
}
