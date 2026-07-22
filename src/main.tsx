import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import {
  applyDocumentLocale,
  loadLocalePreference,
  resolveLocale,
} from "./i18n";
import { I18nProvider } from "./i18n/context";
import { applyThemePreference, loadThemePreference } from "./hooks/useTheme";
import "./styles.css";

// Apply theme & locale before first paint to reduce flash
applyThemePreference(loadThemePreference());
applyDocumentLocale(resolveLocale(loadLocalePreference()));

// Disable WebView default context menu (Reload / Inspect Element, etc.)
document.addEventListener("contextmenu", (e) => e.preventDefault());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
);
