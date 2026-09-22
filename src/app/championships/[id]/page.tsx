import { redirect } from "next/navigation";

/** The championship setup now lives at /c/<id>/gestionar. */
export default async function LegacyChampionshipConfig({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/c/${id}/gestionar`);
}
