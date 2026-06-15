import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type ThemeMode = "light" | "dark";

interface UiPreferencesState {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

const THEME_STORAGE_KEY = "imobiflow-theme";
const UiPreferencesContext = createContext<UiPreferencesState | undefined>(undefined);

function readInitialTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function UiPreferencesProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(readInitialTheme);

  function setTheme(nextTheme: ThemeMode) {
    setThemeState(nextTheme);
  }

  function toggleTheme() {
    setThemeState((current) => {
      const nextTheme = current === "dark" ? "light" : "dark";
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
      return nextTheme;
    });
  }

  const value = useMemo(
    () => ({
      theme,
      setTheme: (nextTheme: ThemeMode) => {
        window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
        setTheme(nextTheme);
      },
      toggleTheme,
    }),
    [theme],
  );

  return <UiPreferencesContext.Provider value={value}>{children}</UiPreferencesContext.Provider>;
}

export function useUiPreferences() {
  const context = useContext(UiPreferencesContext);
  if (!context) throw new Error("useUiPreferences must be used within UiPreferencesProvider");
  return context;
}
