import { NextRequest, NextResponse } from "next/server";
import { connectMongo } from "@/lib/mongodb";
import { Employee } from "@/models/Employee";
import { FaceEmbedding } from "@/models/FaceEmbedding";

export async function GET() {
  await connectMongo();
  const employees = await Employee.find().sort({ createdAt: -1 }).lean();
  const counts = await FaceEmbedding.aggregate([{ $group: { _id: "$employeeId", count: { $sum: 1 } } }]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));

  return NextResponse.json(
    employees.map((e) => ({ ...e, embeddingCount: countMap.get(String(e._id)) ?? 0 }))
  );
}

export async function POST(req: NextRequest) {
  const { name } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Falta 'name'" }, { status: 400 });
  }

  await connectMongo();
  const employee = await Employee.create({ name: name.trim() });
  return NextResponse.json(employee, { status: 201 });
}
