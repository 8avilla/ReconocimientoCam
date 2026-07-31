import Link from "next/link";

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
      }}
    >
      <h1>PoC Asistencia Facial</h1>
      <Link href="/employees">Empleados (crear / enrolar)</Link>
      <Link href="/checkin">Marcar asistencia</Link>
    </main>
  );
}
