"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/ui";
import { FollowContext, type FollowSets } from "@/lib/client/followContext";
import { clearLocalFollows, readLocalFollows } from "@/lib/client/favorites";
import { errorMessage, http } from "@/lib/client/http";
import { FOLLOW_TARGET_TYPES, type FollowTargetType } from "@/lib/constants";

const toSets = (dto: Record<FollowTargetType, string[]>): FollowSets => ({
  championship: new Set(dto.championship),
  team: new Set(dto.team),
  player: new Set(dto.player),
});

/**
 * Follows of a signed-in person live in their account (notifications are sent from there); signed out, they stay in
 * the browser. On signing in, what was followed in the browser is merged into the account once.
 */
export function FollowProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const toast = useToast();
  // The account's follows, tagged with whose they are: after signing out (or in as someone else) they stop applying.
  const [loaded, setLoaded] = useState<{ userId: string; sets: FollowSets } | null>(null);
  const server = userId && loaded?.userId === userId ? loaded.sets : null;

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      try {
        const local = readLocalFollows();
        const hasLocal = FOLLOW_TARGET_TYPES.some((type) => local[type].length > 0);
        const dto = hasLocal ? await http<Record<FollowTargetType, string[]>>("/follows/import", { json: local }) : await http<Record<FollowTargetType, string[]>>("/follows");
        if (hasLocal) clearLocalFollows();
        if (alive) setLoaded({ userId, sets: toSets(dto) });
      } catch {
        // Keep showing this browser's own follows until the account's can be loaded.
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  const toggle = useCallback(
    (type: FollowTargetType, id: string) => {
      if (!server) return;
      const following = server[type].has(id);
      const change = (on: boolean) =>
        setLoaded((current) => {
          if (!current) return current;
          const next = new Set(current.sets[type]);
          if (on) next.add(id);
          else next.delete(id);
          return { ...current, sets: { ...current.sets, [type]: next } };
        });
      change(!following);
      http("/follows", { method: following ? "DELETE" : "POST", json: { targetType: type, targetId: id } }).catch((error) => {
        change(following);
        toast.error(errorMessage(error));
      });
    },
    [server, toast]
  );

  const value = useMemo(() => ({ server, toggle }), [server, toggle]);
  return <FollowContext.Provider value={value}>{children}</FollowContext.Provider>;
}
