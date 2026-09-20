import React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "./Button";

export function Loading({ label = "Cargando..." }: { label?: string }) {
  return (
    <div className="loading-block" role="status" aria-label={label}>
      <span className="spinner large" />
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
