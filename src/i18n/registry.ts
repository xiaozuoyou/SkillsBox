/**
 * Locale registry — single place to enable a language.
 *
 * To add a locale (e.g. ja):
 * 1. Create `locales/ja.ts` implementing `Messages` (copy keys from zh-CN).
 * 2. Append an entry below with `code`, `nativeName`, `matches`, `messages`.
 * 3. Settings language list and `Locale` type update automatically.
 *
 * Currently shipped: zh-CN, en. Architecture supports N locales.
 */

import { en } from "./locales/en";
import { zhCN, type Messages } from "./locales/zh-CN";

export type { Messages };

export interface LocaleEntry {
  /** BCP 47 tag; also used as preference id and `<html lang>`. */
  code: string;
  /** Native name for the language picker (not translated via t()). */
  nativeName: string;
  /**
   * Whether a browser/OS language tag (lowercased) should map to this locale.
   * Checked in registry order; first match wins.
   */
  matches: (langTagLower: string) => boolean;
  messages: Messages;
}

/**
 * Registered locales. Order = display order in Settings (after “System”).
 * First entry is also the fallback when system language matches none.
 */
export const LOCALE_REGISTRY = [
  {
    code: "zh-CN" as const,
    nativeName: "简体中文",
    matches: (tag: string) => tag === "zh" || tag.startsWith("zh-"),
    messages: zhCN,
  },
  {
    code: "en" as const,
    nativeName: "English",
    matches: (tag: string) => tag === "en" || tag.startsWith("en-"),
    messages: en,
  },
] as const satisfies readonly LocaleEntry[];

/** All registered locale codes (grows when you register more). */
export type Locale = (typeof LOCALE_REGISTRY)[number]["code"];

export type LocalePreference = "system" | Locale;

/** Fallback when preference is system but no OS language matches. */
export const FALLBACK_LOCALE: Locale = LOCALE_REGISTRY[0].code;

export function getLocaleEntry(code: Locale): (typeof LOCALE_REGISTRY)[number] {
  const entry = LOCALE_REGISTRY.find((e) => e.code === code);
  if (!entry) {
    // Should be unreachable if Locale is derived from the registry.
    return LOCALE_REGISTRY[0];
  }
  return entry;
}

/** Locales for UI pickers (excluding “system”). */
export function listRegisteredLocales(): ReadonlyArray<{
  code: Locale;
  nativeName: string;
}> {
  return LOCALE_REGISTRY.map((e) => ({
    code: e.code,
    nativeName: e.nativeName,
  }));
}

export function isRegisteredLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" &&
    LOCALE_REGISTRY.some((e) => e.code === value)
  );
}
