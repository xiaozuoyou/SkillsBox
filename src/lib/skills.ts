import type { SkillGroup, SkillListItem, SkillOrigin } from "./types";
import type { MessageKey } from "../i18n";

export function originLabelKey(origin: SkillOrigin): MessageKey {
  return origin === "import" || origin === "Import"
    ? "detail.originImport"
    : "detail.originLocal";
}

export function groupByRepo(
  skills: SkillListItem[],
  filter = "",
): SkillGroup[] {
  const q = filter.trim().toLowerCase();
  const filtered = skills.filter((s) => {
    if (!q) return true;
    const repo = (s.repoLabel || "").toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q) ||
      repo.includes(q)
    );
  });

  const map = new Map<string, SkillGroup>();
  for (const s of filtered) {
    const key = s.repoKey || "unknown";
    const label = s.repoLabel || key;
    if (!map.has(key)) map.set(key, { key, label, items: [] });
    map.get(key)!.items.push(s);
  }
  return [...map.values()];
}
