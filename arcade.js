(() => {
    'use strict';
    const events = window.ArcadeEvents;
    if (!events) throw new Error('Arcade event system failed to load.');
    const publish = (type, detail) => events.emit(type, detail, { source: 'shell' });
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
        publish('system:theme-changed', { theme: theme.id, preference: colorPreference, colorPreference, resolved, resolvedColorMode: resolved, density: theme.density });
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
    const gamePath = location.pathname.match(/\/(pong|Sudoku|Minesweeper|tictactoe|battle-tanks|tetris)\//)?.[1];
    const game = ({ pong:'pong', Sudoku:'sudoku', Minesweeper:'minesweeper', tictactoe:'tictactoe', 'battle-tanks':'battletanks', tetris:'tetris' })[gamePath];
    const audio = game ? window.ArcadeAudio : null;
    const AUDIO_PRESETS = Object.freeze({ quiet: { music: .3, effects: .45 }, balanced: { music: .6, effects: .8 }, bold: { music: .9, effects: 1 } });
    if ('serviceWorker' in navigator) navigator.serviceWorker.register(`${rootPath}service-worker.js`, { scope: rootPath }).catch(() => { /* Installation guidance still works on manual platforms. */ });
    const setupInstallGuide = () => {
        const dismissedKey = 'arcade-install-hint-dismissed';
        const isStandalone = () => window.matchMedia('(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)').matches || navigator.standalone === true;
        const navigatorInfo = () => {
            const userAgent = navigator.userAgent || '';
            const isiPad = /iPad/.test(userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
            const isiOS = isiPad || /iPhone|iPod/.test(userAgent);
            const isAndroid = /Android/.test(userAgent) && !/; wv\)/.test(userAgent);
            const isEdge = /Edg(?:A|iOS)?\//.test(userAgent);
            const isChrome = /(?:Chrome|CriOS)\//.test(userAgent) && !isEdge;
            const isSamsung = /SamsungBrowser\//.test(userAgent);
            const isFirefox = /(?:Firefox|FxiOS)\//.test(userAgent);
            const isSafari = /Safari\//.test(userAgent) && !isChrome && !isEdge && !isFirefox;
            const safariVersion = Number(userAgent.match(/Version\/(\d+)/)?.[1] || 0);
            return { isiPad, isiOS, isAndroid, isEdge, isChrome, isSamsung, isFirefox, isSafari, safariVersion };
        };
        const manualGuide = () => {
            const info = navigatorInfo();
            if (info.isiOS) return {
                label: info.isiPad ? 'Install on this iPad' : 'Install on this iPhone',
                intro: 'Keep the whole arcade one tap away from your Home Screen.',
                steps: ['Open this page in your browser.', 'Tap the Share button in the browser toolbar.', 'Choose “Add to Home Screen.” You may need to scroll the share menu.', 'Tap “Add” to confirm.']
            };
            if (info.isAndroid && (info.isChrome || info.isEdge || info.isSamsung || info.isFirefox)) return {
                label: 'Install on this device',
                intro: 'Add the arcade to your apps for a full-screen launch.',
                steps: ['Open the browser menu (usually ⋮).', 'Choose “Install app” or “Add to Home screen.”', 'Confirm Install or Add.']
            };
            if (info.isSafari && /Macintosh/.test(navigator.userAgent) && info.safariVersion >= 17) return {
                label: 'Add to your Mac',
                intro: 'Launch the arcade from your Dock like any other app.',
                steps: ['Open the File menu in Safari.', 'Choose “Add to Dock.”', 'Confirm the name, then select Add.']
            };
            return null;
        };

        if (!document.querySelector('link[rel="manifest"]')) {
            const manifest = document.createElement('link'); manifest.rel = 'manifest'; manifest.href = `${rootPath}manifest.webmanifest`; document.head.append(manifest);
        }
        const appleMeta = [
            ['apple-mobile-web-app-capable', 'yes'],
            ['apple-mobile-web-app-status-bar-style', 'black-translucent'],
            ['apple-mobile-web-app-title', 'JS Arcade']
        ];
        appleMeta.forEach(([name, content]) => { if (!document.querySelector(`meta[name="${name}"]`)) { const meta = document.createElement('meta'); meta.name = name; meta.content = content; document.head.append(meta); } });

        const hint = document.createElement('aside'); hint.className = 'arcade-install-hint'; hint.hidden = true;
        hint.innerHTML = '<button type="button" class="arcade-install-open"><span aria-hidden="true">＋</span><span><small>Play anywhere</small>Install me</span></button><button type="button" class="arcade-install-dismiss" aria-label="Dismiss install suggestion">×</button>';
        const installDialog = document.createElement('dialog'); installDialog.className = 'arcade-dialog arcade-install-dialog';
        document.body.append(hint, installDialog);
        let installPrompt = null;
        const dismissed = () => { try { return sessionStorage.getItem(dismissedKey) === 'yes'; } catch { return false; } };
        const hide = () => { hint.hidden = true; };
        const updateHint = () => { hint.hidden = isStandalone() || dismissed() || (!installPrompt && !manualGuide()); };
        const renderDialog = () => {
            const guide = installPrompt ? {
                label: 'Install JavaScript Arcade',
                intro: 'Your browser can install the arcade now.',
                steps: ['Select “Install now” below.', 'Confirm Install in your browser.', 'Open JavaScript Arcade from your apps, Home Screen, or Dock.']
            } : manualGuide();
            if (!guide) return false;
            installDialog.innerHTML = `<form method="dialog"><header><div><small>JavaScript Arcade</small><h2>${guide.label}</h2></div><button value="close" aria-label="Close install instructions">×</button></header><p>${guide.intro}</p><ol>${guide.steps.map(step => `<li>${step}</li>`).join('')}</ol><p class="arcade-install-status" role="status" aria-live="polite"></p><div class="arcade-install-actions">${installPrompt ? '<button type="button" class="arcade-install-now">Install now</button>' : ''}<button value="close" class="secondary">${installPrompt ? 'Not now' : 'Got it'}</button></div></form>`;
            installDialog.querySelector('.arcade-install-now')?.addEventListener('click', async event => {
                event.currentTarget.disabled = true;
                const prompt = installPrompt;
                await prompt.prompt();
                const choice = await prompt.userChoice;
                installPrompt = null;
                if (choice.outcome === 'accepted') { hide(); installDialog.close(); return; }
                installDialog.querySelector('.arcade-install-status').textContent = 'Installation was canceled. You can try again from your browser menu.';
                event.currentTarget.remove();
            });
            return true;
        };
        hint.querySelector('.arcade-install-open').addEventListener('click', () => { if (renderDialog()) installDialog.showModal(); });
        hint.querySelector('.arcade-install-dismiss').addEventListener('click', () => { try { sessionStorage.setItem(dismissedKey, 'yes'); } catch { /* Dismiss for this page when storage is unavailable. */ } hide(); });
        window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; updateHint(); });
        window.addEventListener('appinstalled', () => { installPrompt = null; hide(); if (installDialog.open) installDialog.close(); });
        window.matchMedia('(display-mode: standalone)').addEventListener?.('change', updateHint);
        updateHint();
        return () => { if (renderDialog()) installDialog.showModal(); };
    };
    const showInstallGuide = setupInstallGuide();
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
    const audioButton = document.createElement('button'); audioButton.type = 'button'; audioButton.className = 'arcade-audio-button'; audioButton.textContent = 'Sound'; audioButton.setAttribute('aria-haspopup', 'dialog');
    const appearanceDialog = document.createElement('dialog'); appearanceDialog.className = 'arcade-dialog arcade-appearance-dialog';
    appearanceDialog.innerHTML = `<form method="dialog"><header><div><small>Make it yours</small><h2>Appearance & sound</h2></div><button value="close" aria-label="Close appearance and sound settings">×</button></header><p class="arcade-appearance-intro">Choose an experience and color mode${game ? ', then tune the game audio' : ''}. Your choices follow you across the arcade.</p><div class="arcade-theme-grid">${THEMES.map(theme => `<button type="button" data-theme-option="${theme.id}" aria-pressed="false"><span class="arcade-theme-preview preview-${theme.id}" aria-hidden="true"><i></i><i></i><i></i></span><strong>${theme.name}</strong><small>${theme.description}</small></button>`).join('')}</div><fieldset><legend>Color mode</legend><div class="arcade-color-modes" role="radiogroup">${COLOR_PREFERENCES.map(mode => `<button type="button" role="radio" data-color-option="${mode}" aria-checked="false">${mode[0].toUpperCase()}${mode.slice(1)}</button>`).join('')}</div></fieldset>${game ? '<fieldset class="arcade-audio-settings"><legend>Game audio</legend><div class="arcade-audio-levels"><label><span>Music</span><input type="range" min="0" max="1" step="0.05" data-audio-volume="music" aria-label="Music volume"></label><label><span>Effects</span><input type="range" min="0" max="1" step="0.05" data-audio-volume="effects" aria-label="Effects volume"></label></div><p class="arcade-audio-status" role="status" aria-live="polite"></p></fieldset>' : ''}<div class="arcade-appearance-footer"><p class="arcade-appearance-status" role="status" aria-live="polite"></p><button type="button" class="arcade-appearance-reset">Reset defaults</button></div></form>`;
    if (!game) { appearanceDialog.querySelector('h2').textContent = 'Appearance'; appearanceDialog.querySelector('header button').setAttribute('aria-label', 'Close appearance settings'); }
    const audioDialog = audio ? document.createElement('dialog') : null;
    if (audioDialog) {
        audioDialog.className = 'arcade-dialog arcade-audio-dialog';
        audioDialog.innerHTML = `<form method="dialog"><header><div><small>Make it sing</small><h2>Sound mixer</h2></div><button value="close" aria-label="Close sound mixer">×</button></header><p>Choose a starting mix or fine-tune music and action effects independently. Changes apply immediately and follow you across the arcade.</p><div class="arcade-audio-presets" aria-label="Sound presets">${Object.keys(AUDIO_PRESETS).map(name => `<button type="button" data-audio-preset="${name}">${name[0].toUpperCase()}${name.slice(1)}</button>`).join('')}</div><div class="arcade-audio-levels"><label><span>Music <output data-audio-output="music">0%</output></span><input type="range" min="0" max="1" step="0.05" data-audio-volume="music" aria-label="Music volume"></label><label><span>Effects <output data-audio-output="effects">0%</output></span><input type="range" min="0" max="1" step="0.05" data-audio-volume="effects" aria-label="Effects volume"></label></div><div class="arcade-audio-actions"><button type="button" data-audio-mute></button><button type="button" data-audio-preview>Test effects</button><button type="button" data-audio-reset>Reset sound</button></div><p class="arcade-audio-status" role="status" aria-live="polite"></p></form>`;
    }
    const announceAppearance = () => { const theme = THEMES.find(item => item.id === themePreference); appearanceDialog.querySelector('.arcade-appearance-status').textContent = `${theme.name} theme, ${colorPreference} color mode selected.`; };
    const updateAudioControls = () => {
        if (!audio) return;
        const values = audio.preferences();
        audioButton.textContent = values.muted ? 'Sound off' : 'Sound'; audioButton.setAttribute('aria-label', `Open game sound settings${values.muted ? ', currently muted' : ''}`); audioButton.dataset.audioMuted = String(values.muted); audioButton.dataset.audioActivated = String(values.activated); audioButton.disabled = !values.available;
        document.querySelectorAll('[data-audio-volume]').forEach(input => { input.value = values[input.dataset.audioVolume]; input.disabled = !values.available; });
        audioDialog.querySelectorAll('[data-audio-output]').forEach(output => { output.value = `${Math.round(values[output.dataset.audioOutput] * 100)}%`; });
        const mute = audioDialog.querySelector('[data-audio-mute]'); mute.textContent = values.muted ? 'Unmute all' : 'Mute all'; mute.setAttribute('aria-pressed', String(values.muted)); mute.disabled = !values.available;
        document.querySelectorAll('.arcade-audio-status').forEach(status => { status.textContent = values.available ? `${values.muted ? 'Muted · ' : ''}Music ${Math.round(values.music * 100)}% · Effects ${Math.round(values.effects * 100)}%` : 'Web Audio is not supported by this browser.'; });
    };
    appearanceDialog.addEventListener('click', event => { if (event.target.closest('[data-theme-option]')) { setTheme(event.target.closest('[data-theme-option]').dataset.themeOption); announceAppearance(); } if (event.target.dataset.colorOption) { setColorPreference(event.target.dataset.colorOption); announceAppearance(); } if (event.target.classList.contains('arcade-appearance-reset')) { setTheme(config.defaultTheme); setColorPreference('system'); audio?.reset(); announceAppearance(); } });
    appearanceDialog.addEventListener('input', event => { if (event.target.dataset.audioVolume === 'music') audio?.setMusicVolume(event.target.value); if (event.target.dataset.audioVolume === 'effects') audio?.setEffectsVolume(event.target.value); });
    audioDialog?.addEventListener('input', event => { if (audio.preferences().muted) audio.setMuted(false); if (event.target.dataset.audioVolume === 'music') audio.setMusicVolume(event.target.value); if (event.target.dataset.audioVolume === 'effects') audio.setEffectsVolume(event.target.value); audio.activate(); });
    audioDialog?.addEventListener('click', event => {
        if (event.target.dataset.audioMute !== undefined) { const muted = audio.preferences().muted; audio.setMuted(!muted); if (muted) audio.activate(); }
        if (event.target.dataset.audioPreview !== undefined) { if (audio.preferences().muted) audio.setMuted(false); audio.cue('achievement'); }
        if (event.target.dataset.audioReset !== undefined) audio.reset();
        const preset = AUDIO_PRESETS[event.target.dataset.audioPreset];
        if (preset) { if (audio.preferences().muted) audio.setMuted(false); audio.setMusicVolume(preset.music); audio.setEffectsVolume(preset.effects); audio.activate(); }
    });
    appearanceDialog.querySelector('.arcade-color-modes').addEventListener('keydown', event => { if (!['ArrowLeft','ArrowRight'].includes(event.key)) return; event.preventDefault(); const offset=event.key==='ArrowRight'?1:-1; const next=COLOR_PREFERENCES[(COLOR_PREFERENCES.indexOf(colorPreference)+offset+COLOR_PREFERENCES.length)%COLOR_PREFERENCES.length]; setColorPreference(next); appearanceDialog.querySelector(`[data-color-option="${next}"]`).focus(); announceAppearance(); });
    appearanceButton.addEventListener('click', () => { applyTheme(); updateAudioControls(); appearanceDialog.showModal(); });
    audioButton.addEventListener('click', () => { updateAudioControls(); audioDialog.showModal(); audio.activate(); });
    events.on('audio:preferences-changed', updateAudioControls);
    const dialog = document.createElement('dialog'); dialog.className = 'arcade-dialog';
    dialog.innerHTML = `<form class="arcade-auth" method="dialog"><h2>Arcade account</h2><p>Use one gamertag to save play history and scores across every game.</p><label>Gamertag<input name="gamertag" minlength="3" maxlength="24" pattern="[A-Za-z0-9_-]+" autocomplete="username" required></label><label>Passcode<input name="passcode" type="password" minlength="4" maxlength="128" autocomplete="current-password" required></label><p class="arcade-auth-message" role="status"></p><div class="arcade-auth-actions"><button value="login">Sign in</button><button value="register" class="secondary">Create account</button><button value="cancel" class="secondary" formnovalidate>Cancel</button></div></form>`;
    const buildVersion = document.createElement('footer');
    buildVersion.className = 'arcade-build-version';
    const buildVersionButton = document.createElement('button');
    buildVersionButton.type = 'button'; buildVersionButton.textContent = 'Build …'; buildVersionButton.setAttribute('aria-haspopup', 'dialog');
    buildVersion.append(buildVersionButton);
    const releaseDialog = document.createElement('dialog'); releaseDialog.className = 'arcade-dialog arcade-release-dialog';
    releaseDialog.innerHTML = '<form method="dialog"><header><div><small>JavaScript Arcade</small><h2>Build details</h2></div><button value="close" aria-label="Close release notes">×</button></header><p class="arcade-release-summary"></p><div class="arcade-release-sections"></div><div class="arcade-release-actions"><button value="close">Got it</button></div></form>';
    const showReleaseDialog = () => { if (!releaseDialog.open) releaseDialog.showModal(); };
    const renderBuildInformation = result => {
        const channel = ['stable', 'alpha', 'dev'].includes(result.channel) ? result.channel : 'dev';
        buildVersionButton.textContent = channel === 'stable' ? `Version ${result.version}` : channel === 'alpha' ? `Alpha · ${result.version}` : 'Development build';
        const release = channel === 'stable' && result.release?.version === result.version ? result.release : null;
        const heading = releaseDialog.querySelector('h2'), summary = releaseDialog.querySelector('.arcade-release-summary'), sections = releaseDialog.querySelector('.arcade-release-sections');
        sections.replaceChildren();
        if (release) {
            heading.textContent = release.title; summary.textContent = release.summary;
            for (const [label, items] of [['Highlights', release.highlights], ['Fixes', release.fixes]]) {
                if (!Array.isArray(items) || !items.length) continue;
                const section = document.createElement('section'), title = document.createElement('h3'), list = document.createElement('ul');
                title.textContent = label;
                items.forEach(item => { const entry = document.createElement('li'); entry.textContent = item; list.append(entry); });
                section.append(title, list); sections.append(section);
            }
        } else {
            heading.textContent = channel === 'alpha' ? 'Alpha build' : channel === 'stable' ? 'Stable build' : 'Development build';
            summary.textContent = channel === 'alpha' ? `${result.version} follows the newest changes on master. Automatic release notes appear only for stable releases.` : channel === 'stable' ? `Version ${result.version} does not have bundled release notes.` : 'This local build does not have published release notes.';
        }
        buildVersionButton.addEventListener('click', showReleaseDialog);
        if (!release) return;
        const seenKey = 'arcade:last-seen-release';
        let seen = false;
        try { seen = localStorage.getItem(seenKey) === release.version; } catch { /* Show once in this page when storage is unavailable. */ }
        if (!seen && !document.querySelector('dialog[open]')) {
            showReleaseDialog();
            try { localStorage.setItem(seenKey, release.version); } catch { /* The dialog remains available from the footer. */ }
        }
    };
    document.body.classList.add('arcade-has-topbar');
    document.body.prepend(topbar);
    document.body.append(dialog, appearanceDialog, ...(audioDialog ? [audioDialog] : []), releaseDialog, buildVersion);
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
        publish(notification.type === 'achievement' ? 'achievement:unlocked' : 'score:top', notification.detail);
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
    const notifyResult = result => {
        if (!result || typeof result !== 'object') return result;
        showTopScore(result.topScore);
        showUnlocks(Array.isArray(result.unlocked) ? result.unlocked : []);
        return result;
    };
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
    api('/api/version').then(renderBuildInformation).catch(() => { buildVersion.hidden = true; });
    const render = () => {
        account.replaceChildren();
        account.append(appearanceButton);
        if (game && audio) { updateAudioControls(); account.append(audioButton); }
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
        publish('account:user-changed', { user: currentUser });
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
        record: async result => { if (!currentUser) return null; return notifyResult(await api('/api/results', { method: 'POST', body: JSON.stringify(result) })); },
        achievements: loadAchievements,
        notifyAchievements: showUnlocks,
        notifyResult,
        api,
        install: showInstallGuide,
        appearance: () => ({ theme: themePreference, colorPreference, resolvedColorMode: document.documentElement.dataset.colorMode }),
        theme: () => ({ theme: themePreference, preference: colorPreference, resolved: document.documentElement.dataset.colorMode }),
        setTheme,
        setColorPreference
    };
    api('/api/me').then(result => { currentUser = result.user; render(); }).catch(render);
})();
