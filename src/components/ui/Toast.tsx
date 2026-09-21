"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

type ToastKind = "success" | "error";
interface ToastAction { label: string; onClick: () => void }
interface ToastItem { id: number; kind: ToastKind; message: string; action?: ToastAction }
interface ToastApi { success: (message: string, action?: ToastAction) => void; error: (message: string) => void }

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback((kind: ToastKind, message: string, action?: ToastAction) => {
    const id = Date.now() + Math.random();
    // Only the latest few stay on screen so a burst of events never covers the content.
    setToasts((current) => [...current, { id, kind, message, action }].slice(-3));
    // A toast with an action (e.g. "Deshacer") stays a bit longer so it can be reached.
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), kind === "error" ? 6000 : action ? 4500 : 3500);
  }, []);
  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);

  const api = useMemo<ToastApi>(
    () => ({ success: (message, action) => push("success", message, action), error: (message) => push("error", message) }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-region" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.kind}`} role={toast.kind === "error" ? "alert" : "status"}>
            {toast.kind === "success" ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
            <span className="grow">{toast.message}</span>
            {toast.action && (
              <button className="toast-action" onClick={() => { const { onClick } = toast.action!; dismiss(toast.id); onClick(); }}>{toast.action.label}</button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
