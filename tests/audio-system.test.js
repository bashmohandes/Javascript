'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createArcadeAudio } = require('../scripts/audio.js');
const { createArcadeEvents } = require('../scripts/game-events.js');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

class FakeParam {
    constructor(value = 0) { this.value = value; }
    cancelScheduledValues() {}
    setValueAtTime(value) { this.value = value; }
    linearRampToValueAtTime(value) { this.value = value; }
    exponentialRampToValueAtTime(value) { this.value = value; }
}

class FakeNode {
    constructor() { this.connections = []; this.listeners = {}; }
    connect(node) { this.connections.push(node); return node; }
    disconnect() { this.disconnected = true; }
    addEventListener(type, listener) { this.listeners[type] = listener; }
}

class FakeSource extends FakeNode {
    constructor() { super(); this.frequency = new FakeParam(); this.detune = new FakeParam(); }
    start(time) { this.startedAt = time; }
    stop(time) { this.stoppedAt = time; }
}

class FakeAudioContext {
    static instances = [];
    constructor() { this.state = 'suspended'; this.currentTime = 1; this.sampleRate = 8000; this.destination = new FakeNode(); this.oscillators = []; this.sources = []; this.gains = []; this.filters = []; FakeAudioContext.instances.push(this); }
    createGain() { const node = new FakeNode(); node.gain = new FakeParam(1); this.gains.push(node); return node; }
    createDynamicsCompressor() { const node = new FakeNode(); node.threshold = new FakeParam(); node.knee = new FakeParam(); node.ratio = new FakeParam(); return node; }
    createBuffer(_channels, length) { const data = new Float32Array(length); return { getChannelData: () => data }; }
    createOscillator() { const source = new FakeSource(); this.oscillators.push(source); return source; }
    createBufferSource() { const source = new FakeSource(); this.sources.push(source); return source; }
    createBiquadFilter() { const node = new FakeNode(); node.frequency = new FakeParam(); this.filters.push(node); return node; }
    async resume() { this.state = 'running'; }
    async suspend() { this.state = 'suspended'; }
    async close() { this.state = 'closed'; }
}

function environment({ supported = true } = {}) {
    const storage = new Map(), windowListeners = new Map(), documentListeners = new Map(), intervals = new Map();
    const document = {
        hidden: false,
        documentElement: { dataset: { arcadeTheme: 'playful' } },
        addEventListener(type, listener) { documentListeners.set(type, listener); },
        dispatchEvent(event) { documentListeners.get(event.type)?.(event); return true; },
        querySelector() { return null; }
    };
    const env = {
        document,
        location: { pathname: '/tetris/' },
        localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
        CustomEvent: class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
        addEventListener(type, listener) { windowListeners.set(type, listener); },
        setInterval(callback) { const id = intervals.size + 1; intervals.set(id, callback); return id; },
        clearInterval(id) { intervals.delete(id); },
        navigator: { userActivation: { hasBeenActive: true } }
    };
    if (supported) env.AudioContext = FakeAudioContext;
    return { env, storage, windowListeners, documentListeners, intervals };
}

test('audio graph stays lazy until a gameplay cue activates it', async () => {
    FakeAudioContext.instances.length = 0;
    const { env } = environment();
    const audio = createArcadeAudio(env);
    audio.setScene('active', { intensity: .5 });
    assert.equal(FakeAudioContext.instances.length, 0);
    assert.equal(audio.preferences().activated, false);
    assert.equal(await audio.cue('valid'), true);
    assert.equal(FakeAudioContext.instances.length, 1);
    assert.equal(audio.preferences().activated, true);
    assert.ok(FakeAudioContext.instances[0].oscillators.length >= 1);
});

test('domain events drive audio without exposing audio to game controllers', async () => {
    FakeAudioContext.instances.length = 0;
    const { env } = environment();
    env.navigator.userActivation.hasBeenActive = false;
    env.ArcadeEvents = createArcadeEvents(env);
    createArcadeAudio(env);
    env.ArcadeEvents.emit('game:started', { intensity: .3, danger: 0 });
    assert.equal(FakeAudioContext.instances.length, 0, 'a lifecycle event must not bypass user-gesture activation');
    env.navigator.userActivation.hasBeenActive = true;
    env.ArcadeEvents.emit('tetris:piece-locked', { pieces: 1 });
    await Promise.resolve(); await Promise.resolve();
    assert.equal(FakeAudioContext.instances.length, 1);
    assert.ok(FakeAudioContext.instances[0].oscillators.length > 0);
});

test('audio refuses automatic activation and bounds overlapping voices', async () => {
    FakeAudioContext.instances.length = 0;
    const { env } = environment();
    env.navigator.userActivation.hasBeenActive = false;
    const audio = createArcadeAudio(env);
    assert.equal(await audio.cue('valid'), false);
    assert.equal(FakeAudioContext.instances.length, 0);

    env.navigator.userActivation.hasBeenActive = true;
    await audio.activate();
    for (let index = 0; index < 40; index += 1) await audio.cue('valid');
    assert.ok(FakeAudioContext.instances[0].oscillators.some(source => source.disconnected), 'old voices should be stolen and disconnected');
});

test('naturally ended voices disconnect every per-voice audio node', async () => {
    FakeAudioContext.instances.length = 0;
    const { env } = environment();
    const audio = createArcadeAudio(env);
    await audio.cue('valid');
    const context = FakeAudioContext.instances[0], source = context.oscillators.at(-1);
    const filter = source.connections[0], envelope = filter.connections[0];
    source.listeners.ended();
    assert.equal(source.disconnected, true);
    assert.equal(filter.disconnected, true);
    assert.equal(envelope.disconnected, true);
});

