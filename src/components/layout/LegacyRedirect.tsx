"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loading } from "@/components/ui";
import { championshipPath, type Section } from "@/lib/paths";
import { useChampionship } from "./ChampionshipContext";

/** Old unscoped address (`/matches`, `/teams`...): forwards to the same section of the last visited championship. */
export function LegacyRedirect({ section, query = "" }: { section: Section; query?: string }) {
  const router = useRouter();
  const { current, loading } = useChampionship();
  useEffect(() => {
    if (loading) return;
    router.replace(current ? championshipPath(current._id, section, query) : "/");
  }, [loading, current, section, query, router]);
  return <Loading />;
}
