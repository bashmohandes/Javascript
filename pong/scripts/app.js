const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const scoreLeft = document.querySelector('#score-left');
const scoreRight = document.querySelector('#score-right');
const arenaScoreLeft = document.querySelector('#arena-score-left');
const arenaScoreRight = document.querySelector('#arena-score-right');
const arena = document.querySelector('#arena');
const fullscreenButton = document.querySelector('#fullscreen');
const status = document.querySelector('#status');
const overlay = document.querySelector('#arena-message');
const overlayTitle = overlay.querySelector('strong');
const overlayHint = overlay.querySelector('span');
const onlinePanel = document.querySelector('#online-panel');
const onlineLobby = document.querySelector('#online-lobby');
const onlineRoom = document.querySelector('#online-room');
const connectionState = document.querySelector('#connection-state');
const readyOnlineButton = document.querySelector('#ready-online');
const roomList = document.querySelector('#room-list');

const game = {
    width: 960, height: 600, running: false, paused: false, over: false, mode: 'solo',
    last: 0, serve: 1, score: [0, 0], keys: new Set(), nextPowerUp: 5, elapsed: 0,
    lastTouch: 0, powerUps: [], effects: [{}, {}], pointerControls: new Map()
};
const paddles = [
    { x: 34, y: 240, w: 14, h: 120, baseH: 120, vy: 0, color: '#fffdf8' },
    { x: 912, y: 240, w: 14, h: 120, baseH: 120, vy: 0, color: '#d76b45' }
];
const paddleColors = [{name:'Cream',value:'#fffdf8'},{name:'Terracotta',value:'#d76b45'},{name:'Apricot',value:'#e8a15b'},{name:'Goldenrod',value:'#e7ca67'},{name:'Sage',value:'#a9c181'},{name:'Eucalyptus',value:'#70ad98'},{name:'Sea glass',value:'#71a7a0'},{name:'Dusty blue',value:'#75a4c7'},{name:'Periwinkle',value:'#8f91bd'},{name:'Mauve',value:'#b58ab4'},{name:'Rose',value:'#cc8290'},{name:'Walnut',value:'#9b7865'}];
const powerUpTypes = {
    reach: { name: 'Long Reach', icon: '↕', color: '#a9c181', collection: 'paddle' },
    quick: { name: 'Quick Step', icon: '»', color: '#d76b45', collection: 'paddle' },
    curve: { name: 'Curve Shot', icon: '↝', color: '#b58ab4', collection: 'paddle' },
    slow: { name: 'Slow Field', icon: '◷', color: '#75a4c7', collection: 'paddle' },
    burst: { name: 'Velocity Burst', icon: '✦', color: '#e7ca67', collection: 'ball' },
    split: { name: 'Split Ball', icon: '●●', color: '#cc8290', collection: 'ball' }
};
let balls = [];
const online = { socket: null, roomCode: '', token: '', side: 0, connected: false, lastSequence: 0, reconnectTimer: null, intentionalClose: false };