test('stopped lifecycle events return active audio to its idle scene', async () => {
    FakeAudioContext.instances.length = 0;
    const { env, intervals } = environment();
    env.ArcadeEvents = createArcadeEvents(env);
    createArcadeAudio(env);
    env.ArcadeEvents.emit('game:started', { intensity: .3, danger: 0 });
    await Promise.resolve(); await Promise.resolve();
    assert.ok(intervals.size > 0);
    env.ArcadeEvents.emit('game:stopped', { reason: 'waiting-for-online-match' });
    assert.equal(intervals.size, 0);
});

test('audio preferences clamp, persist, mute, and reset independently', async () => {
    FakeAudioContext.instances.length = 0;
    const { env, storage } = environment();
    const audio = createArcadeAudio(env);
    await audio.activate();
    audio.setMusicVolume(4); audio.setEffectsVolume(-2); audio.setMuted(true);
    assert.deepEqual(audio.preferences(), { muted: true, music: 1, effects: 0, available: true, activated: true });
    assert.equal(storage.get('arcade-audio-muted'), 'true');
    assert.equal(storage.get('arcade-music-volume'), '1');
    assert.equal(storage.get('arcade-effects-volume'), '0');
    audio.reset();
    assert.deepEqual(audio.preferences(), { muted: false, music: .35, effects: .7, available: true, activated: true });
});

test('pausing is transition-based and hidden documents suspend an activated context', async () => {
    FakeAudioContext.instances.length = 0;
    const { env, documentListeners } = environment();
    const audio = createArcadeAudio(env);
    await audio.cue('valid');
    const context = FakeAudioContext.instances[0];
    audio.setPaused(true);
    const afterFirstPause = context.oscillators.length;
    audio.setPaused(true);
    assert.equal(context.oscillators.length, afterFirstPause);
    env.document.hidden = true;
    documentListeners.get('visibilitychange')();
    await Promise.resolve();
    assert.equal(context.state, 'suspended');
});

test('unsupported browsers expose a safe silent preference surface', async () => {
    const { env } = environment({ supported: false });
    const audio = createArcadeAudio(env);
    assert.equal(audio.available, false);
    assert.equal(await audio.cue('win'), false);
    assert.equal(audio.preferences().available, false);
    audio.setMusicVolume(.5); audio.setScene('active'); audio.setPaused(true); audio.destroy();
});

test('all modern games load shared audio behind the event adapter', () => {
    const games = ['pong', 'tictactoe', 'battle-tanks', 'Sudoku', 'Minesweeper', 'tetris'];
    for (const game of games) {
        assert.match(read(`${game}/index.html`), /scripts\/audio\.js/, `${game} should load shared audio`);
        assert.doesNotMatch(read(`${game}/scripts/app.js`), /ArcadeAudio|setScene\(|\.cue\(/, `${game} should remain independent from audio`);
        assert.match(read(`${game}/scripts/app.js`), /events\.emit\(/, `${game} should publish domain events`);
    }
    for (const classic of ['pong/classic/index.html', 'Sudoku/classic/index.html', 'Minesweeper/classic/index.html']) assert.doesNotMatch(read(classic), /scripts\/audio\.js/);
});

test('shared controls, provenance, ADR, and design boundaries are documented', () => {
    assert.match(read('arcade.js'), /arcade-audio-button/);
    assert.match(read('arcade.js'), /data-audio-volume="music"/);
    assert.match(read('arcade.js'), /data-audio-volume="effects"/);
    assert.match(read('arcade.css'), /arcade-audio-levels/);
    assert.match(read('docs/adr/0013-procedural-arcade-audio.md'), /AudioContext|Web Audio/);
    assert.match(read('docs/audio-design.md'), /32-voice ceiling/);
    assert.match(read('docs/game-events.md'), /Producer rules/);
    assert.match(read('docs/audio.md'), /Public-domain milestone fragments/);
    assert.match(read('service-worker.js'), /scripts\/audio\.js/);
});

test('online games establish presentation-event watermarks without replaying resume snapshots', () => {
    const pong = read('pong/scripts/app.js'), tic = read('tictactoe/scripts/app.js'), tanks = read('battle-tanks/scripts/app.js');
    assert.match(pong, /awaitingResumeState/); assert.match(pong, /!resumedSnapshot[^\n]*events\.emit/);
    assert.match(tic, /awaitingResumeState/); assert.match(tic, /if\(!resumedSnapshot\)/);
    assert.match(tanks, /suppressNextOnlineEvents/); assert.match(tanks, /lastImpactSerial=message\.state\.lastImpact/);
});

test('non-result exits and online match starts publish accurate lifecycle facts', () => {
    const sudoku = read('Sudoku/scripts/app.js'), tic = read('tictactoe/scripts/app.js');
    assert.match(sudoku, /game:stopped[^\n]*auto-solved/);
    assert.match(sudoku, /game:stopped[^\n]*unsolvable/);
    assert.match(tic, /game\.mode==='online'\?'game:stopped':'game:started'/);
    assert.match(tic, /game\.running&&!wasRunning\)events\.emit\('game:started'/);
    assert.match(tic, /if\(game\.running\)events\.emit\('game:progressed'/);
});

test('the arcade ships no audio media files', () => {
    const audioExtensions = /\.(?:mp3|wav|ogg|m4a|aac|flac|mid|midi)$/i;
    const files = fs.readdirSync(root, { recursive: true, withFileTypes: true }).filter(entry => entry.isFile()).map(entry => entry.name).filter(name => audioExtensions.test(name));
    assert.deepEqual(files, []);
});
