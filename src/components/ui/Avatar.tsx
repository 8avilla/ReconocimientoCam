/* eslint-disable @next/next/no-img-element */
import { initials } from "@/lib/labels";

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
  if (src) return <img src={src} alt={name} className={className} style={style} loading="lazy" />;
  return (
    <span className={className} style={style} role="img" aria-label={name}>
      {initials(name)}
    </span>
  );
}
