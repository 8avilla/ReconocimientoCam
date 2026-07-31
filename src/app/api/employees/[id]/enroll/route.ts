import { NextRequest, NextResponse } from "next/server";
import { getEmbeddingFromImage } from "@/lib/faceEngine/embedding";
import { dataUrlToBuffer } from "@/lib/faceEngine/store";
import { connectMongo } from "@/lib/mongodb";
import { uploadAttendancePhoto } from "@/lib/azureBlob";
import { Employee } from "@/models/Employee";
import { FaceEmbedding } from "@/models/FaceEmbedding";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const { image } = await req.json();
    if (!image) {
      return NextResponse.json({ error: "Falta 'image'" }, { status: 400 });
    }

    await connectMongo();
    const employee = await Employee.findById(id);
    if (!employee) {
      return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 });
    }

    const buffer = dataUrlToBuffer(image);
    const embedding = await getEmbeddingFromImage(buffer);
    await uploadAttendancePhoto(buffer, "enroll");
    await FaceEmbedding.create({ employeeId: employee._id, vector: Array.from(embedding) });

    const total = await FaceEmbedding.countDocuments({ employeeId: employee._id });
    return NextResponse.json({ ok: true, employeeId: employee._id, total });
  } catch (err) {
    console.error("Error en /api/employees/[id]/enroll:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}
