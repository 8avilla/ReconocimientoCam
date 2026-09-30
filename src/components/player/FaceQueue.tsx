"use client";

import { useState } from "react";
import { ScanFace } from "lucide-react";
import { FaceEnrollModal } from "@/components/player/FaceEnrollModal";
import { Button, useToast } from "@/components/ui";

interface Props {
  /** Players without a registered face. */
  players: { _id: string; fullName: string }[];
  /** Called when the queue ends or is closed, so the list behind it refreshes. */
  onChanged: () => void;
}

/** "N players still need their face": walks through them one after another (skip or register), no list in between. */
export function FaceQueue({ players, onChanged }: Props) {
  const toast = useToast();
  // A snapshot taken when the queue starts: players leave `players` as their faces get registered.
  const [queue, setQueue] = useState<Props["players"] | null>(null);
  const [index, setIndex] = useState(0);

  if (players.length === 0 && !queue) return null;
  const current = queue?.[index];

  const finish = (completed: boolean) => {
    setQueue(null);
    setIndex(0);
    if (completed) toast.success("Cola de rostros terminada");
    onChanged();
  };
  const next = () => (queue && index + 1 < queue.length ? setIndex(index + 1) : finish(true));

  return (
    <>
      {!queue && (
        <div className="alert warning" role="note" style={{ marginBottom: "var(--space-lg)" }}>
          <ScanFace size={18} aria-hidden />
          <span className="grow">{players.length} {players.length === 1 ? "jugador no tiene" : "jugadores no tienen"} rostro registrado: no se podrán verificar en los partidos.</span>
          <Button size="small" onClick={() => { setQueue(players); setIndex(0); }}>Registrar rostros</Button>
        </div>
      )}
      {current && queue && (
        <FaceEnrollModal
          key={current._id}
          open
          playerId={current._id}
          title={`${current.fullName} · ${index + 1} de ${queue.length}`}
          onSkip={next}
          onClose={() => finish(false)}
          onSaved={next}
        />
      )}
    </>
  );
}