function setConnection(label, state = 'offline') { connectionState.textContent = label; connectionState.dataset.state = state; }
function sendOnline(message) { if (online.socket?.readyState === WebSocket.OPEN) online.socket.send(JSON.stringify(message)); }
function saveSession() { sessionStorage.setItem('pong-online-session', JSON.stringify({ roomCode: online.roomCode, token: online.token })); }
function clearSession() { sessionStorage.removeItem('pong-online-session'); online.roomCode = ''; online.token = ''; }
function showOnlineRoom(code) { onlineLobby.hidden = true; onlineRoom.hidden = false; document.querySelector('#room-code-display').textContent = code; }
function updateOnlineIdentity() {
    const sideName = online.side === 0 ? 'Left' : 'Right';
    const sideCard = document.querySelector('#player-side');
    sideCard.dataset.side = sideName.toLowerCase();
    sideCard.querySelector('strong').textContent = `${sideName} side`;
    document.querySelectorAll('.player-color').forEach((picker, side) => {
        const ownPaddle = side === online.side;
        picker.querySelector('span').textContent = ownPaddle ? `You (${sideName})` : `Opponent (${side ? 'Right' : 'Left'})`;
        picker.toggleAttribute('aria-disabled', !ownPaddle);
        picker.querySelector('.color-trigger').disabled = !ownPaddle;
    });
}
function resetColorControls() {
    document.querySelectorAll('.player-color').forEach((picker, side) => {
        picker.querySelector('span').textContent = side ? 'Right' : 'Left';
        picker.removeAttribute('aria-disabled');
        picker.querySelector('.color-trigger').disabled = false;
    });
}
async function refreshRooms() {
    roomList.innerHTML = '<p>Loading available rooms…</p>';
    try {
        const response = await fetch('/api/rooms', { cache: 'no-store' });
        if (!response.ok) throw new Error('Unable to load rooms.');
        const { rooms } = await response.json();
        roomList.replaceChildren();
        if (!rooms.length) { roomList.innerHTML = '<p>No public rooms yet. Create one and be the first to play.</p>'; return; }
        rooms.forEach(room => {
            const item = document.createElement('div'); item.className = 'public-room';
            const details = document.createElement('div'); const code = document.createElement('strong'); code.textContent = room.code;
            const players = document.createElement('span'); players.textContent = `${room.players}/2 players · Waiting`;
            const join = document.createElement('button'); join.type = 'button'; join.className = 'secondary-button'; join.textContent = 'Join';
            join.addEventListener('click', () => connectOnline({ type: 'join-room', roomCode: room.code }));
            details.append(code, players); item.append(details, join); roomList.append(item);
        });
    } catch (error) { roomList.innerHTML = `<p>${error.message}</p>`; }
}
function applyOnlineState(state) {
    game.running = state.running; game.paused = state.paused; game.over = state.over; game.elapsed = state.elapsed; game.score = state.score;
    setScore(0, state.score[0]); setScore(1, state.score[1]);
    state.paddles.forEach((paddle, side) => Object.assign(paddles[side], paddle));
    balls = state.balls.map(ball => ({ ...ball })); game.powerUps = state.powerUps.map(powerUp => ({ ...powerUp }));
    if (state.over) { const won = state.winner === online.side; status.textContent = won ? 'You won the online match!' : 'Your opponent won the online match.'; showOverlay(won ? 'You win!' : 'Opponent wins', 'Choose rematch when you are ready'); readyOnlineButton.textContent = 'Ready for rematch'; }
    else if (state.running && !state.paused) overlay.hidden = true;
}
function handleOnlineMessage(message) {
    if (message.type === 'session') {
        online.roomCode = message.roomCode; online.token = message.playerToken; online.side = message.side; saveSession(); showOnlineRoom(message.roomCode); updateOnlineIdentity(); setConnection('Connected', 'online');
        document.querySelector('#room-visibility-display').textContent = message.visibility === 'public' ? 'Public room' : 'Private room';
        const url = new URL(location.href); url.searchParams.set('room', message.roomCode); history.replaceState(null, '', url); status.textContent = message.side === 0 ? 'Room created. Share the invite and wait for your opponent.' : 'Joined room. Press “I’m ready” when set.';
    } else if (message.type === 'room-status') {
        const opponentConnected = message.players[1 - online.side];
        status.textContent = opponentConnected ? 'Opponent connected. Both players can ready up.' : 'Waiting for your opponent to join…';
    } else if (message.type === 'match-started') { readyOnlineButton.disabled = false; readyOnlineButton.textContent = 'Ready for rematch'; status.textContent = 'First to 7. The match is live!'; }
    else if (message.type === 'waiting-ready') { readyOnlineButton.disabled = true; readyOnlineButton.textContent = 'Waiting…'; status.textContent = 'Ready. Waiting for your opponent.'; }
    else if (message.type === 'state' && message.sequence > online.lastSequence) { online.lastSequence = message.sequence; applyOnlineState(message.state); }
    else if (message.type === 'peer-left') { setConnection('Reconnecting…', 'connecting'); status.textContent = `Opponent disconnected. Holding the match for ${Math.round(message.reconnectMs / 1000)} seconds.`; showOverlay('Opponent disconnected', 'The match will resume if they reconnect'); }
    else if (message.type === 'peer-reconnected') { setConnection('Connected', 'online'); status.textContent = 'Opponent reconnected. Match resumed.'; overlay.hidden = true; }
    else if (message.type === 'room-closed') { status.textContent = message.reason; leaveOnline(false); }
    else if (message.type === 'error') { status.textContent = message.message; setConnection('Error', 'offline'); }
}
function connectOnline(action) {
    if (online.socket && online.socket.readyState < WebSocket.CLOSING) online.socket.close();
    online.intentionalClose = false; setConnection('Connecting…', 'connecting');
    const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${scheme}//${location.host}/ws`); online.socket = socket;
    socket.addEventListener('open', () => { online.connected = true; sendOnline(action); });
    socket.addEventListener('message', event => { try { handleOnlineMessage(JSON.parse(event.data)); } catch { status.textContent = 'Received an invalid server update.'; } });
    socket.addEventListener('close', () => {
        if (socket !== online.socket) return;
        online.connected = false;
        if (online.intentionalClose || game.mode !== 'online') { setConnection('Offline'); return; }
        setConnection('Reconnecting…', 'connecting');
        if (online.roomCode && online.token) online.reconnectTimer = setTimeout(() => connectOnline({ type: 'resume', roomCode: online.roomCode, playerToken: online.token }), 1000);
        else setConnection('Offline');
    });
}
function leaveOnline(notify = true) {
    clearTimeout(online.reconnectTimer); if (notify) sendOnline({ type: 'leave' }); online.intentionalClose = true; online.socket?.close(); clearSession();
    onlineLobby.hidden = false; onlineRoom.hidden = true; resetColorControls(); setConnection('Offline'); refreshRooms(); const url = new URL(location.href); url.searchParams.delete('room'); history.replaceState(null, '', url);
}
function onlineInput() { sendOnline({ type: 'input', up: game.keys.has('KeyW') || game.keys.has('ArrowUp'), down: game.keys.has('KeyS') || game.keys.has('ArrowDown'), targetY: null }); }

