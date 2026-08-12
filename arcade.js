(() => {
    'use strict';
    const THEME_KEY = 'arcade-theme';
    const THEMES = ['system', 'light', 'dark'];
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
    const readTheme = () => {
        try { const saved = localStorage.getItem(THEME_KEY); return THEMES.includes(saved) ? saved : 'system'; }
        catch { return 'system'; }
    };
    let themePreference = readTheme();
    const applyTheme = () => {
        const resolved = themePreference === 'system' ? (systemTheme.matches ? 'dark' : 'light') : themePreference;
        document.documentElement.dataset.theme = resolved;
        document.documentElement.style.colorScheme = resolved;
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#111b18' : '#f7f3eb');
        document.querySelectorAll('[data-theme-option]').forEach(button => {
            const selected = button.dataset.themeOption === themePreference;
            button.setAttribute('aria-checked', String(selected));
            button.tabIndex = selected ? 0 : -1;
        });
        document.dispatchEvent(new CustomEvent('arcade:theme', { detail: { preference: themePreference, resolved } }));
    };
    const setTheme = value => {
        themePreference = THEMES.includes(value) ? value : 'system';
        try { localStorage.setItem(THEME_KEY, themePreference); } catch { /* The preference still applies for this page. */ }
        applyTheme();
    };
    applyTheme();
    systemTheme.addEventListener?.('change', () => { if (themePreference === 'system') applyTheme(); });
    window.addEventListener('storage', event => { if (event.key === THEME_KEY) { themePreference = readTheme(); applyTheme(); } });
    let currentUser = null;
    const api = async (url, options = {}) => {
        const response = await fetch(url, { ...options, headers: { 'content-type': 'application/json', ...options.headers } });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || 'Request failed.');
        return body;
    };
    const rootPath = document.currentScript?.src ? new URL('.', document.currentScript.src).pathname : '/';
    const account = document.createElement('nav');
    account.className = 'arcade-account'; account.setAttribute('aria-label', 'Arcade account');
    const themeControl = document.createElement('div');
    themeControl.className = 'arcade-theme'; themeControl.setAttribute('role', 'radiogroup'); themeControl.setAttribute('aria-label', 'Appearance');
    themeControl.innerHTML = THEMES.map(theme => `<button type="button" role="radio" data-theme-option="${theme}" aria-checked="false">${theme[0].toUpperCase()}${theme.slice(1)}</button>`).join('');
    themeControl.addEventListener('click', event => { if (event.target.dataset.themeOption) setTheme(event.target.dataset.themeOption); });
    themeControl.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        event.preventDefault();
        const offset = event.key === 'ArrowRight' ? 1 : -1;
        const next = THEMES[(THEMES.indexOf(themePreference) + offset + THEMES.length) % THEMES.length];
        setTheme(next); themeControl.querySelector(`[data-theme-option="${next}"]`).focus();
    });
    const dialog = document.createElement('dialog'); dialog.className = 'arcade-dialog';
    dialog.innerHTML = `<form class="arcade-auth" method="dialog"><h2>Arcade account</h2><p>Use one gamertag to save play history and scores across every game.</p><label>Gamertag<input name="gamertag" minlength="3" maxlength="24" pattern="[A-Za-z0-9_-]+" autocomplete="username" required></label><label>Passcode<input name="passcode" type="password" minlength="4" maxlength="128" autocomplete="current-password" required></label><p class="arcade-auth-message" role="status"></p><div class="arcade-auth-actions"><button value="login">Sign in</button><button value="register" class="secondary">Create account</button><button value="cancel" class="secondary" formnovalidate>Cancel</button></div></form>`;
    document.body.append(account, dialog);
    const render = () => {
        account.replaceChildren();
        account.append(themeControl);
        const scores = document.createElement('a'); scores.href = `${rootPath}profile.html#leaderboards`; scores.textContent = 'Top scores'; account.append(scores);
        if (currentUser) {
            const profile = document.createElement('a'); profile.href = `${rootPath}profile.html`; profile.textContent = currentUser.gamertag;
            const logout = document.createElement('button'); logout.type = 'button'; logout.textContent = 'Sign out'; logout.addEventListener('click', async () => { await api('/api/auth/logout', { method: 'POST', body: '{}' }); currentUser = null; render(); });
            account.append(profile, logout);
        } else {
            const signIn = document.createElement('button'); signIn.type = 'button'; signIn.textContent = 'Sign in'; signIn.addEventListener('click', () => dialog.showModal()); account.append(signIn);
        }
        applyTheme();
        document.dispatchEvent(new CustomEvent('arcade:user', { detail: currentUser }));
    };
    dialog.addEventListener('close', async () => {
        if (!['login', 'register'].includes(dialog.returnValue)) return;
        const form = dialog.querySelector('form'), message = dialog.querySelector('.arcade-auth-message');
        try {
            const values = Object.fromEntries(new FormData(form));
            const result = await api(`/api/auth/${dialog.returnValue}`, { method: 'POST', body: JSON.stringify(values) });
            currentUser = result.user; form.reset(); message.textContent = ''; render();
        } catch (error) { message.textContent = error.message; dialog.showModal(); }
    });
    window.Arcade = {
        user: () => currentUser,
        signIn: () => dialog.showModal(),
        record: async result => currentUser ? api('/api/results', { method: 'POST', body: JSON.stringify(result) }) : null,
        api,
        theme: () => ({ preference: themePreference, resolved: document.documentElement.dataset.theme }),
        setTheme
    };
    api('/api/me').then(result => { currentUser = result.user; render(); }).catch(render);
})();
