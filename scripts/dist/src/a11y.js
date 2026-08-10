/** Theme, color-vision modes, and font scale (persisted). */
const THEME_KEY = "yueyu.theme";
const COLOR_KEY = "yueyu.colorMode";
const FONT_KEY = "yueyu.fontScale";
function isTheme(v) {
    return v === "dark" || v === "light";
}
function isColorMode(v) {
    return v === "default" || v === "deuteranopia" || v === "protanopia" || v === "high-contrast";
}
function isFontScale(v) {
    return v === "100" || v === "125" || v === "150";
}
function readStored(key, guard, fallback) {
    try {
        const saved = localStorage.getItem(key);
        if (guard(saved))
            return saved;
    }
    catch {
        /* ignore */
    }
    return fallback;
}
export function applyA11yPrefs(theme, colorMode, fontScale) {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.colorMode = colorMode;
    root.dataset.fontScale = fontScale;
    try {
        localStorage.setItem(THEME_KEY, theme);
        localStorage.setItem(COLOR_KEY, colorMode);
        localStorage.setItem(FONT_KEY, fontScale);
    }
    catch {
        /* ignore */
    }
    syncPressed("theme", theme);
    syncPressed("color-mode", colorMode);
    syncPressed("font-scale", fontScale);
}
function syncPressed(kind, value) {
    const attr = kind === "theme" ? "data-theme-option" : kind === "color-mode" ? "data-color-mode-option" : "data-font-scale-option";
    document.querySelectorAll(`[${attr}]`).forEach((el) => {
        const option = el.getAttribute(attr);
        el.setAttribute("aria-pressed", option === value ? "true" : "false");
    });
}
export function initA11y() {
    const theme = readStored(THEME_KEY, isTheme, "dark");
    const colorMode = readStored(COLOR_KEY, isColorMode, "default");
    const fontScale = readStored(FONT_KEY, isFontScale, "100");
    applyA11yPrefs(theme, colorMode, fontScale);
    document.querySelectorAll("[data-theme-option]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const next = btn.dataset.themeOption;
            if (!isTheme(next))
                return;
            applyA11yPrefs(next, readStored(COLOR_KEY, isColorMode, "default"), readStored(FONT_KEY, isFontScale, "100"));
        });
    });
    document.querySelectorAll("[data-color-mode-option]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const next = btn.dataset.colorModeOption;
            if (!isColorMode(next))
                return;
            applyA11yPrefs(readStored(THEME_KEY, isTheme, "dark"), next, readStored(FONT_KEY, isFontScale, "100"));
        });
    });
    document.querySelectorAll("[data-font-scale-option]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const next = btn.dataset.fontScaleOption;
            if (!isFontScale(next))
                return;
            applyA11yPrefs(readStored(THEME_KEY, isTheme, "dark"), readStored(COLOR_KEY, isColorMode, "default"), next);
        });
    });
}
//# sourceMappingURL=a11y.js.map