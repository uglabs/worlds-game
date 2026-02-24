/**
 * challenge-manager.js — Overlay system for all challenge types.
 * On open: pauses engine, renders semi-transparent overlay each frame.
 * Each challenge module implements: { init, render, handleInput, isDone, isFailed, getContext }
 */
import { MathChallenge } from './math.js';
import { LogicChallenge } from './logic.js';
import { ActionChallenge } from './action.js';

// Zone label → challenge type map
const ZONE_TYPES = {
  'Number Gnome':     'math',
  "Witch's Cauldron": 'math',
  "Dragon's Riddle":  'math',
  'Cloud Sequence':       'logic',
  "Oracle's Deduction":   'logic',
  'Rule Machine':         'logic',
  'Click Battle':    'action',
  'Lightning Catch': 'action',
  'Rhythm Drums':    'action',
};

export class ChallengeManager {
  #engine = null;
  #worldManager = null;
  #audioManager = null;
  #buddy = null;

  #active = false;
  #currentZone = null;
  #worldIndex = 0;
  #challenge = null;

  // Lives & credits
  #lives = 3;
  #credits = 3;

  // Timers for phase transitions
  #failTimer = 0;       // counts down after isFailed() detected, then deducts life
  #successTimer = 0;    // counts down after isDone() detected, then closes with success
  #successParticles = [];

  // Try-again overlay (shown after world reset)
  #tryAgainShowing = false;
  #tryAgainTimer = 0;

  // Input forwarding
  #keyHandler = null;
  #mouseHandler = null;
  #keyUpHandler = null;

  constructor({ engine, worldManager, audioManager, buddy }) {
    this.#engine = engine;
    this.#worldManager = worldManager;
    this.#audioManager = audioManager;
    this.#buddy = buddy;
  }

