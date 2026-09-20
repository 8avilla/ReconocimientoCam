import { MatchDetail, type MatchTab } from "@/components/match/MatchDetail";

const TABS: MatchTab[] = ["attendance", "events", "summary"];

export default async function MatchDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  return <MatchDetail id={id} initialTab={TABS.find((item) => item === tab)} />;
}
