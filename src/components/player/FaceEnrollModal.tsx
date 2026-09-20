"use client";

import { useState } from "react";
import { Button, Modal, useToast } from "@/components/ui";
import { errorMessage, http } from "@/lib/client/http";
import { FaceEnrollment } from "./FaceEnrollment";

interface Props {
  open: boolean;
  playerId: string;
  /** Consent already on file skips the consent checkbox requirement on the server. */
  hasConsent: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function FaceEnrollModal({ open, ...props }: Props) {
  return (
    <Modal open={open} title="Registrar rostro" onClose={props.onClose} wide>
      <FaceEnrollForm {...props} />
    </Modal>
  );
}

function FaceEnrollForm({ playerId, hasConsent, onClose, onSaved }: Omit<Props, "open">) {
  const toast = useToast();
  const [consent, setConsent] = useState(hasConsent);
  const [image, setImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!image) return;
    setSaving(true);
    try {
      await http(`/players/${playerId}/face`, { json: { image, consent } });
      toast.success("Rostro registrado correctamente");
      onSaved();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stack">
      <FaceEnrollment image={image} consent={consent} onConsentChange={(value) => { setConsent(value); if (!value) setImage(null); }} onImageChange={setImage} />
      <div className="action-bar">
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button size="large" onClick={handleSave} loading={saving} disabled={!image}>Guardar rostro</Button>
      </div>
    </div>
  );
}
