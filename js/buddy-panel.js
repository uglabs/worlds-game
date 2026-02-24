/**
 * buddy-panel.js — Buddy conversation sidebar panel.
 * A clickable portrait button in the bottom-right corner opens a
 * slide-in sidebar showing the full conversation history, a text
 * input box, and a push-to-talk [P] button.
 */

export class BuddyPanel {
  #buddy = null;
  #engine = null;

  #open = false;
  #messages = [];   // { role: 'player'|'buddy', text: string, _streaming?, _voice? }
  #scrollY = 0;

  #inputEl = null;
  #inputWrapper = null;

  // Fixed button position (canvas coords 900×480)
  static BTN_X = 856;
  static BTN_Y = 420;
  static BTN_R = 30;
  static PANEL_W = 245;

  constructor({ buddy, engine }) {
    this.#buddy = buddy;
    this.#engine = engine;

    // Subscribe to buddy text streaming so panel shows live responses
    buddy?.onTextChunk((chunk) => {
      const last = this.#messages.at(-1);
      if (last?.role === 'buddy' && last._streaming) {
        last.text += chunk;
      } else {
        this.#messages.push({ role: 'buddy', text: chunk, _streaming: true });
      }
      this.#scrollY = Infinity;
    });

    buddy?.onInteractionDone(() => {
      const last = this.#messages.at(-1);
      if (last?._streaming) delete last._streaming;
    });

    this._createInputEl();
    this._bindCanvasClick();
    this._bindPanelKeys();
  }

