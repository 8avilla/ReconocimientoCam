"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { Camera, ImageIcon } from "lucide-react";
import { Avatar, Button, Modal, useToast } from "@/components/ui";
import { errorMessage, http } from "@/lib/client/http";
import { fileToResizedDataUrl } from "@/lib/client/image";

// getUserMedia only runs in the browser.
const SimpleCameraCapture = dynamic(() => import("@/components/camera/SimpleCameraCapture").then((mod) => mod.SimpleCameraCapture), { ssr: false });

interface Props {
  open: boolean;
  player: { _id: string; fullName: string; photoUrl: string; facePhotoUrl?: string };
  onClose: () => void;
  onSaved: () => void;
}

/** Profile photo: take one with the camera or pick one from the gallery, preview it, then save. */
export function PlayerPhotoModal({ open, ...props }: Props) {
  return (
    <Modal open={open} title="Foto del jugador" onClose={props.onClose}>
      <PhotoForm key={props.player._id} {...props} />
    </Modal>
  );
}

function PhotoForm({ player, onClose, onSaved }: Omit<Props, "open">) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function pickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      setPending(await fileToResizedDataUrl(file, 1280, "image/jpeg"));
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function save() {
    if (!pending) return;
    setSaving(true);
    try {
      const { detectFaceCropsInImage } = await import("@/components/camera/faceCrop");
      const crops = await detectFaceCropsInImage(pending).catch(() => null);
      await http(`/players/${player._id}/carnet-photo`, { json: { image: crops?.carnet ?? pending } });
      toast.success("Foto de perfil actualizada");
      onSaved();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  if (cameraOpen) {
    return <SimpleCameraCapture onCapture={(image) => { setPending(image); setCameraOpen(false); }} onCancel={() => setCameraOpen(false)} />;
  }

  return (
    <div className="stack">
      <div className="row" style={{ gap: "var(--space-md)", alignItems: "flex-start" }}>
        <Avatar src={pending ?? (player.photoUrl || player.facePhotoUrl)} name={player.fullName} size={112} square />
        <div className="stack-sm grow">
          <Button variant="secondary" icon={<Camera size={18} />} onClick={() => setCameraOpen(true)}>Tomar foto</Button>
          <Button variant="secondary" icon={<ImageIcon size={18} />} onClick={() => inputRef.current?.click()}>Subir desde galería</Button>
          <input ref={inputRef} type="file" accept="image/*" hidden onChange={pickFile} />
        </div>
      </div>
      <div className="action-bar">
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button onClick={save} loading={saving} disabled={!pending}>Guardar</Button>
      </div>
    </div>
  );
}
