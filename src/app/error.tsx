"use client";

import Link from "next/link";
import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <EmptyState
      icon={<TriangleAlert size={28} />}
      title="Algo salió mal"
      description="Tuvimos un problema al cargar esta pantalla. Puedes intentarlo de nuevo o volver al inicio."
      action={
        <div className="row" style={{ gap: "var(--space-sm)", justifyContent: "center" }}>
          <button className="btn primary" onClick={reset}>Reintentar</button>
          <Link href="/" className="btn secondary">Ir al inicio</Link>
        </div>
      }
    />
  );
}
