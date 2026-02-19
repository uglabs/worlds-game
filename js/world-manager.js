/**
 * world-manager.js — World state machine, portal logic, and world transitions.
 */
import { createWorld1 } from './worlds/world1.js';
import { createWorld2 } from './worlds/world2.js';
import { createWorld3 } from './worlds/world3.js';

const WORLD_FACTORIES = [createWorld1, createWorld2, createWorld3];

export class WorldManager {
  #currentWorldIndex = 0;
  #worlds = [];
  #transitioning = false;
  #transitionAlpha = 0;   // 0=clear, 1=black
  #transitionPhase = 'none'; // 'fadein' | 'fadeout' | 'none'
  #transitionCallback = null;
  #victoryShowing = false;

  // Victory animation state
  #victoryParticles = [];
  #victoryStars = [];
  #victoryTime = 0;
  #victoryLastTick = 0;
  #victoryFireworkTimer = 0;

  // External refs
  engine = null;
  player = null;
  buddy = null;
  audioManager = null;

  constructor() {
    // Pre-create all worlds (but only load first)
    this.#worlds = WORLD_FACTORIES.map(f => f());
  }

  get currentWorld() {
    return this.#worlds[this.#currentWorldIndex];
  }

  get worldIndex() {
    return this.#currentWorldIndex;
  }

  /** Returns a game state descriptor for Buddy's prompt builder. */
  getGameState() {
    const world = this.currentWorld;
    const solved = world.challengeZones.filter(z => z.solved).length;
    return {
      worldIndex: this.#currentWorldIndex,
      worldName: world.name,
      challengesSolved: solved,
      challengesTotal: world.challengeZones.length,
      currentZone: world.challengeZones.find(z => z._playerNear && !z.solved) || null,
    };
  }

  // ── Portal ────────────────────────────────────────────────────

  /** Called by challenge-manager after each zone is solved. */
  checkPortal() {
    const world = this.currentWorld;
    const allSolved = world.challengeZones.every(z => z.solved);
    if (allSolved && world.portal.locked) {
      world.portal.locked = false;
      this.audioManager?.playPortalUnlock?.();
    }
  }

  // ── World Transition ──────────────────────────────────────────

  advanceWorld() {
    if (this.#transitioning || this.#victoryShowing) return;

    if (this.#currentWorldIndex >= 2) {
      this._showVictory();
      return;
    }

    this.#transitioning = true;
    this.#transitionPhase = 'fadein'; // fade to black first
    this.#transitionAlpha = 0;

    this.#transitionCallback = () => {
      this.#currentWorldIndex++;
      const newWorld = this.currentWorld;
      // Reset player position
      if (this.player) {
        this.player.x = 60;
        this.player.y = newWorld.groundY - this.player.height;
        this.player.vx = 0;
        this.player.vy = 0;
      }
      // Update engine camera
      if (this.engine) this.engine.camera.x = 0;
      // Update music
      if (this.audioManager) {
        this.audioManager.stopMusic();
        this.audioManager.setWorldFreqs?.(newWorld.musicFreqs);
        this.audioManager.startMusic();
      }
      // Update buddy
      this.buddy?.onWorldChange(this.getGameState());
    };
  }

