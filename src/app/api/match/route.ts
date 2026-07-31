import { NextRequest, NextResponse } from "next/server";
import { getEmbeddingFromImage, cosineSimilarity } from "@/lib/faceEngine/embedding";
import { dataUrlToBuffer } from "@/lib/faceEngine/store";
import { connectMongo } from "@/lib/mongodb";
import { uploadAttendancePhoto } from "@/lib/azureBlob";
import { Employee } from "@/models/Employee";
import { FaceEmbedding } from "@/models/FaceEmbedding";
import { AttendanceRecord } from "@/models/AttendanceRecord";

const MATCH_THRESHOLD = 0.35; // valor inicial para calibrar con pruebas reales

export async function POST(req: NextRequest) {
  try {
    const { image, lat, lng, accuracy } = await req.json();
    if (!image) {
      return NextResponse.json({ error: "Falta 'image'" }, { status: 400 });
    }

    const buffer = dataUrlToBuffer(image);
    const embedding = await getEmbeddingFromImage(buffer);

    await connectMongo();
    const photoUrl = await uploadAttendancePhoto(buffer, "checkin");

    const stored = await FaceEmbedding.find().lean();
    let best: { employeeId: string; score: number } | null = null;
    for (const face of stored) {
      const score = cosineSimilarity(embedding, Float32Array.from(face.vector));
      if (!best || score > best.score) {
        best = { employeeId: String(face.employeeId), score };
      }
    }

    const matched = best && best.score >= MATCH_THRESHOLD;
    const employee = matched ? await Employee.findById(best!.employeeId) : null;

    await AttendanceRecord.create({
      employeeId: employee?._id ?? null,
      confidence: best?.score ?? 0,
      photoUrl,
      lat: lat ?? null,
      lng: lng ?? null,
      accuracy: accuracy ?? null,
    });

    return NextResponse.json({
      match: employee?.name ?? null,
      confidence: best?.score ?? null,
      photoUrl,
      location: lat != null ? { lat, lng, accuracy } : null,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Error en /api/match:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}
