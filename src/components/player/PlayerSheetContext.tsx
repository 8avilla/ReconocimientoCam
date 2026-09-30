"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { PlayerInfoModal } from "./PlayerInfoModal";

type OpenPlayer = (playerId: string, onChanged?: () => void) => void;

const PlayerSheetContext = createContext<OpenPlayer | null>(null);

/** One quick player sheet for the whole app: any list can open it with `useOpenPlayer()` and refresh itself when it changed something. */
export function PlayerSheetProvider({ children }: { children: React.ReactNode }) {
  const [playerId, setPlayerId] = useState<string | null>(null);
  const onChangedRef = useRef<(() => void) | undefined>(undefined);

  const open = useCallback<OpenPlayer>((id, onChanged) => {
    onChangedRef.current = onChanged;
    setPlayerId(id);
  }, []);
  const value = useMemo(() => open, [open]);

  return (
    <PlayerSheetContext.Provider value={value}>
      {children}
      <PlayerInfoModal playerId={playerId} onChanged={() => onChangedRef.current?.()} onClose={() => setPlayerId(null)} />
    </PlayerSheetContext.Provider>
  );
}

export function useOpenPlayer(): OpenPlayer {
  const open = useContext(PlayerSheetContext);
  if (!open) throw new Error("useOpenPlayer must be used inside PlayerSheetProvider");
  return open;
}
