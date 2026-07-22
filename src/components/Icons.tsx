export function ArchiveIcon() {
  return (
    <svg
      className="icon-archive"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 4.5h11v1.2a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V4.5z" />
      <path d="M3.5 6.7v5.3a1.2 1.2 0 0 0 1.2 1.2h6.6a1.2 1.2 0 0 0 1.2-1.2V6.7" />
      <path d="M6.5 9.5h3" />
    </svg>
  );
}

export function UnarchiveIcon() {
  return (
    <svg
      className="icon-unarchive"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 4.5h11v1.2a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V4.5z" />
      <path d="M3.5 6.7v5.3a1.2 1.2 0 0 0 1.2 1.2h6.6a1.2 1.2 0 0 0 1.2-1.2V6.7" />
      <path d="M8 11.5V8.5" />
      <path d="M6.25 9.5 8 7.75 9.75 9.5" />
    </svg>
  );
}

export function SettingsIcon() {
  /* Stroke gear — toothed cog, clearly not a sun */
  return (
    <svg
      className="icon-settings"
      viewBox="0 0 24 24"
      width="16"
      height="16"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

export function StarIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg
      className="icon-star"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      aria-hidden="true"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 2.2 9.7 5.7l3.8.4-2.9 2.6.9 3.7L8 10.6l-3.5 2 0.9-3.7-2.9-2.6 3.8-.4L8 2.2z" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 4.5h10" />
      <path d="M6 4.5V3.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1" />
      <path d="M4.5 4.5v8a1.2 1.2 0 0 0 1.2 1.2h4.6a1.2 1.2 0 0 0 1.2-1.2v-8" />
      <path d="M6.75 7.25v4" />
      <path d="M9.25 7.25v4" />
    </svg>
  );
}

/** Circular arrows — check / refresh updates */
export function RefreshIcon() {
  return (
    <svg
      className="icon-refresh"
      viewBox="0 0 16 16"
      width="15"
      height="15"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M13.2 8A5.2 5.2 0 1 1 11.5 3.6" />
      <path d="M11.5 2.2v2.4h2.4" />
    </svg>
  );
}

/**
 * Expand all groups — top/bottom rails with outward arrows
 * (simplified from iconfont expand glyph)
 */
export function ExpandAllIcon() {
  return (
    <svg
      className="icon-expand-all"
      viewBox="0 0 16 16"
      width="15"
      height="15"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* top & bottom rails */}
      <path d="M3 2.25h10" />
      <path d="M3 13.75h10" />
      {/* outward vertical arrows */}
      <path d="M8 5.75V10.25" />
      <path d="M5.75 4.75 8 2.75 10.25 4.75" />
      <path d="M5.75 11.25 8 13.25 10.25 11.25" />
    </svg>
  );
}

/**
 * Collapse all groups — dashed midline with inward arrows
 * (simplified from iconfont collapse glyph)
 */
export function CollapseAllIcon() {
  return (
    <svg
      className="icon-collapse-all"
      viewBox="0 0 16 16"
      width="15"
      height="15"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* dashed horizontal midline */}
      <path d="M1.75 8h1.75" />
      <path d="M5.25 8h1.75" />
      <path d="M9 8h1.75" />
      <path d="M12.5 8h1.75" />
      {/* inward vertical arrows */}
      <path d="M8 2.25v3.5" />
      <path d="M5.75 4 8 5.75 10.25 4" />
      <path d="M8 13.75v-3.5" />
      <path d="M5.75 12 8 10.25 10.25 12" />
    </svg>
  );
}
