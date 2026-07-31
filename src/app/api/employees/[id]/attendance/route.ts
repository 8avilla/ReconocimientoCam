import { NextRequest, NextResponse } from "next/server";
import { connectMongo } from "@/lib/mongodb";
import { AttendanceRecord } from "@/models/AttendanceRecord";

type Params = { params: Promise<{ id: string }> };

type DaySummary = {
  date: string; // YYYY-MM-DD
  firstCheckin: string | null;
  lastCheckout: string | null;
  workedMinutes: number;
  incomplete: boolean;
};

function dayKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    await connectMongo();

    const records = await AttendanceRecord.find({ employeeId: id, type: { $ne: null } })
      .sort({ createdAt: 1 })
      .lean();

    const byDay = new Map<string, { type: string; createdAt: Date }[]>();
    for (const r of records) {
      const key = dayKey(new Date(r.createdAt));
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push({ type: r.type as string, createdAt: new Date(r.createdAt) });
    }

    const days: DaySummary[] = [];
    for (const [date, dayRecords] of byDay) {
      let openCheckin: Date | null = null;
      let firstCheckin: Date | null = null;
      let lastCheckout: Date | null = null;
      let workedMs = 0;

      for (const r of dayRecords) {
        if (r.type === "checkin") {
          if (!firstCheckin) firstCheckin = r.createdAt;
          openCheckin = r.createdAt;
        } else if (r.type === "checkout" && openCheckin) {
          workedMs += r.createdAt.getTime() - openCheckin.getTime();
          lastCheckout = r.createdAt;
          openCheckin = null;
        }
      }

      days.push({
        date,
        firstCheckin: firstCheckin?.toISOString() ?? null,
        lastCheckout: lastCheckout?.toISOString() ?? null,
        workedMinutes: Math.round(workedMs / 60000),
        incomplete: openCheckin !== null,
      });
    }

    days.sort((a, b) => (a.date < b.date ? 1 : -1));

    return NextResponse.json(days);
  } catch (err) {
    console.error("Error en GET /api/employees/[id]/attendance:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error interno" },
      { status: 500 }
    );
  }
}
