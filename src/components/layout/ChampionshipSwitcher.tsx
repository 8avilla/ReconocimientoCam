"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Star, Trophy } from "lucide-react";
import { Modal } from "@/components/ui";
import { championshipPath, type Section } from "@/lib/paths";
import { useChampionship } from "./ChampionshipContext";

/** Sheet to jump to another championship, keeping the section being viewed; followed ones come first. */
export function ChampionshipSwitcher({ open, section, onClose }: { open: boolean; section: Section | null; onClose: () => void }) {
  const router = useRouter();
  const { championships, current, favoriteIds } = useChampionship();
  const favorites = championships.filter((item) => favoriteIds.has(item._id));
  const others = championships.filter((item) => !favoriteIds.has(item._id));

  const goTo = (id: string) => {
    onClose();
    router.push(championshipPath(id, section ?? undefined));
  };

  const row = (item: (typeof championships)[number]) => (
    <button
      key={item._id}
      className={`switch-row${current?._id === item._id ? " active" : ""}`}
      onClick={() => goTo(item._id)}
    >
      <span className="champ-tile" aria-hidden style={{ width: 36, height: 36 }}><Trophy size={18} /></span>
      <span className="grow" style={{ minWidth: 0, textAlign: "left" }}>
        <span className="text-strong truncate" style={{ display: "block" }}>{item.name}</span>
        <span className="text-secondary text-small">Temporada {item.season}</span>
      </span>
      {favoriteIds.has(item._id) && <Star size={18} fill="#f59e0b" color="#f59e0b" aria-label="Lo sigues" />}
      {current?._id === item._id && <Check size={18} aria-label="Campeonato actual" />}
    </button>
  );

  return (
    <Modal open={open} title="Cambiar de campeonato" onClose={onClose}>
      <div className="stack">
        {favorites.length > 0 && (
          <div className="stack-sm">
            <h3 className="text-caption text-secondary">Sigues</h3>
            {favorites.map(row)}
          </div>
        )}
        {others.length > 0 && (
          <div className="stack-sm">
            {favorites.length > 0 && <h3 className="text-caption text-secondary">Otros campeonatos</h3>}
            {others.map(row)}
          </div>
        )}
        <Link href="/" className="btn secondary block" onClick={onClose}>Ver todos los campeonatos</Link>
      </div>
    </Modal>
  );
}
