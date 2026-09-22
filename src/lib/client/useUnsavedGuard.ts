"use client";

import { useState } from "react";

/**
 * Guards the "Cancelar" button of a form: if `dirty` is true it asks for confirmation before discarding;
 * otherwise it closes right away. Pass `confirmProps` to a `<ConfirmDialog>` rendered in the form.
 */
export function useUnsavedGuard(dirty: boolean, onClose: () => void) {
  const [confirming, setConfirming] = useState(false);
  const requestClose = () => (dirty ? setConfirming(true) : onClose());
  return {
    requestClose,
    confirmProps: {
      open: confirming,
      title: "¿Descartar cambios?",
      message: "Perderás lo que escribiste en este formulario.",
      confirmLabel: "Descartar",
      onConfirm: onClose,
      onClose: () => setConfirming(false),
    },
  };
}
