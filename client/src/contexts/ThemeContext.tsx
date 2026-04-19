import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme?: () => void;
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  switchable?: boolean;
}

export function ThemeProvider({
  children,
  // Ember Dark is the recommended default per the editorial brief.
  defaultTheme = "dark",
  switchable = false,
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    // Always honour a persisted preference if one exists — this lets the
    // no-flash bootstrap script in index.html and React stay in sync even
    // when ThemeProvider is mounted with switchable=false.
    if (typeof window !== "undefined") {
      const stored = window.localStorage?.getItem("theme");
      if (stored === "light" || stored === "dark") return stored;
    }
    return defaultTheme;
  });

  useEffect(() => {
    const root = document.documentElement;
    // Editorial palette: Ember Dark applies on :root by default, Editorial
    // Cream opts in via .light. Toggle both classes so either palette can
    // be the active one regardless of which started as default.
    root.classList.toggle("dark", theme === "dark");
    root.classList.toggle("light", theme === "light");

    // Repaint the mobile browser chrome so the address bar matches the
    // active palette. Surface tokens come straight from Phase 1.
    const themeColor = theme === "dark" ? "#0F1419" : "#F5F1E4";
    document
      .querySelectorAll('meta[name="theme-color"]')
      .forEach((m) => m.setAttribute("content", themeColor));

    if (switchable) {
      localStorage.setItem("theme", theme);
    }
  }, [theme, switchable]);

  const toggleTheme = switchable
    ? () => {
        setTheme(prev => (prev === "light" ? "dark" : "light"));
      }
    : undefined;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, switchable }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
