import { useCallback, useEffect, useState } from "react";

const KEY = "skillsbox.recentProjects";
const MAX = 8;

function load(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .slice(0, MAX);
  } catch {
    return [];
  }
}

function save(paths: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(paths.slice(0, MAX)));
  } catch {
    /* ignore quota */
  }
}

/** Recently used project roots for quick enable workspace. */
export function useRecentProjects() {
  const [recent, setRecent] = useState<string[]>(() => load());

  useEffect(() => {
    setRecent(load());
  }, []);

  const push = useCallback((path: string) => {
    const p = path.trim();
    if (!p) return;
    setRecent((prev) => {
      const next = [p, ...prev.filter((x) => x !== p)].slice(0, MAX);
      save(next);
      return next;
    });
  }, []);

  const remove = useCallback((path: string) => {
    setRecent((prev) => {
      const next = prev.filter((x) => x !== path);
      save(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setRecent([]);
    save([]);
  }, []);

  return { recent, push, remove, clear };
}
