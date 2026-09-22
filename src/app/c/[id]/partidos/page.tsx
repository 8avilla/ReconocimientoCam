import { MatchesView } from "@/components/match/MatchesView";

/** `?programacion=sin|con` opens the list already filtered by day/time assignment (used by the shortcuts). */
export default async function MatchesPage({ searchParams }: { searchParams: Promise<{ programacion?: string }> }) {
  const { programacion } = await searchParams;
  return <MatchesView initialScheduled={programacion === "sin" ? "false" : programacion === "con" ? "true" : undefined} />;
}
