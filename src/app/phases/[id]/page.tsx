import { KnockoutManager } from "@/components/knockout/KnockoutManager";

export default async function KnockoutPhasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <KnockoutManager phaseId={id} />;
}
