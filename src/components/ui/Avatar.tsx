import { initials } from "@/lib/labels";
import Image from "next/image";

interface AvatarProps {
  src?: string;
  name: string;
  size?: number;
  square?: boolean;
}

/** Player/team image (1:1, object-fit cover) with an initials fallback. */
export function Avatar({ src, name, size = 44, square }: AvatarProps) {
  const style = { width: size, height: size, fontSize: Math.max(11, size / 3) };
  const className = `avatar${square ? " square" : ""}`;
  if (src) return <Image src={src} alt={name} width={size} height={size} className={className} style={{ ...style, objectFit: "cover" }} />;
  return (
    <span className={className} style={style} role="img" aria-label={name}>
      {initials(name)}
    </span>
  );
}
