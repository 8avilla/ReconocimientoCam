import { ArrowLeftRight, CircleSlash, Goal, TriangleAlert, Volleyball } from "lucide-react";
import type { MatchEventType } from "@/lib/constants";

/** Icon per event type. Cards are drawn as colored rectangles so they read at a glance. */
export function EventIcon({ type, size = 20 }: { type: MatchEventType; size?: number }) {
  switch (type) {
    case "goal":
    case "penalty_goal":
      return <Goal size={size} color="var(--color-primary)" aria-hidden />;
    case "own_goal":
      return <Volleyball size={size} color="var(--color-error)" aria-hidden />;
    case "penalty_missed":
      return <CircleSlash size={size} color="var(--color-text-secondary)" aria-hidden />;
    case "yellow_card":
      return <span aria-hidden style={{ width: size * 0.7, height: size, background: "#facc15", borderRadius: 3, display: "inline-block" }} />;
    case "red_card":
      return <span aria-hidden style={{ width: size * 0.7, height: size, background: "var(--color-error)", borderRadius: 3, display: "inline-block" }} />;
    case "substitution":
      return <ArrowLeftRight size={size} color="var(--color-info)" aria-hidden />;
    case "incident":
      return <TriangleAlert size={size} color="var(--color-warning)" aria-hidden />;
  }
}
