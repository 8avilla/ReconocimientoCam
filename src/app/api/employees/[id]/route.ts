import { NextRequest, NextResponse } from "next/server";
import { connectMongo } from "@/lib/mongodb";
import { Employee } from "@/models/Employee";
import { FaceEmbedding } from "@/models/FaceEmbedding";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  await connectMongo();

  const employee = await Employee.findById(id).lean();
  if (!employee) {
    return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 });
  }
  const embeddingCount = await FaceEmbedding.countDocuments({ employeeId: id });

  return NextResponse.json({ ...employee, embeddingCount });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();

  await connectMongo();
  const employee = await Employee.findByIdAndUpdate(
    id,
    {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.active !== undefined ? { active: body.active } : {}),
    },
    { new: true }
  );
  if (!employee) {
    return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 });
  }

  return NextResponse.json(employee);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  await connectMongo();

  const employee = await Employee.findByIdAndDelete(id);
  if (!employee) {
    return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 });
  }
  await FaceEmbedding.deleteMany({ employeeId: id });

  return NextResponse.json({ ok: true });
}
