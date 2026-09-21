import { PhasesManager } from "@/components/phase/PhasesManager";

export default async function ChampionshipConfigPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PhasesManager championshipId={id} />;
}
