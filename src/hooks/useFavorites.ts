import { useCallback, useState } from "react";

const KEY = "skillsbox.favorites";

function load(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function save(set: Set<string>) {
  localStorage.setItem(KEY, JSON.stringify([...set]));
}

export function useFavorites() {
  const [ids, setIds] = useState<Set<string>>(load);

  const isFavorite = useCallback((id: string) => ids.has(id), [ids]);

  const toggleFavorite = useCallback((id: string) => {
    setIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      save(next);
      return next;
    });
  }, []);

  return { favoriteIds: ids, isFavorite, toggleFavorite };
}
