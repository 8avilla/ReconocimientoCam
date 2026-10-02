"use client";

/** Last resort: replaces the whole page (even the layout) when the root layout itself fails. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0, background: "#f8fafc", color: "#0f172a" }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 22 }}>Algo salió mal</h1>
          <p style={{ color: "#64748b" }}>No pudimos cargar Super Torneos. Inténtalo de nuevo.</p>
          <button onClick={reset} style={{ marginTop: 12, padding: "12px 20px", borderRadius: 10, border: 0, background: "#16a34a", color: "#fff", fontWeight: 700 }}>
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
