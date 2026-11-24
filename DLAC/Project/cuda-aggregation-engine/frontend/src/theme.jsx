import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export const THEME_KEY = "reductionlab.theme";
const THEMES = ["dark", "light"];

/** Concrete colours for Recharts (SVG props cannot rely on CSS variables everywhere).
 *  Series colours were checked with the colour-blindness validator in both themes. */
export const CHART_THEMES = {
  dark: {
    cpu: "#3f8fe8", kernel: "#16a98c", transfer: "#cc7f2e", readback: "#d4624f",
    axis: "#8fa1ba", grid: "#24395a", legend: "#b9c6da", cursor: "rgba(143,161,186,0.10)",
    separator: "#112038", reference: "#e9eff8", panel: "#112038",
  },
  light: {
    cpu: "#1f6fd1", kernel: "#0d8f7a", transfer: "#c0701a", readback: "#bf4a3f",
    axis: "#526378", grid: "#e1dccd", legend: "#3a4d68", cursor: "rgba(16,36,61,0.06)",
    separator: "#ffffff", reference: "#10243d", panel: "#ffffff",
  },
};

/** CSS-variable references for HTML swatches (they follow the theme automatically). */
export const SERIES_VARS = { cpu: "var(--cpu)", kernel: "var(--kernel)", transfer: "var(--transfer)", readback: "var(--readback)" };

export function readStoredTheme() {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return THEMES.includes(t) ? t : "dark";   // first visit (or blocked storage) -> refined dark
  } catch { return "dark"; }
}

function applyTheme(theme) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? "#0b1626" : "#f3efe6");
}

const Ctx = createContext({ theme: "dark", setTheme: () => {}, toggle: () => {}, chart: CHART_THEMES.dark });
export const useTheme = () => useContext(Ctx);

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readStoredTheme);

  useEffect(() => { applyTheme(theme); }, [theme]);

  const setTheme = useCallback((t) => {
    if (!THEMES.includes(t)) return;
    setThemeState(t);
    try { localStorage.setItem(THEME_KEY, t); } catch { /* storage blocked: theme still works for this session */ }
  }, []);
  const toggle = useCallback(() => setTheme(theme === "dark" ? "light" : "dark"), [theme, setTheme]);

  // Keep several open tabs in sync.
  useEffect(() => {
    const onStorage = (e) => { if (e.key === THEME_KEY && THEMES.includes(e.newValue)) setThemeState(e.newValue); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo(() => ({ theme, setTheme, toggle, chart: CHART_THEMES[theme] }), [theme, setTheme, toggle]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
