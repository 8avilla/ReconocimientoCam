"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import FaceCapture from "@/components/camera/FaceCapture";
import BackHomeButton from "@/components/BackHomeButton";

type Employee = {
  _id: string;
  name: string;
  active: boolean;
  embeddingCount: number;
};

type DaySummary = {
  date: string;
  firstCheckin: string | null;
  lastCheckout: string | null;
  workedMinutes: number;
  incomplete: boolean;
};

const ACCENT = "#4f46e5";

const cardStyle: React.CSSProperties = {
  background: "white",
  borderRadius: 20,
  padding: 24,
  boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
};

function formatTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
}

function formatWorked(minutes: number) {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

export default function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyEnroll, setBusyEnroll] = useState(false);
  const [message, setMessage] = useState("");
  const [attendance, setAttendance] = useState<DaySummary[]>([]);

  async function load() {
    const res = await fetch(`/api/employees/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setEmployee(data);
    setName(data.name);
  }

  async function loadAttendance() {
    const res = await fetch(`/api/employees/${id}/attendance`);
    if (!res.ok) return;
    setAttendance(await res.json());
  }

  useEffect(() => {
    load();
    loadAttendance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/employees/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, active: employee?.active }),
    });
    setSaving(false);
    load();
  }

  async function handleToggleActive() {
    if (!employee) return;
    await fetch(`/api/employees/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !employee.active }),
    });
    load();
  }

  async function handleDelete() {
    if (!confirm("¿Eliminar este empleado y sus rostros enrolados?")) return;
    await fetch(`/api/employees/${id}`, { method: "DELETE" });
    router.push("/employees");
  }

  async function handleEnroll(imageBase64: string) {
    setBusyEnroll(true);
    setMessage("");
    try {
      const res = await fetch(`/api/employees/${id}/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageBase64 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(`Error: ${data.error ?? "No se pudo enrolar"}`);
        return;
      }
      setMessage(`Rostro enrolado. Total capturas: ${data.total}`);
      load();
    } catch (e) {
      setMessage("Error: " + (e as Error).message);
    } finally {
      setBusyEnroll(false);
    }
  }

  if (!employee) {
    return (
      <main style={{ minHeight: "100vh", background: "#f4f6f8", padding: 24 }}>
        <p style={{ color: "#6b7280" }}>Cargando...</p>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f4f6f8", padding: 24 }}>
      <div style={{ maxWidth: 780, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
        <BackHomeButton />

        <div>
          <h1 style={{ color: ACCENT, margin: 0, fontSize: 28 }}>👤 {employee.name}</h1>
          <p style={{ color: "#6b7280", marginTop: 4 }}>Editar datos, enrolar rostro y ver informe de asistencia</p>
        </div>

        <div style={cardStyle}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: "1px solid #d1d5db", fontSize: 15 }}
            />
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: "10px 20px",
                borderRadius: 10,
                border: "none",
                background: ACCENT,
                color: "white",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 16 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, color: "#374151" }}>
              <input type="checkbox" checked={employee.active} onChange={handleToggleActive} /> Activo
            </label>
            <span style={{ color: "#6b7280", fontSize: 14 }}>{employee.embeddingCount} rostro(s) enrolado(s)</span>
            <button
              onClick={handleDelete}
              style={{
                marginLeft: "auto",
                color: "#dc2626",
                background: "none",
                border: "none",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Eliminar empleado
            </button>
          </div>
        </div>

        <div style={{ ...cardStyle, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18, alignSelf: "flex-start" }}>Enrolar rostro</h2>
          <FaceCapture onCapture={handleEnroll} busy={busyEnroll} buttonLabel="Enrolar rostro" />
          {message && (
            <p style={{ color: message.startsWith("Error") ? "#dc2626" : "#16a34a", fontWeight: 600 }}>{message}</p>
          )}
        </div>

        <div style={cardStyle}>
          <h2 style={{ margin: "0 0 16px", fontSize: 18 }}>Informe de asistencia</h2>
          {attendance.length === 0 ? (
            <p style={{ color: "#6b7280" }}>Todavía no hay marcaciones.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb", color: "#6b7280", fontSize: 13 }}>
                    <th style={{ padding: "0 8px 8px 0" }}>Fecha</th>
                    <th style={{ padding: "0 8px 8px" }}>Entrada</th>
                    <th style={{ padding: "0 8px 8px" }}>Salida</th>
                    <th style={{ padding: "0 8px 8px" }}>Horas trabajadas</th>
                    <th style={{ padding: "0 0 8px 8px" }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.map((day) => (
                    <tr key={day.date} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "10px 8px 10px 0", fontWeight: 600 }}>{day.date}</td>
                      <td style={{ padding: "10px 8px" }}>{formatTime(day.firstCheckin)}</td>
                      <td style={{ padding: "10px 8px" }}>{formatTime(day.lastCheckout)}</td>
                      <td style={{ padding: "10px 8px" }}>{formatWorked(day.workedMinutes)}</td>
                      <td style={{ padding: "10px 0 10px 8px" }}>
                        <span
                          style={{
                            padding: "2px 10px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 600,
                            color: day.incomplete ? "#dc2626" : "#16a34a",
                            background: day.incomplete ? "#fef2f2" : "#f0fdf4",
                          }}
                        >
                          {day.incomplete ? "Sin salida" : "Completo"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
