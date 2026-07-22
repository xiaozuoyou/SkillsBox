import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  applyDocumentLocale,
  createTranslator,
  loadLocalePreference,
  resolveLocale,
  saveLocalePreference,
  type Locale,
  type LocalePreference,
  type MessageKey,
  type TranslateParams,
} from "./index";

type TFunction = (key: MessageKey | string, params?: TranslateParams) => string;

interface I18nContextValue {
  preference: LocalePreference;
  locale: Locale;
  setPreference: (pref: LocalePreference) => void;
  t: TFunction;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<LocalePreference>(
    loadLocalePreference,
  );
  const [locale, setLocale] = useState<Locale>(() =>
    resolveLocale(loadLocalePreference()),
  );

  const setPreference = useCallback((pref: LocalePreference) => {
    setPreferenceState(pref);
    saveLocalePreference(pref);
    const resolved = resolveLocale(pref);
    setLocale(resolved);
    applyDocumentLocale(resolved);
  }, []);

  useEffect(() => {
    const resolved = resolveLocale(preference);
    setLocale(resolved);
    applyDocumentLocale(resolved);

    if (preference !== "system") return;

    const onLangChange = () => {
      const next = resolveLocale("system");
      setLocale(next);
      applyDocumentLocale(next);
    };
    window.addEventListener("languagechange", onLangChange);
    return () => window.removeEventListener("languagechange", onLangChange);
  }, [preference]);

  const t = useMemo(() => createTranslator(locale), [locale]);

  const value = useMemo(
    () => ({ preference, locale, setPreference, t }),
    [preference, locale, setPreference, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}

export function useT(): TFunction {
  return useI18n().t;
}
