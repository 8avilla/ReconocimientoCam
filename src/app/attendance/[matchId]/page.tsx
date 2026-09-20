import { redirect } from "next/navigation";

/** Attendance now lives inside the match; this keeps old links and bookmarks working. */
export default async function LegacyAttendancePage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  redirect(`/matches/${matchId}?tab=attendance`);
}
