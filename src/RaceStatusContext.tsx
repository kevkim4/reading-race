import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type RaceStatus } from "./api";

interface RaceStatusState {
  status: RaceStatus | null;
  refresh: () => Promise<void>;
}

const RaceStatusContext = createContext<RaceStatusState | null>(null);

export function RaceStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<RaceStatus | null>(null);

  async function refresh() {
    const s = await api.getRaceStatus().catch(() => null);
    setStatus(s);
  }

  useEffect(() => {
    refresh();
  }, []);

  return <RaceStatusContext.Provider value={{ status, refresh }}>{children}</RaceStatusContext.Provider>;
}

export function useRaceStatus() {
  const ctx = useContext(RaceStatusContext);
  if (!ctx) throw new Error("useRaceStatus must be used within RaceStatusProvider");
  return ctx;
}
