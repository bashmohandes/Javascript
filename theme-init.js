(() => {
    'use strict';

    const config = Object.freeze({
        defaultTheme: 'playful',
        themes: Object.freeze([
            Object.freeze({ id: 'playful', name: 'Playful', description: 'Bold cards, generous spacing, and bright arcade energy.', density: 'comfortable', themeColor: Object.freeze({ light: '#f7f3eb', dark: '#0d1420' }) }),
            Object.freeze({ id: 'cabinet', name: 'Cabinet', description: 'A compact, game-first layout inspired by classic arcade cabinets.', density: 'compact', themeColor: Object.freeze({ light: '#f2dfb6', dark: '#090b13' }) }),
            Object.freeze({ id: 'calm', name: 'Calm', description: 'Quiet surfaces, open layouts, and restrained decoration.', density: 'spacious', themeColor: Object.freeze({ light: '#eef4f1', dark: '#111917' }) })
        ]),
        colorPreferences: Object.freeze(['system', 'light', 'dark']),
        themeKey: 'arcade-experience-theme',
        colorKey: 'arcade-color-preference',
        legacyKey: 'arcade-theme'
    });
    window.ArcadeThemeConfig = config;

    const themeIds = config.themes.map(theme => theme.id);
    const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
    const write = (key, value) => { try { localStorage.setItem(key, value); } catch { /* Defaults still apply. */ } };
    const legacy = read(config.legacyKey);
    const savedTheme = read(config.themeKey);
    const savedColor = read(config.colorKey);
    const theme = themeIds.includes(savedTheme) ? savedTheme : config.defaultTheme;
    const colorPreference = config.colorPreferences.includes(savedColor)
        ? savedColor
        : (config.colorPreferences.includes(legacy) ? legacy : 'system');
    const systemDark = (() => { try { return matchMedia('(prefers-color-scheme: dark)').matches; } catch { return false; } })();
    const resolvedColorMode = colorPreference === 'system'
        ? (systemDark ? 'dark' : 'light')
        : colorPreference;

    if (!savedTheme) write(config.themeKey, theme);
    if (!savedColor) write(config.colorKey, colorPreference);
    const root = document.documentElement;
    root.dataset.arcadeTheme = theme;
    root.dataset.colorMode = resolvedColorMode;
    // Kept during migration for game-specific styles that have not yet moved to the new contract.
    root.dataset.theme = resolvedColorMode;
    root.style.colorScheme = resolvedColorMode;
})();
