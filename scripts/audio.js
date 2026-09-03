'use strict';

const TETRIS_DANGER_THRESHOLD = 2 / 3;
const TETRIS_DANGER_BPM_BOOST = 32;
function musicBpm(game, track, detail = {}) {
    const intensity = Math.max(0, Math.min(1, Number(detail.intensity ?? .35)));
    const danger = Math.max(0, Math.min(1, Number(detail.danger ?? 0)));
    return track.bpm + intensity * 10 + (game === 'tetris' && danger > TETRIS_DANGER_THRESHOLD ? TETRIS_DANGER_BPM_BOOST : 0);
}

(function attachArcadeAudio(root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = { createArcadeAudio: factory, musicBpm };
    if (root?.document) root.ArcadeAudio = factory(root);
})(typeof window === 'undefined' ? null : window, function createArcadeAudio(root) {
    const doc = root.document;
    const events = root.ArcadeEvents;
    const AudioContextClass = root.AudioContext || root.webkitAudioContext;
    const GAME_NAMES = Object.freeze({ pong: 'pong', Sudoku: 'sudoku', Minesweeper: 'minesweeper', tictactoe: 'tictactoe', 'battle-tanks': 'battletanks', tetris: 'tetris' });
    const pathGame = root.location?.pathname?.match(/\/(pong|Sudoku|Minesweeper|tictactoe|battle-tanks|tetris)\//)?.[1];
    const game = GAME_NAMES[pathGame] || null;
    const STORAGE = Object.freeze({ muted: 'arcade-audio-muted', music: 'arcade-music-volume', effects: 'arcade-effects-volume' });
    const DEFAULTS = Object.freeze({ muted: false, music: .6, effects: .8 });
    const BUS_GAIN = Object.freeze({ music: 1.7, effects: 1.35 });
    const MAX_VOICES = 32;
    const TRACKS = Object.freeze({
        sudoku: { bpm: 88, root: 48, scale: [0,2,4,7,9], melody: [0,2,4,7,4,2,9,7,4,7,9,11,9,7,4,2,0,4,7,9,7,4,2,4,7,9,11,9,7,4,2,0], rhythm: [2,0,1,1,2,1,0,1,2,0,1,1,2,1,1,0], bass: [0,7,9,4,0,7,4,9], chords: [[0,4,7],[7,11,14],[9,12,16],[5,9,12]], swing: .08 },
        minesweeper: { bpm: 108, root: 45, scale: [0,3,5,7,10], melody: [0,2,1,3,2,4,3,1,0,3,4,2,1,4,2,3,5,3,1,2,4,2,0,3,1,4,3,5,4,2,1,0], rhythm: [2,1,0,1,2,0,1,1,2,1,1,0,2,1,0,1], bass: [0,5,3,7,0,10,7,5], chords: [[0,3,7],[5,8,12],[3,7,10],[7,10,14]], swing: .14 },
        pong: { bpm: 126, root: 43, scale: [0,2,5,7,9], melody: [0,3,2,4,3,1,2,4,5,3,1,4,2,5,4,2,0,2,3,5,4,2,1,3,5,4,2,3,1,4,2,0], rhythm: [2,1,1,0,2,1,0,1,2,1,1,1,2,0,1,1], bass: [0,7,5,9,0,7,5,2], chords: [[0,4,7],[7,11,14],[5,9,12],[9,12,16]], swing: .1 },
        tictactoe: { bpm: 98, root: 50, scale: [0,2,3,7,9], melody: [0,null,2,3,4,3,null,1,0,2,3,null,4,5,2,1,0,2,null,4,3,1,2,4,5,3,1,null,4,2,1,0], rhythm: [2,0,1,1,2,1,0,1,2,1,1,0,2,1,0,1], bass: [0,3,7,2,0,9,7,3], chords: [[0,3,7],[3,7,10],[7,10,14],[2,5,9]], swing: .16 },
        battletanks: { bpm: 114, root: 38, scale: [0,2,3,7,8], melody: [0,2,3,1,4,3,2,1,0,3,4,2,1,4,5,3,0,2,4,3,5,4,2,1,3,5,4,2,1,3,2,0], rhythm: [2,0,1,1,2,1,1,0,2,1,0,1,2,1,1,1], bass: [0,3,8,7,0,10,8,7], chords: [[0,3,7],[3,7,10],[8,12,15],[7,10,14]], swing: .06 },
        tetris: {
            bpm: 132, root: 45, scale: [0,2,3,5,7,8,10], phrased: true,
            melody: [7,null,4,5,6,null,5,4,3,null,3,5,7,null,6,5,4,null,null,5,6,null,7,null,5,null,3,null,3,null,null,null,6,null,null,8,10,null,9,8,7,null,null,5,7,null,6,5,4,null,4,5,6,null,7,null,5,null,3,null,3,null,null,null],
            rhythm: [2,0,1,1,2,0,1,1,2,0,1,1,2,0,1,1,3,0,0,1,2,0,2,0,2,0,2,0,4,0,0,0,3,0,0,1,2,0,1,1,3,0,0,1,2,0,1,1,2,0,1,1,2,0,2,0,2,0,2,0,4,0,0,0],
            bass: [0,0,0,0,0,0,0,0,7,7,7,7,0,0,0,0,5,5,5,5,0,0,0,0,7,7,7,7,0,0,0,0],
            chords: [[0,3,7],[0,3,7],[7,11,14],[0,3,7],[5,8,12],[0,3,7],[7,11,14],[0,3,7]], swing: .04
        }
    });
    const TIMBRES = Object.freeze({
        playful: { music: 'triangle', lead: 'sine', effects: 'triangle', attack: .008, release: .16, brightness: 2800, density: 1, gain: 1 },
        cabinet: { music: 'square', lead: 'sawtooth', effects: 'square', attack: .003, release: .09, brightness: 1900, density: 1, gain: .78 },
        calm: { music: 'sine', lead: 'triangle', effects: 'sine', attack: .035, release: .28, brightness: 1500, density: .65, gain: .72 }
    });
    const PUBLIC_DOMAIN = Object.freeze({
        bachPrelude: [[60,.12],[64,.12],[67,.12],[72,.12],[76,.12],[67,.12],[72,.12],[76,.24]],
        odeToJoy: [[64,.16],[64,.16],[65,.16],[67,.16],[67,.16],[65,.16],[64,.16],[62,.16],[60,.16],[60,.16],[62,.16],[64,.16],[64,.24],[62,.12],[62,.28]],
        rondoAllaTurca: [[71,.1],[69,.1],[68,.1],[69,.1],[72,.22]]
    });

    const clamp = value => Math.max(0, Math.min(1, Number(value)));
    const readBoolean = (key, fallback) => {
        try { const value = root.localStorage.getItem(key); return value === 'true' ? true : value === 'false' ? false : fallback; }
        catch { return fallback; }
    };
    const readLevel = (key, fallback) => {
        try { const saved = root.localStorage.getItem(key); if (saved === null) return fallback; const value = Number(saved); return Number.isFinite(value) && value >= 0 && value <= 1 ? value : fallback; }
        catch { return fallback; }
    };
    let preferences = { muted: readBoolean(STORAGE.muted, DEFAULTS.muted), music: readLevel(STORAGE.music, DEFAULTS.music), effects: readLevel(STORAGE.effects, DEFAULTS.effects) };
    let context = null, master = null, musicBus = null, effectsBus = null, compressor = null, noiseBuffer = null;
    let scene = 'idle', sceneDetail = {}, paused = false, hidden = doc.hidden, ducked = false, activated = false;
    let scheduler = null, nextStepTime = 0, stepIndex = 0, theme = doc.documentElement.dataset.arcadeTheme || 'playful';
    const voices = new Set(), musicVoices = new Set();

    const currentTimbre = () => TIMBRES[theme] || TIMBRES.playful;
    const frequency = midi => 440 * Math.pow(2, (midi - 69) / 12);
    const scaleMidi = (track, degree, baseOctave) => track.root + baseOctave + track.scale[degree % track.scale.length] + Math.floor(degree / track.scale.length) * 12;
    const safeParam = (param, value, time = context?.currentTime || 0) => {
        if (!param) return;
        if (typeof param.cancelScheduledValues === 'function') param.cancelScheduledValues(time);
        if (typeof param.setValueAtTime === 'function') param.setValueAtTime(value, time);
        else param.value = value;
    };
    const rampParam = (param, value, duration = .025) => {
        if (!param || !context) return;
        const now = context.currentTime;
        if (typeof param.cancelScheduledValues === 'function') param.cancelScheduledValues(now);
        if (typeof param.setValueAtTime === 'function') param.setValueAtTime(param.value, now);
        if (typeof param.linearRampToValueAtTime === 'function') param.linearRampToValueAtTime(value, now + duration);
        else param.value = value;
    };
    const emit = () => {
        const detail = api.preferences();
        events?.emit('audio:preferences-changed', detail, { source: 'audio' });
    };
    const save = () => {
        try {
            root.localStorage.setItem(STORAGE.muted, String(preferences.muted));
            root.localStorage.setItem(STORAGE.music, String(preferences.music));
            root.localStorage.setItem(STORAGE.effects, String(preferences.effects));
        } catch { /* Preferences still apply for this page. */ }
    };
    const effectiveMaster = () => preferences.muted ? 0 : ducked ? .24 : 1;
    const effectiveBus = key => preferences[key] * BUS_GAIN[key];
    const applyMix = () => {
        if (!context) return;
        rampParam(master.gain, effectiveMaster());
        rampParam(musicBus.gain, effectiveBus('music'));
        rampParam(effectsBus.gain, effectiveBus('effects'));
    };
    const makeNoiseBuffer = () => {
        const buffer = context.createBuffer(1, Math.max(1, Math.floor(context.sampleRate * .45)), context.sampleRate);
        const channel = buffer.getChannelData(0);
        let seed = 0x51f15e;
        for (let index = 0; index < channel.length; index += 1) { seed = (seed * 1664525 + 1013904223) >>> 0; channel[index] = (seed / 0xffffffff) * 2 - 1; }
        return buffer;
    };
    const createGraph = () => {
        if (context || !AudioContextClass) return Boolean(context);
        context = new AudioContextClass({ latencyHint: 'interactive' });
        master = context.createGain(); musicBus = context.createGain(); effectsBus = context.createGain();
        compressor = typeof context.createDynamicsCompressor === 'function' ? context.createDynamicsCompressor() : context.createGain();
        if (compressor.threshold) safeParam(compressor.threshold, -18);
        if (compressor.knee) safeParam(compressor.knee, 16);
        if (compressor.ratio) safeParam(compressor.ratio, 8);
        musicBus.connect(compressor); effectsBus.connect(compressor); compressor.connect(master); master.connect(context.destination);
        safeParam(master.gain, effectiveMaster()); safeParam(musicBus.gain, effectiveBus('music')); safeParam(effectsBus.gain, effectiveBus('effects'));
        noiseBuffer = makeNoiseBuffer();
        return true;
    };
    const forgetVoice = entry => { voices.delete(entry); musicVoices.delete(entry); };
    const disconnectVoice = entry => {
        if (entry.disconnected) return;
        entry.disconnected = true;
        entry.nodes.forEach(node => { try { node.disconnect(); } catch { /* Disconnection is best effort. */ } });
        forgetVoice(entry);
    };
    const stopVoice = entry => {
        try { entry.source.stop(); } catch { /* It may already have stopped. */ }
        disconnectVoice(entry);
    };
    const claimVoice = (source, isMusic, nodes) => {
        while (voices.size >= MAX_VOICES) stopVoice(voices.values().next().value);
        const entry = { source, nodes, disconnected: false };
        voices.add(entry); if (isMusic) musicVoices.add(entry);
        source.addEventListener?.('ended', () => disconnectVoice(entry), { once: true });
        return entry;
    };
    const tone = ({ midi, hz, at, duration = .12, gain = .08, type, bus = effectsBus, isMusic = false, detune = 0, filter = true }) => {
        if (!context || !bus) return;
        const start = Math.max(context.currentTime, at ?? context.currentTime), timbre = currentTimbre();
        const oscillator = context.createOscillator(), envelope = context.createGain();
        oscillator.type = type || (isMusic ? timbre.music : timbre.effects);
        safeParam(oscillator.frequency, hz || frequency(midi), start);
        if (oscillator.detune) safeParam(oscillator.detune, detune, start);
        const peak = Math.max(.0001, gain * timbre.gain), attack = Math.min(duration * .35, isMusic ? timbre.attack : .008), release = Math.min(duration * .8, timbre.release);
        safeParam(envelope.gain, .0001, start);
        envelope.gain.exponentialRampToValueAtTime?.(peak, start + Math.max(.003, attack));
        envelope.gain.exponentialRampToValueAtTime?.(.0001, start + Math.max(attack + .01, duration + release));
        const nodes = [oscillator, envelope];
        if (filter && typeof context.createBiquadFilter === 'function') {
            const filterNode = context.createBiquadFilter(); filterNode.type = 'lowpass'; safeParam(filterNode.frequency, timbre.brightness, start);
            oscillator.connect(filterNode); filterNode.connect(envelope); nodes.push(filterNode);
        } else oscillator.connect(envelope);
        envelope.connect(bus); claimVoice(oscillator, isMusic, nodes); oscillator.start(start); oscillator.stop(start + duration + release + .03);
    };
    const noise = ({ at, duration = .12, gain = .09, frequency: cutoff = 900, type = 'lowpass', bus = effectsBus, isMusic = false }) => {
        if (!context || !noiseBuffer) return;
        const start = Math.max(context.currentTime, at ?? context.currentTime), source = context.createBufferSource(), envelope = context.createGain();
        source.buffer = noiseBuffer;
        const nodes = [source, envelope];
        if (typeof context.createBiquadFilter === 'function') {
            const filterNode = context.createBiquadFilter(); filterNode.type = type; safeParam(filterNode.frequency, cutoff, start); source.connect(filterNode); filterNode.connect(envelope);
            nodes.push(filterNode);
        } else source.connect(envelope);
        safeParam(envelope.gain, Math.max(.0001, gain), start); envelope.gain.exponentialRampToValueAtTime?.(.0001, start + duration); envelope.connect(bus);
        claimVoice(source, isMusic, nodes); source.start(start); source.stop(start + duration + .02);
    };
    const sequence = (notes, { at = context?.currentTime || 0, gain = .075, type, gap = .015 } = {}) => {
        let cursor = at;
        notes.forEach(([midi, duration]) => { tone({ midi, at: cursor, duration: Math.max(.04, duration - gap), gain, type }); cursor += duration; });
    };
    const chord = (notes, options = {}) => notes.forEach((midi, index) => tone({ midi, detune: index ? (index % 2 ? 2 : -2) : 0, ...options }));
    const stopMusicVoices = () => [...musicVoices].forEach(stopVoice);
    const musicAllowed = () => activated && context?.state === 'running' && !preferences.muted && preferences.music > 0 && !paused && !hidden && !ducked && scene === 'active' && Boolean(TRACKS[game]);
    const scheduleStep = (index, at, beat) => {
        const track = TRACKS[game], timbre = currentTimbre(), intensity = clamp(sceneDetail.intensity ?? .35), danger = clamp(sceneDetail.danger ?? 0);
        const degree = track.melody[index % track.melody.length];
        const rhythm = track.rhythm[index % track.rhythm.length];
        const melodyAllowed = track.phrased || ((rhythm > 1 || intensity > .28) && (timbre.density >= 1 || index % 4 === 0));
        if (degree !== null && rhythm > 0 && melodyAllowed) {
            const midi = scaleMidi(track, degree, 12);
            const duration = track.phrased ? beat * Math.max(.52, rhythm - .18) : beat * (rhythm > 1 ? .82 : .52);
            tone({ midi, at, duration, gain: .04 + intensity * .022, type: timbre.lead, bus: musicBus, isMusic: true });
        }
        if (index % 2 === 0) {
            const bass = track.root + track.bass[Math.floor(index / 2) % track.bass.length];
            tone({ midi: bass, at, duration: beat * 1.35, gain: .045 + intensity * .02, bus: musicBus, isMusic: true });
        }
        if (index % 8 === 0) {
            const notes = track.chords[Math.floor(index / 8) % track.chords.length].map(offset => track.root + 12 + offset);
            chord(notes, { at, duration: beat * 2.8, gain: .016 + intensity * .008, type: timbre.music, bus: musicBus, isMusic: true });
        }
        if (timbre.density >= 1 && index % 2 === 1) noise({ at, duration: .035, gain: .012 + intensity * .006, frequency: 2600, type: 'highpass', bus: musicBus, isMusic: true });
        if (index % 4 === 0) tone({ hz: 72, at, duration: .07, gain: .025 + intensity * .012, type: 'sine', bus: musicBus, isMusic: true, filter: false });
        if ((intensity > .52 || danger > .35) && index % 4 === 2) {
            const counterDegree = (degree ?? 0) + 2, counter = scaleMidi(track, counterDegree, 24);
            tone({ midi: counter, at, duration: beat * .42, gain: .018 + danger * .012, type: 'sine', bus: musicBus, isMusic: true, filter: false });
        }
    };
    const scheduleMusic = () => {
        if (!musicAllowed()) return;
        const track = TRACKS[game], beat = 60 / musicBpm(game, track, sceneDetail) / 2;
        if (nextStepTime < context.currentTime - .2) nextStepTime = context.currentTime + .04;
        while (nextStepTime < context.currentTime + .16) { scheduleStep(stepIndex, nextStepTime + (stepIndex % 2 ? beat * track.swing : 0), beat); stepIndex += 1; nextStepTime += beat; }
    };
    const stopScheduler = () => { if (scheduler) root.clearInterval(scheduler); scheduler = null; stopMusicVoices(); };
    const updateScheduler = () => {
        if (!musicAllowed()) { stopScheduler(); return; }
        if (scheduler) return;
        nextStepTime = context.currentTime + .04; scheduler = root.setInterval(scheduleMusic, 45); scheduleMusic();
    };
    const playResult = result => {
        if (result === 'draw') return sequence([[60,.14],[64,.14],[62,.22]], { gain: .08 });
        if (result === 'loss') return sequence([[55,.15],[52,.15],[48,.32]], { gain: .085, type: 'sawtooth' });
        sequence(PUBLIC_DOMAIN.odeToJoy, { gain: .055, type: currentTimbre().lead });
    };
    const playCue = (name, detail = {}) => {
        if (!context || preferences.muted || preferences.effects <= 0) return;
        const now = context.currentTime + .006, base = TRACKS[game]?.root || 48;
        switch (name) {
            case 'select': case 'move': tone({ midi: base + 19, at: now, duration: .045, gain: .045 }); break;
            case 'note': case 'rotate': sequence([[base+12,.045],[base+16,.055]], { at: now, gain: .045 }); break;
            case 'erase': case 'unflag': sequence([[base+14,.045],[base+10,.07]], { at: now, gain: .04 }); break;
            case 'valid': case 'mark': case 'reveal': tone({ midi: base + 24 + (detail.side || 0) * 3, at: now, duration: .075, gain: .06 }); break;
            case 'error': noise({ at: now, duration: .13, gain: .075, frequency: 280, type: 'bandpass' }); tone({ midi: base + 5, at: now, duration: .15, gain: .045, type: 'sawtooth' }); break;
            case 'hint': sequence([[base+19,.08],[base+24,.08],[base+28,.16]], { at: now, gain: .06 }); break;
            case 'flag': sequence([[base+12,.06],[base+19,.09]], { at: now, gain: .06, type: 'square' }); break;
            case 'cascade': sequence([[base+12,.04],[base+16,.04],[base+19,.04],[base+24,.09]], { at: now, gain: .04 }); break;
            case 'wall': tone({ midi: base+10, at: now, duration: .035, gain: .055, type: 'square' }); break;
            case 'hit': tone({ midi: base+17+(detail.speed ? Math.min(8,Math.floor(detail.speed/100)) : 0), at: now, duration: .045, gain: .07, type: 'triangle' }); break;
            case 'serve': sequence([[base+12,.055],[base+19,.08]], { at: now, gain: .06 }); break;
            case 'score': sequence([[base+12,.07],[base+19,.07],[base+24,.12]], { at: now, gain: .075 }); break;
            case 'drop': noise({ at: now, duration: .055, gain: .045, frequency: 520 }); tone({ midi: base, at: now, duration: .06, gain: .055 }); break;
            case 'lock': noise({ at: now, duration: .075, gain: .055, frequency: 420 }); tone({ midi: base+7, at: now, duration: .07, gain: .05 }); break;
            case 'clear': {
                const count = Math.max(1, Math.min(4, Number(detail.count) || 1));
                const notes = Array.from({ length: count + 2 }, (_, index) => [base+12+[0,4,7,12,16,19][index], .065]); sequence(notes, { at: now, gain: .055 + count * .008 });
                if (game === 'tetris' && count === 4) sequence(PUBLIC_DOMAIN.rondoAllaTurca, { at: now + .32, gain: .05 });
                break;
            }
            case 'power-up': chord([base+12,base+19,base+24], { at: now, duration: .26, gain: .045, type: currentTimbre().lead }); break;
            case 'fire': {
                const weapon = detail.weapon || 'shell';
                noise({ at: now, duration: weapon === 'heavy-shell' ? .28 : .16, gain: weapon === 'laser' ? .05 : .12, frequency: weapon === 'heavy-shell' ? 180 : 520 });
                tone({ hz: weapon === 'laser' ? 980 : weapon === 'homing' ? 310 : 140, at: now, duration: weapon === 'laser' ? .24 : .12, gain: .09, type: weapon === 'laser' ? 'sawtooth' : 'triangle' }); break;
            }
            case 'impact': {
                const strength = clamp((Number(detail.damage) || 12) / 50); noise({ at: now, duration: .16 + strength * .22, gain: .08 + strength * .1, frequency: 180 + strength * 520 });
                tone({ hz: 72 + strength * 38, at: now, duration: .18, gain: .08 + strength * .06, type: 'sine' }); break;
            }
            case 'complete':
                if (game === 'sudoku') sequence(PUBLIC_DOMAIN.bachPrelude, { at: now, gain: .052, type: currentTimbre().lead });
                else playResult('win');
                break;
            case 'win': playResult('win'); break;
            case 'loss': playResult('loss'); break;
            case 'draw': playResult('draw'); break;
            case 'achievement': chord([60,64,67,72], { at: now, duration: .32, gain: .05, type: currentTimbre().lead }); break;
            case 'top-score': sequence([[60,.07],[64,.07],[67,.07],[72,.2]], { at: now, gain: .075 }); break;
            case 'pause': chord([base+12,base+15], { at: now, duration: .12, gain: .035 }); break;
            default: break;
        }
    };
    const activate = async () => {
        if (!activated && root.navigator?.userActivation && !root.navigator.userActivation.hasBeenActive) return false;
        if (!game || !createGraph()) return false;
        try { if (context.state === 'suspended' || context.state === 'interrupted') await context.resume(); }
        catch { return false; }
        activated = context.state === 'running'; updateScheduler(); emit(); return activated;
    };
    const setPreference = (key, value) => {
        preferences = { ...preferences, [key]: key === 'muted' ? Boolean(value) : clamp(value) };
        save(); applyMix(); updateScheduler(); emit();
        if (!preferences.muted && key === 'muted') activate();
    };
    const api = {
        available: Boolean(AudioContextClass), game,
        activate,
        cue(name, detail) { if (!game || !AudioContextClass) return Promise.resolve(false); return activate().then(ok => { if (ok) playCue(name, detail); return ok; }); },
        setScene(next, detail = {}) { scene = ['idle','active','complete'].includes(next) ? next : 'idle'; sceneDetail = { ...detail }; if (scene !== 'active') stopMusicVoices(); updateScheduler(); },
        setPaused(value) { const next = Boolean(value); if (next === paused) return; paused = next; if (paused && activated) playCue('pause'); updateScheduler(); },
        preferences: () => ({ ...preferences, available: Boolean(AudioContextClass), activated }),
        setMuted(value) { setPreference('muted', value); },
        setMusicVolume(value) { setPreference('music', value); },
        setEffectsVolume(value) { setPreference('effects', value); },
        reset() { preferences = { ...DEFAULTS }; save(); applyMix(); updateScheduler(); emit(); },
        destroy() { subscriptions.splice(0).forEach(off => off()); stopScheduler(); [...voices].forEach(stopVoice); context?.close?.(); context = null; activated = false; }
    };

    const subscriptions = [];
    const subscribe = (type, listener) => { if (events) subscriptions.push(events.on(type, listener)); };
    const cues = {
        'sudoku:cell-selected': 'select', 'sudoku:note-entered': 'note', 'sudoku:entry-rejected': 'error', 'sudoku:entry-accepted': 'valid', 'sudoku:cell-erased': 'erase', 'sudoku:hint-used': 'hint',
        'minesweeper:cells-revealed': event => event.detail.count > 1 ? 'cascade' : 'reveal', 'minesweeper:flag-changed': event => event.detail.flagged ? 'flag' : 'unflag', 'minesweeper:mine-triggered': 'impact',
        'tictactoe:mark-placed': 'mark',
        'pong:served': 'serve', 'pong:wall-hit': 'wall', 'pong:paddle-hit': 'hit', 'pong:point-scored': 'score', 'pong:power-up-spawned': 'power-up', 'pong:power-up-activated': 'power-up',
        'battletanks:power-up-acquired': 'power-up', 'battletanks:impact-resolved': 'impact', 'battletanks:shot-fired': 'fire', 'battletanks:tank-moved': 'move', 'battletanks:control-adjusted': 'select',
        'tetris:power-up-presented': 'power-up', 'tetris:power-up-activated': 'power-up', 'tetris:blocks-destroyed': 'impact', 'tetris:stack-compacted': 'drop', 'tetris:lines-cleared': 'clear', 'tetris:piece-locked': 'lock', 'tetris:local-record-broken': 'top-score',
        'achievement:unlocked': 'achievement', 'score:top': 'top-score'
    };
    Object.entries(cues).forEach(([type, cue]) => subscribe(type, event => api.cue(typeof cue === 'function' ? cue(event) : cue, event.detail)));
    subscribe('tetris:piece-manipulated', event => api.cue(event.detail.action.startsWith('rotate') ? 'rotate' : event.detail.action === 'hard-drop' ? 'drop' : event.detail.action === 'hold' ? 'power-up' : 'move', event.detail));
    subscribe('system:theme-changed', event => { theme = event.detail.theme || doc.documentElement.dataset.arcadeTheme || 'playful'; });
    subscribe('game:started', event => { api.setPaused(false); api.setScene('active', event.detail); api.activate(); });
    subscribe('game:progressed', event => api.setScene('active', event.detail));
    subscribe('game:paused', event => api.setPaused(event.detail.paused));
    subscribe('game:stopped', () => { api.setPaused(false); api.setScene('idle'); });
    subscribe('game:completed', event => { api.setScene('complete'); api.cue(game === 'sudoku' && event.detail.outcome === 'win' ? 'complete' : event.detail.outcome || 'loss', event.detail); });
    doc.addEventListener('visibilitychange', () => { hidden = doc.hidden; updateScheduler(); if (hidden && context?.state === 'running') context.suspend().catch(() => {}); else if (!hidden && activated && !preferences.muted) activate(); });
    root.addEventListener('storage', event => {
        if (!Object.values(STORAGE).includes(event.key)) return;
        preferences = { muted: readBoolean(STORAGE.muted, DEFAULTS.muted), music: readLevel(STORAGE.music, DEFAULTS.music), effects: readLevel(STORAGE.effects, DEFAULTS.effects) };
        applyMix(); updateScheduler(); emit();
    });
    if (root.MutationObserver) {
        const observer = new root.MutationObserver(() => { const next = Boolean(doc.querySelector('dialog[open]:not(.arcade-audio-dialog)')); if (next === ducked) return; ducked = next; applyMix(); updateScheduler(); });
        observer.observe(doc.documentElement, { attributes: true, subtree: true, attributeFilter: ['open'] });
    }
    return Object.freeze(api);
});