  /** Called each frame by engine to update transition animation. */
  renderTransition(ctx) {
    if (this.#victoryShowing) {
      this._renderVictory(ctx);
      return;
    }

    if (this.#transitionPhase === 'none') return;

    const speed = 0.04;

    if (this.#transitionPhase === 'fadein') {
      this.#transitionAlpha = Math.min(1, this.#transitionAlpha + speed);
      if (this.#transitionAlpha >= 1) {
        this.#transitionCallback?.();
        this.#transitionCallback = null;
        this.#transitionPhase = 'fadeout';
      }
    } else if (this.#transitionPhase === 'fadeout') {
      this.#transitionAlpha = Math.max(0, this.#transitionAlpha - speed);
      if (this.#transitionAlpha <= 0) {
        this.#transitionPhase = 'none';
        this.#transitioning = false;
      }
    }

    if (this.#transitionAlpha > 0) {
      ctx.fillStyle = `rgba(0,0,0,${this.#transitionAlpha})`;
      ctx.fillRect(0, 0, 900, 480);

      if (this.#transitionAlpha > 0.6 && this.#transitionPhase === 'fadein') {
        const world = this.currentWorld;
        ctx.fillStyle = `rgba(255,255,255,${(this.#transitionAlpha - 0.6) * 2.5})`;
        ctx.font = 'bold 32px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`World ${world.worldIndex + 1}: ${world.name}`, 450, 240);
        ctx.textAlign = 'left';
      }
    }
  }

  _showVictory() {
    this.#victoryShowing = true;
    this.#victoryLastTick = Date.now();
    this.#victoryTime = 0;
    this.#victoryFireworkTimer = 0;
    // Seed initial background stars
    this.#victoryStars = Array.from({ length: 80 }, () => ({
      x: Math.random() * 900,
      y: Math.random() * 480,
      r: Math.random() * 2 + 0.5,
      phase: Math.random() * Math.PI * 2,
    }));
    this.#victoryParticles = [];
    this.audioManager?.playSuccess();
  }

  _spawnFirework(ctx) {
    const cx = 150 + Math.random() * 600;
    const cy = 60 + Math.random() * 260;
    const hue = Math.floor(Math.random() * 360);
    const count = 22 + Math.floor(Math.random() * 14);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const spd = 80 + Math.random() * 120;
      this.#victoryParticles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: 1,
        hue: hue + Math.random() * 40 - 20,
        size: 3 + Math.random() * 3,
        trail: [],
      });
    }
  }

  _renderVictory(ctx) {
    const now = Date.now();
    const dtSec = Math.min((now - this.#victoryLastTick) / 1000, 0.05);
    this.#victoryLastTick = now;
    this.#victoryTime += dtSec;

    // Deep space background
    ctx.fillStyle = 'rgba(2,2,18,1)';
    ctx.fillRect(0, 0, 900, 480);

    // Twinkling stars
    for (const s of this.#victoryStars) {
      const brightness = 0.4 + 0.6 * Math.abs(Math.sin(this.#victoryTime * 1.5 + s.phase));
      ctx.fillStyle = `rgba(255,255,255,${brightness})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Spawn fireworks periodically
    this.#victoryFireworkTimer -= dtSec;
    if (this.#victoryFireworkTimer <= 0) {
      this._spawnFirework(ctx);
      this.#victoryFireworkTimer = 0.45 + Math.random() * 0.35;
    }

    // Update & draw particles
    for (const p of this.#victoryParticles) {
      p.vy += 60 * dtSec; // gravity
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      p.life -= dtSec * 0.9;
      p.vx *= 0.98;
      p.vy *= 0.98;
    }
    for (const p of this.#victoryParticles) {
      if (p.life <= 0) continue;
      ctx.fillStyle = `hsla(${p.hue},100%,65%,${p.life})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    this.#victoryParticles = this.#victoryParticles.filter(p => p.life > 0);

    // Trophy glow
    const glowPulse = 0.55 + 0.45 * Math.sin(this.#victoryTime * 2.5);
    ctx.fillStyle = `rgba(255,200,0,${glowPulse * 0.25})`;
    ctx.beginPath();
    ctx.arc(450, 148, 90, 0, Math.PI * 2);
    ctx.fill();

    // Trophy emoji
    ctx.font = '88px sans-serif';
    ctx.textAlign = 'center';
    const trophyBob = Math.sin(this.#victoryTime * 1.8) * 5;
    ctx.fillText('🏆', 450, 188 + trophyBob);

    // "YOU WIN!" with gradient glow
    const titleScale = 1 + 0.04 * Math.sin(this.#victoryTime * 2);
    ctx.save();
    ctx.translate(450, 240);
    ctx.scale(titleScale, titleScale);
    const grad = ctx.createLinearGradient(-180, 0, 180, 0);
    grad.addColorStop(0, '#ff8c00');
    grad.addColorStop(0.5, '#ffd700');
    grad.addColorStop(1, '#ff8c00');
    ctx.font = 'bold 54px "Segoe UI", sans-serif';
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillText('YOU WIN!', 3, 3);
    ctx.fillStyle = grad;
    ctx.fillText('YOU WIN!', 0, 0);
    ctx.restore();

    // Subtitle
    ctx.fillStyle = '#a0e8ff';
    ctx.font = '22px "Segoe UI", sans-serif';
    ctx.fillText("Buddy's so proud of you!", 450, 295);

    // Stars row
    const starAlpha = Math.min(1, (this.#victoryTime - 0.5) * 2);
    ctx.fillStyle = `rgba(255,220,50,${starAlpha})`;
    ctx.font = '28px sans-serif';
    ctx.fillText('⭐  ⭐  ⭐', 450, 332);

    // "All 3 worlds conquered" badge
    if (this.#victoryTime > 1.0) {
      const badgeAlpha = Math.min(1, (this.#victoryTime - 1.0) * 1.5);
      ctx.fillStyle = `rgba(30,80,30,${badgeAlpha * 0.8})`;
      ctx.beginPath();
      ctx.roundRect(270, 350, 360, 40, 10);
      ctx.fill();
      ctx.strokeStyle = `rgba(80,255,80,${badgeAlpha * 0.6})`;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = `rgba(120,255,120,${badgeAlpha})`;
      ctx.font = '16px "Segoe UI", sans-serif';
      ctx.fillText('✓ All 3 worlds conquered!', 450, 375);
    }

    // Buddy dog at bottom-right, waving
    this._drawVictoryBuddy(ctx);

    // Refresh prompt
    ctx.fillStyle = `rgba(180,180,180,${0.4 + 0.2 * Math.sin(this.#victoryTime * 3)})`;
    ctx.font = '14px "Segoe UI", sans-serif';
    ctx.fillText('Refresh to play again', 450, 462);

    ctx.textAlign = 'left';
  }

  _drawVictoryBuddy(ctx) {
    const t = this.#victoryTime;
    const bx = 800, by = 400;
    const wave = Math.sin(t * 4) * 12; // waving arm

    ctx.save();
    ctx.translate(bx, by);

    // Tail wagging
    const tailAngle = Math.sin(t * 6) * 0.5;
    ctx.strokeStyle = '#c8a46e';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-18, -10);
    ctx.quadraticCurveTo(-30, -20 + tailAngle * 15, -28 + tailAngle * 10, -32);
    ctx.stroke();

    // Body
    ctx.fillStyle = '#c8a46e';
    ctx.beginPath();
    ctx.ellipse(0, -8, 22, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.beginPath();
    ctx.arc(16, -24, 14, 0, Math.PI * 2);
    ctx.fill();

    // Ear
    ctx.fillStyle = '#a07840';
    ctx.beginPath();
    ctx.ellipse(22, -35, 5, 9, 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Eye
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(21, -25, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(22, -26, 1, 0, Math.PI * 2);
    ctx.fill();

    // Nose
    ctx.fillStyle = '#442211';
    ctx.beginPath();
    ctx.arc(28, -22, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Smile
    ctx.strokeStyle = '#442211';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(26, -20, 4, 0.1, Math.PI * 0.9);
    ctx.stroke();

    // Paw (waving)
    ctx.fillStyle = '#c8a46e';
    ctx.beginPath();
    ctx.ellipse(32, -14 + wave, 8, 6, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Legs
    ctx.fillStyle = '#c8a46e';
    [-12, 4].forEach(lx => {
      ctx.beginPath();
      ctx.roundRect(lx, 4, 9, 14, 4);
      ctx.fill();
    });

    ctx.restore();
  }
}
