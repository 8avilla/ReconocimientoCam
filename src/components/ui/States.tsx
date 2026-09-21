import React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "./Button";

/** Placeholder while data loads: greyed rows shaped like a list (default) or a plain spinner. */
export function Loading({ label = "Cargando...", variant = "list", rows = 5 }: { label?: string; variant?: "list" | "spinner"; rows?: number }) {
  if (variant === "spinner") {
    return (
      <div className="loading-block" role="status" aria-label={label}>
        <span className="spinner large" />
      </div>
    );
  }
  return (
    <div className="skeleton-list" role="status" aria-label={label} aria-busy="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="skeleton-row">
          <span className="skeleton skeleton-avatar" />
          <span className="skeleton-lines">
            <span className="skeleton skeleton-line short" />
            <span className="skeleton skeleton-line" />
          </span>
        </div>
      ))}
    </div>
  );
}

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <EmptyState
      icon={<AlertTriangle size={28} />}
      title="No se pudo cargar la información"
      description={message}
      action={onRetry && <Button variant="secondary" onClick={onRetry}>Reintentar</Button>}
    />
  );
}
