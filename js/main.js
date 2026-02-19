/**
 * main.js — Boot sequence. Wires engine + player + buddy + world-manager.
 *
 * Boot order:
 * 1. AudioManager, UGLabsClient, WorldManager
 * 2. Engine with canvas
 * 3. Player at starting position
 * 4. Buddy with client + audioManager
 * 5. ChallengeManager connecting everything
 * 6. Connect UGLabs (non-blocking)
 * 7. Engine start
 */

import { AudioManager } from './audio-manager.js';
import { UGLabsClient } from './uglab-client.js';
import { CONFIG } from './config.js';
import { Engine } from './engine.js';
import { Player } from './player.js';
import { Buddy } from './buddy.js';
import { WorldManager } from './world-manager.js';
import { ChallengeManager } from './challenges/challenge-manager.js';

// ── 1. Core services ───────────────────────────────────────────

const audioManager = new AudioManager();

const ugLabsClient = new UGLabsClient({
  apiKey: CONFIG.API_KEY,
  playerId: CONFIG.PLAYER_ID,
  authUrl: CONFIG.AUTH_URL,
  wsUrl: CONFIG.WS_URL,
});

const worldManager = new WorldManager();

// ── 2. Engine ──────────────────────────────────────────────────

const canvas = document.getElementById('game-canvas');
const engine = new Engine(canvas);

// ── 3. Player ──────────────────────────────────────────────────

const world1 = worldManager.currentWorld;
const player = new Player(60, world1.groundY - 48);

// ── 4. Buddy ──────────────────────────────────────────────────

const buddy = new Buddy(
  player.x - 80,
  world1.groundY - 36,
  ugLabsClient,
  audioManager
);

// ── 5. Challenge Manager ───────────────────────────────────────

const challengeManager = new ChallengeManager({
  engine,
  worldManager,
  audioManager,
  buddy,
});

// ── 6. Wire everything together ───────────────────────────────

engine.player = player;
engine.buddy = buddy;
engine.worldManager = worldManager;
engine.challengeManager = challengeManager;
engine.audioManager = audioManager;

// Expose canvas ref for challenge manager mouse events
engine._canvas = canvas;

worldManager.engine = engine;
worldManager.player = player;
worldManager.buddy = buddy;
worldManager.audioManager = audioManager;

// Music toggle
document.getElementById('btn-music').addEventListener('click', () => {
  const muted = audioManager.toggleMusic();
  const btn = document.getElementById('btn-music');
  btn.textContent = muted ? '🔇' : '🎵';
  btn.classList.toggle('muted', muted);
});

// SFX toggle
document.getElementById('btn-sfx').addEventListener('click', () => {
  const muted = audioManager.toggleSfx();
  const btn = document.getElementById('btn-sfx');
  btn.textContent = muted ? '🔕' : '🔊';
  btn.classList.toggle('muted', muted);
});

// ── 7. World music helper ──────────────────────────────────────

// Extend AudioManager to support world-specific music frequencies
audioManager.setWorldFreqs = (freqs) => {
  audioManager._worldFreqs = freqs;
};

// Patch AudioManager's private music loop to use world freqs
// (The base AudioManager uses a hardcoded C major arpeggio; we override at world boundaries)
const originalStartMusic = audioManager.startMusic.bind(audioManager);
audioManager.startMusic = function () {
  if (this._worldFreqs) {
    this._startCustomMusic(this._worldFreqs);
  } else {
    originalStartMusic();
  }
};

// We can't easily patch the private method, so we use a public wrapper approach.
// Instead: each world transition calls stopMusic() → setWorldFreqs() → startMusic()
// The base class startMusic is fine for World 1 (default C major).
// For worlds 2 & 3 we want different moods — we accept the base music for simplicity,
// since AudioManager's private methods aren't patchable from outside.
// The world freqs are passed through for future enhancement.
audioManager.startMusic = originalStartMusic; // restore

// ── 8. Start ──────────────────────────────────────────────────

// Connect UGLabs asynchronously (non-blocking)
ugLabsClient.fetchToken()
  .then(() => ugLabsClient.connect())
  .then(() => {
    console.log('[Main] UGLabs connected');
    buddy.onWorldChange(worldManager.getGameState());
  })
  .catch((err) => {
    console.warn('[Main] UGLabs connection failed (Buddy voice unavailable):', err);
  });

// Wait for first keypress to resume AudioContext (browser autoplay policy)
const startHandler = async () => {
  await audioManager.resume();
  audioManager.startMusic();

  // Initialize buddy world config
  buddy.onWorldChange(worldManager.getGameState());
};

// Hook into engine's started flag
const origStart = engine.start.bind(engine);
engine._onStartEvent = startHandler;

// We intercept started = true to trigger audio
const originalBindInput = engine._bindInput.bind(engine);
engine._startCallback = null;

window.addEventListener('keydown', async () => {
  if (!engine.started) return; // Engine keydown sets started = true first
  if (engine._startCallback) return;
  engine._startCallback = true;
  await startHandler();
}, { once: true });

// Also handle first click (mobile)
window.addEventListener('click', async () => {
  if (!engine.started) {
    // simulate keypress to start
    engine.started = true;
    await startHandler();
  }
}, { once: true });

engine.start();

// ── PTT via 'P' key ───────────────────────────────────────────

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyP' && !e.repeat) {
    buddy.startRecording();
  }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyP') {
    buddy.stopRecording();
  }
});

// ── Keyboard shortcut reminder ─────────────────────────────────

console.log('%c🐾 Buddy\'s World Adventure', 'font-size:20px;font-weight:bold;color:#ffd700');
console.log('Controls: A/D or ←/→ Move · Space/↑ Jump · E Interact · B Ask Buddy · P PTT');
