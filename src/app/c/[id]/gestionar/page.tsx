import { ManageView } from "@/components/phase/ManageView";

export default async function ManagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ManageView championshipId={id} />;
}
