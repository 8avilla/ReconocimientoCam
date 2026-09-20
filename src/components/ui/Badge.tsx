import React from "react";
import type { Tone } from "@/lib/labels";

/** Status pill. Always pairs text with an optional icon so state never depends on color alone. */
export function Badge({ tone = "neutral", icon, children }: { tone?: Tone; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className={`badge ${tone}`}>
      {icon}
      {children}
    </span>
  );
}
