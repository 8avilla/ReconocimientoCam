import Link from "next/link";

const menuItems = [
  {
    href: "/employees",
    title: "Empleados",
    description: "Crear, editar y enrolar el rostro de los empleados",
  },
  {
    href: "/checkin",
    title: "Marcar asistencia",
    description: "Capturar rostro y ubicación para registrar la entrada/salida",
  },
];

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        padding: 24,
      }}
    >
      <h1>Asistencia Facial</h1>
      <nav style={{ display: "flex", flexDirection: "column", gap: 16, width: 320, maxWidth: "90vw" }}>
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: "block",
              padding: "16px 20px",
              borderRadius: 12,
              border: "1px solid #ddd",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 600 }}>{item.title}</div>
            <div style={{ fontSize: 14, opacity: 0.7 }}>{item.description}</div>
          </Link>
        ))}
      </nav>
    </main>
  );
}
