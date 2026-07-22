import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useState } from "react";

export function WindowControls() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const win = getCurrentWindow();
    let unlisten: (() => void) | undefined;

    void win.isMaximized().then(setMaximized);
    void win
      .onResized(() => {
        void win.isMaximized().then(setMaximized);
      })
      .then((fn) => {
        unlisten = fn;
      });

    return () => {
      unlisten?.();
    };
  }, []);

  /* Drive CSS window radius: square when maximized, rounded otherwise */
  useEffect(() => {
    document.documentElement.classList.toggle(
      "is-window-maximized",
      maximized,
    );
    return () => {
      document.documentElement.classList.remove("is-window-maximized");
    };
  }, [maximized]);

  const minimize = useCallback(() => {
    void getCurrentWindow().minimize();
  }, []);

  const toggleMaximize = useCallback(() => {
    void getCurrentWindow().toggleMaximize();
  }, []);

  const close = useCallback(() => {
    void getCurrentWindow().close();
  }, []);

  return (
    <div className="window-controls">
      <button
        type="button"
        className="window-control"
        aria-label="Minimize"
        onClick={minimize}
      >
        <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
          <path d="M2 6h8" fill="none" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </button>
      <button
        type="button"
        className="window-control"
        aria-label={maximized ? "Restore" : "Maximize"}
        onClick={toggleMaximize}
      >
        {maximized ? (
          <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
            <path
              d="M3.5 4.5h5v5h-5zM4.5 3.5h4a1 1 0 0 1 1 1v4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
            <rect
              x="2.5"
              y="2.5"
              width="7"
              height="7"
              rx="0.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            />
          </svg>
        )}
      </button>
      <button
        type="button"
        className="window-control window-control-close"
        aria-label="Close"
        onClick={close}
      >
        <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
          <path
            d="M3 3l6 6M9 3L3 9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
