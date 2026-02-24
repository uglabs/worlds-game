/**
 * buddy.js — Buddy the dog. Follows the player, UGLabs wiring, speech bubble.
 * Fixed: text/charIndex reset on each new request. Added thinking state.
 */

const WORLD_COACHING = {
  0: {
    default: `You are Buddy, a friendly adventure dog helping a 10-12 year old kid.
The player is in the Enchanted Forest solving math challenges.
Give short warm hints. Never give the answer — guide them to it.
Use fun dog-themed phrases occasionally: "Woof!", "I've sniffed this one out!", etc.`,
    1: `World 1, Challenge 1 (Number Gnome): multiplication and division — multiple choice, 4 options.
Hint: remind them of times tables. Escalate specificity with repeated attempts.`,
    2: `World 1, Challenge 2 (Witch's Cauldron): order of operations (PEMDAS).
Hint: Parentheses first, then multiply/divide, then add/subtract.`,
    3: `World 1, Challenge 3 (Dragon's Riddle): fraction and percentage word problems.
Hint: identify "fraction of what?" then multiply. For %, divide by 100 first.`,
  },
  1: {
    default: `You are Buddy, a friendly adventure dog helping a 10-12 year old.
The player is in the Sky Kingdom solving logic puzzles.
Teach systematic thinking. One clue at a time.`,
    1: `World 2, Challenge 1 (Cloud Sequence): number pattern completion.
Ask: "What changes between each number — adding? Multiplying?"`,
    2: `World 2, Challenge 2 (Oracle's Deduction): grid logic puzzle with clues.
Teach elimination: start with the most specific clue first.`,
    3: `World 2, Challenge 3 (Rule Machine): identify a function rule from input→output pairs.
Ask: "Try multiplying the input — does it match ALL the outputs?"`,
  },
  2: {
    default: `You are Buddy, a brave adventure dog helping a 10-12 year old.
The player is in the Volcano Arena facing action challenges.
Keep energy high — tips should be short and punchy!`,
    1: `World 3, Challenge 1 (Click Battle): click as fast as possible in 5 seconds.
Tip: use one finger, steady rhythm, don't hold your breath!`,
    2: `World 3, Challenge 2 (Lightning Catch): click the bolt before the rival.
Tip: relax eyes, watch the whole screen, click the MOMENT you see it.`,
    3: `World 3, Challenge 3 (Rhythm Drums): press A/S/D when beats reach the line.
Tip: start pressing just BEFORE the beat arrives. Feel the rhythm!`,
  },
};

export class Buddy {
  #x; #y;
  #client = null;
  #audioManager = null;
  #busy = false;

  // Speech bubble
  #bubbleText = '';
  #bubbleTimer = 0;
  #fullText = '';
  #charIndex = 0;

  // Visual state: 'idle' | 'thinking' | 'speaking' | 'barking'
  #state = 'idle';
  #stateTimer = 0;
  #tailPhase = 0;
  #mouthPhase = 0;
  #thinkDots = 0;

  // Callbacks for BuddyPanel
  #textChunkCallbacks = [];
  #doneCallbacks = [];

