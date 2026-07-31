import Link from "next/link";

const menuItems = [
  {
    href: "/employees",
    title: "Empleados",
    description: "Crear, editar y enrolar el rostro de los empleados",
    icon: "👥",
    color: "#4f46e5",
  },
  {
    href: "/checkin",
    title: "Marcar asistencia",
    description: "Capturar rostro y ubicación para registrar la entrada/salida",
    icon: "📸",
    color: "#16a34a",
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
        gap: 32,
        padding: 24,
        background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #16a34a 100%)",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h1 style={{ color: "white", fontSize: 36, margin: 0 }}>Asistencia Facial</h1>
        <p style={{ color: "rgba(255,255,255,0.85)", marginTop: 8 }}>
          Reconocimiento facial + geolocalización
        </p>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 16, width: 360, maxWidth: "90vw" }}>
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "20px 24px",
              borderRadius: 16,
              background: "white",
              textDecoration: "none",
              color: "#111",
              boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
              borderLeft: `6px solid ${item.color}`,
              transition: "transform 0.15s ease",
            }}
          >
            <div
              style={{
                fontSize: 28,
                width: 48,
                height: 48,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 12,
                background: `${item.color}1a`,
              }}
            >
              {item.icon}
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: item.color }}>{item.title}</div>
              <div style={{ fontSize: 14, opacity: 0.7 }}>{item.description}</div>
            </div>
          </Link>
        ))}
      </nav>
    </main>
  );
}
