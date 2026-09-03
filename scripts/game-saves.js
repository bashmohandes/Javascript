(() => {
    'use strict';

    const formatTime = total => {
        const seconds = Math.max(0, Number(total) || 0), hours = Math.floor(seconds / 3600), minutes = Math.floor(seconds % 3600 / 60), rest = Math.floor(seconds % 60);
        return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}` : `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
    };
    const blobData = blob => new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.onerror = () => reject(new Error('Could not read the save screenshot.'));
        reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.readAsDataURL(blob);
    });
    const canvasBlob = canvas => new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not create the save screenshot.')), 'image/jpeg', .78));
    async function screenshot(canvas) {
        if (!(canvas instanceof HTMLCanvasElement)) throw new Error('This game could not create a save screenshot.');
        const output = document.createElement('canvas'); output.width = 480; output.height = 270;
        const context = output.getContext('2d'), scale = Math.min(output.width / canvas.width, output.height / canvas.height), width = canvas.width * scale, height = canvas.height * scale;
        context.fillStyle = '#101827'; context.fillRect(0, 0, output.width, output.height); context.drawImage(canvas, (output.width - width) / 2, (output.height - height) / 2, width, height);
        const blob = await canvasBlob(output);
        return { mimeType: blob.type, data: await blobData(blob) };
    }
    function makeCanvas(draw) {
        const canvas = document.createElement('canvas'); canvas.width = 480; canvas.height = 270;
        const context = canvas.getContext('2d'); context.fillStyle = '#101827'; context.fillRect(0, 0, 480, 270); draw(context, canvas);
        return canvas;
    }
    function create({ game, api, user, signIn }) {
        let adapter = null, activeSave = null, dirty = false, saving = false, saves = [], replacing = false, exitAfterSave = null, dialogPause = null, leavePause = null, accountId = user()?.id ?? null;
        const button = document.createElement('button'); button.type = 'button'; button.className = 'arcade-saves-button'; button.textContent = 'Saves'; button.setAttribute('aria-haspopup', 'dialog');
        const dialog = document.createElement('dialog'); dialog.className = 'arcade-dialog arcade-saves-dialog';
        dialog.innerHTML = `<div class="arcade-saves-content"><header><div><small>Continue anywhere</small><h2>Game saves</h2></div><button type="button" data-save-close aria-label="Close game saves">×</button></header><div class="arcade-save-create"><label>Optional title<input maxlength="60" data-save-title placeholder="My run"></label><button type="button" data-save-current>Save current game</button></div><p class="arcade-save-status" role="status" aria-live="polite"></p><div class="arcade-save-slots"></div></div>`;
        const leaveDialog = document.createElement('dialog'); leaveDialog.className = 'arcade-dialog arcade-leave-dialog';
        leaveDialog.innerHTML = `<div><small>Unfinished game</small><h2>Save before leaving?</h2><p>Your latest progress has not been saved.</p><p class="arcade-leave-status" role="status" aria-live="polite"></p><div><button type="button" data-leave-stay>Stay</button><button type="button" class="secondary" data-leave-exit>Exit without saving</button><button type="button" data-leave-save>Quick Save &amp; Exit</button></div></div>`;
        document.body.append(dialog, leaveDialog);
        const status = message => { dialog.querySelector('.arcade-save-status').textContent = message || ''; };
        const eligible = () => Boolean(adapter?.canSave?.());
        const hasProgress = () => Boolean(adapter?.hasProgress?.());
        const shouldWarn = () => eligible() && hasProgress() && dirty;
        const observeProgress = event => {
            const namespace = window.ArcadeEvents?.game;
            if (!namespace || event.game !== namespace || !eligible() || !hasProgress()) return;
            if (event.type === 'game:started' || event.type === 'game:progressed' || event.type.startsWith(`${namespace}:`)) dirty = true;
        };
        async function authenticated() {
            if (user()) return true;
            return Boolean(await signIn('Save your progress and continue from any signed-in device.'));
        }
        function pauseFor(owner) {
            if (!adapter?.pause) return null;
            try { return adapter.pause(owner); } catch { return null; }
        }
        function resumeFrom(token) { if (token !== null && adapter?.resume) { try { adapter.resume(token); } catch { /* Keep the restored state usable. */ } } }
        function slotCard(slot, save) {
            const card = document.createElement('article'); card.className = `arcade-save-slot${activeSave?.slot === slot ? ' is-active' : ''}`;
            const preview = document.createElement('div'); preview.className = 'arcade-save-preview';
            if (save) { const image = document.createElement('img'); image.src = save.screenshotUrl; image.alt = `Screenshot for ${save.title || `slot ${slot}`}`; preview.append(image); }
            else preview.innerHTML = '<span aria-hidden="true">＋</span>';
            const details = document.createElement('div'), heading = document.createElement('h3'); heading.textContent = save?.title || `Slot ${slot}`;
            const meta = document.createElement('p');
            if (save) meta.textContent = `${new Date(save.updatedAt).toLocaleString()} · ${formatTime(save.elapsedSeconds)}${save.scoreLabel ? ` · ${save.scoreLabel}` : ''}`;
            else meta.textContent = 'Empty slot';
            details.append(heading, meta);
            if (save?.mode) { const mode = document.createElement('small'); mode.textContent = save.mode.replaceAll('-', ' '); details.append(mode); }
            const actions = document.createElement('div'); actions.className = 'arcade-save-slot-actions';
            if (save) {
                const load = document.createElement('button'); load.type = 'button'; load.textContent = 'Load'; load.disabled = saving; load.addEventListener('click', () => loadSave(save)); actions.append(load);
                if (replacing && !activeSave) { const replace = document.createElement('button'); replace.type = 'button'; replace.textContent = 'Replace'; replace.disabled = saving; replace.addEventListener('click', () => saveCurrent(save)); actions.append(replace); }
                const rename = document.createElement('button'); rename.type = 'button'; rename.className = 'secondary'; rename.textContent = 'Rename'; rename.disabled = saving; rename.addEventListener('click', () => renameSave(save));
                const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'secondary'; remove.textContent = 'Delete'; remove.disabled = saving; remove.addEventListener('click', () => deleteSave(save)); actions.append(rename, remove);
            }
            card.append(preview, details, actions); return card;
        }
        function renderSlots() {
            const bySlot = new Map(saves.map(save => [save.slot, save]));
            dialog.querySelector('.arcade-save-slots').replaceChildren(...[1,2,3,4,5].map(slot => slotCard(slot, bySlot.get(slot))));
            const saveButton = dialog.querySelector('[data-save-current]'); saveButton.disabled = saving || !eligible() || !hasProgress();
            saveButton.textContent = saving ? 'Saving…' : activeSave ? `Save to slot ${activeSave.slot}` : 'Save current game';
        }
        async function refresh() {
            const result = await api(`/api/saves/${game}`); saves = result.saves; renderSlots();
        }
        async function capture(title) {
            const captured = await adapter.capture();
            return { title, mode: captured.mode, stateVersion: adapter.stateVersion, state: captured.state, elapsedSeconds: captured.elapsedSeconds, scoreLabel: captured.scoreLabel || null, screenshot: await screenshot(await adapter.thumbnail(captured)) };
        }
        async function navigateAfterSave() {
            const destination = exitAfterSave; exitAfterSave = null;
            if (destination) { dirty = false; location.assign(destination); }
        }
        async function saveCurrent(replace = null) {
            if (saving) return null;
            if (!eligible() || !hasProgress()) { status('Start an eligible local game before saving.'); return null; }
            saving = true; renderSlots();
            try {
                if (!await authenticated()) return null;
                status('Saving…');
                const title = dialog.querySelector('[data-save-title]').value.trim() || activeSave?.title || replace?.title || '';
                const body = await capture(title);
                let result;
                if (activeSave) result = await api(`/api/saves/${game}/${activeSave.slot}`, { method: 'PUT', body: JSON.stringify({ ...body, expectedRevision: activeSave.revision }) });
                else if (replace) result = await api(`/api/saves/${game}/${replace.slot}`, { method: 'PUT', body: JSON.stringify({ ...body, expectedRevision: replace.revision }) });
                else result = await api(`/api/saves/${game}`, { method: 'POST', body: JSON.stringify(body) });
                activeSave = result.save; dirty = false; replacing = false; dialog.querySelector('[data-save-title]').value = activeSave.title || '';
                await refresh(); status(`Saved to slot ${activeSave.slot}.`); await navigateAfterSave(); return activeSave;
            } catch (error) {
                if (error.code === 'SAVE_SLOTS_FULL') { replacing = true; await refresh(); status('All five slots are full. Choose one to replace.'); }
                else if (error.code === 'SAVE_CONFLICT') { activeSave = error.current; await refresh(); status('That slot changed on another device. Review it before saving again.'); }
                else status(error.message);
                return null;
            } finally { saving = false; renderSlots(); }
        }
        async function loadSave(save) {
            if (shouldWarn() && !window.confirm('Load this save and discard your unsaved progress?')) return;
            status('Loading…');
            try {
                const result = await api(`/api/saves/${game}/${save.slot}`);
                if (result.save.stateVersion !== adapter.stateVersion) throw new Error('This save was created by an incompatible game version.');
                await adapter.restore(result.save.state, result.save);
                activeSave = result.save; dirty = false; dialogPause = null; dialog.close();
            } catch (error) { status(error.message); }
        }
        async function renameSave(save) {
            const title = window.prompt('Save title (leave blank to use the slot number):', save.title || '');
            if (title === null) return;
            try {
                const result = await api(`/api/saves/${game}/${save.slot}`, { method: 'PATCH', body: JSON.stringify({ title, expectedRevision: save.revision }) });
                if (activeSave?.slot === save.slot) { activeSave = result.save; dialog.querySelector('[data-save-title]').value = activeSave.title || ''; }
                await refresh(); status('Title updated.');
            }
            catch (error) { status(error.message); }
        }
        async function deleteSave(save) {
            if (!window.confirm(`Delete ${save.title || `slot ${save.slot}`}? This cannot be undone.`)) return;
            try {
                await api(`/api/saves/${game}/${save.slot}`, { method: 'DELETE', body: JSON.stringify({ expectedRevision: save.revision }) });
                if (activeSave?.slot === save.slot) activeSave = null; await refresh(); status('Save deleted.');
            } catch (error) { status(error.message); }
        }
        async function open() {
            const token = pauseFor('saves');
            if (!await authenticated()) { resumeFrom(token); return; }
            dialogPause = token; status('Loading saves…'); dialog.showModal();
            try { await refresh(); status(eligible() ? '' : 'Cloud saves are available during solo and local games.'); }
            catch (error) { status(error.message); }
        }
        function closeManager() { dialog.close(); }
        dialog.querySelector('[data-save-close]').addEventListener('click', closeManager);
        dialog.querySelector('[data-save-current]').addEventListener('click', () => saveCurrent());
        dialog.addEventListener('close', () => { const token = dialogPause; dialogPause = null; resumeFrom(token); replacing = false; });
        button.addEventListener('click', open);
        function showLeave(destination) { exitAfterSave = destination; leavePause = pauseFor('leave'); leaveDialog.querySelector('.arcade-leave-status').textContent = ''; leaveDialog.showModal(); }
        leaveDialog.querySelector('[data-leave-stay]').addEventListener('click', () => { exitAfterSave = null; leaveDialog.close(); });
        leaveDialog.querySelector('[data-leave-exit]').addEventListener('click', () => { const destination = exitAfterSave; dirty = false; leaveDialog.close(); if (destination) location.assign(destination); });
        leaveDialog.querySelector('[data-leave-save]').addEventListener('click', async () => {
            leaveDialog.querySelector('.arcade-leave-status').textContent = 'Preparing your save…';
            const token = leavePause; leavePause = null; leaveDialog.close();
            if (!await authenticated()) { exitAfterSave = null; resumeFrom(token); return; }
            if (!dialog.open) { dialogPause = token; dialog.showModal(); try { await refresh(); } catch { /* The save action reports the useful error. */ } }
            await saveCurrent();
        });
        leaveDialog.addEventListener('close', () => { const token = leavePause; leavePause = null; resumeFrom(token); });
        document.addEventListener('click', event => {
            const link = event.target.closest?.('a[href]');
            if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target || link.download || !shouldWarn()) return;
            const destination = new URL(link.href, location.href);
            if (destination.origin !== location.origin || destination.href === location.href || (destination.pathname === location.pathname && destination.search === location.search && destination.hash)) return;
            event.preventDefault(); showLeave(destination.href);
        }, true);
        window.addEventListener('beforeunload', event => { if (shouldWarn()) { event.preventDefault(); event.returnValue = ''; } });
        async function completeRun() {
            const completed = activeSave; activeSave = null; dirty = false;
            if (!completed || !user()) return;
            try { await api(`/api/saves/${game}/${completed.slot}`, { method: 'DELETE', body: JSON.stringify({ expectedRevision: completed.revision }) }); }
            catch { /* Completion and result recording must not depend on cleanup connectivity. */ }
        }
        window.ArcadeEvents?.on('game:completed', completeRun);
        window.ArcadeEvents?.on('*', observeProgress);
        window.ArcadeEvents?.on('account:user-changed', event => {
            const nextAccountId = event.detail.user?.id ?? null;
            if (nextAccountId === accountId) return;
            accountId = nextAccountId; activeSave = null; saves = []; replacing = false;
            dialog.querySelector('[data-save-title]').value = ''; renderSlots();
        });
        return {
            button,
            registerAdapter(value) { adapter = value; renderSlots(); },
            startRun() { activeSave = null; dirty = false; },
            completeRun,
            open, save: saveCurrent, active: () => activeSave, isDirty: () => dirty,
            helpers: { makeCanvas, formatTime }
        };
    }
    window.ArcadeSaveManager = { create };
})();
