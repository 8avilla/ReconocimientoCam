"use client";

import React, { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "./Button";

interface ModalProps {
  title: string;
  open: boolean;
  onClose: () => void;
  wide?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/** Dialog on desktop, bottom sheet on mobile. Closes with Esc or a backdrop click. */
export function Modal({ title, open, onClose, wide, children, footer }: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  // Callers pass a new onClose on every render; the effect below must only run when the modal opens or closes,
  // otherwise it would steal the focus from the field being typed in on each keystroke.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      // Keep keyboard focus inside the dialog (background content must not be tabbable while it's open).
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey ? active === first || !dialogRef.current.contains(active) : active === last) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    };
    // With the on-screen keyboard open, keep the field being edited visible.
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement;
      if (target.matches("input, select, textarea")) setTimeout(() => target.scrollIntoView({ block: "center", behavior: "smooth" }), 300);
    };
    document.addEventListener("keydown", onKeyDown);
    dialogRef.current?.addEventListener("focusin", onFocusIn);
    const dialog = dialogRef.current;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      dialog?.removeEventListener("focusin", onFocusIn);
      document.body.style.overflow = "";
      previouslyFocused?.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        ref={dialogRef}
        className={`modal${wide ? " wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="modal-header">
          <h3 id={titleId}>{title}</h3>
          <button className="icon-button" onClick={onClose} aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({ open, title, message, confirmLabel, loading, onConfirm, onClose }: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </>
      }
    >
      <p className="text-secondary">{message}</p>
    </Modal>
  );
}