function makeBall(x = game.width / 2, y = game.height / 2, vx = 0, vy = 0) { return { x, y, r: 10, vx, vy }; }
function resize() { const ratio = Math.min(window.devicePixelRatio || 1, 2); canvas.width = game.width * ratio; canvas.height = game.height * ratio; ctx.setTransform(ratio, 0, 0, ratio, 0, 0); draw(); }
function resetBall(direction = game.serve) { balls = [makeBall()]; game.serve = direction; }
function launch() { const angle = (Math.random() * .8) - .4; balls[0].vx = game.serve * 410 * Math.cos(angle); balls[0].vy = 410 * Math.sin(angle); game.serve *= -1; }
function setScore(side, value) { (side ? scoreRight : scoreLeft).textContent = value; (side ? arenaScoreRight : arenaScoreLeft).textContent = value; }
function clearPowerUps() { game.powerUps = []; game.effects = [{}, {}]; paddles.forEach(paddle => paddle.h = paddle.baseH); }
function schedulePowerUp(first = false) { game.nextPowerUp = game.elapsed + (first ? 5 : 8 + Math.random() * 6); }
function newGame() {
    game.score = [0, 0]; game.over = false; game.elapsed = 0; game.lastTouch = 0; setScore(0, 0); setScore(1, 0);
    paddles.forEach(paddle => { paddle.y = 240; paddle.h = paddle.baseH; }); clearPowerUps(); schedulePowerUp(true);
    resetBall(Math.random() < .5 ? -1 : 1); game.running = true; game.paused = false; overlay.hidden = true;
    status.textContent = game.mode === 'solo' ? 'First to 7. Watch for power-ups.' : 'First to 7. Chase power-ups—but guard your goal.';
    setTimeout(() => { if (game.running && !game.paused && balls[0].vx === 0) launch(); }, 500);
}
function showOverlay(title, hint) { overlayTitle.textContent = title; overlayHint.textContent = hint; overlay.hidden = false; }
function togglePause() { if (game.mode === 'online') return; if (game.over || !game.running) { newGame(); return; } game.paused = !game.paused; game.paused ? showOverlay('Game paused', 'Click or press Space to continue') : overlay.hidden = true; }
function point(side) {
    game.score[side]++; setScore(side, game.score[side]); clearPowerUps();
    if (game.score[side] === 7) { game.over = true; game.running = false; const name = side === 0 ? (game.mode === 'solo' ? 'You' : 'Left player') : (game.mode === 'solo' ? 'Computer' : 'Right player'); status.textContent = `${name} won ${game.score[side]}–${game.score[1 - side]}.`; showOverlay(`${name} wins!`, 'Click to play another match'); return; }
    resetBall(side === 0 ? 1 : -1); schedulePowerUp(true); setTimeout(() => { if (game.running && !game.paused && balls[0].vx === 0) launch(); }, 650);
}
function spawnPowerUp() {
    const paddlePickup = Math.random() < .68;
    const keys = paddlePickup ? ['reach', 'quick', 'curve', 'slow'] : ['burst', 'split'];
    const type = keys[Math.floor(Math.random() * keys.length)];
    const side = Math.random() < .5 ? 0 : 1;
    const paddle = paddles[side];
    let y;
    do { y = 55 + Math.random() * (game.height - 110); } while (Math.abs(y - (paddle.y + paddle.h / 2)) < 145);
    game.powerUps.push({ type, side, x: paddlePickup ? (side ? 898 : 62) : 300 + Math.random() * 360, y: paddlePickup ? y : 80 + Math.random() * 440, r: paddlePickup ? 17 : 20, expires: game.elapsed + (paddlePickup ? 5 : 7) });
    schedulePowerUp();
}
function collectPowerUp(powerUp, side) {
    const effect = game.effects[side];
    if (powerUp.type === 'reach') effect.reachUntil = game.elapsed + 8;
    if (powerUp.type === 'quick') effect.quickUntil = game.elapsed + 7;
    if (powerUp.type === 'curve') effect.curve = true;
    if (powerUp.type === 'slow') effect.slowUntil = game.elapsed + 6;
    if (powerUp.type === 'burst') balls.forEach(ball => { ball.vx *= 1.22; ball.vy *= 1.22; });
    if (powerUp.type === 'split' && balls.length === 1) balls.push(makeBall(balls[0].x, balls[0].y, balls[0].vx, -balls[0].vy || 260));
    status.textContent = `${side ? (game.mode === 'solo' ? 'Computer' : 'Right player') : (game.mode === 'solo' ? 'You' : 'Left player')} collected ${powerUpTypes[powerUp.type].name}.`;
    game.powerUps = game.powerUps.filter(item => item !== powerUp);
}
function overlapsPaddle(powerUp, paddle) { return powerUp.x + powerUp.r > paddle.x && powerUp.x - powerUp.r < paddle.x + paddle.w && powerUp.y + powerUp.r > paddle.y && powerUp.y - powerUp.r < paddle.y + paddle.h; }
function updatePowerUps() {
    if (game.elapsed >= game.nextPowerUp && game.powerUps.length < 2) spawnPowerUp();
    game.powerUps = game.powerUps.filter(powerUp => powerUp.expires > game.elapsed);
    game.powerUps.slice().forEach(powerUp => {
        const type = powerUpTypes[powerUp.type];
        if (type.collection === 'paddle' && overlapsPaddle(powerUp, paddles[powerUp.side])) collectPowerUp(powerUp, powerUp.side);
        if (type.collection === 'ball') balls.forEach(ball => { if (game.powerUps.includes(powerUp) && Math.hypot(ball.x - powerUp.x, ball.y - powerUp.y) < ball.r + powerUp.r) collectPowerUp(powerUp, game.lastTouch); });
    });
}
function update(dt) {
    game.elapsed += dt; updatePowerUps();
    paddles.forEach((paddle, side) => { const tall = (game.effects[side].reachUntil || 0) > game.elapsed; const center = paddle.y + paddle.h / 2; paddle.h = tall ? 162 : paddle.baseH; paddle.y = center - paddle.h / 2; });
    const leftSpeed = (game.effects[0].quickUntil || 0) > game.elapsed ? 625 : 500;
    paddles[0].vy = game.pointerControls.has(0) ? 0 : (game.keys.has('KeyS') ? leftSpeed : 0) - (game.keys.has('KeyW') ? leftSpeed : 0);
    if (game.mode === 'duo') { const rightSpeed = (game.effects[1].quickUntil || 0) > game.elapsed ? 625 : 500; paddles[1].vy = game.pointerControls.has(1) ? 0 : (game.keys.has('ArrowDown') ? rightSpeed : 0) - (game.keys.has('ArrowUp') ? rightSpeed : 0); }
    else { const target = game.powerUps.find(item => item.side === 1 && powerUpTypes[item.type].collection === 'paddle')?.y ?? balls[0].y; paddles[1].vy = Math.max(-370, Math.min(370, (target - paddles[1].h / 2 - paddles[1].y) * 5)); }
    paddles.forEach(paddle => paddle.y = Math.max(12, Math.min(game.height - paddle.h - 12, paddle.y + paddle.vy * dt)));
    for (const ball of balls) {
        const slowed = ((game.effects[0].slowUntil || 0) > game.elapsed && ball.x < game.width / 2) || ((game.effects[1].slowUntil || 0) > game.elapsed && ball.x > game.width / 2);
        const move = dt * (slowed ? .72 : 1); ball.x += ball.vx * move; ball.y += ball.vy * move;
        if ((ball.y - ball.r < 10 && ball.vy < 0) || (ball.y + ball.r > game.height - 10 && ball.vy > 0)) ball.vy *= -1;
        paddles.forEach((paddle, side) => { const toward = side === 0 ? ball.vx < 0 : ball.vx > 0; if (toward && ball.x + ball.r > paddle.x && ball.x - ball.r < paddle.x + paddle.w && ball.y + ball.r > paddle.y && ball.y - ball.r < paddle.y + paddle.h) { const offset = (ball.y - (paddle.y + paddle.h / 2)) / (paddle.h / 2); ball.x = side === 0 ? paddle.x + paddle.w + ball.r : paddle.x - ball.r; ball.vx = (side === 0 ? 1 : -1) * Math.min(Math.abs(ball.vx) * 1.055, 720); ball.vy = offset * 430; if (game.effects[side].curve) { ball.vy += (paddle.vy < 0 ? -1 : paddle.vy > 0 ? 1 : offset >= 0 ? 1 : -1) * 220; game.effects[side].curve = false; } game.lastTouch = side; } });
        if (ball.x < -30) { point(1); return; } if (ball.x > game.width + 30) { point(0); return; }
    }
}

