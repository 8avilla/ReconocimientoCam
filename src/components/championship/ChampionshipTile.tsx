import { Trophy } from "lucide-react";
import Image from "next/image";

/** Championship's own logo where one was uploaded; a plain trophy tile otherwise. The name is always
 * rendered as visible text right next to this, so the tile itself stays decorative either way. */
export function ChampionshipTile({ logoUrl, size = 44 }: { logoUrl?: string; size?: number }) {
  if (logoUrl) {
    return <Image src={logoUrl} alt="" aria-hidden width={size} height={size} className="champ-tile" style={{ objectFit: "cover" }} />;
  }
  return (
    <span className="champ-tile" aria-hidden style={{ width: size, height: size }}>
      <Trophy size={Math.round(size * 0.5)} />
    </span>
  );
}
