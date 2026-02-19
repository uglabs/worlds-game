/**
 * player.js — Physics, collision, and canvas rendering.
 * 32×48 AABB. Stylized cartoon character — no sprites.
 */

const GRAVITY = 0.55;
const JUMP_VEL = -13;
const SPEED = 5;

export class Player {
  x; y;
  vx = 0; vy = 0;
  width = 32; height = 48;
  onGround = false;
  facing = 1;
  _justJumped = false;  // read by engine for jump SFX

  #legPhase = 0;
  #state = 'idle';
  #capePhase = 0;

  constructor(x, y) { this.x = x; this.y = y; }

  // ── Update ────────────────────────────────────────────────────

  update(keys, world, dt) {
    const left  = keys['ArrowLeft']  || keys['KeyA'];
    const right = keys['ArrowRight'] || keys['KeyD'];
    this.vx = 0;
    if (left)  { this.vx = -SPEED; this.facing = -1; }
    if (right) { this.vx =  SPEED; this.facing =  1; }

    const jumpKey = keys['Space'] || keys['ArrowUp'] || keys['KeyW'];
    if (jumpKey && this.onGround) {
      this.vy = JUMP_VEL;
      this.onGround = false;
      this._justJumped = true;
    }

    this.vy += GRAVITY * dt;
    this.x += this.vx * dt;
    this.x = Math.max(0, Math.min(this.x, world.width - this.width));
    this._collidePlatformsX(world.platforms);
    this.y += this.vy * dt;
    this.onGround = false;
    this._collidePlatformsY(world.platforms);

    if (this.y + this.height >= world.groundY) {
      this.y = world.groundY - this.height;
      this.vy = 0;
      this.onGround = true;
    }

    if (!this.onGround) {
      this.#state = 'jump';
    } else if (this.vx !== 0) {
      this.#state = 'run';
      this.#legPhase += 0.2 * dt;
    } else {
      this.#state = 'idle';
      this.#legPhase += 0.025 * dt;
    }
    this.#capePhase += 0.05 * dt;
  }

  _collidePlatformsX(platforms) {
    for (const p of platforms) {
      if (this._aabb(p)) {
        const oR = (this.x + this.width) - p.x;
        const oL = (p.x + p.w) - this.x;
        this.x = oR < oL ? p.x - this.width : p.x + p.w;
        this.vx = 0;
      }
    }
  }

  _collidePlatformsY(platforms) {
    for (const p of platforms) {
      if (this._aabb(p)) {
        const oB = (this.y + this.height) - p.y;
        const oT = (p.y + p.h) - this.y;
        if (oB < oT && this.vy >= 0) {
          this.y = p.y - this.height;
          this.vy = 0;
          this.onGround = true;
        } else if (oT < oB && this.vy < 0) {
          this.y = p.y + p.h;
          this.vy = 0;
        }
      }
    }
  }

  _aabb(p) {
    return this.x < p.x + p.w && this.x + this.width > p.x &&
           this.y < p.y + p.h && this.y + this.height > p.y;
  }

  // ── Render ────────────────────────────────────────────────────

  render(ctx, camera) {
    const sx = this.x - camera.x;
    const sy = this.y;
    const cx = sx + this.width / 2;

    ctx.save();
    ctx.translate(cx, sy + this.height);  // (0,0) = feet center
    if (this.facing === -1) ctx.scale(-1, 1);

    this._drawShadow(ctx);
    this._drawCape(ctx);
    this._drawLegs(ctx);
    this._drawBody(ctx);
    this._drawHead(ctx);

    ctx.restore();
  }