  get isOpen() { return this.#open; }

  open() {
    if (this.#open) return;
    this.#open = true;
    if (this.#engine) this.#engine.paused = true;
    if (!this.#messages.length) {
      this.#messages.push({
        role: 'buddy',
        text: "Woof! Hi! I'm Buddy 🐾 Ask me anything — type below or press [P] to talk!"
      });
    }
    this._repositionInput();
    if (this.#inputWrapper) this.#inputWrapper.style.display = 'block';
    requestAnimationFrame(() => this.#inputEl?.focus());
  }

  close() {
    if (!this.#open) return;
    this.#open = false;
    // Only unpause if the challenge isn't keeping things paused
    if (this.#engine && !this.#engine.challengeManager?.isActive) {
      this.#engine.paused = false;
    }
    if (this.#inputWrapper) this.#inputWrapper.style.display = 'none';
    this.#inputEl?.blur();
  }

  toggle() { this.#open ? this.close() : this.open(); }

  // ── DOM input element ────────────────────────────────────────

  _createInputEl() {
    const canvas = document.getElementById('game-canvas');
    const parent = canvas.parentElement || document.body;
    parent.style.position = parent.style.position || 'relative';

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:absolute;display:none;pointer-events:all;box-sizing:border-box;';

    const ta = document.createElement('textarea');
    ta.placeholder = 'Ask Buddy anything…';
    ta.style.cssText = [
      'width:100%;height:100%;box-sizing:border-box;',
      'background:transparent;border:none;outline:none;resize:none;',
      'color:#fff;font:13px "Segoe UI",sans-serif;padding:8px 10px;',
    ].join('');

    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this._submit(); }
      e.stopPropagation();
    });
    ta.addEventListener('keyup', (e) => e.stopPropagation());

    wrapper.appendChild(ta);
    parent.appendChild(wrapper);
    this.#inputWrapper = wrapper;
    this.#inputEl = ta;
  }

  _repositionInput() {
    const canvas = document.getElementById('game-canvas');
    const rect = canvas.getBoundingClientRect();
    const sx = rect.width / 900;
    const sy = rect.height / 480;
    const W = BuddyPanel.PANEL_W;
    const panelLeft = (900 - W) * sx + rect.left;
    // Input occupies canvas area y:390-444 (54px tall), 10px inset from panel edges
    this.#inputWrapper.style.left   = `${panelLeft + 10 * sx}px`;
    this.#inputWrapper.style.top    = `${rect.top + 392 * sy}px`;
    this.#inputWrapper.style.width  = `${(W - 20) * sx}px`;
    this.#inputWrapper.style.height = `${50 * sy}px`;
  }

  // ── Event bindings ──────────────────────────────────────────

  _bindCanvasClick() {
    const canvas = document.getElementById('game-canvas');
    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const cx = (e.clientX - rect.left) * (900 / rect.width);
      const cy = (e.clientY - rect.top)  * (480 / rect.height);

      const { BTN_X: bx, BTN_Y: by, BTN_R: br } = BuddyPanel;

      // Buddy portrait button
      if ((cx - bx) ** 2 + (cy - by) ** 2 <= br * br) {
        this.toggle();
        e.stopPropagation();
        return;
      }

      if (!this.#open) return;

      // [×] close button (top-right corner of panel)
      if (cx >= 870 && cx <= 894 && cy >= 6 && cy <= 28) {
        this.close();
        e.stopPropagation();
        return;
      }

      // Click outside panel closes it
      if (cx < 900 - BuddyPanel.PANEL_W) {
        this.close();
      }
    });
  }

  _bindPanelKeys() {
    window.addEventListener('keydown', (e) => {
      if (!this.#open) return;
      if (e.key === 'Escape') { this.close(); return; }
      if (e.code === 'KeyP') {
        if (!this.#buddy?.recording) {
          this.#buddy?.startRecording();
          this.#messages.push({ role: 'player', text: '🎤 [voice recording…]', _voice: true });
          this.#scrollY = Infinity;
        } else {
          this.#buddy?.stopRecording();
          const vm = this.#messages.findLast(m => m._voice);
          if (vm) { vm.text = '🎤 [voice sent]'; delete vm._voice; }
        }
      }
    });
  }

  _submit() {
    const text = this.#inputEl.value.trim();
    if (!text) return;
    this.#inputEl.value = '';
    this.#messages.push({ role: 'player', text });
    this.#scrollY = Infinity;
    const gs = this.#engine?.worldManager?.getGameState() ?? {};
    this.#buddy?.chat(text, gs);
  }

  // ── Render ──────────────────────────────────────────────────

  render(ctx) {
    this._renderButton(ctx);
    if (this.#open) this._renderPanel(ctx);
  }

  _renderButton(ctx) {
    const { BTN_X: bx, BTN_Y: by, BTN_R: br } = BuddyPanel;
    const t = Date.now() / 1000;
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.5);

    ctx.save();

    // Pulsing glow ring
    ctx.strokeStyle = `rgba(212,160,48,${0.35 + pulse * 0.5})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(bx, by, br + 5 + pulse * 3, 0, Math.PI * 2);
    ctx.stroke();

    // Button background
    const g = ctx.createRadialGradient(bx - 8, by - 8, 3, bx, by, br);
    g.addColorStop(0, this.#open ? '#6040a8' : '#3a2870');
    g.addColorStop(1, '#0e0820');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = this.#open ? '#ffd700' : '#d4a030';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Buddy face portrait inside button
    ctx.translate(bx - 13, by + 10);
    ctx.scale(0.52, 0.52);
    this._drawBuddyFace(ctx);
    ctx.restore();

    // "BUDDY" label below button
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.beginPath();
    ctx.roundRect(bx - 26, by + br + 2, 52, 16, 4);
    ctx.fill();
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 9px "Segoe UI",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🐾 BUDDY', bx, by + br + 13);
    ctx.textAlign = 'left';
    ctx.restore();
  }

  _renderPanel(ctx) {
    const W = BuddyPanel.PANEL_W;
    const px = 900 - W;

    // Panel background
    ctx.fillStyle = 'rgba(10, 6, 28, 0.97)';
    ctx.fillRect(px, 0, W, 480);

    // Left glowing border
    const border = ctx.createLinearGradient(px, 0, px + 5, 0);
    border.addColorStop(0, 'rgba(212,160,48,0.9)');
    border.addColorStop(1, 'rgba(212,160,48,0)');
    ctx.fillStyle = border;
    ctx.fillRect(px, 0, 5, 480);

    // ── Header ───────────────────────────────────────────────

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(px, 0, W, 70);

    // Portrait circle
    const pfx = px + 38, pfy = 36;
    const pg = ctx.createRadialGradient(pfx - 5, pfy - 5, 3, pfx, pfy, 24);
    pg.addColorStop(0, '#c49020');
    pg.addColorStop(1, '#5a3c00');
    ctx.fillStyle = pg;
    ctx.beginPath(); ctx.arc(pfx, pfy, 24, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 2; ctx.stroke();

    ctx.save();
    ctx.translate(pfx - 11, pfy + 9);
    ctx.scale(0.50, 0.50);
    this._drawBuddyFace(ctx);
    ctx.restore();

    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 14px "Segoe UI",sans-serif';
    ctx.fillText('Chat with Buddy', px + 70, 27);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '11px "Segoe UI",sans-serif';
    ctx.fillText('[P] voice  ·  [Esc] close', px + 70, 45);

    // [×] close button
    ctx.fillStyle = 'rgba(220,50,50,0.7)';
    ctx.beginPath(); ctx.roundRect(900 - 26, 8, 18, 18, 4); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('×', 900 - 17, 21);
    ctx.textAlign = 'left';

    // Divider
    ctx.strokeStyle = 'rgba(212,160,48,0.2)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px + 8, 70); ctx.lineTo(900 - 8, 70); ctx.stroke();

    // ── Messages area ────────────────────────────────────────

    const msgY = 74, msgH = 308; // y 74–382
    ctx.save();
    ctx.beginPath(); ctx.rect(px, msgY, W, msgH); ctx.clip();
    this._renderMessages(ctx, px, W, msgY, msgH);
    ctx.restore();

    // Divider before input
    ctx.strokeStyle = 'rgba(212,160,48,0.2)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px + 8, 382); ctx.lineTo(900 - 8, 382); ctx.stroke();

    // ── Input box (HTML textarea sits on top of this) ────────

    ctx.fillStyle = 'rgba(25,15,55,0.9)';
    ctx.beginPath(); ctx.roundRect(px + 8, 386, W - 16, 58, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(212,160,48,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();

    if (!this.#inputEl?.value) {
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.font = 'italic 12px "Segoe UI",sans-serif';
      ctx.fillText('Ask Buddy anything…', px + 16, 416);
    }

    ctx.fillStyle = 'rgba(255,255,200,0.3)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('[Enter] send', 900 - 14, 440);
    ctx.textAlign = 'left';

    // ── Push-to-talk button ──────────────────────────────────

    const rec = this.#buddy?.recording ?? false;
    ctx.fillStyle = rec ? 'rgba(210,40,40,0.85)' : 'rgba(40,90,210,0.75)';
    ctx.beginPath(); ctx.roundRect(px + 8, 450, W - 16, 24, 6); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px "Segoe UI",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      rec ? '🔴 Recording… [P] to stop' : '🎤  [P] Push to Talk',
      px + W / 2, 466
    );
    ctx.textAlign = 'left';
  }

  _renderMessages(ctx, px, W, areaY, areaH) {
    if (!this.#messages.length) {
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.font = 'italic 12px "Segoe UI",sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No messages yet', px + W / 2, areaY + 30);
      ctx.textAlign = 'left';
      return;
    }

    const gap = 6, pad = 9, lh = 15;
    const maxBubW = W - 28;

    // Measure all bubbles first
    const bubbles = this.#messages.map(msg => {
      const lines = this._wrapText(ctx, msg.text, maxBubW - pad * 2);
      const h = lines.length * lh + pad * 2 + 2;
      return { msg, lines, h };
    });

    const totalH = bubbles.reduce((s, b) => s + b.h + gap, 0);
    const maxScroll = Math.max(0, totalH - areaH + 6);
    if (this.#scrollY === Infinity) this.#scrollY = maxScroll;
    this.#scrollY = Math.max(0, Math.min(this.#scrollY, maxScroll));

    let y = areaY + 4 - this.#scrollY;

    for (const { msg, lines, h } of bubbles) {
      if (y + h < areaY) { y += h + gap; continue; }
      if (y > areaY + areaH) break;

      const isPlayer = msg.role === 'player';
      ctx.font = '12px "Segoe UI",sans-serif';
      const textW = Math.max(...lines.map(l => ctx.measureText(l).width));
      const bW = Math.min(maxBubW, textW + pad * 2 + 8);
      const bx = isPlayer ? px + W - bW - 6 : px + 6;

      // Bubble background
      ctx.fillStyle = isPlayer ? 'rgba(65,105,210,0.82)' : 'rgba(212,160,48,0.15)';
      ctx.beginPath(); ctx.roundRect(bx, y, bW, h, 8); ctx.fill();
      ctx.strokeStyle = isPlayer ? 'rgba(120,160,255,0.55)' : 'rgba(212,160,48,0.45)';
      ctx.lineWidth = 1; ctx.stroke();

      // Text
      ctx.fillStyle = isPlayer ? '#dce8ff' : '#fffaee';
      ctx.font = '12px "Segoe UI",sans-serif';
      lines.forEach((line, i) => ctx.fillText(line, bx + pad, y + pad + 11 + i * lh));

      // Role label
      ctx.fillStyle = isPlayer ? 'rgba(160,190,255,0.45)' : 'rgba(255,210,100,0.45)';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = isPlayer ? 'right' : 'left';
      ctx.fillText(isPlayer ? 'You' : '🐾 Buddy', isPlayer ? bx + bW - 4 : bx + 4, y + h - 2);
      ctx.textAlign = 'left';

      y += h + gap;
    }
  }

  _wrapText(ctx, text, maxW) {
    ctx.font = '12px "Segoe UI",sans-serif';
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line + w + ' ';
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line.trim()); line = w + ' ';
      } else { line = test; }
    }
    if (line.trim()) lines.push(line.trim());
    return lines.length ? lines : [''];
  }

  _drawBuddyFace(ctx) {
    // Head
    ctx.fillStyle = '#d4a030';
    ctx.beginPath(); ctx.arc(30, -30, 16, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#a07820'; ctx.lineWidth = 1.5; ctx.stroke();

    // Floppy ear
    ctx.fillStyle = '#a07820';
    ctx.beginPath();
    ctx.moveTo(22, -40);
    ctx.bezierCurveTo(14, -40, 12, -28, 18, -24);
    ctx.bezierCurveTo(22, -24, 24, -32, 22, -40);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#7a5a10'; ctx.lineWidth = 1; ctx.stroke();

    // Snout
    ctx.fillStyle = '#e8b840';
    ctx.beginPath(); ctx.ellipse(44, -27, 10, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#a07820'; ctx.lineWidth = 1; ctx.stroke();

    // Nose
    ctx.fillStyle = '#2c3e50';
    ctx.beginPath(); ctx.ellipse(48, -30, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.arc(47, -32, 1.5, 0, Math.PI * 2); ctx.fill();

    // Eyes
    const ey = -36;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(28, ey, 6, 6.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(38, ey - 1, 6, 6.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath(); ctx.arc(30, ey, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(40, ey - 1, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(32, ey - 2, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(42, ey - 3, 1.5, 0, Math.PI * 2); ctx.fill();

    // Collar + tag
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(6, -30, 20, 5);
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath(); ctx.arc(16, -23, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#e67e22'; ctx.lineWidth = 1; ctx.stroke();
  }
}
