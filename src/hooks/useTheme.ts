import { useCallback, useEffect, useState } from "react";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const KEY = "skillsbox.theme";

function isPreference(v: unknown): v is ThemePreference {
  return v === "system" || v === "light" || v === "dark";
}

export function loadThemePreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(KEY);
    if (isPreference(raw)) return raw;
  } catch {
    /* ignore */
  }
  return "system";
}

function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === "light") return "light";
  if (preference === "dark") return "dark";
  return systemPrefersDark() ? "dark" : "light";
}

/** Apply resolved theme on <html> (data-theme + color-scheme). */
export function applyResolvedTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
}

export function applyThemePreference(preference: ThemePreference) {
  applyResolvedTheme(resolveTheme(preference));
}

export function useTheme() {
  const [preference, setPreferenceState] = useState<ThemePreference>(loadThemePreference);
  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    resolveTheme(loadThemePreference()),
  );

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* ignore */
    }
    const r = resolveTheme(next);
    setResolved(r);
    applyResolvedTheme(r);
  }, []);

  useEffect(() => {
    applyResolvedTheme(resolveTheme(preference));
    setResolved(resolveTheme(preference));

    if (preference !== "system") return;

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const r = resolveTheme("system");
      setResolved(r);
      applyResolvedTheme(r);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preference]);

  return { preference, resolved, setPreference };
}
