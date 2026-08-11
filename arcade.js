(() => {
    'use strict';
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
    const dialog = document.createElement('dialog'); dialog.className = 'arcade-dialog';
    dialog.innerHTML = `<form class="arcade-auth" method="dialog"><h2>Arcade account</h2><p>Use one gamertag to save play history and scores across every game.</p><label>Gamertag<input name="gamertag" minlength="3" maxlength="24" pattern="[A-Za-z0-9_-]+" autocomplete="username" required></label><label>Passcode<input name="passcode" type="password" minlength="4" maxlength="128" autocomplete="current-password" required></label><p class="arcade-auth-message" role="status"></p><div class="arcade-auth-actions"><button value="login">Sign in</button><button value="register" class="secondary">Create account</button><button value="cancel" class="secondary">Cancel</button></div></form>`;
    document.body.append(account, dialog);
    const render = () => {
        account.replaceChildren();
        const scores = document.createElement('a'); scores.href = `${rootPath}profile.html#leaderboards`; scores.textContent = 'Top scores'; account.append(scores);
        if (currentUser) {
            const profile = document.createElement('a'); profile.href = `${rootPath}profile.html`; profile.textContent = currentUser.gamertag;
            const logout = document.createElement('button'); logout.type = 'button'; logout.textContent = 'Sign out'; logout.addEventListener('click', async () => { await api('/api/auth/logout', { method: 'POST', body: '{}' }); currentUser = null; render(); });
            account.append(profile, logout);
        } else {
            const signIn = document.createElement('button'); signIn.type = 'button'; signIn.textContent = 'Sign in'; signIn.addEventListener('click', () => dialog.showModal()); account.append(signIn);
        }
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
        api
    };
    api('/api/me').then(result => { currentUser = result.user; render(); }).catch(render);
})();
