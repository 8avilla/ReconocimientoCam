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
    <main style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <BackHomeButton />
      <h1>Empleados</h1>

      <form onSubmit={handleCreate} style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <input
          placeholder="Nombre del nuevo empleado"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ flex: 1, padding: 8, borderRadius: 6, border: "1px solid #ccc" }}
        />
        <button type="submit" disabled={saving} style={{ padding: "8px 16px", borderRadius: 6 }}>
          {saving ? "Creando..." : "Crear"}
        </button>
      </form>

      {loading ? (
        <p>Cargando...</p>
      ) : employees.length === 0 ? (
        <p>No hay empleados todavía.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
              <th>Nombre</th>
              <th>Activo</th>
              <th>Rostros enrolados</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp._id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "8px 0" }}>{emp.name}</td>
                <td>{emp.active ? "Sí" : "No"}</td>
                <td>{emp.embeddingCount}</td>
                <td style={{ display: "flex", gap: 12 }}>
                  <Link href={`/employees/${emp._id}`}>Ver / Enrolar</Link>
                  <button onClick={() => handleDelete(emp._id)} style={{ color: "#dc2626" }}>
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
