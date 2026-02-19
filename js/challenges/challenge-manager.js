/**
 * challenge-manager.js — Overlay system for all challenge types.
 * On open: pauses engine, renders semi-transparent overlay each frame.
 * Each challenge module implements: { init, render, handleInput, isDone, getContext }
 */
import { MathChallenge } from './math.js';
import { LogicChallenge } from './logic.js';
import { ActionChallenge } from './action.js';

// Zone label → challenge type map (by world + zone id)
const ZONE_TYPES = {
  // World 1
  'Number Gnome':     'math',
  "Witch's Cauldron": 'math',
  "Dragon's Riddle":  'math',
  // World 2
  'Cloud Sequence':       'logic',
  "Oracle's Deduction":   'logic',
  'Rule Machine':         'logic',
  // World 3
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

  get isActive() { return this.#active; }

  // ── Open / Close ──────────────────────────────────────────────

  open(zone, worldIndex) {
    if (this.#active) return;
    this.#active = true;
    this.#currentZone = zone;
    this.#worldIndex = worldIndex;
    this.#engine.paused = true;

    const type = ZONE_TYPES[zone.label];
    this.#challenge = this._createChallenge(type, zone, worldIndex);
    this.#challenge.init(zone, worldIndex, this.#audioManager);

    // Keyboard input
    this.#keyHandler = (e) => {
      if (e.key === 'Escape') { this._close(false); return; }

      // B key: ask Buddy for help with current challenge context
      if (e.code === 'KeyB') {
        const gs = this.#worldManager?.getGameState() ?? {};
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

  _createChallenge(type, zone, worldIndex) {
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
  }

  // ── Render ────────────────────────────────────────────────────

  render(ctx) {
    if (!this.#active || !this.#challenge) return;

    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, 900, 480);

    // Challenge renders inside
    this.#challenge.render(ctx);

    // Close hint
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('[Esc] Close  ·  [B] Ask Buddy', 892, 470);
    ctx.textAlign = 'left';

    // Check completion
    if (this.#challenge.isDone()) {
      this._close(true);
    }
  }
}
