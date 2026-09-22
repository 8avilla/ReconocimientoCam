import { LegacyRedirect } from "@/components/layout/LegacyRedirect";

export default async function LegacyMatches({ searchParams }: { searchParams: Promise<{ programacion?: string }> }) {
  const { programacion } = await searchParams;
  return <LegacyRedirect section="partidos" query={programacion ? `?programacion=${encodeURIComponent(programacion)}` : ""} />;
}
