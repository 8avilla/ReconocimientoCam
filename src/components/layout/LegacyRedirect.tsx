"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loading } from "@/components/ui";
import { championshipPath, type Section } from "@/lib/paths";
import { useChampionship, useChampionshipList } from "./ChampionshipContext";

/** Old unscoped address (`/matches`, `/teams`...): forwards to the same section of the last visited championship. */
export function LegacyRedirect({ section, subpath = "", query = "" }: { section: Section; /** Page inside the section, e.g. "/nuevo". */ subpath?: string; query?: string }) {
  const router = useRouter();
  const { current: visited, favoriteIds, loading: loadingVisited } = useChampionship();
  // With no championship remembered, a followed one (else the first) is the destination: this is the only screen that needs the list for that.
  const list = useChampionshipList();
  const target = visited ?? list.championships.find((item) => favoriteIds.has(item._id)) ?? list.championships[0] ?? null;
  const loading = loadingVisited || (!visited && list.loading);
  useEffect(() => {
    if (loading) return;
    router.replace(target ? championshipPath(target._id, section, `${subpath}${query}`) : "/");
  }, [loading, target, section, subpath, query, router]);
  return <Loading />;
}
