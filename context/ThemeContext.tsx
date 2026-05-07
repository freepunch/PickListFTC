"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { useAuth } from "@/context/AuthContext";

export type Theme = "dark" | "light" | "system";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: "dark" | "light";
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function themeKey(userId?: string | null): string {
  return userId ? `plftc:${userId}:theme` : "plftc:anon:theme";
}

function readTheme(userId?: string | null): Theme {
  try {
    const saved = localStorage.getItem(themeKey(userId)) as Theme | null;
    if (saved && ["dark", "light", "system"].includes(saved)) return saved;
    if (userId) {
      const anon = localStorage.getItem("plftc:anon:theme") as Theme | null;
      if (anon && ["dark", "light", "system"].includes(anon)) return anon;
    }
  } catch {}
  return "dark";
}

function getSystemPreference(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [theme, setThemeState] = useState<Theme>("dark");
  const [systemPref, setSystemPref] = useState<"dark" | "light">("dark");

  // Read system preference once on mount
  useEffect(() => {
    setSystemPref(getSystemPreference());
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) =>
      setSystemPref(e.matches ? "dark" : "light");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Load theme from localStorage when user changes
  useEffect(() => {
    setThemeState(readTheme(user?.id));
  }, [user?.id]);

  const resolvedTheme: "dark" | "light" =
    theme === "system" ? systemPref : theme;

  // Apply theme class to <html>
  useEffect(() => {
    const html = document.documentElement;
    html.classList.remove("dark", "light");
    html.classList.add(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = useCallback(
    (t: Theme) => {
      setThemeState(t);
      try {
        localStorage.setItem(themeKey(user?.id), t);
      } catch {}
    },
    [user?.id]
  );

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider
      value={{ theme, resolvedTheme, setTheme, toggleTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