  _drawShadow(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 14, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawCape(ctx) {
    const wave = Math.sin(this.#capePhase) * 3;
    const isRun = this.#state === 'run';
    const flap = isRun ? Math.sin(this.#legPhase) * 5 : wave;
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.moveTo(-2, -40);
    ctx.lineTo(-2, -28);
    ctx.quadraticCurveTo(-18, -20 + flap, -20, -8 + flap * 0.5);
    ctx.quadraticCurveTo(-16, -14, -8, -28);
    ctx.closePath();
    ctx.fill();
    // Cape highlight
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.moveTo(-3, -40);
    ctx.lineTo(-3, -30);
    ctx.quadraticCurveTo(-10, -24, -11, -16 + flap * 0.3);
    ctx.lineTo(-7, -28);
    ctx.closePath();
    ctx.fill();
  }

  _drawLegs(ctx) {
    const isRun = this.#state === 'run';
    const isJump = this.#state === 'jump';
    const ph = this.#legPhase;

    // Left leg
    const lSwing = isRun ? Math.sin(ph) * 9 : isJump ? -7 : 0;
    ctx.fillStyle = '#2980b9';
    ctx.beginPath(); ctx.roundRect(-11, -22 + lSwing, 9, 22 - lSwing, 3); ctx.fill();
    // Left shoe
    ctx.fillStyle = '#ecf0f1';
    ctx.beginPath(); ctx.ellipse(-7, lSwing, 7, 4, 0, 0, Math.PI * 2); ctx.fill();

    // Right leg
    const rSwing = isRun ? -Math.sin(ph) * 9 : isJump ? -5 : 0;
    ctx.fillStyle = '#2980b9';
    ctx.beginPath(); ctx.roundRect(2, -22 + rSwing, 9, 22 - rSwing, 3); ctx.fill();
    ctx.fillStyle = '#ecf0f1';
    ctx.beginPath(); ctx.ellipse(6, rSwing, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
  }

  _drawBody(ctx) {
    // Jacket
    ctx.fillStyle = '#e67e22';
    ctx.beginPath(); ctx.roundRect(-13, -46, 26, 26, 5); ctx.fill();
    // Jacket outline
    ctx.strokeStyle = '#ca6f1e';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(-13, -46, 26, 26, 5); ctx.stroke();
    // Zipper strip
    ctx.fillStyle = '#ca6f1e';
    ctx.fillRect(-1.5, -46, 3, 26);
    // Collar
    ctx.fillStyle = '#ecf0f1';
    ctx.beginPath();
    ctx.moveTo(-13, -46); ctx.lineTo(-6, -46); ctx.lineTo(0, -40); ctx.lineTo(6, -46); ctx.lineTo(13, -46);
    ctx.lineTo(13, -42); ctx.lineTo(6, -42); ctx.lineTo(0, -36); ctx.lineTo(-6, -42); ctx.lineTo(-13, -42);
    ctx.closePath(); ctx.fill();

    const armSwing = this.#state === 'run' ? Math.sin(this.#legPhase) * 7 : 0;
    // Left arm
    ctx.fillStyle = '#e67e22';
    ctx.beginPath(); ctx.roundRect(-19, -44 + armSwing, 8, 18, 4); ctx.fill();
    ctx.strokeStyle = '#ca6f1e'; ctx.lineWidth = 1;
    ctx.strokeRect(-19, -44 + armSwing, 8, 18);
    // Left fist
    ctx.fillStyle = '#f5cba7';
    ctx.beginPath(); ctx.arc(-15, -26 + armSwing, 4, 0, Math.PI * 2); ctx.fill();

    // Right arm
    ctx.fillStyle = '#e67e22';
    ctx.beginPath(); ctx.roundRect(11, -44 - armSwing, 8, 18, 4); ctx.fill();
    ctx.strokeStyle = '#ca6f1e'; ctx.lineWidth = 1;
    ctx.strokeRect(11, -44 - armSwing, 8, 18);
    ctx.fillStyle = '#f5cba7';
    ctx.beginPath(); ctx.arc(15, -26 - armSwing, 4, 0, Math.PI * 2); ctx.fill();
  }

  _drawHead(ctx) {
    // Neck
    ctx.fillStyle = '#f5cba7';
    ctx.fillRect(-4, -52, 8, 8);

    // Head
    ctx.fillStyle = '#f5cba7';
    ctx.beginPath(); ctx.roundRect(-13, -70, 26, 24, 8); ctx.fill();
    ctx.strokeStyle = '#e59866'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(-13, -70, 26, 24, 8); ctx.stroke();

    // Eyes
    // Eye whites
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(5, -60, 5, 5.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-5, -60, 5, 5.5, 0, 0, Math.PI * 2); ctx.fill();
    // Pupils
    ctx.fillStyle = '#2c3e50';
    ctx.beginPath(); ctx.arc(6, -59, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-4, -59, 3, 0, Math.PI * 2); ctx.fill();
    // Shine
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(7, -61, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-3, -61, 1.2, 0, Math.PI * 2); ctx.fill();

    // Eyebrows
    ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    const brow = this.#state === 'jump' ? -2 : 0;
    ctx.beginPath(); ctx.moveTo(1, -67 + brow); ctx.lineTo(9, -65 + brow); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-1, -67 + brow); ctx.lineTo(-9, -65 + brow); ctx.stroke();

    // Mouth
    ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (this.#state === 'jump') {
      ctx.arc(0, -53, 4, 0.2, Math.PI - 0.2); // smile on jump
    } else {
      ctx.arc(0, -55, 3, 0.3, Math.PI - 0.3);
    }
    ctx.stroke();

    // Hair — swept back style
    ctx.fillStyle = '#4a2f0a';
    ctx.beginPath();
    ctx.moveTo(-13, -66);
    ctx.quadraticCurveTo(-13, -76, -4, -78);
    ctx.quadraticCurveTo(8, -80, 14, -72);
    ctx.lineTo(13, -66);
    ctx.closePath();
    ctx.fill();
    // Hair highlight
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.moveTo(-8, -68);
    ctx.quadraticCurveTo(-10, -75, -2, -77);
    ctx.quadraticCurveTo(3, -78, 5, -74);
    ctx.lineTo(4, -68);
    ctx.closePath();
    ctx.fill();
  }
}
