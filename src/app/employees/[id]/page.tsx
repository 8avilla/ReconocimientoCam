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

  if (!employee) return <main style={{ padding: 24 }}>Cargando...</main>;

  return (
    <main style={{ padding: 24, maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
      <BackHomeButton />
      <h1>Editar empleado</h1>

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ flex: 1, padding: 8, borderRadius: 6, border: "1px solid #ccc" }}
        />
        <button onClick={handleSave} disabled={saving} style={{ padding: "8px 16px", borderRadius: 6 }}>
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <label>
          <input type="checkbox" checked={employee.active} onChange={handleToggleActive} /> Activo
        </label>
        <button onClick={handleDelete} style={{ color: "#dc2626", marginLeft: "auto" }}>
          Eliminar empleado
        </button>
      </div>

      <p>Rostros enrolados: {employee.embeddingCount}</p>

      <hr />

      <h2>Enrolar rostro</h2>
      <FaceCapture onCapture={handleEnroll} busy={busyEnroll} buttonLabel="Enrolar rostro" />
      {message && <p>{message}</p>}

      <hr />

      <h2>Informe de asistencia</h2>
      {attendance.length === 0 ? (
        <p>Todavía no hay marcaciones.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
              <th>Fecha</th>
              <th>Entrada</th>
              <th>Salida</th>
              <th>Horas trabajadas</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {attendance.map((day) => (
              <tr key={day.date} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "8px 0" }}>{day.date}</td>
                <td>{formatTime(day.firstCheckin)}</td>
                <td>{formatTime(day.lastCheckout)}</td>
                <td>{formatWorked(day.workedMinutes)}</td>
                <td style={{ color: day.incomplete ? "#dc2626" : "#16a34a" }}>
                  {day.incomplete ? "Sin salida" : "Completo"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
