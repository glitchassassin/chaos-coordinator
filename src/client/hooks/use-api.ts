import { useState, useCallback } from "preact/hooks";

const BASE = "/api/instances";

export function instanceUrl(instanceId: string, path: string): string {
  return `${BASE}/${instanceId}${path}`;
}

export function useApi() {
  const [loading, setLoading] = useState(false);

  const request = useCallback(
    async <T>(
      instanceId: string,
      path: string,
      options?: RequestInit,
    ): Promise<T> => {
      setLoading(true);
      try {
        const res = await fetch(instanceUrl(instanceId, path), {
          ...options,
          headers: {
            "Content-Type": "application/json",
            ...options?.headers,
          },
        });
        if (res.status === 401) {
          window.location.href = "/login";
          throw new Error("Unauthorized");
        }
        if (!res.ok) {
          throw new Error(`API error: ${res.status}`);
        }
        return await res.json();
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { request, loading };
}
