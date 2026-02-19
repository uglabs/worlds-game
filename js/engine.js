/**
 * engine.js — Game loop, input handling, camera, and rendering orchestration.
 * Canvas: 900×480px. Horizontal-follow camera.
 */

export class Engine {
  /** @type {HTMLCanvasElement} */
  #canvas;
  /** @type {CanvasRenderingContext2D} */
  #ctx;
  #rafId = null;
  #lastTime = 0;

  // External refs set by main.js
  player = null;
  buddy = null;
  worldManager = null;
  challengeManager = null;
  audioManager = null;  // set from main.js

  paused = false;
  started = false; // false until first keypress

  // Input state
  keys = {};
  #justPressed = {};
  #justReleased = {};

  camera = { x: 0 };

  #hudHintAlpha = 1;   // fades to 0 over 10s
  #hudHintTimer = 10;

  constructor(canvas) {
    this.#canvas = canvas;
    this.#ctx = canvas.getContext('2d');
    this._bindInput();
    this._bindMuteButton();
  }

  // ── Input ──────────────────────────────────────────────────────

  _bindInput() {
    window.addEventListener('keydown', (e) => {
      if (!this.keys[e.code]) {
        this.#justPressed[e.code] = true;
      }
      this.keys[e.code] = true;

      // First keypress starts the game
      if (!this.started) {
        this.started = true;
        return;
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      this.#justReleased[e.code] = true;
    });
  }

  _bindMuteButton() {
    // Music/SFX buttons are wired directly in main.js
  }

  /** Called once per frame — consume and clear just-pressed/released state. */
  _consumeInput() {
    const jp = { ...this.#justPressed };
    const jr = { ...this.#justReleased };
    this.#justPressed = {};
    this.#justReleased = {};
    return { jp, jr };
  }

  isJustPressed(code) {
    return !!this.#justPressed[code];
  }

  // ── Lifecycle ──────────────────────────────────────────────────

  start() {
    this.#lastTime = performance.now();
    this.#rafId = requestAnimationFrame((t) => this.#loop(t));
  }

  stop() {
    if (this.#rafId) cancelAnimationFrame(this.#rafId);
    this.#rafId = null;
  }

  // ── Loop ──────────────────────────────────────────────────────

  #loop(timestamp) {
    const dt = Math.min((timestamp - this.#lastTime) / 16.67, 3); // normalize to 60fps
    this.#lastTime = timestamp;

    const { jp, jr } = this._consumeInput();

    if (!this.paused && this.started) {
      this._update(dt, jp, jr);
    }

    this._render();
    this.#rafId = requestAnimationFrame((t) => this.#loop(t));
  }

  _update(dt, jp, jr) {
    const world = this.worldManager?.currentWorld;
    if (!world) return;

    // Player update
    this.player?.update(this.keys, world, dt);

    // Update camera
    const worldWidth = world.width;
    this.camera.x = Math.max(0, Math.min(this.player.x - 450, worldWidth - 900));

    // Buddy follow
    this.buddy?.update(dt, this.player);

    // HUD hint timer
    if (this.#hudHintTimer > 0) {
      this.#hudHintTimer -= dt / 60;
      this.#hudHintAlpha = Math.max(0, Math.min(1, this.#hudHintTimer));
    }

    // Jump SFX
    if (this.player._justJumped) {
      this.player._justJumped = false;
      this.audioManager?.playJump();
    }

    // B key — ask Buddy (bark + request)
    if (jp['KeyB']) {
      this.buddy?.bark();
      this.buddy?.requestHelp(this.worldManager.getGameState());
    }

    // E key — interact with challenge zone
    if (jp['KeyE']) {
      const zone = this._getOverlappingZone(world);
      if (zone && !zone.solved) {
        this.audioManager?.playZoneEnter();
        this.challengeManager?.open(zone, world.worldIndex);
      }
    }

    // Portal collision
    if (!this.paused) {
      const portal = world.portal;
      if (portal && !portal.locked && this._overlaps(this.player, portal, 40, 80)) {
        this.worldManager?.advanceWorld();
      }
    }

    // Zone proximity hint
    world.challengeZones.forEach(z => {
      z._playerNear = this._overlaps(this.player, z, z.w, z.h, 32);
    });
  }

  _getOverlappingZone(world) {
    return world.challengeZones.find(z =>
      !z.solved && this._overlaps(this.player, z, z.w, z.h, 16)
    );
  }

  _overlaps(player, rect, rw, rh, margin = 0) {
    return (
      player.x + player.width > rect.x - margin &&
      player.x < rect.x + rw + margin &&
      player.y + player.height > rect.y &&
      player.y < rect.y + rh
    );
  }

  // ── Render ────────────────────────────────────────────────────

  _render() {
    const ctx = this.#ctx;
    const world = this.worldManager?.currentWorld;
    ctx.clearRect(0, 0, 900, 480);

    if (!this.started) {
      this._renderStartScreen(ctx);
      return;
    }

    if (!world) return;

    // Sky / background
    ctx.fillStyle = world.bg;
    ctx.fillRect(0, 0, 900, 480);

    // Background decorations (behind platforms)
    this._renderDecorations(ctx, world, 'back');

    // Ground
    ctx.fillStyle = world.groundColor || '#4a7c2a';
    ctx.fillRect(-this.camera.x, world.groundY, world.width, 480 - world.groundY);
    ctx.fillStyle = world.groundTopColor || '#5a9c32';
    ctx.fillRect(-this.camera.x, world.groundY, world.width, 8);

    // Platforms
    this._renderPlatforms(ctx, world);

    // Foreground decorations
    this._renderDecorations(ctx, world, 'front');

    // Challenge zones
    this._renderZones(ctx, world);

    // Portal
    this._renderPortal(ctx, world);

    // Player
    this.player?.render(ctx, this.camera);

    // Buddy
    this.buddy?.render(ctx, this.camera);

    // HUD
    this._renderHUD(ctx, world);

    // Challenge overlay (drawn on top)
    this.challengeManager?.render(ctx);

    // Transition overlay
    this.worldManager?.renderTransition(ctx);
  }

  _renderStartScreen(ctx) {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, 900, 480);

    // Title
    ctx.fillStyle = '#f0c040';
    ctx.font = 'bold 48px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText("Buddy's World Adventure", 450, 180);

    ctx.fillStyle = '#a0d8ef';
    ctx.font = '22px "Segoe UI", sans-serif';
    ctx.fillText('Help Buddy explore 3 magical worlds!', 450, 230);
    ctx.fillText('Solve puzzles to unlock the portal to the next world.', 450, 262);

    // Blinking "Press any key"
    if (Math.floor(Date.now() / 600) % 2 === 0) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px "Segoe UI", sans-serif';
      ctx.fillText('Press any key to start', 450, 330);
    }

    // Controls reminder
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '15px "Segoe UI", sans-serif';
    ctx.fillText('A/D or ←/→ Move   ·   Space or ↑ Jump   ·   E Interact   ·   B Ask Buddy', 450, 420);
    ctx.textAlign = 'left';
  }

  _renderPlatforms(ctx, world) {
    for (const p of world.platforms) {
      ctx.fillStyle = p.color || '#8b7355';
      const sx = p.x - this.camera.x;
      if (sx + p.w < 0 || sx > 900) continue;
      ctx.fillRect(sx, p.y, p.w, p.h);
      // top highlight
      ctx.fillStyle = p.topColor || p.color || '#8b7355';
      ctx.fillRect(sx, p.y, p.w, 5);
    }
  }

  _renderDecorations(ctx, world, layer) {
    const t = Date.now() / 1000;
    for (const d of world.decorations) {
      if ((d.layer || 'back') !== layer) continue;
      const sx = d.x - this.camera.x;
      if (sx + 100 < 0 || sx > 1000) continue;
      this._renderDecoration(ctx, d, sx, t);
    }
  }

  _renderDecoration(ctx, d, sx, t) {
    switch (d.type) {
      case 'tree': {
        // trunk
        ctx.fillStyle = '#5d3a1a';
        ctx.fillRect(sx + d.w * 0.4, d.y + d.h * 0.5, d.w * 0.2, d.h * 0.5);
        // foliage
        ctx.fillStyle = d.color || '#2d6a2d';
        ctx.beginPath();
        ctx.arc(sx + d.w / 2, d.y + d.h * 0.4, d.w * 0.45, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'mushroom': {
        const glow = 0.5 + 0.5 * Math.sin(t * 2 + d.x * 0.01);
        ctx.fillStyle = '#ddd';
        ctx.fillRect(sx + d.w * 0.38, d.y + d.h * 0.5, d.w * 0.24, d.h * 0.5);
        ctx.fillStyle = d.color || '#cc2222';
        ctx.beginPath();
        ctx.ellipse(sx + d.w / 2, d.y + d.h * 0.4, d.w * 0.5, d.h * 0.45, 0, Math.PI, 0);
        ctx.fill();
        // glow dots
        ctx.fillStyle = `rgba(255,255,200,${0.3 + glow * 0.5})`;
        ctx.beginPath();
        ctx.arc(sx + d.w * 0.35, d.y + d.h * 0.3, 4, 0, Math.PI * 2);
        ctx.arc(sx + d.w * 0.65, d.y + d.h * 0.35, 3, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'cloud': {
        ctx.fillStyle = d.color || 'rgba(255,255,255,0.85)';
        const cy = d.y + Math.sin(t * 0.3 + d.x * 0.005) * 4;
        ctx.beginPath();
        ctx.arc(sx + d.w * 0.3, cy, d.h * 0.5, 0, Math.PI * 2);
        ctx.arc(sx + d.w * 0.55, cy - d.h * 0.15, d.h * 0.6, 0, Math.PI * 2);
        ctx.arc(sx + d.w * 0.75, cy, d.h * 0.45, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'rock': {
        ctx.fillStyle = d.color || '#888';
        ctx.beginPath();
        ctx.ellipse(sx + d.w / 2, d.y + d.h * 0.6, d.w * 0.5, d.h * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'lava': {
        const glow = 0.6 + 0.4 * Math.sin(t * 3 + d.x * 0.02);
        ctx.fillStyle = `rgba(255,${80 + glow * 60},0,${glow * 0.8})`;
        ctx.fillRect(sx, d.y, d.w, d.h);
        break;
      }
      case 'firefly': {
        const on = Math.sin(t * 4 + d.x * 0.3) > 0;
        if (on) {
          ctx.fillStyle = 'rgba(200,255,100,0.9)';
          ctx.beginPath();
          ctx.arc(sx + Math.sin(t + d.x) * 15, d.y + Math.cos(t * 0.7 + d.x) * 10, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'spire': {
        ctx.fillStyle = d.color || '#3a2a2a';
        ctx.beginPath();
        ctx.moveTo(sx + d.w / 2, d.y);
        ctx.lineTo(sx + d.w, d.y + d.h);
        ctx.lineTo(sx, d.y + d.h);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case 'island': {
        ctx.fillStyle = d.color || '#7b9e6b';
        ctx.beginPath();
        ctx.ellipse(sx + d.w / 2, d.y + d.h * 0.7, d.w * 0.5, d.h * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5a7a4a';
        ctx.fillRect(sx, d.y + d.h * 0.6, d.w, d.h * 0.1);
        break;
      }
    }
  }

  _renderZones(ctx, world) {
    const t = Date.now() / 1000;
    for (const z of world.challengeZones) {
      const sx = z.x - this.camera.x;
      if (sx + z.w < 0 || sx > 900) continue;

      if (z.solved) {
        // Solved — golden shimmer
        ctx.fillStyle = 'rgba(255,215,0,0.25)';
        ctx.fillRect(sx, z.y, z.w, z.h);
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.strokeRect(sx, z.y, z.w, z.h);
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 18px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('✓', sx + z.w / 2, z.y - 8);
      } else {
        // Unsolved — pulsing glow
        const pulse = 0.4 + 0.3 * Math.sin(t * 2.5 + z.id);
        ctx.fillStyle = `rgba(100,180,255,${pulse * 0.3})`;
        ctx.fillRect(sx, z.y, z.w, z.h);
        ctx.strokeStyle = `rgba(100,180,255,${pulse})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(sx, z.y, z.w, z.h);

        // Label above
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(z.label, sx + z.w / 2, z.y - 8);

        // "Press E" hint if near
        if (z._playerNear) {
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.font = '12px sans-serif';
          ctx.fillText('[E] Enter', sx + z.w / 2, z.y - 24);
        }
      }
      ctx.textAlign = 'left';
    }
  }

  _renderPortal(ctx, world) {
    const portal = world.portal;
    if (!portal) return;
    const sx = portal.x - this.camera.x;
    if (sx + 80 < 0 || sx > 900) return;

    const t = Date.now() / 1000;
    const locked = portal.locked;

    // Arch shape
    const archX = sx;
    const archY = portal.y;
    const archW = 70;
    const archH = 120;

    if (locked) {
      ctx.fillStyle = 'rgba(60,60,80,0.6)';
      ctx.strokeStyle = '#555577';
    } else {
      const glow = 0.7 + 0.3 * Math.sin(t * 3);
      ctx.fillStyle = `rgba(80,20,160,${glow * 0.5})`;
      ctx.strokeStyle = `rgba(180,100,255,${glow})`;
      // Outer glow
      ctx.shadowColor = '#a050ff';
      ctx.shadowBlur = 20 * glow;
    }

    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(archX, archY + archH);
    ctx.lineTo(archX, archY + archH * 0.35);
    ctx.arc(archX + archW / 2, archY + archH * 0.35, archW / 2, Math.PI, 0);
    ctx.lineTo(archX + archW, archY + archH);
    ctx.stroke();
    ctx.fill();
    ctx.shadowBlur = 0;

    // Inner fill
    ctx.fillStyle = locked ? 'rgba(30,30,50,0.8)' : `rgba(120,40,220,${0.5 + 0.3 * Math.sin(t * 4)})`;
    ctx.beginPath();
    ctx.moveTo(archX + 8, archY + archH);
    ctx.lineTo(archX + 8, archY + archH * 0.38);
    ctx.arc(archX + archW / 2, archY + archH * 0.38, archW / 2 - 8, Math.PI, 0);
    ctx.lineTo(archX + archW - 8, archY + archH);
    ctx.fill();

    // Lock icon or arrow
    ctx.fillStyle = locked ? '#888' : '#fff';
    ctx.font = locked ? '24px sans-serif' : 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(locked ? '🔒' : '▶', archX + archW / 2, archY + archH * 0.65);
    ctx.textAlign = 'left';
  }

  _renderHUD(ctx, world) {
    // World name
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(8, 8, 260, 38);
    ctx.fillStyle = '#f0e080';
    ctx.font = 'bold 15px "Segoe UI", sans-serif';
    ctx.fillText(`World ${world.worldIndex + 1}: ${world.name}`, 16, 32);

    // Progress dots
    const dotX = 276;
    for (let i = 0; i < 3; i++) {
      const solved = world.challengeZones[i]?.solved;
      ctx.fillStyle = solved ? '#ffd700' : 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.arc(dotX + i * 22, 27, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = solved ? '#ffd700' : 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Buddy hint (fades after 10s)
    if (this.#hudHintAlpha > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.#hudHintAlpha * 0.75})`;
      ctx.font = '14px "Segoe UI", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('🐾  B = Ask Buddy', 892, 30);
      ctx.textAlign = 'left';
    }
  }
}
