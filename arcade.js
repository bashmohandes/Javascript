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
    const buildVersion = document.createElement('footer');
    buildVersion.className = 'arcade-build-version';
    buildVersion.textContent = 'Build …';
    document.body.append(account, dialog, buildVersion);
    const gamePath = location.pathname.match(/\/(pong|Sudoku|Minesweeper|tictactoe|battle-tanks)\//)?.[1];
    const game = ({ pong:'pong', Sudoku:'sudoku', Minesweeper:'minesweeper', tictactoe:'tictactoe', 'battle-tanks':'battletanks' })[gamePath];
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
        account.append(themeControl);
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
        theme: () => ({ preference: themePreference, resolved: document.documentElement.dataset.theme }),
        setTheme
    };
    api('/api/me').then(result => { currentUser = result.user; render(); }).catch(render);
})();
