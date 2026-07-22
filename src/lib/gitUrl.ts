/**
 * Convert a git remote URI into a browser-openable HTTPS URL when possible.
 * Returns null if the URI cannot reasonably open in a browser (e.g. local path).
 */
export function gitUriToBrowserUrl(uri: string): string | null {
  const raw = uri.trim();
  if (!raw) return null;

  // Already http(s)
  if (/^https?:\/\//i.test(raw)) {
    return raw.replace(/\.git$/i, "").replace(/\/$/, "");
  }

  // git@host:owner/repo(.git)
  const ssh = raw.match(/^git@([^:]+):(.+)$/i);
  if (ssh) {
    const host = ssh[1];
    const path = ssh[2].replace(/\.git$/i, "").replace(/^\/+/, "");
    return `https://${host}/${path}`;
  }

  // ssh://git@host/owner/repo
  const sshUrl = raw.match(/^ssh:\/\/(?:git@)?([^/]+)\/(.+)$/i);
  if (sshUrl) {
    const host = sshUrl[1];
    const path = sshUrl[2].replace(/\.git$/i, "");
    return `https://${host}/${path}`;
  }

  // Local path or unknown — do not open in browser
  if (raw.startsWith("/") || raw.startsWith("~") || /^[A-Za-z]:[\\/]/.test(raw)) {
    return null;
  }

  return null;
}

/** Prefer a skill's git source URI for a group (first git item). */
export function groupGitUri(items: { source?: { type?: string; uri?: string } | null }[]): string | null {
  for (const s of items) {
    const ty = String(s.source?.type ?? "").toLowerCase();
    if (ty === "git" && s.source?.uri) return s.source.uri;
  }
  return null;
}
