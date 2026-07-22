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

/** Enable favorites into a project — layout + plus glyph */
export function AddIcon() {
  return (
    <svg
      className="icon-add"
      viewBox="0 0 1024 1024"
      width="15"
      height="15"
      aria-hidden="true"
      fill="currentColor"
    >
      <path d="M53.333333 384V128q0-30.933333 21.888-52.778667Q97.066667 53.333333 128 53.333333h768q30.933333 0 52.778667 21.888 21.888 21.845333 21.888 52.778667v256q0 30.933333-21.888 52.778667-21.845333 21.888-52.778667 21.888H128q-30.933333 0-52.778667-21.888Q53.333333 414.933333 53.333333 384z m64 0q0 10.666667 10.666667 10.666667h768q10.666667 0 10.666667-10.666667V128q0-10.666667-10.666667-10.666667H128q-10.666667 0-10.666667 10.666667v256z m-64 512v-256q0-30.933333 21.888-52.778667 21.845333-21.888 52.778667-21.888h256q30.933333 0 52.778667 21.888 21.888 21.845333 21.888 52.778667v256q0 30.933333-21.888 52.778667-21.845333 21.888-52.778667 21.888H128q-30.933333 0-52.778667-21.888Q53.333333 926.933333 53.333333 896zM768 565.333333a32 32 0 0 0-32 32v138.666667H597.333333a32 32 0 1 0 0 64h138.666667V938.666667a32 32 0 0 0 64 0v-138.666667H938.666667a32 32 0 0 0 0-64h-138.666667V597.333333a32 32 0 0 0-32-32zM117.333333 896q0 10.666667 10.666667 10.666667h256q10.666667 0 10.666667-10.666667v-256q0-10.666667-10.666667-10.666667H128q-10.666667 0-10.666667 10.666667v256z" />
    </svg>
  );
}

/** Create local skill */
export function CreateIcon() {
  return (
    <svg
      className="icon-create"
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
      <path d="M4 2.75h5.25L12.5 6v7.25a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3.75a1 1 0 0 1 1-1Z" />
      <path d="M9 2.75V6h3.5" />
      <path d="M8 8.25v4" />
      <path d="M6 10.25h4" />
    </svg>
  );
}

/** Import skills (folder / repo) — reference glyph: arrow into tray */
export function ImportIcon() {
  return (
    <svg
      className="icon-import"
      viewBox="0 0 1024 1024"
      width="15"
      height="15"
      aria-hidden="true"
      fill="currentColor"
    >
      <path d="M790.157981 263.097393a67.2 67.2 0 1 0 95.033493-95.03681 67.2 67.2 0 1 0-95.033493 95.03681Z" />
      <path d="M347.1 749.8h267.6c14.2 0 28-17.1 28-31.3s-13.7-32.4-28-32.4H405.1l320.4-313.7c9.9-10.2 8.7-34.6-1.5-44.5-10-9.6-36.1-8.2-46 1.4L360.1 636.1V443.8c0-14.2-17.1-25.7-31.3-25.7s-31.3 11.5-31.3 25.7v256.4c0 27.4 22.2 49.6 49.6 49.6z" />
      <path d="M863.6 534c-19 0-34.4 15.4-34.4 34.4v190.7c0 43.6-35.4 79-79 79H282.7c-43.6 0-79-35.4-79-79V291.7c0-43.6 35.4-79 79-79H518c19 0 34.4-15.4 34.4-34.4S537 143.9 518 143.9H282.7c-81.5 0-147.9 66.3-147.9 147.9v467.4c0 81.5 66.3 147.9 147.9 147.9h467.4c81.5 0 147.9-66.3 147.9-147.9V568.4c0-19-15.4-34.4-34.4-34.4z" />
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