function movePaddleToPointer(side, event) {
    const paddle = paddles[side];
    const rect = canvas.getBoundingClientRect();
    const pointerY = (event.clientY - rect.top) * game.height / rect.height;
    if (game.mode === 'online') { sendOnline({ type: 'input', up: false, down: false, targetY: pointerY }); return; }
    paddle.y = Math.max(12, Math.min(game.height - paddle.h - 12, pointerY - paddle.h / 2));
}
canvas.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const rect = canvas.getBoundingClientRect();
    const side = event.clientX - rect.left < rect.width / 2 ? 0 : 1;
    if (game.mode === 'online' && side !== online.side) return;
    if (side === 1 && game.mode !== 'duo' && game.mode !== 'online') return;
    if (game.pointerControls.has(side)) return;
    event.preventDefault();
    game.pointerControls.set(side, event.pointerId);
    canvas.setPointerCapture(event.pointerId);
    movePaddleToPointer(side, event);
});
canvas.addEventListener('pointermove', event => {
    const side = [0, 1].find(index => game.pointerControls.get(index) === event.pointerId);
    if (side === undefined) return;
    event.preventDefault();
    movePaddleToPointer(side, event);
});
function releasePointer(event) {
    const side = [0, 1].find(index => game.pointerControls.get(index) === event.pointerId);
    if (side !== undefined) game.pointerControls.delete(side);
}
canvas.addEventListener('pointerup', releasePointer);
canvas.addEventListener('pointercancel', releasePointer);
function roundedRect(x, y, width, height, radius) { ctx.beginPath(); ctx.roundRect(x, y, width, height, radius); ctx.fill(); }
function drawPowerUp(powerUp) {
    const type = powerUpTypes[powerUp.type]; const remaining = powerUp.expires - game.elapsed; const pulse = 1 + Math.sin(game.elapsed * 7) * .06;
    ctx.save(); ctx.translate(powerUp.x, powerUp.y); ctx.scale(pulse, pulse); ctx.globalAlpha = Math.min(1, remaining * 2); ctx.fillStyle = type.color; ctx.beginPath();
    if (type.collection === 'ball') { ctx.rotate(Math.PI / 4); ctx.roundRect(-powerUp.r, -powerUp.r, powerUp.r * 2, powerUp.r * 2, 6); } else ctx.arc(0, 0, powerUp.r, 0, Math.PI * 2);
    ctx.fill(); ctx.rotate(type.collection === 'ball' ? -Math.PI / 4 : 0); ctx.fillStyle = '#20352f'; ctx.font = `700 ${powerUp.type === 'split' ? 9 : 16}px "DM Sans"`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(type.icon, 0, 1); ctx.restore();
}
function draw() {
    ctx.clearRect(0, 0, game.width, game.height); ctx.fillStyle = '#20352f'; ctx.fillRect(0, 0, game.width, game.height);
    ctx.fillStyle = 'rgba(255,253,248,.12)'; for (let y = 18; y < game.height; y += 34) ctx.fillRect(game.width / 2 - 2, y, 4, 18);
    ctx.strokeStyle = 'rgba(255,253,248,.16)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(game.width / 2, game.height / 2, 82, 0, Math.PI * 2); ctx.stroke();
    game.powerUps.forEach(drawPowerUp); paddles.forEach(paddle => { ctx.fillStyle = paddle.color; roundedRect(paddle.x, paddle.y, paddle.w, paddle.h, 7); });
    ctx.fillStyle = '#fffdf8'; balls.forEach(ball => { ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); ctx.fill(); });
}
function frame(time) { const dt = Math.min((time - game.last) / 1000, .025) || 0; game.last = time; if (game.mode !== 'online' && game.running && !game.paused) update(dt); draw(); requestAnimationFrame(frame); }