  get isActive()  { return this.#active; }
  get lives()     { return this.#lives; }
  get credits()   { return this.#credits; }

  // ── Open / Close ──────────────────────────────────────────────

  open(zone, worldIndex) {
    if (this.#active) return;
    this.#active = true;
    this.#currentZone = zone;
    this.#worldIndex = worldIndex;
    this.#engine.paused = true;
    this.#failTimer = 0;
    this.#successTimer = 0;
    this.#successParticles = [];

    const type = ZONE_TYPES[zone.label];
    this.#challenge = this._createChallenge(type);
    this.#challenge.init(zone, worldIndex, this.#audioManager, {
      onCorrect: () => { this.#credits++; },
    });

    // Keyboard input
    this.#keyHandler = (e) => {
      if (e.key === 'Escape') {
        // If already in fail phase, commit immediately
        if (this.#failTimer > 0) {
          this.#failTimer = 0;
          this._commitFailure();
        } else if (this.#successTimer === 0) {
          this._close(false);
        }
        return;
      }

      // B key: ask Buddy (costs 1 credit)
      if (e.code === 'KeyB') {
        if (this.#credits <= 0) {
          this.#buddy?.say('No credits! Earn some by answering correctly 🐾', 4);
          this.#buddy?.bark();
          return;
        }
        this.#credits--;
        const gs = this.#worldManager?.getGameState() ?? {};
        gs.credits = this.#credits;
        const ctx = this.#challenge?.getContext?.();
        if (ctx) gs.challengeContext = ctx;
        this.#buddy?.bark();
        this.#buddy?.requestHelp(gs);
        return;
      }

      this.#challenge?.handleInput({ type: 'keydown', key: e.key, code: e.code });
    };
    this.#keyUpHandler = (e) => {
      this.#challenge?.handleInput({ type: 'keyup', key: e.key, code: e.code });
    };
    this.#mouseHandler = (e) => {
      const rect = this.#engine._canvas?.getBoundingClientRect?.() ||
                   document.getElementById('game-canvas').getBoundingClientRect();
      const scaleX = 900 / rect.width;
      const scaleY = 480 / rect.height;
      this.#challenge?.handleInput({
        type: e.type,
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      });
    };

    window.addEventListener('keydown', this.#keyHandler);
    window.addEventListener('keyup', this.#keyUpHandler);
    document.getElementById('game-canvas').addEventListener('mousedown', this.#mouseHandler);
    document.getElementById('game-canvas').addEventListener('click', this.#mouseHandler);
  }

  _createChallenge(type) {
    switch (type) {
      case 'math':   return new MathChallenge();
      case 'logic':  return new LogicChallenge();
      case 'action': return new ActionChallenge();
      default:       return new MathChallenge();
    }
  }

  _close(solved) {
    if (!this.#active) return;
    this.#active = false;
    this.#engine.paused = false;

    if (solved && this.#currentZone) {
      this.#currentZone.solved = true;
      this.#audioManager?.playSuccess();
      this.#worldManager?.checkPortal();
      this.#buddy?.onChallengeSolved(this.#worldManager?.getGameState());
    }

    window.removeEventListener('keydown', this.#keyHandler);
    window.removeEventListener('keyup', this.#keyUpHandler);
    document.getElementById('game-canvas').removeEventListener('mousedown', this.#mouseHandler);
    document.getElementById('game-canvas').removeEventListener('click', this.#mouseHandler);

    this.#challenge = null;
    this.#currentZone = null;
    this.#keyHandler = null;
    this.#keyUpHandler = null;
    this.#mouseHandler = null;
    this.#failTimer = 0;
    this.#successTimer = 0;
    this.#successParticles = [];
  }

  _commitFailure() {
    this.#lives--;
    if (this.#lives <= 0) {
      this.#lives = 3;
      this._close(false);
      this._resetCurrentWorld();
    } else {
      this._close(false);
    }
  }

  _resetCurrentWorld() {
    const world = this.#worldManager?.currentWorld;
    if (world) {
      world.challengeZones.forEach(z => { z.solved = false; });
      if (world.portal) world.portal.locked = true;
    }
    if (this.#engine?.player) {
      const p = this.#engine.player;
      p.x = 60;
      p.y = (world?.groundY ?? 415) - p.height;
      p.vx = 0;
      p.vy = 0;
    }
    if (this.#engine) this.#engine.camera.x = 0;
    this.#tryAgainShowing = true;
    this.#tryAgainTimer = 2.2;
  }

  // ── Success particles ─────────────────────────────────────────

  _spawnSuccessParticles() {
    for (let i = 0; i < 24; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 70 + Math.random() * 150;
      this.#successParticles.push({
        x: 450, y: 240,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        hue: Math.floor(Math.random() * 360),
        size: 4 + Math.random() * 5,
      });
    }
  }

  // ── Render ────────────────────────────────────────────────────

  render(ctx) {
    const dtSec = 1 / 60;

    // Try-again overlay shown after world reset (even when not active)
    if (this.#tryAgainShowing && this.#tryAgainTimer > 0) {
      this.#tryAgainTimer -= dtSec;
      if (this.#tryAgainTimer <= 0) { this.#tryAgainShowing = false; return; }

      ctx.fillStyle = 'rgba(0,0,0,0.82)';
      ctx.fillRect(0, 0, 900, 480);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff8060';
      ctx.font = 'bold 42px "Segoe UI", sans-serif';
      ctx.fillText('😅  Try again!', 450, 210);
      ctx.fillStyle = '#fff';
      ctx.font = '22px "Segoe UI", sans-serif';
      ctx.fillText('World reset — all zones unlocked', 450, 260);
      // Draw remaining lives
      ctx.font = '28px sans-serif';
      let heartsStr = '';
      for (let i = 0; i < 3; i++) heartsStr += i < this.#lives ? '❤️' : '🖤';
      ctx.fillText(heartsStr, 450, 310);
      ctx.textAlign = 'left';
      return;
    }

    if (!this.#active || !this.#challenge) return;

    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, 900, 480);

    // Challenge renders inside
    this.#challenge.render(ctx);

    // Credits + Buddy hint button in challenge HUD
    const creditsText = `[B] Ask Buddy  🦴×${this.#credits}`;
    const hasCredits = this.#credits > 0;
    ctx.fillStyle = hasCredits ? 'rgba(255,255,200,0.9)' : 'rgba(200,200,200,0.5)';
    ctx.font = 'bold 14px "Segoe UI", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(creditsText, 892, 450);
    if (!hasCredits) {
      ctx.fillStyle = 'rgba(255,100,100,0.8)';
      ctx.font = '11px sans-serif';
      ctx.fillText('(no credits)', 892, 466);
    }

    // Close hint (only when not in a timed phase)
    if (this.#successTimer === 0 && this.#failTimer === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.font = '13px sans-serif';
      ctx.fillText('[Esc] Close', 892, 470);
    }
    ctx.textAlign = 'left';

    // ── Phase transitions ──────────────────────────────────────

    if (this.#successTimer > 0) {
      // Update & draw success confetti
      this.#successTimer -= dtSec;
      for (const p of this.#successParticles) {
        p.x += p.vx * dtSec;
        p.y += p.vy * dtSec;
        p.vy += 60 * dtSec;
        p.life -= dtSec * 0.8;
      }
      this.#successParticles = this.#successParticles.filter(p => p.life > 0);
      ctx.save();
      for (const p of this.#successParticles) {
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = `hsl(${p.hue},100%,65%)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      if (this.#successTimer <= 0) {
        this.#successParticles = [];
        this._close(true);
      }
    } else if (this.#failTimer > 0) {
      this.#failTimer -= dtSec;
      if (this.#failTimer <= 0) {
        this.#failTimer = 0;
        this._commitFailure();
      }
    } else {
      // Check for done / failed
      if (this.#challenge.isDone()) {
        this.#successTimer = 1.3;
        this._spawnSuccessParticles();
      } else if (this.#challenge.isFailed()) {
        this.#failTimer = 2.0;
        this.#audioManager?.playWrong?.();
      }
    }
  }
}
