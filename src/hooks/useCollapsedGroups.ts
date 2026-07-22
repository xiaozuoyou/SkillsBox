import { useCallback, useState } from "react";

const KEY = "skillsbox.collapsedGroups";

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

export function useCollapsedGroups() {
  const [collapsed, setCollapsed] = useState<Set<string>>(load);

  const toggle = useCallback((key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      save(next);
      return next;
    });
  }, []);

  const isCollapsed = useCallback(
    (key: string) => collapsed.has(key),
    [collapsed],
  );

  const expandAll = useCallback(() => {
    setCollapsed(() => {
      const next = new Set<string>();
      save(next);
      return next;
    });
  }, []);

  const collapseAll = useCallback((keys: string[]) => {
    setCollapsed(() => {
      const next = new Set(keys);
      save(next);
      return next;
    });
  }, []);

  return { isCollapsed, toggle, expandAll, collapseAll };
}
