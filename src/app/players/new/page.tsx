import { NewPlayerWizard } from "@/components/player/NewPlayerWizard";

export default async function NewPlayerPage({ searchParams }: { searchParams: Promise<{ teamId?: string }> }) {
  const { teamId } = await searchParams;
  return <NewPlayerWizard initialTeamId={teamId ?? ""} />;
}
