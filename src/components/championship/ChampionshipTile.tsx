/* eslint-disable @next/next/no-img-element */
import { Trophy } from "lucide-react";

/** Championship's own logo where one was uploaded; a plain trophy tile otherwise. The name is always
 * rendered as visible text right next to this, so the tile itself stays decorative either way. */
export function ChampionshipTile({ logoUrl, size = 44 }: { logoUrl?: string; size?: number }) {
  if (logoUrl) {
    return <img src={logoUrl} alt="" aria-hidden className="champ-tile" style={{ width: size, height: size, objectFit: "cover" }} />;
  }
  return (
    <span className="champ-tile" aria-hidden style={{ width: size, height: size }}>
      <Trophy size={Math.round(size * 0.5)} />
    </span>
  );
}
