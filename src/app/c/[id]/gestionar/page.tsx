import { notFound } from "next/navigation";
import { ManageView } from "@/components/phase/ManageView";
import { connectToDatabase } from "@/lib/db";
import { findChampionshipByIdOrSlug } from "@/lib/services/championships";

export default async function ManagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await connectToDatabase();
  const championship = await findChampionshipByIdOrSlug(id).select("_id").lean();
  if (!championship) notFound();
  return <ManageView championshipId={String(championship._id)} />;
}
