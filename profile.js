(() => {
    'use strict';
    const labels = { pong: 'Pong', sudoku: 'Sudoku', minesweeper: 'Minesweeper' };
    const profileForm = document.querySelector('#profile-form');
    const currentPasscode = document.createElement('input');
    currentPasscode.name = 'currentPasscode'; currentPasscode.type = 'password'; currentPasscode.minLength = 4; currentPasscode.maxLength = 128; currentPasscode.required = true; currentPasscode.placeholder = 'Current passcode'; currentPasscode.autocomplete = 'current-password'; currentPasscode.setAttribute('aria-label', 'Current passcode');
    profileForm.insertBefore(currentPasscode, profileForm.elements.passcode);
    profileForm.elements.passcode.autocomplete = 'new-password';
    const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[character]);
    const formatDuration = seconds => {
        const total = Number(seconds), hours = Math.floor(total / 3600), minutes = Math.floor(total % 3600 / 60), remainder = total % 60;
        return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}` : `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
    };
    const detailLabels = { difficulty: 'Difficulty', mode: 'Mode', score: 'Result', mistakes: 'Mistakes', hintsUsed: 'Hints', seconds: 'Time' };
    const duration = row => Number.isFinite(Number(row.details?.seconds)) ? formatDuration(row.details.seconds) : '—';
    const details = row => Object.entries(row.details || {}).filter(([key]) => key !== 'seconds').map(([key, value]) => `${detailLabels[key] || key}: ${value}`).join(' · ') || '—';
    async function loadProfile(user, page = 1) {
        document.querySelector('#account-panel').hidden = !user; document.querySelector('#stats-panel').hidden = !user;
        if (!user) return;
        const profile = await Arcade.api(`/api/profile?page=${page}&pageSize=10`);
        document.querySelector('#profile-title').textContent = profile.user.gamertag;
        document.querySelector('#profile-note').textContent = `Member since ${new Date(profile.user.createdAt + 'Z').toLocaleDateString()}`;
        document.querySelector('#profile-form').gamertag.value = profile.user.gamertag;
        const byGame = Object.fromEntries(profile.totals.map(item => [item.game, item]));
        document.querySelector('#stats').innerHTML = Object.keys(labels).map(game => { const row = byGame[game] || {}; return `<div class="stat"><span class="stat-game">${labels[game]}</span><div class="stat-metrics"><div><strong>${row.games_played || 0}</strong><small>Played</small></div><div><strong>${row.wins || 0}</strong><small>Wins</small></div><div><strong>${row.best_score ?? '—'}</strong><small>Best</small></div></div></div>`; }).join('');
        document.querySelector('#history').innerHTML = profile.recent.length ? profile.recent.map(row => `<tr><td>${labels[row.game]}</td><td>${row.won ? 'Win' : 'Played'}</td><td>${row.score}</td><td>${duration(row)}</td><td>${new Date(row.played_at + 'Z').toLocaleString()}</td></tr>`).join('') : '<tr><td colspan="5" class="empty">Play a game to begin your history.</td></tr>';
        const pagination = document.querySelector('#history-pagination');
        pagination.hidden = profile.pagination.totalPages <= 1;
        pagination.dataset.page = profile.pagination.page;
        document.querySelector('#history-page').textContent = `Page ${profile.pagination.page} of ${profile.pagination.totalPages}`;
        pagination.querySelector('[data-page-action="previous"]').disabled = profile.pagination.page === 1;
        pagination.querySelector('[data-page-action="next"]').disabled = profile.pagination.page === profile.pagination.totalPages;
    }
    async function loadLeaders(game) {
        const result = await Arcade.api(`/api/leaderboards/${game}`);
        document.querySelector('#leaders').innerHTML = result.entries.length ? result.entries.map((row, index) => `<tr><td>${index + 1}</td><td>${escape(row.gamertag)}</td><td>${row.score}</td><td>${duration(row)}</td><td>${escape(details(row))}</td></tr>`).join('') : '<tr><td colspan="5" class="empty">No scores yet. Be the first.</td></tr>';
    }
    document.addEventListener('arcade:user', event => loadProfile(event.detail).catch(() => {}));
    document.querySelector('#game-tabs').addEventListener('click', event => { if (!event.target.dataset.game) return; document.querySelectorAll('#game-tabs button').forEach(button => button.setAttribute('aria-pressed', button === event.target)); loadLeaders(event.target.dataset.game); });
    document.querySelector('#history-pagination').addEventListener('click', event => {
        const action = event.target.dataset.pageAction;
        if (!action) return;
        const currentPage = Number(event.currentTarget.dataset.page);
        loadProfile(true, currentPage + (action === 'next' ? 1 : -1));
    });
    profileForm.addEventListener('submit', async event => { event.preventDefault(); const message = document.querySelector('#profile-message'); try { await Arcade.api('/api/profile', { method:'PATCH', body:JSON.stringify(Object.fromEntries(new FormData(event.target))) }); message.textContent = 'Profile updated. Refreshing…'; location.reload(); } catch (error) { message.textContent = error.message; } });
    loadLeaders('pong');
})();