  get recording() { return this.#recording; }

  onTextChunk(cb) { this.#textChunkCallbacks.push(cb); }
  onInteractionDone(cb) { this.#doneCallbacks.push(cb); }

  /** Free-form chat — sends text directly to the AI as a user message. */
  chat(text, gameState = {}) {
    if (!this.#client?.ready) {
      this._say("Still connecting… try in a sec! 🐾", 3);
      return;
    }
    if (this.#busy) this.#audioManager?.clearVoiceQueue();
    this.#fullText = '';
    this.#charIndex = 0;
    this.#bubbleText = '';
    this.#bubbleTimer = 8;
    this.#busy = true;
    this.#state = 'thinking';
    this.#stateTimer = 0;
    this.#audioManager?.clearVoiceQueue();
    this.#client.requestHelp(text);
  }

  // PTT
  #recording = false;
  #mediaRecorder = null;

  constructor(startX, startY, client, audioManager) {
    this.#x = startX;
    this.#y = startY;
    this.#client = client;
    this.#audioManager = audioManager;

    if (client) {
      client.addEventListener('text', (ev) => this._onText(ev.detail.text));
      client.addEventListener('audio', (ev) => audioManager?.queueVoiceChunk(ev.detail.audio));
      client.addEventListener('interaction_complete', () => this._onDone());
    }
  }

  // ── Follow ────────────────────────────────────────────────────

  update(dt, player) {
    const targetX = player.x - 85;
    const dist = targetX - this.#x;
    if (Math.abs(dist) > 14) {
      const speed = Math.min(9, Math.abs(dist) * 0.14);
      this.#x += Math.sign(dist) * speed * dt;
    }

    // Y: sit on same surface as player
    this.#y = player.y + player.height - 38;

    // Bubble timer
    if (this.#bubbleTimer > 0) this.#bubbleTimer -= dt / 60;

    // Typewriter
    if (this.#charIndex < this.#fullText.length) {
      this.#charIndex = Math.min(this.#charIndex + 2, this.#fullText.length);
      this.#bubbleText = this.#fullText.slice(0, this.#charIndex);
    }

    // Animation
    this.#tailPhase += 0.12 * dt;
    this.#mouthPhase += 0.18 * dt;
    this.#stateTimer += dt / 60;
    this.#thinkDots = Math.floor(this.#stateTimer * 2.5) % 4;

    // Auto-idle after state expires
    if (this.#state === 'barking' && this.#stateTimer > 0.5) {
      this.#state = this.#busy ? 'thinking' : 'idle';
    }
    if (this.#state === 'speaking' && this.#bubbleTimer <= 0) {
      this.#state = 'idle';
    }
    if (this.#state === 'thinking' && !this.#busy) {
      this.#state = 'idle';
    }
  }

  // ── UGLabs ───────────────────────────────────────────────────

  onWorldChange(gameState) {
    if (this.#client) {
      this.#client.setConfiguration(this._buildPrompt(gameState));
    }
    this._say("Woof! New world! Press B for hints — costs 1 🦴 each. Earn bones by answering correctly! 🐾", 6);
  }

  /** Public method to say something directly (e.g. from challenge-manager). */
  say(text, secs = 4) {
    this._say(text, secs);
  }

  onChallengeSolved(gameState) {
    this._say("Yes! Great job! 🐾 Portal's getting closer!", 4);
  }

  requestHelp(gameState) {
    if (!this.#client?.ready) {
      this._say("Still connecting… try in a sec! 🐾", 3);
      return;
    }
    if (this.#busy) {
      // Already processing — cancel and restart
      this.#audioManager?.clearVoiceQueue();
    }

    // ← CRITICAL FIX: reset text state for fresh response
    this.#fullText = '';
    this.#charIndex = 0;
    this.#bubbleText = '';
    this.#bubbleTimer = 10;

    this.#busy = true;
    this.#state = 'thinking';
    this.#stateTimer = 0;

    this.#audioManager?.clearVoiceQueue();
    this.#client.requestHelp(this._buildHelpText(gameState));
  }

  _buildPrompt(gs) {
    return (WORLD_COACHING[gs.worldIndex] || WORLD_COACHING[0]).default;
  }

  _buildHelpText(gs) {
    const zone = gs.currentZone;
    const ctx = gs.challengeContext;
    if (ctx) {
      return `I'm inside the "${zone?.label || 'challenge'}" challenge and need help! Here's what's on screen right now: ${ctx} Please give me a helpful hint without spoiling the answer.`;
    }
    if (zone) return `Help! I'm stuck on the "${zone.label}" challenge. I've solved ${gs.challengesSolved}/${gs.challengesTotal} so far.`;
    return `Help! I'm in ${gs.worldName}. ${gs.challengesSolved}/${gs.challengesTotal} challenges done. What should I do next?`;
  }

  bark() {
    this.#state = 'barking';
    this.#stateTimer = 0;
    this.#audioManager?.playBark?.();
  }

  // PTT
  async startRecording() {
    if (this.#recording || !this.#client?.ready) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.#mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      this.#mediaRecorder.ondataavailable = async (e) => {
        if (e.data.size > 0) {
          const buf = await e.data.arrayBuffer();
          const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
          this.#client.addAudio(b64);
        }
      };
      this.#mediaRecorder.start(200);
      this.#recording = true;
      this.#client.clearAudioBuffer();
    } catch (err) {
      console.warn('[Buddy] Mic denied:', err);
    }
  }

  stopRecording() {
    if (!this.#recording || !this.#mediaRecorder) return;
    this.#recording = false;
    this.#mediaRecorder.stop();
    this.#mediaRecorder.stream.getTracks().forEach(t => t.stop());
    this.#mediaRecorder = null;
    if (this.#client?.ready) {
      this.#fullText = '';
      this.#charIndex = 0;
      this.#bubbleText = '';
      this.#busy = true;
      this.#state = 'thinking';
      this.#audioManager?.clearVoiceQueue();
      this.#client.requestVoiceInteract();
    }
  }

  _onText(chunk) {
    this.#fullText += chunk;
    this.#state = 'speaking';
    this.#bubbleTimer = Math.max(this.#bubbleTimer, 6 + chunk.length / 15);
    for (const cb of this.#textChunkCallbacks) cb(chunk);
  }

  _onDone() {
    this.#busy = false;
    if (this.#state === 'thinking') this.#state = 'idle';
    for (const cb of this.#doneCallbacks) cb();
  }

  _say(text, secs = 4) {
    this.#fullText = text;
    this.#charIndex = 0;
    this.#bubbleText = '';
    this.#bubbleTimer = secs;
    this.#state = 'speaking';
    this.#stateTimer = 0;
  }

  // ── Render ────────────────────────────────────────────────────

  render(ctx, camera) {
    const sx = this.#x - camera.x;
    const sy = this.#y;

    ctx.save();
    ctx.translate(sx, sy);
    this._drawDog(ctx);
    ctx.restore();

    // Bubble
    if ((this.#bubbleText || this.#state === 'thinking') && this.#bubbleTimer > 0) {
      this._drawBubble(ctx, sx, sy);
    }

    // "B to ask Buddy" indicator when idle and connected
    if (this.#state === 'idle' && this.#client?.ready && !this.#busy) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath();
      ctx.roundRect(sx - 16, sy - 64, 82, 22, 5);
      ctx.fill();
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 13px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('[B] Ask 🦴', sx + 24, sy - 49);
      ctx.textAlign = 'left';
    }
  }

  _drawDog(ctx) {
    const t = this.#tailPhase;
    const isTalking = this.#state === 'speaking';
    const isThinking = this.#state === 'thinking';
    const isBarking = this.#state === 'barking';
    const mouthOpen = isTalking || isBarking ? Math.abs(Math.sin(this.#mouthPhase)) * 0.6 : 0;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.ellipse(16, 2, 20, 5, 0, 0, Math.PI * 2); ctx.fill();

    // Tail (animated wag) — behind body
    const wagSpeed = isBarking ? 0.4 : 0.2;
    const wagAmp = isBarking ? 22 : 14;
    const wag = Math.sin(t * (isBarking ? 4 : 2)) * wagAmp;
    ctx.strokeStyle = '#a07820';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-2, -14);
    ctx.quadraticCurveTo(-16, -20 + wag, -22, -28 + wag * 0.6);
    ctx.stroke();
    // Tail tip
    ctx.fillStyle = '#f0c040';
    ctx.beginPath(); ctx.arc(-22, -28 + wag * 0.6, 5, 0, Math.PI * 2); ctx.fill();

    // Body
    ctx.fillStyle = '#d4a030';
    ctx.beginPath(); ctx.roundRect(-4, -26, 36, 22, 8); ctx.fill();
    ctx.strokeStyle = '#a07820'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(-4, -26, 36, 22, 8); ctx.stroke();

    // Belly patch
    ctx.fillStyle = '#f0d060';
    ctx.beginPath(); ctx.ellipse(14, -12, 10, 7, 0, 0, Math.PI * 2); ctx.fill();

    // Legs (4)
    const legBob = Math.sin(t * 3) * (isBarking ? 3 : 0);
    ctx.fillStyle = '#a07820';
    [[0, 0], [10, 0], [0, 1], [10, 1]].forEach(([x, back]) => {
      const lx = back ? x + 16 : x;
      ctx.beginPath(); ctx.roundRect(lx, -6 + legBob, 7, 10, 3); ctx.fill();
    });

    // Collar
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(6, -30, 20, 5);
    ctx.fillStyle = '#e74c3c'; // collar highlight
    ctx.fillRect(6, -30, 20, 2);
    ctx.fillStyle = '#f1c40f'; // tag
    ctx.beginPath(); ctx.arc(16, -23, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#e67e22'; ctx.lineWidth = 1;
    ctx.stroke();

    // Head
    ctx.fillStyle = '#d4a030';
    ctx.beginPath(); ctx.arc(30, -30, 16, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#a07820'; ctx.lineWidth = 1.5;
    ctx.stroke();

    // Ear (floppy) — droops when thinking
    const earDroop = isThinking ? 8 : 3;
    ctx.fillStyle = '#a07820';
    ctx.beginPath();
    ctx.moveTo(22, -40);
    ctx.bezierCurveTo(14, -40, 12, -28 + earDroop, 18, -24 + earDroop);
    ctx.bezierCurveTo(22, -24 + earDroop, 24, -32, 22, -40);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#7a5a10'; ctx.lineWidth = 1;
    ctx.stroke();

    // Snout
    ctx.fillStyle = '#e8b840';
    ctx.beginPath(); ctx.ellipse(44, -27, 10, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#a07820'; ctx.lineWidth = 1;
    ctx.stroke();

    // Nose
    ctx.fillStyle = '#2c3e50';
    ctx.beginPath(); ctx.ellipse(48, -30, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
    // Nose shine
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.arc(47, -32, 1.5, 0, Math.PI * 2); ctx.fill();

    // Mouth
    ctx.strokeStyle = '#7a5a10'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    if (mouthOpen > 0.1) {
      // Open mouth
      ctx.fillStyle = '#c0392b';
      ctx.beginPath();
      ctx.arc(44, -22 + mouthOpen * 4, 5 + mouthOpen * 3, 0, Math.PI);
      ctx.fill();
      ctx.fillStyle = '#e74c3c';
      ctx.beginPath(); ctx.ellipse(44, -22 + mouthOpen * 6, 3, 2, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(44, -24, 5, 0.2, Math.PI - 0.2);
      ctx.stroke();
    }

    // Eyes — big expressive
    const eyeY = -36;
    // whites
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(28, eyeY, 6, 6.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(38, eyeY - 1, 6, 6.5, 0, 0, Math.PI * 2); ctx.fill();
    // pupils — look forward (right by default)
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath(); ctx.arc(30, eyeY, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(40, eyeY - 1, 4, 0, Math.PI * 2); ctx.fill();
    // Shine
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(32, eyeY - 2, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(42, eyeY - 3, 1.5, 0, Math.PI * 2); ctx.fill();
    // Eyebrows raised when thinking/barking
    ctx.strokeStyle = '#7a5a10'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    const browRaise = (isThinking || isBarking) ? -3 : 0;
    ctx.beginPath(); ctx.moveTo(23, eyeY - 8 + browRaise); ctx.lineTo(33, eyeY - 7 + browRaise); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(35, eyeY - 8 + browRaise); ctx.lineTo(45, eyeY - 6 + browRaise); ctx.stroke();
  }

  _drawBubble(ctx, x, y) {
    const isThinking = this.#state === 'thinking' && !this.#bubbleText;
    const text = isThinking
      ? 'Thinking' + '.'.repeat(this.#thinkDots)
      : this.#bubbleText;

    if (!text) return;

    const lines = this._wrapLines(ctx, text, 210);
    const lineH = 18;
    const padX = 12;
    const padY = 8;
    const bubbleW = 236;
    const bubbleH = lines.length * lineH + padY * 2 + (isThinking ? 4 : 0);

    // Anchor above buddy's head (head is at y-40)
    const bx = Math.max(8, Math.min(x - bubbleW / 2 + 20, 900 - bubbleW - 8));
    const by = y - bubbleH - 52;

    // Drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.roundRect(bx + 3, by + 3, bubbleW, bubbleH, 10);
    ctx.fill();

    // Bubble bg
    const grad = ctx.createLinearGradient(bx, by, bx, by + bubbleH);
    grad.addColorStop(0, 'rgba(255,255,245,0.98)');
    grad.addColorStop(1, 'rgba(255,248,220,0.98)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(bx, by, bubbleW, bubbleH, 10);
    ctx.fill();
    ctx.strokeStyle = '#d4a030';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Tail pointer (pointing down-right toward Buddy's head)
    const tipX = Math.min(x + 22, bx + bubbleW - 12);
    ctx.fillStyle = 'rgba(255,248,220,0.98)';
    ctx.beginPath();
    ctx.moveTo(tipX - 8, by + bubbleH);
    ctx.lineTo(tipX + 8, by + bubbleH);
    ctx.lineTo(tipX, by + bubbleH + 12);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#d4a030'; ctx.lineWidth = 2;
    ctx.stroke();

    // Text
    ctx.fillStyle = isThinking ? '#888' : '#2c3e50';
    ctx.font = isThinking ? 'italic 13px sans-serif' : '13px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    lines.forEach((line, i) => {
      ctx.fillText(line, bx + padX, by + padY + 13 + i * lineH);
    });

    // Buddy face indicator emoji in top-left of bubble
    ctx.font = '14px sans-serif';
    ctx.fillText(isThinking ? '🤔' : '🐾', bx + bubbleW - 24, by + 18);
  }

  _wrapLines(ctx, text, maxW) {
    ctx.font = '13px "Segoe UI", sans-serif';
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line + word + ' ';
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line.trim()); line = word + ' ';
      } else {
        line = test;
      }
    }
    if (line.trim()) lines.push(line.trim());
    return lines;
  }
}
