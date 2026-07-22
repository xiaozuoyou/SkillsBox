import { useCallback, useEffect, useRef } from "react";

const SIDEBAR_WIDTH_KEY = "skillsbox.sidebarWidth";
const SIDEBAR_MIN = 200;
const SIDEBAR_MAX = 560;
const SIDEBAR_DEFAULT = 280;

function clampSidebarWidth(px: number): number {
  const max = Math.min(SIDEBAR_MAX, Math.floor(window.innerWidth * 0.55));
  return Math.max(SIDEBAR_MIN, Math.min(max, Math.round(px)));
}

function applySidebarWidth(px: number): number {
  const w = clampSidebarWidth(px);
  document.documentElement.style.setProperty("--sidebar-width", `${w}px`);
  return w;
}

export function useSidebarResize() {
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(SIDEBAR_DEFAULT);

  useEffect(() => {
    const raw = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    const n = raw ? parseInt(raw, 10) : SIDEBAR_DEFAULT;
    applySidebarWidth(Number.isFinite(n) ? n : SIDEBAR_DEFAULT);

    const onWinResize = () => {
      const current = parseInt(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--sidebar-width",
        ),
        10,
      );
      if (Number.isFinite(current)) applySidebarWidth(current);
    };
    window.addEventListener("resize", onWinResize);
    return () => window.removeEventListener("resize", onWinResize);
  }, []);

  const onPointerDown = useCallback((ev: React.PointerEvent<HTMLDivElement>) => {
    ev.preventDefault();
    dragging.current = true;
    startX.current = ev.clientX;
    startW.current =
      parseInt(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--sidebar-width",
        ),
        10,
      ) || SIDEBAR_DEFAULT;
    document.body.classList.add("is-resizing-sidebar");
    ev.currentTarget.classList.add("is-dragging");
    ev.currentTarget.setPointerCapture(ev.pointerId);

    const target = ev.currentTarget;

    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      applySidebarWidth(startW.current + (e.clientX - startX.current));
    };

    const onUp = (e: PointerEvent) => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.classList.remove("is-resizing-sidebar");
      target.classList.remove("is-dragging");
      try {
        target.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      const current = getComputedStyle(document.documentElement)
        .getPropertyValue("--sidebar-width")
        .trim();
      const n = parseInt(current, 10);
      if (Number.isFinite(n)) {
        localStorage.setItem(SIDEBAR_WIDTH_KEY, String(n));
      }
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, []);

  const onDoubleClick = useCallback(() => {
    const w = applySidebarWidth(SIDEBAR_DEFAULT);
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(w));
  }, []);

  return { onPointerDown, onDoubleClick };
}
