(() => {
    'use strict';
    const config = window.ArcadeThemeConfig;
    const THEMES = config.themes;
    const COLOR_PREFERENCES = config.colorPreferences;
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
    const readPreference = (key, allowed, fallback) => {
        try { const saved = localStorage.getItem(key); return allowed.includes(saved) ? saved : fallback; }
        catch { return fallback; }
    };
    let themePreference = readPreference(config.themeKey, THEMES.map(theme => theme.id), config.defaultTheme);
    let colorPreference = readPreference(config.colorKey, COLOR_PREFERENCES, 'system');
    const applyTheme = () => {
        const resolved = colorPreference === 'system' ? (systemTheme.matches ? 'dark' : 'light') : colorPreference;
        const theme = THEMES.find(item => item.id === themePreference) || THEMES[0];
        document.documentElement.dataset.arcadeTheme = theme.id;
        document.documentElement.dataset.colorMode = resolved;
        document.documentElement.dataset.theme = resolved;
        document.documentElement.style.colorScheme = resolved;
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.themeColor[resolved]);
        document.querySelectorAll('[data-theme-option]').forEach(button => {
            const selected = button.dataset.themeOption === themePreference;
            button.setAttribute('aria-pressed', String(selected));
        });
        document.querySelectorAll('[data-color-option]').forEach(button => {
            const selected = button.dataset.colorOption === colorPreference;
            button.setAttribute('aria-checked', String(selected)); button.tabIndex = selected ? 0 : -1;
        });
        document.dispatchEvent(new CustomEvent('arcade:theme', { detail: { theme: theme.id, preference: colorPreference, colorPreference, resolved, resolvedColorMode: resolved, density: theme.density } }));
    };
    const setTheme = value => {
        themePreference = THEMES.some(theme => theme.id === value) ? value : config.defaultTheme;
        try { localStorage.setItem(config.themeKey, themePreference); } catch { /* The preference still applies for this page. */ }
        applyTheme();
    };
    const setColorPreference = value => {
        colorPreference = COLOR_PREFERENCES.includes(value) ? value : 'system';
        try { localStorage.setItem(config.colorKey, colorPreference); } catch { /* The preference still applies for this page. */ }
        applyTheme();
    };
    applyTheme();
    systemTheme.addEventListener?.('change', () => { if (colorPreference === 'system') applyTheme(); });
    window.addEventListener('storage', event => { if ([config.themeKey, config.colorKey].includes(event.key)) { themePreference = readPreference(config.themeKey, THEMES.map(theme => theme.id), config.defaultTheme); colorPreference = readPreference(config.colorKey, COLOR_PREFERENCES, 'system'); applyTheme(); } });
    let currentUser = null;
    const api = async (url, options = {}) => {
        const response = await fetch(url, { ...options, headers: { 'content-type': 'application/json', ...options.headers } });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || 'Request failed.');
        return body;
    };
    const rootPath = document.currentScript?.src ? new URL('.', document.currentScript.src).pathname : '/';
    const topbar = document.createElement('header');
    topbar.className = 'arcade-topbar';
    const topbarInner = document.createElement('div');
    topbarInner.className = 'arcade-topbar-inner';
    const home = document.createElement('a');
    home.className = 'arcade-home'; home.href = rootPath;
    home.setAttribute('aria-label', 'JavaScript Arcade home');
    home.innerHTML = '<span class="arcade-home-mark" aria-hidden="true">JS</span><span>JavaScript Arcade</span>';
    const account = document.createElement('nav');
    account.className = 'arcade-account'; account.setAttribute('aria-label', 'Arcade account and appearance');
    topbarInner.append(home, account); topbar.append(topbarInner);
    const appearanceButton = document.createElement('button'); appearanceButton.type = 'button'; appearanceButton.className = 'arcade-appearance-button'; appearanceButton.textContent = 'Appearance';
    const appearanceDialog = document.createElement('dialog'); appearanceDialog.className = 'arcade-dialog arcade-appearance-dialog';
    appearanceDialog.innerHTML = `<form method="dialog"><header><div><small>Make it yours</small><h2>Appearance</h2></div><button value="close" aria-label="Close appearance settings">×</button></header><p class="arcade-appearance-intro">Choose an experience and a color mode. Your choice follows you across the arcade.</p><div class="arcade-theme-grid">${THEMES.map(theme => `<button type="button" data-theme-option="${theme.id}" aria-pressed="false"><span class="arcade-theme-preview preview-${theme.id}" aria-hidden="true"><i></i><i></i><i></i></span><strong>${theme.name}</strong><small>${theme.description}</small></button>`).join('')}</div><fieldset><legend>Color mode</legend><div class="arcade-color-modes" role="radiogroup">${COLOR_PREFERENCES.map(mode => `<button type="button" role="radio" data-color-option="${mode}" aria-checked="false">${mode[0].toUpperCase()}${mode.slice(1)}</button>`).join('')}</div></fieldset><div class="arcade-appearance-footer"><p class="arcade-appearance-status" role="status" aria-live="polite"></p><button type="button" class="arcade-appearance-reset">Reset defaults</button></div></form>`;
    const announceAppearance = () => { const theme = THEMES.find(item => item.id === themePreference); appearanceDialog.querySelector('.arcade-appearance-status').textContent = `${theme.name} theme, ${colorPreference} color mode selected.`; };
    appearanceDialog.addEventListener('click', event => { if (event.target.closest('[data-theme-option]')) { setTheme(event.target.closest('[data-theme-option]').dataset.themeOption); announceAppearance(); } if (event.target.dataset.colorOption) { setColorPreference(event.target.dataset.colorOption); announceAppearance(); } if (event.target.classList.contains('arcade-appearance-reset')) { setTheme(config.defaultTheme); setColorPreference('system'); announceAppearance(); } });
    appearanceDialog.querySelector('.arcade-color-modes').addEventListener('keydown', event => { if (!['ArrowLeft','ArrowRight'].includes(event.key)) return; event.preventDefault(); const offset=event.key==='ArrowRight'?1:-1; const next=COLOR_PREFERENCES[(COLOR_PREFERENCES.indexOf(colorPreference)+offset+COLOR_PREFERENCES.length)%COLOR_PREFERENCES.length]; setColorPreference(next); appearanceDialog.querySelector(`[data-color-option="${next}"]`).focus(); announceAppearance(); });
    appearanceButton.addEventListener('click', () => { applyTheme(); appearanceDialog.showModal(); });
    const dialog = document.createElement('dialog'); dialog.className = 'arcade-dialog';
    dialog.innerHTML = `<form class="arcade-auth" method="dialog"><h2>Arcade account</h2><p>Use one gamertag to save play history and scores across every game.</p><label>Gamertag<input name="gamertag" minlength="3" maxlength="24" pattern="[A-Za-z0-9_-]+" autocomplete="username" required></label><label>Passcode<input name="passcode" type="password" minlength="4" maxlength="128" autocomplete="current-password" required></label><p class="arcade-auth-message" role="status"></p><div class="arcade-auth-actions"><button value="login">Sign in</button><button value="register" class="secondary">Create account</button><button value="cancel" class="secondary" formnovalidate>Cancel</button></div></form>`;
    const buildVersion = document.createElement('footer');
    buildVersion.className = 'arcade-build-version';
    buildVersion.textContent = 'Build …';
    document.body.classList.add('arcade-has-topbar');
    document.body.prepend(topbar);
    document.body.append(dialog, appearanceDialog, buildVersion);
    const gamePath = location.pathname.match(/\/(pong|Sudoku|Minesweeper|tictactoe|battle-tanks|tetris)\//)?.[1];
    const game = ({ pong:'pong', Sudoku:'sudoku', Minesweeper:'minesweeper', tictactoe:'tictactoe', 'battle-tanks':'battletanks', tetris:'tetris' })[gamePath];
    let achievementDialog;
    const shareAchievement = async achievement => {
        const text = `${achievement.icon} Achievement unlocked: “${achievement.title}” in JavaScript Arcade — ${achievement.condition}`;
        const url = location.origin + '/profile.html#achievements';
        const image = window.ResultShare?.achievement(achievement);
        if (image) return window.ResultShare.share({ image, filename: `achievement-${achievement.id}.png`, title: achievement.title, text, url });
        if (navigator.share) return navigator.share({ title: achievement.title, text, url });
        await navigator.clipboard.writeText(`${text} ${url}`);
    };
    const scoreMessages = ['The leaderboard just felt that!', 'New legend status unlocked!', 'That record never stood a chance!', 'History, officially rewritten!'];
    const notificationQueue = [];
    let showingNotification = false;
    const showNextNotification = () => {
        const notification = notificationQueue.shift();
        if (!notification) { showingNotification = false; return; }
        showingNotification = true;
        const toast = document.createElement('aside');
        toast.setAttribute('role', 'status'); toast.setAttribute('aria-live', 'polite');
        if (notification.type === 'achievement') {
            const achievement = notification.detail;
            toast.className = 'achievement-toast';
            toast.innerHTML = `<span>${achievement.icon}</span><div><small>Achievement unlocked</small><strong>${achievement.title}</strong></div>`;
        } else {
            const topScore = notification.detail;
            const message = scoreMessages[Math.floor(Math.random() * scoreMessages.length)];
            const leaderboardUrl = `${rootPath}profile.html?game=${encodeURIComponent(topScore.game)}#leaderboards`;
            const fasterFinish = topScore.previousScore === topScore.newScore
                ? `<em>Faster finish: ${topScore.previousSeconds}s → ${topScore.newSeconds}s</em>` : '';
            toast.className = 'top-score-toast';
            toast.innerHTML = `<button type="button" aria-label="Dismiss top score notification">×</button><span class="top-score-confetti" aria-hidden="true">🏆</span><div><small>Top score smashed</small><strong>${message}</strong><p><s>${topScore.previousScore}</s><b aria-label="New score ${topScore.newScore}">${topScore.newScore}</b></p>${fasterFinish}<a href="${leaderboardUrl}">See the top score you broke →</a></div>`;
        }
        document.body.append(toast);
        document.dispatchEvent(new CustomEvent(`arcade:${notification.type === 'achievement' ? 'achievement' : 'top-score'}`, { detail: notification.detail }));
        let timer;
        const finish = () => { clearTimeout(timer); toast.remove(); showNextNotification(); };
        toast.querySelector('button')?.addEventListener('click', finish);
        timer = setTimeout(finish, notification.type === 'achievement' ? 5200 : 10000);
    };
    const enqueueNotifications = notifications => {
        notificationQueue.push(...notifications);
        if (!showingNotification) showNextNotification();
    };
    const showUnlocks = unlocked => enqueueNotifications(unlocked.map(detail => ({ type: 'achievement', detail })));
    const showTopScore = topScore => { if (topScore) enqueueNotifications([{ type: 'top-score', detail: topScore }]); };
    const loadAchievements = async () => {
        if (!game || !achievementDialog) return;
        const result = await api(`/api/achievements/${game}`);
        achievementDialog.querySelector('.achievement-list').innerHTML = result.achievements.map(item => `<article class="achievement-card ${item.unlocked ? 'is-unlocked' : ''}"><span class="achievement-icon" aria-hidden="true">${item.icon}</span><div><small>${item.unlocked ? `Unlocked ${new Date(item.unlockedAt + 'Z').toLocaleDateString()}` : 'Locked'}</small><strong>${item.title}</strong><p>${item.condition}</p>${item.target > 1 ? `<progress value="${item.progress}" max="${item.target}">${item.progress}/${item.target}</progress><small>${item.progress} / ${item.target}</small>` : ''}</div>${item.unlocked ? `<button type="button" data-share-achievement="${item.id}">Share</button>` : ''}</article>`).join('');
        achievementDialog.querySelectorAll('[data-share-achievement]').forEach(button => button.addEventListener('click', () => shareAchievement(result.achievements.find(item => item.id === button.dataset.shareAchievement)).catch(() => {})));
    };
    if (game) {
        achievementDialog = document.createElement('dialog'); achievementDialog.className = 'arcade-dialog achievement-dialog';
        achievementDialog.innerHTML = `<header><div><small>Challenge cabinet</small><h2>Achievements</h2></div><button type="button" aria-label="Close achievements">×</button></header><div class="achievement-list"></div>`;
        achievementDialog.querySelector('header button').addEventListener('click', () => achievementDialog.close());
        document.body.append(achievementDialog);
    }
    api('/api/version').then(result => { buildVersion.textContent = `Build ${result.version}`; }).catch(() => { buildVersion.hidden = true; });
    const render = () => {
        account.replaceChildren();
        account.append(appearanceButton);
        if (game) { const achievements = document.createElement('button'); achievements.type = 'button'; achievements.className = 'achievement-nav'; achievements.textContent = 'Achievements'; achievements.addEventListener('click', () => { achievementDialog.showModal(); loadAchievements().catch(() => {}); }); account.append(achievements); }
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
        record: async result => { if (!currentUser) return null; const recorded = await api('/api/results', { method: 'POST', body: JSON.stringify(result) }); showTopScore(recorded.topScore); showUnlocks(recorded.unlocked || []); return recorded; },
        achievements: loadAchievements,
        notifyAchievements: showUnlocks,
        api,
        appearance: () => ({ theme: themePreference, colorPreference, resolvedColorMode: document.documentElement.dataset.colorMode }),
        theme: () => ({ theme: themePreference, preference: colorPreference, resolved: document.documentElement.dataset.colorMode }),
        setTheme,
        setColorPreference
    };
    api('/api/me').then(result => { currentUser = result.user; render(); }).catch(render);
})();
