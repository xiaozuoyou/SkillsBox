/**
 * i18n runtime API.
 *
 * UI code: use `useT()` / `useI18n()` from `./context`.
 * Adding a language: see `./registry.ts` and `./README.md`.
 */

import {
  FALLBACK_LOCALE,
  getLocaleEntry,
  isRegisteredLocale,
  listRegisteredLocales,
  LOCALE_REGISTRY,
  type Locale,
  type LocalePreference,
  type Messages,
} from "./registry";

export type { Locale, LocalePreference, Messages };
export {
  FALLBACK_LOCALE,
  listRegisteredLocales,
  LOCALE_REGISTRY,
  isRegisteredLocale,
};

const STORAGE_KEY = "skillsbox.locale";

export function isLocalePreference(v: unknown): v is LocalePreference {
  return v === "system" || isRegisteredLocale(v);
}

export function loadLocalePreference(): LocalePreference {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (isLocalePreference(raw)) return raw;
  } catch {
    /* ignore */
  }
  return "system";
}

export function saveLocalePreference(pref: LocalePreference) {
  try {
    localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    /* ignore */
  }
}

function browserLanguageTags(): string[] {
  if (typeof navigator === "undefined") return [];
  if (navigator.languages?.length) return [...navigator.languages];
  if (navigator.language) return [navigator.language];
  return [];
}

/**
 * Map OS/browser languages to a registered locale.
 * Walks `navigator.languages` in order; first registry match wins.
 */
export function detectSystemLocale(): Locale {
  for (const raw of browserLanguageTags()) {
    const tag = (raw || "").toLowerCase();
    if (!tag) continue;
    for (const entry of LOCALE_REGISTRY) {
      if (entry.matches(tag)) return entry.code;
    }
  }
  return FALLBACK_LOCALE;
}

export function resolveLocale(preference: LocalePreference): Locale {
  if (preference === "system") return detectSystemLocale();
  if (isRegisteredLocale(preference)) return preference;
  return FALLBACK_LOCALE;
}

export function getMessages(locale: Locale): Messages {
  return getLocaleEntry(locale).messages;
}

export function applyDocumentLocale(locale: Locale) {
  document.documentElement.lang = locale;
}

type NestedKeyOf<T, Prefix extends string = ""> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends string
        ? Prefix extends ""
          ? K
          : `${Prefix}.${K}`
        : T[K] extends object
          ? NestedKeyOf<T[K], Prefix extends "" ? K : `${Prefix}.${K}`>
          : never;
    }[keyof T & string]
  : never;

export type MessageKey = NestedKeyOf<Messages>;

function lookup(messages: Messages, key: string): string | undefined {
  const parts = key.split(".");
  let cur: unknown = messages;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === "string" ? cur : undefined;
}

export type TranslateParams = Record<string, string | number>;

/**
 * Translate a key. Missing keys fall back to the source catalog (zh-CN),
 * then to the key string itself — so incomplete locales still work while shipping.
 */
export function translate(
  messages: Messages,
  key: MessageKey | string,
  params?: TranslateParams,
  fallbackMessages: Messages = getMessages(FALLBACK_LOCALE),
): string {
  let s =
    lookup(messages, key) ?? lookup(fallbackMessages, key) ?? String(key);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      s = s.replaceAll(`{${k}}`, String(v));
    }
  }
  return s;
}

export function createTranslator(locale: Locale) {
  const messages = getMessages(locale);
  const fallback = getMessages(FALLBACK_LOCALE);
  return (key: MessageKey | string, params?: TranslateParams) =>
    translate(messages, key, params, fallback);
}

/** @deprecated use isRegisteredLocale */
export function isLocale(v: unknown): v is Locale {
  return isRegisteredLocale(v);
}
