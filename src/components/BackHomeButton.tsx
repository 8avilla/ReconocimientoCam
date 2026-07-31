import Link from "next/link";

export default function BackHomeButton() {
  return (
    <Link
      href="/"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 14,
        color: "#4f46e5",
        textDecoration: "none",
        fontWeight: 600,
      }}
    >
      ← Volver al inicio
    </Link>
  );
}
