import { LegacyRedirect } from "@/components/layout/LegacyRedirect";

export default async function LegacyStats({ searchParams }: { searchParams: Promise<{ phase?: string }> }) {
  const { phase } = await searchParams;
  return <LegacyRedirect section="clasificacion" query={phase ? `?phase=${encodeURIComponent(phase)}` : ""} />;
}
