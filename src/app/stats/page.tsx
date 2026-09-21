import { StatsView } from "@/components/stats/StatsView";

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ phase?: string }> }) {
  const { phase } = await searchParams;
  return <StatsView initialPhaseId={phase} />;
}
