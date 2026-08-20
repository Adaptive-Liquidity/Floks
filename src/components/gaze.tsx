import { createContext, useContext, useEffect, useState } from "react";

type Gaze = { x: number; y: number } | null;

const GazeContext = createContext<Gaze>(null);

export function GazeProvider({ children }: { children: React.ReactNode }) {
  const [gaze, setGaze] = useState<Gaze>(null);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      setGaze({ x: event.clientX, y: event.clientY });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return <GazeContext.Provider value={gaze}>{children}</GazeContext.Provider>;
}

export function useGaze() {
  return useContext(GazeContext);
}
