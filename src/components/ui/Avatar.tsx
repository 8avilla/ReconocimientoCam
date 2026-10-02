"use client";

import { useState } from "react";
import { initials } from "@/lib/labels";
import { avatarSrc } from "@/lib/thumbs";
import Image from "next/image";

interface AvatarProps {
  src?: string;
  name: string;
  size?: number;
  square?: boolean;
}

/** Player/team image (1:1, object-fit cover) with an initials fallback. Small ones use the stored small copy when there is one. */
export function Avatar({ src, name, size = 44, square }: AvatarProps) {
  const style = { width: size, height: size, fontSize: Math.max(11, size / 3) };
  const className = `avatar${square ? " square" : ""}`;
  // An image uploaded before small copies existed has none: the first failure switches to the original.
  const [failedCopy, setFailedCopy] = useState<string | null>(null);
  if (src) {
    const { src: preferred, fallback } = avatarSrc(src, size);
    const usingCopy = Boolean(fallback) && failedCopy !== preferred;
    return (
      <Image
        src={usingCopy ? preferred : (fallback ?? preferred)}
        alt={name}
        width={size}
        height={size}
        className={className}
        style={{ ...style, objectFit: "cover" }}
        // A copy is already small and immutable: straight from storage, no resizing on our server.
        unoptimized={usingCopy}
        onError={usingCopy ? () => setFailedCopy(preferred) : undefined}
      />
    );
  }
  return (
    <span className={className} style={style} role="img" aria-label={name}>
      {initials(name)}
    </span>
  );
}
