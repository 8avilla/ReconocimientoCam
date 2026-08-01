"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BackHomeButton from "@/components/BackHomeButton";

type Employee = {
  _id: string;
  name: string;
  active: boolean;
  embeddingCount: number;
};

const ACCENT = "#4f46e5";

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/employees");
    setEmployees(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setName("");
    setSaving(false);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este empleado y sus rostros enrolados?")) return;
    await fetch(`/api/employees/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f4f6f8", padding: 24 }}>
      <div style={{ maxWidth: 780, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
        <BackHomeButton />

        <div>
          <h1 style={{ color: ACCENT, margin: 0, fontSize: 28 }}>👥 Empleados</h1>
          <p style={{ color: "#6b7280", marginTop: 4 }}>Crea, edita y enrola el rostro de tus empleados</p>
        </div>

        <div style={{ background: "white", borderRadius: 20, padding: 24, boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }}>
          <form onSubmit={handleCreate} style={{ display: "flex", gap: 8, marginBottom: 24 }}>
            <input
              placeholder="Nombre del nuevo empleado"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                flex: 1,
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #d1d5db",
                fontSize: 15,
              }}
            />
            <button
              type="submit"
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
              {saving ? "Creando..." : "Crear"}
            </button>
          </form>

          {loading ? (
            <p style={{ color: "#6b7280" }}>Cargando...</p>
          ) : employees.length === 0 ? (
            <p style={{ color: "#6b7280" }}>No hay empleados todavía.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {employees.map((emp) => (
                <div
                  key={emp._id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    padding: "14px 16px",
                    borderRadius: 12,
                    border: "1px solid #eee",
                  }}
                >
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: emp.active ? "#16a34a" : "#9ca3af",
                      flexShrink: 0,
                    }}
                    title={emp.active ? "Activo" : "Inactivo"}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{emp.name}</div>
                    <div style={{ fontSize: 13, color: "#6b7280" }}>
                      {emp.embeddingCount} rostro(s) enrolado(s)
                    </div>
                  </div>
                  <Link
                    href={`/employees/${emp._id}`}
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: ACCENT,
                      textDecoration: "none",
                    }}
                  >
                    Ver / Enrolar
                  </Link>
                  <button
                    onClick={() => handleDelete(emp._id)}
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#dc2626",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    Eliminar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