document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => { if (game.mode === 'online' && button.dataset.mode !== 'online') leaveOnline(); game.mode = button.dataset.mode; document.querySelectorAll('[data-mode]').forEach(item => item.setAttribute('aria-pressed', item === button)); onlinePanel.hidden = game.mode !== 'online'; document.querySelectorAll('.local-control').forEach(item => item.hidden = game.mode === 'online'); document.querySelector('#pause').hidden = game.mode === 'online'; if (game.mode === 'online') { game.running = false; game.paused = true; resetBall(); refreshRooms(); showOverlay('Online match', 'Choose a public room or create your own'); } else { resetColorControls(); newGame(); } }));
document.querySelector('#new-game').addEventListener('click', newGame); document.querySelector('#pause').addEventListener('click', togglePause); overlay.addEventListener('click', togglePause);
document.querySelector('#room-visibility').addEventListener('change', event => { document.querySelector('#create-passcode').hidden = event.target.value !== 'private'; });
document.querySelector('#create-room').addEventListener('click', () => { const visibility = document.querySelector('#room-visibility').value; const passcode = document.querySelector('#create-passcode').value.trim(); if (visibility === 'private' && (passcode.length < 4 || passcode.length > 32)) { status.textContent = 'Choose a private room passcode between 4 and 32 characters.'; return; } connectOnline({ type: 'create-room', visibility, passcode }); });
document.querySelector('#join-room').addEventListener('click', () => { const roomCode = document.querySelector('#room-code').value.trim().toUpperCase(); if (roomCode.length !== 5) { status.textContent = 'Enter the five-character room code.'; return; } connectOnline({ type: 'join-room', roomCode, passcode: document.querySelector('#join-passcode').value.trim() }); });
document.querySelector('#refresh-rooms').addEventListener('click', refreshRooms);
document.querySelector('#room-code').addEventListener('input', event => { event.target.value = event.target.value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 5); });
readyOnlineButton.addEventListener('click', () => { readyOnlineButton.disabled = true; sendOnline({ type: game.over ? 'rematch' : 'ready' }); });
document.querySelector('#leave-room').addEventListener('click', () => leaveOnline());
document.querySelector('#copy-invite').addEventListener('click', async () => { const url = new URL(location.href); url.searchParams.set('room', online.roomCode); await navigator.clipboard.writeText(url.href); status.textContent = 'Invite link copied.'; });
document.querySelectorAll('.player-color').forEach((picker, index) => {
    const trigger = picker.querySelector('.color-trigger'); const menu = picker.querySelector('.color-menu'); const palette = picker.querySelector('.swatches');
    trigger.addEventListener('click', () => { const opening = menu.hidden; document.querySelectorAll('.color-menu').forEach(item => item.hidden = true); document.querySelectorAll('.color-trigger').forEach(item => item.setAttribute('aria-expanded', false)); menu.hidden = !opening; trigger.setAttribute('aria-expanded', opening); });
    paddleColors.forEach(color => { const swatch = document.createElement('button'); swatch.type = 'button'; swatch.className = 'swatch'; swatch.style.setProperty('--swatch', color.value); swatch.setAttribute('aria-label', `${color.name} ${index ? 'right' : 'left'} paddle`); swatch.setAttribute('aria-pressed', paddles[index].color === color.value); swatch.addEventListener('click', () => { if (game.mode === 'online' && index !== online.side) return; paddles[index].color = color.value; if (game.mode === 'online') sendOnline({ type: 'color', color: color.value }); trigger.style.setProperty('--selected-color', color.value); palette.querySelectorAll('.swatch').forEach(button => button.setAttribute('aria-pressed', button === swatch)); menu.hidden = true; trigger.setAttribute('aria-expanded', false); trigger.focus(); draw(); }); palette.append(swatch); });
});
document.addEventListener('click', event => { if (!event.target.closest('.player-color')) { document.querySelectorAll('.color-menu').forEach(menu => menu.hidden = true); document.querySelectorAll('.color-trigger').forEach(trigger => trigger.setAttribute('aria-expanded', false)); } });
fullscreenButton.addEventListener('click', async () => { if (document.fullscreenElement) await document.exitFullscreen(); else await arena.requestFullscreen(); });
document.addEventListener('fullscreenchange', () => { const active = document.fullscreenElement === arena; fullscreenButton.textContent = active ? 'Exit full screen' : 'Enter full screen'; fullscreenButton.setAttribute('aria-pressed', active); });
addEventListener('keydown', event => { if (event.code === 'Escape') { document.querySelectorAll('.color-menu').forEach(menu => menu.hidden = true); document.querySelectorAll('.color-trigger').forEach(trigger => trigger.setAttribute('aria-expanded', false)); return; } if (['ArrowUp', 'ArrowDown', 'Space'].includes(event.code)) event.preventDefault(); if (event.code === 'Space') { togglePause(); return; } game.keys.add(event.code); if (game.mode === 'online') onlineInput(); }); addEventListener('keyup', event => { game.keys.delete(event.code); if (game.mode === 'online') onlineInput(); });
document.querySelectorAll('[data-key]').forEach(button => { const key = button.dataset.key; const on = event => { event.preventDefault(); game.keys.add(key); if (game.mode === 'online') onlineInput(); }; const off = event => { event.preventDefault(); game.keys.delete(key); if (game.mode === 'online') onlineInput(); }; button.addEventListener('pointerdown', on); button.addEventListener('pointerup', off); button.addEventListener('pointercancel', off); button.addEventListener('pointerleave', off); });
addEventListener('resize', resize); resize(); requestAnimationFrame(frame);
const invitedRoom = new URLSearchParams(location.search).get('room');
let savedOnlineSession = null;
try { savedOnlineSession = JSON.parse(sessionStorage.getItem('pong-online-session')); } catch { clearSession(); }
if (invitedRoom) {
    document.querySelector('[data-mode="online"]').click();
    const normalizedRoom = invitedRoom.toUpperCase().slice(0, 5);
    if (savedOnlineSession?.roomCode === normalizedRoom && savedOnlineSession.token) {
        online.roomCode = savedOnlineSession.roomCode; online.token = savedOnlineSession.token;
        connectOnline({ type: 'resume', roomCode: online.roomCode, playerToken: online.token });
    } else {
        document.querySelector('#room-code').value = normalizedRoom;
        status.textContent = 'Invitation loaded. Join when you are ready.';
    }
}
