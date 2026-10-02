"use client";

import { createContext } from "react";
import type { FollowTargetType } from "@/lib/constants";

export type FollowSets = Record<FollowTargetType, ReadonlySet<string>>;

export interface FollowContextValue {
  /** What the signed-in person follows, from the server; null while signed out or still loading. */
  server: FollowSets | null;
  toggle: (type: FollowTargetType, id: string) => void;
}

export const FollowContext = createContext<FollowContextValue | null>(null);
