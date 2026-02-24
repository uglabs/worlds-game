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
  buddyPanel = null;
  worldManager = null;
  challengeManager = null;
  audioManager = null;

  paused = false;
  started = false; // false until first keypress

  // Story phase: 'wait' → 'showing' → 'done'
  #storyPhase = 'wait';
  #storyTimer = 5.0; // seconds before auto-advance

  // Input state
  keys = {};
  #justPressed = {};
  #justReleased = {};

  camera = { x: 0 };

  #hudHintAlpha = 1;
  #hudHintTimer = 10;

  constructor(canvas) {
    this.#canvas = canvas;
    this.#ctx = canvas.getContext('2d');
    this._bindInput();
  }

  // Expose canvas for challenge-manager hit-testing
  get _canvas() { return this.#canvas; }

  // ── Input ──────────────────────────────────────────────────────

  _bindInput() {
    window.addEventListener('keydown', (e) => {
      if (!this.keys[e.code]) {
        this.#justPressed[e.code] = true;
      }
      this.keys[e.code] = true;

      if (!this.started) {
        this.started = true;
        return;
      }

      // Skip story screen on any key
      if (this.#storyPhase === 'showing') {
        this.#storyPhase = 'done';
      }

      // B key toggles Buddy panel — always, even when paused
      if (e.code === 'KeyB' && this.#storyPhase === 'done') {
        this.buddyPanel?.toggle();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      this.#justReleased[e.code] = true;
    });
  }

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
    const dt = Math.min((timestamp - this.#lastTime) / 16.67, 3);
    this.#lastTime = timestamp;

    const { jp, jr } = this._consumeInput();

    if (!this.paused && this.started) {
      if (this.#storyPhase === 'showing') {
        this._updateStory(dt);
      } else if (this.#storyPhase === 'done') {
        this._update(dt, jp, jr);
      } else {
        // 'wait' — started just became true this frame, transition to story
        this.#storyPhase = 'showing';
        this.#storyTimer = 5.0;
      }
    }

    this._render();
    this.#rafId = requestAnimationFrame((t) => this.#loop(t));
  }

  _updateStory(dt) {
    this.#storyTimer -= dt / 60;
    if (this.#storyTimer <= 0) {
      this.#storyPhase = 'done';
    }
  }

  _update(dt, jp, jr) {
    const world = this.worldManager?.currentWorld;
    if (!world) return;

    this.player?.update(this.keys, world, dt);

    const worldWidth = world.width;
    this.camera.x = Math.max(0, Math.min(this.player.x - 450, worldWidth - 900));

    this.buddy?.update(dt, this.player);

    if (this.#hudHintTimer > 0) {
      this.#hudHintTimer -= dt / 60;
      this.#hudHintAlpha = Math.max(0, Math.min(1, this.#hudHintTimer));
    }

    if (this.player._justJumped) {
      this.player._justJumped = false;
      this.audioManager?.playJump();
    }

    // (B key handled in _bindInput so it works even when paused)

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

    if (this.#storyPhase !== 'done') {
      this._renderStoryScreen(ctx);
      return;
    }

    if (!world) return;

    ctx.fillStyle = world.bg;
    ctx.fillRect(0, 0, 900, 480);

    this._renderDecorations(ctx, world, 'back');

    ctx.fillStyle = world.groundColor || '#4a7c2a';
    ctx.fillRect(-this.camera.x, world.groundY, world.width, 480 - world.groundY);
    ctx.fillStyle = world.groundTopColor || '#5a9c32';
    ctx.fillRect(-this.camera.x, world.groundY, world.width, 8);

    this._renderPlatforms(ctx, world);
    this._renderDecorations(ctx, world, 'front');
    this._renderZones(ctx, world);
    this._renderPortal(ctx, world);

    this.player?.render(ctx, this.camera);
    this.buddy?.render(ctx, this.camera);

    this._renderHUD(ctx, world);

    this.challengeManager?.render(ctx);
    this.buddyPanel?.render(ctx);
    this.worldManager?.renderTransition(ctx);
  }

  _renderStartScreen(ctx) {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, 900, 480);

    ctx.fillStyle = '#f0c040';
    ctx.font = 'bold 48px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText("Buddy's World Adventure", 450, 180);

    ctx.fillStyle = '#a0d8ef';
    ctx.font = '22px "Segoe UI", sans-serif';
    ctx.fillText('Help Buddy rescue Luna the Fox!', 450, 230);
    ctx.fillText('Solve challenges in all 3 worlds to save her.', 450, 262);

    if (Math.floor(Date.now() / 600) % 2 === 0) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px "Segoe UI", sans-serif';
      ctx.fillText('Press any key to start', 450, 330);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '15px "Segoe UI", sans-serif';
    ctx.fillText('A/D or ←/→ Move   ·   Space or ↑ Jump   ·   E Interact   ·   B Ask Buddy', 450, 420);
    ctx.textAlign = 'left';
  }

  _renderStoryScreen(ctx) {
    const t = Date.now() / 1000;
    const alpha = Math.min(1, (5.0 - this.#storyTimer) * 2); // fade in

    ctx.fillStyle = '#0a0518';
    ctx.fillRect(0, 0, 900, 480);

    // Stars in background
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    for (let i = 0; i < 40; i++) {
      const sx = ((i * 137.5 + 50) % 880) + 10;
      const sy = ((i * 89.3 + 30) % 440) + 20;
      const br = 0.3 + 0.7 * Math.abs(Math.sin(t * 1.2 + i));
      ctx.globalAlpha = br * alpha;
      ctx.beginPath();
      ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = alpha;

    // Luna portrait (simple orange fox silhouette)
    this._drawLunaFox(ctx, 180, 240, 1.5);

    // Story text
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 28px "Segoe UI", sans-serif';
    ctx.fillText('🦊  A Fox in Danger!', 450, 120);

    ctx.fillStyle = '#e0e8ff';
    ctx.font = '18px "Segoe UI", sans-serif';
    const lines = [
      'Luna the Magic Fox has been captured',
      'by the Volcano Witch!',
      '',
      'Help Buddy solve challenges in all 3 worlds',
      'to rescue her and break the spell.',
    ];
    lines.forEach((line, i) => {
      ctx.fillText(line, 540, 175 + i * 28);
    });

    // Skip hint (blinking)
    if (Math.floor(t * 2) % 2 === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '15px "Segoe UI", sans-serif';
      ctx.fillText('Press any key to start', 450, 440);
    }

    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  _drawLunaFox(ctx, cx, cy, scale = 1) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    // Body
    ctx.fillStyle = '#d4600a';
    ctx.beginPath();
    ctx.ellipse(0, 0, 28, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.beginPath();
    ctx.arc(30, -22, 18, 0, Math.PI * 2);
    ctx.fill();

    // Ears (pointed)
    ctx.fillStyle = '#d4600a';
    ctx.beginPath();
    ctx.moveTo(22, -34); ctx.lineTo(16, -54); ctx.lineTo(32, -40);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(36, -34); ctx.lineTo(44, -54); ctx.lineTo(48, -38);
    ctx.closePath(); ctx.fill();

    // Inner ears
    ctx.fillStyle = '#ffaaaa';
    ctx.beginPath();
    ctx.moveTo(23, -36); ctx.lineTo(18, -50); ctx.lineTo(30, -41);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(37, -36); ctx.lineTo(43, -50); ctx.lineTo(46, -40);
    ctx.closePath(); ctx.fill();

    // White face patch
    ctx.fillStyle = '#ffe8cc';
    ctx.beginPath();
    ctx.ellipse(34, -18, 10, 13, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Eye (sparkly)
    ctx.fillStyle = '#1a0050';
    ctx.beginPath(); ctx.arc(36, -24, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(38, -26, 1.5, 0, Math.PI * 2); ctx.fill();

    // Nose
    ctx.fillStyle = '#3d1a00';
    ctx.beginPath(); ctx.ellipse(44, -19, 3, 2, 0, 0, Math.PI * 2); ctx.fill();

    // Fluffy tail
    ctx.fillStyle = '#d4600a';
    ctx.beginPath();
    ctx.moveTo(-20, 0);
    ctx.bezierCurveTo(-50, -10, -60, -30, -45, -45);
    ctx.bezierCurveTo(-35, -55, -20, -50, -25, -35);
    ctx.bezierCurveTo(-28, -20, -10, -15, -20, 0);
    ctx.fill();
    // Tail tip
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-44, -44, 9, 0, Math.PI * 2); ctx.fill();

    // Magic sparkles around Luna
    const t2 = Date.now() / 600;
    ctx.fillStyle = '#a060ff';
    for (let i = 0; i < 5; i++) {
      const angle = t2 + i * (Math.PI * 2 / 5);
      const r = 42 + Math.sin(t2 * 2 + i) * 6;
      const sx2 = Math.cos(angle) * r;
      const sy2 = Math.sin(angle) * r - 10;
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t2 + i * 1.3);
      ctx.beginPath(); ctx.arc(sx2, sy2, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  _renderPlatforms(ctx, world) {
    const t = Date.now();
    for (const p of world.platforms) {
      const sx = p.x - this.camera.x;
      if (sx + p.w < 0 || sx > 900) continue;

      // Glow ring for challenge platforms (drawn behind)
      if (p.glowColor) {
        const pulse = 0.2 + 0.15 * Math.sin(t / 400);
        ctx.fillStyle = p.glowColor.replace('ALPHA', String(pulse));
        ctx.fillRect(sx - 4, p.y - 4, p.w + 8, p.h + 8);
      }

      // Main body
      ctx.fillStyle = p.color || '#8b7355';
      ctx.fillRect(sx, p.y, p.w, p.h);

      // Wider top highlight (14px)
      ctx.fillStyle = p.topColor || p.color || '#8b7355';
      ctx.fillRect(sx, p.y, p.w, 14);

      // Bright outline
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx, p.y, p.w, p.h);
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
        ctx.fillStyle = '#5d3a1a';
        ctx.fillRect(sx + d.w * 0.4, d.y + d.h * 0.5, d.w * 0.2, d.h * 0.5);
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
        const pulse = 0.4 + 0.3 * Math.sin(t * 2.5 + z.id);
        ctx.fillStyle = `rgba(100,180,255,${pulse * 0.3})`;
        ctx.fillRect(sx, z.y, z.w, z.h);
        ctx.strokeStyle = `rgba(100,180,255,${pulse})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(sx, z.y, z.w, z.h);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(z.label, sx + z.w / 2, z.y - 8);

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

    ctx.fillStyle = locked ? 'rgba(30,30,50,0.8)' : `rgba(120,40,220,${0.5 + 0.3 * Math.sin(t * 4)})`;
    ctx.beginPath();
    ctx.moveTo(archX + 8, archY + archH);
    ctx.lineTo(archX + 8, archY + archH * 0.38);
    ctx.arc(archX + archW / 2, archY + archH * 0.38, archW / 2 - 8, Math.PI, 0);
    ctx.lineTo(archX + archW - 8, archY + archH);
    ctx.fill();

    ctx.fillStyle = locked ? '#888' : '#fff';
    ctx.font = locked ? '24px sans-serif' : 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(locked ? '🔒' : '▶', archX + archW / 2, archY + archH * 0.65);
    ctx.textAlign = 'left';
  }

  _renderHUD(ctx, world) {
    // World name + background
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(8, 8, 260, 38);
    ctx.fillStyle = '#f0e080';
    ctx.font = 'bold 15px "Segoe UI", sans-serif';
    ctx.fillText(`World ${world.worldIndex + 1}: ${world.name}`, 16, 32);

    // Zone progress dots
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

    // Hearts (lives)
    const lives = this.challengeManager?.lives ?? 3;
    ctx.font = '18px sans-serif';
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i < lives ? '#ff4040' : '#444';
      ctx.fillText(i < lives ? '❤️' : '🖤', 10 + i * 26, 68);
    }

    // Credits
    const credits = this.challengeManager?.credits ?? 0;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(8, 74, 90, 22);
    ctx.fillStyle = credits > 0 ? '#ffd700' : '#888';
    ctx.font = 'bold 13px "Segoe UI", sans-serif';
    ctx.fillText(`🦴 ×${credits}`, 14, 90);

    // Luna rescue progress (top-right)
    this._renderLunaProgress(ctx);

    // Buddy hint (fades after 10s)
    if (this.#hudHintAlpha > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.#hudHintAlpha * 0.75})`;
      ctx.font = '14px "Segoe UI", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('🐾  B = Ask Buddy', 892, 30);
      ctx.textAlign = 'left';
    }
  }

  _renderLunaProgress(ctx) {
    // Show world completion segments: how far has the player gotten?
    const currentWorldIdx = this.worldManager?.worldIndex ?? 0;
    const segW = 50, segH = 12, gap = 6;
    const totalW = 3 * segW + 2 * gap;
    const startX = 900 - totalW - 10;
    const startY = 46;

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(startX - 6, startY - 14, totalW + 12, segH + 20);

    ctx.fillStyle = 'rgba(255,255,200,0.7)';
    ctx.font = '10px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🦊 Luna', startX + totalW / 2, startY - 2);

    for (let i = 0; i < 3; i++) {
      const x = startX + i * (segW + gap);
      const complete = i < currentWorldIdx;
      const inProgress = i === currentWorldIdx;

      ctx.fillStyle = complete ? '#50e050' : inProgress ? 'rgba(255,200,0,0.5)' : 'rgba(80,80,80,0.5)';
      ctx.fillRect(x, startY, segW, segH);

      if (complete) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText('✓', x + segW / 2, startY + 9);
      } else if (inProgress) {
        // Pulse
        const pulse = 0.4 + 0.3 * Math.sin(Date.now() / 400);
        ctx.strokeStyle = `rgba(255,200,0,${pulse + 0.4})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, startY, segW, segH);
      }
    }
    ctx.textAlign = 'left';
  }
}
