# Internationalization (i18n)

SkillsBox is built for **multi-locale development**. Only **zh-CN** and **en** are registered today; the same path scales to more languages.

## Rules

1. **No hard-coded user-facing copy in components** — use `t("section.key")` / `t("key", { name })`.
2. **Source of truth for keys** — `locales/zh-CN.ts`. Add keys there first.
3. **Every locale implements the same schema** — TypeScript enforces `Messages`.
4. **Register the locale** — one entry in `registry.ts`. UI pickers and `Locale` type update from the registry.
5. **Language native names** live on the registry (`nativeName`), not in message catalogs (they stay in the language’s own script).

## Add a language (e.g. Japanese)

```text
1. src/i18n/locales/ja.ts
   import type { Messages } from "./zh-CN";
   export const ja: Messages = { /* all keys */ };

2. src/i18n/registry.ts
   import { ja } from "./locales/ja";
   // append:
   {
     code: "ja" as const,
     nativeName: "日本語",
     matches: (tag) => tag === "ja" || tag.startsWith("ja-"),
     messages: ja,
   },
```

No Settings UI changes required.

## Runtime

| Preference | Behavior |
|------------|----------|
| `system` (default) | First matching `navigator.languages` via each entry’s `matches` |
| Registered code | Pin that catalog |
| No match | `FALLBACK_LOCALE` (first registry entry, currently `zh-CN`) |

Missing keys in a partial locale fall back to the fallback catalog, then to the key string.

## API

```ts
import { useT, useI18n } from "../i18n/context";
import { listRegisteredLocales } from "../i18n";

const t = useT();
t("library.tabAll");
t("toast.created", { name: "foo" });
```
