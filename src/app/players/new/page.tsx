import { LegacyRedirect } from "@/components/layout/LegacyRedirect";

export default async function LegacyNewPlayer({ searchParams }: { searchParams: Promise<{ teamId?: string }> }) {
  const { teamId } = await searchParams;
  return <LegacyRedirect section="jugadores" subpath="/nuevo" query={teamId ? `?teamId=${encodeURIComponent(teamId)}` : ""} />;
}
