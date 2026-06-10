import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useRef, useState } from "react";

type RefreshOptions = {
  force?: boolean;
};

export function useStaleFocusRefresh(load: () => Promise<void>, ttlMs = 30000) {
  const lastLoadedAtRef = useRef(0);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const run = useCallback(async ({ force = false }: RefreshOptions = {}) => {
    const now = Date.now();
    const isFresh = hasLoadedOnce && now - lastLoadedAtRef.current < ttlMs;

    if (!force && isFresh) {
      return;
    }

    if (inFlightRef.current) {
      return inFlightRef.current;
    }

    const request = (async () => {
      try {
        await load();
        lastLoadedAtRef.current = Date.now();
        setHasLoadedOnce(true);
      } finally {
        inFlightRef.current = null;
      }
    })();

    inFlightRef.current = request;
    return request;
  }, [hasLoadedOnce, load, ttlMs]);

  useFocusEffect(
    useCallback(() => {
      void run();
    }, [run])
  );

  const refreshNow = useCallback(async () => {
    await run({ force: true });
  }, [run]);

  const seedLoadedAt = useCallback((loadedAt: number) => {
    if (!Number.isFinite(loadedAt) || loadedAt <= 0) return;
    if (loadedAt <= lastLoadedAtRef.current) return;
    lastLoadedAtRef.current = loadedAt;
    setHasLoadedOnce(true);
  }, []);

  return {
    hasLoadedOnce,
    refreshNow,
    seedLoadedAt
  };
}
