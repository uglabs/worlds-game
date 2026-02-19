/**
 * action.js — World 3 challenges: click battle, reaction time, rhythm drums.
 * Zone id 1 = Click Battle, 2 = Lightning Catch, 3 = Rhythm Drums.
 *
 * Exports: ActionChallenge — implements { init, render, handleInput, isDone }
 */

export class ActionChallenge {
  #zoneId = 1;
  #done = false;
  #phase = 'intro';
  #audio = null;

  // C1 — Click Battle
  #c1PlayerClicks = 0;
  #c1RivalClicks = 0;
  #c1Timer = 5;
  #c1LastTick = 0;
  #c1RivalInterval = null;
  #c1Result = null;

  // C2 — Lightning Catch
  #c2Rounds = 5;
  #c2Round = 0;
  #c2PlayerWins = 0;
  #c2BoltX = 0;
  #c2BoltY = 0;
  #c2BoltShowing = false;
  #c2WaitTimer = 0;
  #c2WaitDuration = 0;
  #c2RoundResult = null; // 'win'|'lose'|null
  #c2Done = false;
  #c2FinalResult = null;
  #c2NextRoundTimer = 0;  // countdown after round result before next round
  // Rival visual
  #c2RivalX = 680;
  #c2RivalY = 230;
  #c2RivalSpeed = 300;    // px/sec toward bolt
  #c2RivalMoving = false;
  #c2LastTick = 0;

  // C3 — Rhythm Drums
  #c3Beats = [];       // { lane, x, hit, missed }
  #c3BeatTimer = 0;
  #c3BeatInterval = 0.5; // seconds between beats
  #c3TotalBeats = 16;
  #c3SpawnedBeats = 0;
  #c3GoodHits = 0;
  #c3Misses = 0;
  #c3Particles = [];
  #c3Speed = 120; // px/sec
  #c3HitZoneX = 180;
  #c3HitWindow = 40; // ±px from hit zone
  #c3Done = false;
  #c3LastTick = 0;

  init(zone, worldIndex, audioManager) {
    this.#zoneId = zone.id;
    this.#done = false;
    this.#phase = 'intro';
    this.#audio = audioManager;

    if (zone.id === 1) this._c1Reset();
    else if (zone.id === 2) this._c2Reset();
    else this._c3Reset();
  }

