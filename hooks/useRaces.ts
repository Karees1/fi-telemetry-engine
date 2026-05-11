'use client';

import { useState, useEffect } from 'react';
import { Race, ApiResponse } from '@/types';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CachedRaces {
  data: Race[];
  expiresAt: number;
}

export function useRaces(year: number = 2024) {
  const [races, setRaces] = useState<Race[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cacheKey = `f1_races_${year}`;

    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (raw) {
        const cached: CachedRaces = JSON.parse(raw);
        if (Date.now() < cached.expiresAt) {
          setRaces(cached.data);
          setIsLoading(false);
          return;
        }
      }
    } catch {
      // Corrupt cache entry — fall through to network fetch
    }

    fetch(`/api/races?year=${year}`)
      .then((r) => r.json())
      .then((res: ApiResponse<Race[]>) => {
        if (res.status === 'success' && res.data) {
          setRaces(res.data);
          try {
            sessionStorage.setItem(
              cacheKey,
              JSON.stringify({ data: res.data, expiresAt: Date.now() + CACHE_TTL_MS })
            );
          } catch {
            // sessionStorage quota exceeded — skip caching, not fatal
          }
        } else {
          setError(res.error ?? 'Failed to load races');
        }
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setIsLoading(false));
  }, [year]);

  return { races, isLoading, error };
}