  isDone() { return this.#done; }

  getContext() {
    if (this.#zoneId === 1) {
      return `Click Battle: click the big button as FAST as possible! You have ${this.#c1PlayerClicks} clicks vs rival's ${this.#c1RivalClicks}. ${Math.ceil(this.#c1Timer)}s left. Phase: ${this.#phase}.`;
    } else if (this.#zoneId === 2) {
      return `Lightning Catch: a lightning bolt appears at a random spot — click it BEFORE the rival does! Round ${this.#c2Round}/${this.#c2Rounds}, ${this.#c2PlayerWins} wins. Bolt showing: ${this.#c2BoltShowing}.`;
    } else {
      return `Rhythm Drums: press A (left), S (middle), or D (right) when the beat reaches the hit line! ${this.#c3GoodHits} good hits so far, ${this.#c3TotalBeats} total beats.`;
    }
  }

  // ── C1 ────────────────────────────────────────────────────────

  _c1Reset() {
    this.#c1PlayerClicks = 0;
    this.#c1RivalClicks = 0;
    this.#c1Timer = 5;
    this.#c1LastTick = 0;
    this.#c1Result = null;
    this.#phase = 'intro';
  }

  _c1Start() {
    this.#phase = 'active';
    this.#c1LastTick = Date.now();
    // Rival auto-clicks at 6/sec
    this.#c1RivalInterval = setInterval(() => {
      this.#c1RivalClicks++;
    }, 1000 / 6);
  }

  _c1Stop() {
    clearInterval(this.#c1RivalInterval);
    this.#c1RivalInterval = null;
    this.#c1Result = this.#c1PlayerClicks > this.#c1RivalClicks ? 'win' : 'lose';
    this.#phase = 'result';
    if (this.#c1Result === 'win') { this.#done = true; this.#audio?.playCorrect?.(); }
    else { this.#audio?.playWrong?.(); }
  }

  // ── C2 ────────────────────────────────────────────────────────

  _c2Reset() {
    this.#c2Round = 0;
    this.#c2PlayerWins = 0;
    this.#c2BoltShowing = false;
    this.#c2WaitTimer = 0;
    this.#c2RoundResult = null;
    this.#c2Done = false;
    this.#c2FinalResult = null;
    this.#c2RivalX = 680;
    this.#c2RivalY = 230;
    this.#c2RivalMoving = false;
    this.#c2NextRoundTimer = 0;
    this.#c2LastTick = Date.now();
    this.#phase = 'intro';
  }

  _c2StartRound() {
    this.#c2BoltShowing = false;
    this.#c2RoundResult = null;
    this.#c2WaitDuration = 1000 + Math.random() * 2000;
    this.#c2WaitTimer = Date.now();
    // Rival starts at a random edge of the arena
    const side = Math.random() < 0.5 ? 'left' : 'right';
    this.#c2RivalX = side === 'right' ? 700 : 200;
    this.#c2RivalY = 180 + Math.random() * 120;
    this.#c2RivalMoving = false;
    this.#c2LastTick = Date.now();
  }

  // Called each frame during active C2 phase
  _c2Update(dtSec) {
    // Wait phase: countdown to bolt appearance
    if (!this.#c2BoltShowing && this.#c2RoundResult === null) {
      const elapsed = Date.now() - this.#c2WaitTimer;
      if (elapsed >= this.#c2WaitDuration) {
        // Bolt appears
        this.#c2BoltX = 300 + Math.random() * 300;
        this.#c2BoltY = 160 + Math.random() * 130;
        this.#c2BoltShowing = true;
        this.#c2RivalMoving = true;
      }
      return;
    }

    // Next-round delay after result
    if (this.#c2RoundResult !== null && !this.#c2Done) {
      this.#c2NextRoundTimer -= dtSec;
      if (this.#c2NextRoundTimer <= 0) {
        this._c2NextRound();
      }
      return;
    }

    // Rival moves toward bolt
    if (this.#c2RivalMoving && this.#c2BoltShowing && this.#c2RoundResult === null) {
      const dx = this.#c2BoltX - this.#c2RivalX;
      const dy = this.#c2BoltY - this.#c2RivalY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 30) {
        // Rival reached bolt
        this.#c2RoundResult = 'lose';
        this.#c2BoltShowing = false;
        this.#c2RivalMoving = false;
        this.#c2NextRoundTimer = 1.0;
        this.#audio?.playWrong?.();
      } else {
        const spd = Math.min(this.#c2RivalSpeed * dtSec, dist);
        this.#c2RivalX += (dx / dist) * spd;
        this.#c2RivalY += (dy / dist) * spd;
      }
    }
  }

  _c2PlayerClick(x, y) {
    if (!this.#c2BoltShowing || this.#c2RoundResult !== null) return;
    const dx = x - this.#c2BoltX;
    const dy = y - this.#c2BoltY;
    if (Math.sqrt(dx * dx + dy * dy) < 55) {
      this.#c2RoundResult = 'win';
      this.#c2PlayerWins++;
      this.#c2BoltShowing = false;
      this.#c2RivalMoving = false;
      this.#c2NextRoundTimer = 0.8;
      this.#audio?.playCorrect?.();
    }
  }

  _c2NextRound() {
    this.#c2Round++;
    if (this.#c2Round >= this.#c2Rounds) {
      this.#c2Done = true;
      this.#c2FinalResult = this.#c2PlayerWins >= 3 ? 'win' : 'lose';
      this.#phase = 'result';
      if (this.#c2FinalResult === 'win') { this.#done = true; this.#audio?.playCorrect?.(); }
      else { this.#audio?.playWrong?.(); }
    } else {
      this._c2StartRound();
    }
  }

  // ── C3 ────────────────────────────────────────────────────────

  _c3Reset() {
    this.#c3Beats = [];
    this.#c3BeatTimer = 0;
    this.#c3SpawnedBeats = 0;
    this.#c3GoodHits = 0;
    this.#c3Misses = 0;
    this.#c3Particles = [];
    this.#c3Done = false;
    this.#c3LastTick = Date.now();
    this.#phase = 'intro';
  }

  _c3SpawnBeat() {
    const lane = Math.floor(Math.random() * 3); // 0=A 1=S 2=D
    this.#c3Beats.push({ lane, x: 850, hit: false, missed: false });
    this.#c3SpawnedBeats++;
  }

  _c3HitLane(lane) {
    const beat = this.#c3Beats.find(
      b => !b.hit && !b.missed && b.lane === lane &&
           Math.abs(b.x - this.#c3HitZoneX) <= this.#c3HitWindow
    );
    if (beat) {
      beat.hit = true;
      this.#c3GoodHits++;
      this.#c3Particles.push({ x: this.#c3HitZoneX, y: 280 + lane * 60, life: 1 });
    }
  }

  // ── Input ─────────────────────────────────────────────────────

  handleInput(ev) {
    if (this.#phase === 'intro') {
      if (ev.type === 'keydown' && (ev.key === ' ' || ev.key === 'Enter')) {
        this._startChallenge();
      } else if (ev.type === 'click') {
        this._startChallenge();
      }
      return;
    }

    if (this.#zoneId === 1) this._c1Input(ev);
    else if (this.#zoneId === 2) this._c2Input(ev);
    else this._c3Input(ev);
  }

  _startChallenge() {
    if (this.#zoneId === 1) {
      this._c1Start();
    } else if (this.#zoneId === 2) {
      this.#phase = 'active';
      this.#c2LastTick = Date.now();
      this._c2StartRound();
    } else {
      this.#phase = 'active';
      this.#c3LastTick = Date.now(); // reset tick so first frame delta is near zero
    }
  }

  _c1Input(ev) {
    if (this.#phase !== 'active') return;
    if (ev.type === 'click') {
      if (ev.x >= 350 && ev.x <= 550 && ev.y >= 215 && ev.y <= 295) {
        this.#c1PlayerClicks++;
      }
    }
  }

  _c2Input(ev) {
    if (this.#phase !== 'active') return;
    if (ev.type === 'click') {
      this._c2PlayerClick(ev.x, ev.y);
    }
  }

  _c3Input(ev) {
    if (this.#phase !== 'active') return;
    if (ev.type === 'keydown') {
      if (ev.key === 'a' || ev.key === 'A') this._c3HitLane(0);
      if (ev.key === 's' || ev.key === 'S') this._c3HitLane(1);
      if (ev.key === 'd' || ev.key === 'D') this._c3HitLane(2);
    }
  }

  // ── Render ────────────────────────────────────────────────────

  render(ctx) {
    if (this.#zoneId === 1) this._renderC1(ctx);
    else if (this.#zoneId === 2) this._renderC2(ctx);
    else this._renderC3(ctx);
  }

  _renderC1(ctx) {
    this._drawPanel(ctx, 450, 240, 500, 360);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff6040';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('🔥  Click Battle  🔥', 450, 110);

    if (this.#phase === 'intro') {
      ctx.fillStyle = '#fff';
      ctx.font = '18px sans-serif';
      ctx.fillText('Click as fast as you can!', 450, 160);
      ctx.fillText('Beat the rival (6 clicks/sec) in 5 seconds.', 450, 190);
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('Click here or press Space to start', 450, 260);
      ctx.textAlign = 'left'; return;
    }

    if (this.#phase === 'active') {
      const now = Date.now();
      const elapsed = (now - this.#c1LastTick) / 1000;
      this.#c1LastTick = now;
      this.#c1Timer = Math.max(0, this.#c1Timer - elapsed);
      if (this.#c1Timer <= 0 && this.#c1RivalInterval) this._c1Stop();

      ctx.fillStyle = '#fff';
      ctx.font = '18px sans-serif';
      ctx.fillText(`⏱ ${this.#c1Timer.toFixed(1)}s`, 450, 150);
      ctx.fillText(`You: ${this.#c1PlayerClicks}   Rival: ${this.#c1RivalClicks}`, 450, 185);

      ctx.fillStyle = 'rgba(220,80,30,0.8)';
      ctx.beginPath();
      ctx.roundRect(350, 215, 200, 80, 16);
      ctx.fill();
      ctx.strokeStyle = '#ff8060';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText('CLICK!', 450, 264);
      ctx.textAlign = 'left'; return;
    }

    ctx.fillStyle = this.#c1Result === 'win' ? '#50e050' : '#ff5050';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(this.#c1Result === 'win' ? '🏆 You Win!' : '😅 Rival Wins!', 450, 200);
    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif';
    ctx.fillText(`You: ${this.#c1PlayerClicks}   Rival: ${this.#c1RivalClicks}`, 450, 240);
    if (this.#c1Result === 'lose') {
      ctx.fillStyle = '#ffd700';
      ctx.font = '16px sans-serif';
      ctx.fillText('Press Esc and try again', 450, 300);
    }
    ctx.textAlign = 'left';
  }

  _renderC2(ctx) {
    this._drawPanel(ctx, 450, 240, 620, 400);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe060';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('⚡  Lightning Catch  ⚡', 450, 62);

    if (this.#phase === 'intro') {
      ctx.fillStyle = '#fff';
      ctx.font = '18px sans-serif';
      ctx.fillText('Click the lightning bolt before the rival!', 450, 120);
      ctx.fillText('The rival will RACE toward it — be faster!', 450, 150);
      ctx.fillText('Win 3 of 5 rounds.', 450, 180);
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('Click here to start', 450, 250);
      ctx.textAlign = 'left'; return;
    }

    // Update rival + bolt logic
    if (this.#phase === 'active' && !this.#c2Done) {
      const now = Date.now();
      const dtSec = Math.min((now - this.#c2LastTick) / 1000, 0.1);
      this.#c2LastTick = now;
      this._c2Update(dtSec);
    }

    // Scores
    ctx.fillStyle = '#ccc';
    ctx.font = '15px sans-serif';
    ctx.fillText(`Round ${this.#c2Round + 1}/${this.#c2Rounds}  ·  Wins: ${this.#c2PlayerWins}`, 450, 90);

    // Arena background
    ctx.fillStyle = 'rgba(20,20,60,0.6)';
    ctx.fillRect(150, 100, 600, 260);
    ctx.strokeStyle = 'rgba(255,220,50,0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(150, 100, 600, 260);

    if (this.#phase !== 'result') {
      // Draw rival character
      this._drawRival(ctx, this.#c2RivalX, this.#c2RivalY);

      // Draw bolt
      if (this.#c2BoltShowing) {
        const pulse = 0.7 + 0.3 * Math.sin(Date.now() / 80);
        // Glow ring
        ctx.fillStyle = `rgba(255,255,100,${pulse * 0.3})`;
        ctx.beginPath();
        ctx.arc(this.#c2BoltX, this.#c2BoltY, 30, 0, Math.PI * 2);
        ctx.fill();
        // Emoji — drawn centered on boltX, boltY
        ctx.font = '40px sans-serif';
        ctx.fillStyle = `rgba(255,255,80,${pulse})`;
        ctx.fillText('⚡', this.#c2BoltX - 20, this.#c2BoltY + 18);
        ctx.fillStyle = 'rgba(255,255,200,0.8)';
        ctx.font = '13px sans-serif';
        ctx.fillText('Click!', this.#c2BoltX, this.#c2BoltY - 20);
      } else if (this.#c2RoundResult === null && this.#phase === 'active') {
        ctx.fillStyle = 'rgba(200,200,100,0.4)';
        ctx.font = '16px sans-serif';
        ctx.fillText('Waiting for bolt...', 450, 230);
      }

      // Round result flash
      if (this.#c2RoundResult) {
        const col = this.#c2RoundResult === 'win' ? '#50e050' : '#ff6060';
        ctx.fillStyle = col;
        ctx.font = 'bold 26px sans-serif';
        ctx.fillText(
          this.#c2RoundResult === 'win' ? '⚡ You got it!' : '😅 Too slow!',
          450, 390
        );
      }
    }

    if (this.#phase === 'result') {
      ctx.fillStyle = this.#c2FinalResult === 'win' ? '#50e050' : '#ff5050';
      ctx.font = 'bold 30px sans-serif';
      ctx.fillText(
        this.#c2FinalResult === 'win' ? '🏆 Lightning fast!' : '😅 Not this time',
        450, 200
      );
      ctx.fillStyle = '#fff';
      ctx.font = '18px sans-serif';
      ctx.fillText(`You won ${this.#c2PlayerWins}/${this.#c2Rounds} rounds`, 450, 245);
      if (this.#c2FinalResult === 'lose') {
        ctx.fillStyle = '#ffd700';
        ctx.font = '15px sans-serif';
        ctx.fillText('Press Esc and try again', 450, 300);
      }
    }
    ctx.textAlign = 'left';
  }

  /** Draw rival as a small robot-like character at (rx, ry). */
  _drawRival(ctx, rx, ry) {
    const t = Date.now() / 400;
    const bob = Math.sin(t) * (this.#c2RivalMoving ? 3 : 1);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(rx, ry + 20, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = '#e05020';
    ctx.fillRect(rx - 10, ry - 16 + bob, 20, 22);
    // Head
    ctx.fillStyle = '#ff7040';
    ctx.fillRect(rx - 9, ry - 30 + bob, 18, 16);
    // Eyes (glow when moving)
    ctx.fillStyle = this.#c2RivalMoving ? '#ffff00' : '#ffffff';
    ctx.fillRect(rx - 6, ry - 27 + bob, 4, 4);
    ctx.fillRect(rx + 2, ry - 27 + bob, 4, 4);
    // Antenna
    ctx.strokeStyle = '#ff9060';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rx, ry - 30 + bob);
    ctx.lineTo(rx, ry - 38 + bob);
    ctx.stroke();
    ctx.fillStyle = '#ffff80';
    ctx.beginPath();
    ctx.arc(rx, ry - 39 + bob, 3, 0, Math.PI * 2);
    ctx.fill();
    // Legs (animated when moving)
    const legSwing = this.#c2RivalMoving ? Math.sin(t * 3) * 5 : 0;
    ctx.strokeStyle = '#e05020';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(rx - 4, ry + 6 + bob);
    ctx.lineTo(rx - 4 + legSwing, ry + 20 + bob);
    ctx.moveTo(rx + 4, ry + 6 + bob);
    ctx.lineTo(rx + 4 - legSwing, ry + 20 + bob);
    ctx.stroke();

    // Label above head
    ctx.fillStyle = '#ffaa80';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('RIVAL', rx, ry - 43 + bob);
  }

  _renderC3(ctx) {
    const now = Date.now();

    if (this.#phase === 'intro') {
      this._drawPanel(ctx, 450, 240, 580, 360);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#c080ff';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('🥁  Rhythm Drums  🥁', 450, 115);
      ctx.fillStyle = '#fff';
      ctx.font = '18px sans-serif';
      ctx.fillText('Press A, S, D when beats reach the hit zone!', 450, 160);
      ctx.fillText('Hit 12/16 beats to pass.', 450, 190);
      ctx.fillStyle = '#aaa';
      ctx.font = '14px sans-serif';
      ctx.fillText('A = Top lane   S = Middle   D = Bottom', 450, 220);
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('Press Space or click to start', 450, 280);
      ctx.textAlign = 'left'; return;
    }

    this._drawPanel(ctx, 450, 240, 780, 360);

    // Update game state
    if (this.#phase === 'active' && !this.#c3Done) {
      const dtSec = Math.min((now - this.#c3LastTick) / 1000, 0.1); // cap delta
      this.#c3LastTick = now;

      // Spawn beats
      if (this.#c3SpawnedBeats < this.#c3TotalBeats) {
        this.#c3BeatTimer += dtSec;
        if (this.#c3BeatTimer >= this.#c3BeatInterval) {
          this.#c3BeatTimer -= this.#c3BeatInterval;
          this._c3SpawnBeat();
        }
      }

      // Move ALL beats (including hit ones so they exit and get removed)
      for (const b of this.#c3Beats) {
        b.x -= this.#c3Speed * dtSec;
        if (!b.hit && !b.missed && b.x < this.#c3HitZoneX - this.#c3HitWindow) {
          b.missed = true;
          this.#c3Misses++;
        }
      }

      // Remove beats that have scrolled off left edge
      this.#c3Beats = this.#c3Beats.filter(b => b.x > -60);

      // Particles
      for (const p of this.#c3Particles) p.life -= dtSec * 2;
      this.#c3Particles = this.#c3Particles.filter(p => p.life > 0);

      // Check done: all beats spawned, processed, and off screen
      const totalProcessed = this.#c3GoodHits + this.#c3Misses;
      if (this.#c3SpawnedBeats >= this.#c3TotalBeats &&
          totalProcessed >= this.#c3TotalBeats &&
          this.#c3Beats.length === 0) {
        this.#c3Done = true;
        this.#phase = 'result';
        if (this.#c3GoodHits >= 12) { this.#done = true; this.#audio?.playCorrect?.(); }
        else { this.#audio?.playWrong?.(); }
      }
    }

    // Draw lanes
    const lanes = ['A', 'S', 'D'];
    const laneColors = ['rgba(100,160,255,0.4)', 'rgba(100,220,100,0.4)', 'rgba(255,120,60,0.4)'];
    const laneY = [200, 260, 320];

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('🥁  Rhythm Drums', 450, 160);

    ctx.fillStyle = '#aaa';
    ctx.font = '14px sans-serif';
    ctx.fillText(`Hits: ${this.#c3GoodHits}/${this.#c3TotalBeats}  (need 12)`, 450, 183);

    for (let i = 0; i < 3; i++) {
      const y = laneY[i];
      ctx.fillStyle = laneColors[i];
      ctx.fillRect(120, y - 18, 680, 36);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.strokeRect(120, y - 18, 680, 36);

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText(lanes[i], 100, y + 6);

      // Hit zone marker
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(this.#c3HitZoneX, y - 22);
      ctx.lineTo(this.#c3HitZoneX, y + 22);
      ctx.stroke();
    }

    // Draw beats (skip hit ones — they fade via particles)
    for (const b of this.#c3Beats) {
      if (b.hit) continue;
      const y = laneY[b.lane];
      ctx.fillStyle = b.missed ? 'rgba(200,50,50,0.6)' : '#ffe060';
      ctx.beginPath();
      ctx.arc(b.x, y, 14, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw particles
    for (const p of this.#c3Particles) {
      ctx.fillStyle = `rgba(100,255,100,${p.life})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 18 * p.life, 0, Math.PI * 2);
      ctx.fill();
    }

    if (this.#phase === 'result') {
      const pass = this.#c3GoodHits >= 12;
      ctx.fillStyle = pass ? '#50e050' : '#ff5050';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText(pass ? '🎉 Perfect rhythm!' : '😅 Keep practicing!', 450, 375);
      ctx.fillStyle = '#fff';
      ctx.font = '18px sans-serif';
      ctx.fillText(`Hits: ${this.#c3GoodHits}/${this.#c3TotalBeats}`, 450, 405);
      if (!pass) {
        ctx.fillStyle = '#ffd700';
        ctx.font = '14px sans-serif';
        ctx.fillText('Press Esc and try again', 450, 435);
      }
    }
    ctx.textAlign = 'left';
  }

  _drawPanel(ctx, cx, cy, w, h) {
    ctx.fillStyle = 'rgba(8,8,20,0.93)';
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, cy - h / 2, w, h, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(180,100,255,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}
