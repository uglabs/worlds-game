/**
 * math.js — World 1 challenges: arithmetic, PEMDAS, fractions/percentages.
 * Three sub-challenges selected by zone.id.
 *
 * Exports: MathChallenge — implements { init, render, handleInput, isDone, isFailed, getContext }
 */

// ── World 1 Challenge Data ─────────────────────────────────────

// C1 problems: raw numeric answers — MC options generated dynamically at init
const C1_PROBLEMS = [
  { q: '7 × 8',    a: 56 },
  { q: '63 ÷ 9',   a: 7  },
  { q: '12 × 6',   a: 72 },
  { q: '144 ÷ 12', a: 12 },
  { q: '9 × 7',    a: 63 },
  { q: '56 ÷ 7',   a: 8  },
  { q: '15 × 4',   a: 60 },
  { q: '108 ÷ 9',  a: 12 },
];

const C2_PROBLEMS = [
  { q: '3 + 4 × 2 = ?', options: ['14', '11', '10', '8'], a: 1 },     // 11
  { q: '(5 + 3) × 2 = ?', options: ['11', '16', '13', '18'], a: 1 },  // 16
  { q: '20 ÷ 4 + 3 = ?', options: ['8', '23', '5', '7'], a: 0 },      // 8
  { q: '2 + 6² ÷ 4 = ?', options: ['2', '11', '20', '9'], a: 1 },     // 2+36/4=11
  { q: '(8 − 3) × (2 + 1) = ?', options: ['15', '10', '13', '18'], a: 0 }, // 15
];

const C3_PROBLEMS = [
  {
    q: 'A dragon has 24 coins and gives away 3/8. How many remain?',
    options: ['9', '15', '6'],
    a: 1, // 15
  },
  {
    q: "A wizard's 80 spells: 25% are fire spells. How many fire spells?",
    options: ['25', '20', '30'],
    a: 1, // 20
  },
  {
    q: '36 magic gems split equally among 4 dragons. Each gets?',
    options: ['8', '10', '9'],
    a: 2, // 9
  },
  {
    q: 'A forest has 60 trees. If 40% are oak, how many are NOT oak?',
    options: ['24', '36', '40'],
    a: 1, // 36
  },
];

// Layout constants
const C1_LAYOUT = { startY: 242, optH: 38, gap: 9, optW: 260, cx: 450 };
const C2_LAYOUT = { startY: 242, optH: 38, gap: 9, optW: 260, cx: 450 };
const C3_LAYOUT = { startY: 260, optH: 48, gap: 10, optW: 260, cx: 450 };

// ── MathChallenge ─────────────────────────────────────────────

export class MathChallenge {
  #zoneId = 1;
  #done = false;
  #failed = false;
  #shake = 0;
  #feedback = '';
  #feedbackTimer = 0;
  #audio = null;
  #onCorrect = null;

  // Particles
  #particles = [];

  // C1 state — MC format
  #c1Problems = [];
  #c1Index = 0;
  #c1Correct = 0;
  #c1WrongCount = 0;

  // C2 state
  #c2Problems = [];
  #c2Index = 0;
  #c2WrongCount = 0;

  // C3 state
  #c3Problems = [];
  #c3Index = 0;
  #c3WrongCount = 0;

  init(zone, worldIndex, audioManager, callbacks = {}) {
    this.#zoneId = zone.id;
    this.#done = false;
    this.#failed = false;
    this.#audio = audioManager;
    this.#onCorrect = callbacks.onCorrect || null;
    this.#particles = [];
    this.#feedback = '';
    this.#feedbackTimer = 0;
    this.#shake = 0;

    if (zone.id === 1) {
      this.#c1Problems = shuffle([...C1_PROBLEMS]).slice(0, 5).map(buildC1Options);
      this.#c1Index = 0;
      this.#c1Correct = 0;
      this.#c1WrongCount = 0;
    } else if (zone.id === 2) {
      this.#c2Problems = shuffle([...C2_PROBLEMS]).slice(0, 3);
      this.#c2Index = 0;
      this.#c2WrongCount = 0;
    } else {
      this.#c3Problems = shuffle([...C3_PROBLEMS]).slice(0, 3);
      this.#c3Index = 0;
      this.#c3WrongCount = 0;
    }
  }

  isDone()   { return this.#done; }
  isFailed() { return this.#failed; }

  getContext() {
    if (this.#zoneId === 1) {
      const prob = this.#c1Problems[this.#c1Index];
      if (!prob) return 'Number Gnome challenge complete!';
      return `Number Gnome (arithmetic): Problem ${this.#c1Index + 1}/5: "${prob.q} = ?" — Choose from 4 options. ${this.#c1Correct} correct so far.`;
    } else if (this.#zoneId === 2) {
      const prob = this.#c2Problems[this.#c2Index];
      if (!prob) return "Witch's Cauldron complete!";
      return `Witch's Cauldron (order of operations): Problem ${this.#c2Index + 1}/3: "${prob.q}" Options: 1) ${prob.options[0]}  2) ${prob.options[1]}  3) ${prob.options[2]}  4) ${prob.options[3]}. Press 1/2/3/4 or click.`;
    } else {
      const prob = this.#c3Problems[this.#c3Index];
      if (!prob) return "Dragon's Riddle complete!";
      return `Dragon's Riddle (fractions/percentages): Riddle ${this.#c3Index + 1}/3: "${prob.q}" Options: 1) ${prob.options[0]}  2) ${prob.options[1]}  3) ${prob.options[2]}. Press 1/2/3 or click.`;
    }
  }

  // ── Input ─────────────────────────────────────────────────────

  handleInput(ev) {
    if (ev.type !== 'keydown' && ev.type !== 'click') return;
    if (this.#failed || this.#done) return;

    if (this.#zoneId === 1) this._c1Input(ev);
    else if (this.#zoneId === 2) this._c2Input(ev);
    else this._c3Input(ev);
  }

  _c1Input(ev) {
    const prob = this.#c1Problems[this.#c1Index];
    if (!prob) return;

    let optionIdx = null;
    if (ev.type === 'click') {
      optionIdx = this._getClickedOption(ev.x, ev.y, prob.options.length, C1_LAYOUT);
    } else if (ev.type === 'keydown' && ['1','2','3','4'].includes(ev.key)) {
      optionIdx = parseInt(ev.key) - 1;
      if (optionIdx >= prob.options.length) return;
    }
    if (optionIdx === null) return;

    if (optionIdx === prob.a) {
      this.#audio?.playCorrect?.();
      this.#onCorrect?.();
      this.#c1Correct++;
      this.#c1WrongCount = 0;
      this.#feedback = '✓ Correct!';
      this.#feedbackTimer = 1;
      const optY = C1_LAYOUT.startY + optionIdx * (C1_LAYOUT.optH + C1_LAYOUT.gap) + C1_LAYOUT.optH / 2;
      this._spawnCorrectParticles(C1_LAYOUT.cx, optY);
      this.#c1Index++;
      if (this.#c1Index >= this.#c1Problems.length) {
        this.#done = true;
      }
    } else {
      this.#audio?.playWrong?.();
      this.#shake = 8;
      this.#c1WrongCount++;
      if (this.#c1WrongCount >= 3) {
        this.#failed = true;
        this.#feedback = '❌ Too many mistakes!';
        this.#feedbackTimer = 2.5;
      } else {
        this.#feedback = `✗ Try again (${3 - this.#c1WrongCount} left)`;
        this.#feedbackTimer = 1.5;
      }
    }
  }

  _c2Input(ev) {
    const prob = this.#c2Problems[this.#c2Index];
    if (!prob) return;

    let optionIdx = null;
    if (ev.type === 'click') {
      optionIdx = this._getClickedOption(ev.x, ev.y, prob.options.length, C2_LAYOUT);
    } else if (ev.type === 'keydown' && ['1','2','3','4'].includes(ev.key)) {
      optionIdx = parseInt(ev.key) - 1;
      if (optionIdx >= prob.options.length) return;
    }
    if (optionIdx === null) return;

    if (optionIdx === prob.a) {
      this.#audio?.playCorrect?.();
      this.#onCorrect?.();
      this.#c2WrongCount = 0;
      this.#feedback = '✓ Correct!';
      this.#feedbackTimer = 1;
      const optY = C2_LAYOUT.startY + optionIdx * (C2_LAYOUT.optH + C2_LAYOUT.gap) + C2_LAYOUT.optH / 2;
      this._spawnCorrectParticles(C2_LAYOUT.cx, optY);
      this.#c2Index++;
      if (this.#c2Index >= this.#c2Problems.length) this.#done = true;
    } else {
      this.#audio?.playWrong?.();
      this.#shake = 8;
      this.#c2WrongCount++;
      if (this.#c2WrongCount >= 3) {
        this.#failed = true;
        this.#feedback = '❌ Too many mistakes!';
        this.#feedbackTimer = 2.5;
      } else {
        this.#feedback = `✗ Not quite (${3 - this.#c2WrongCount} left)`;
        this.#feedbackTimer = 1.5;
      }
    }
  }

  _c3Input(ev) {
    const prob = this.#c3Problems[this.#c3Index];
    if (!prob) return;

    let optionIdx = null;
    if (ev.type === 'click') {
      optionIdx = this._getClickedOption(ev.x, ev.y, prob.options.length, C3_LAYOUT);
    } else if (ev.type === 'keydown' && ['1','2','3','4'].includes(ev.key)) {
      optionIdx = parseInt(ev.key) - 1;
      if (optionIdx >= prob.options.length) return;
    }
    if (optionIdx === null) return;

    if (optionIdx === prob.a) {
      this.#audio?.playCorrect?.();
      this.#onCorrect?.();
      this.#c3WrongCount = 0;
      this.#feedback = '✓ Correct!';
      this.#feedbackTimer = 1;
      const optY = C3_LAYOUT.startY + optionIdx * (C3_LAYOUT.optH + C3_LAYOUT.gap) + C3_LAYOUT.optH / 2;
      this._spawnCorrectParticles(C3_LAYOUT.cx, optY);
      this.#c3Index++;
      if (this.#c3Index >= this.#c3Problems.length) this.#done = true;
    } else {
      this.#audio?.playWrong?.();
      this.#shake = 8;
      this.#c3WrongCount++;
      if (this.#c3WrongCount >= 3) {
        this.#failed = true;
        this.#feedback = '❌ Too many mistakes!';
        this.#feedbackTimer = 2.5;
      } else {
        this.#feedback = `✗ Wrong (${3 - this.#c3WrongCount} left)`;
        this.#feedbackTimer = 1.5;
      }
    }
  }

  _getClickedOption(mx, my, count, layout) {
    const { startY, optH, gap, optW, cx } = layout;
    for (let i = 0; i < count; i++) {
      const oy = startY + i * (optH + gap);
      if (mx >= cx - optW / 2 && mx <= cx + optW / 2 && my >= oy && my <= oy + optH) {
        return i;
      }
    }
    return null;
  }

  // ── Particles ─────────────────────────────────────────────────

  _spawnCorrectParticles(bx, by) {
    for (let i = 0; i < 9; i++) {
      const angle = -Math.PI * 0.8 + (Math.random() - 0.5) * Math.PI * 1.3;
      const speed = 60 + Math.random() * 110;
      this.#particles.push({
        x: bx + (Math.random() - 0.5) * 50,
        y: by,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        isStar: true,
        hue: 40 + Math.floor(Math.random() * 50),
      });
    }
    // +1 bone floating text particle
    this.#particles.push({ x: bx, y: by - 10, vx: 0, vy: -45, life: 1.5, isStar: false });
  }

  _drawParticles(ctx) {
    ctx.save();
    for (const p of this.#particles) {
      if (p.isStar) {
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = `hsl(${p.hue},100%,65%)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5 * p.life, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 15px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('+1 🦴', p.x, p.y);
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ── Render ────────────────────────────────────────────────────

  render(ctx) {
    const dtSec = 1 / 60;
    if (this.#feedbackTimer > 0) this.#feedbackTimer -= dtSec;
    if (this.#shake > 0) this.#shake -= 1;

    // Update particles
    for (const p of this.#particles) {
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      if (p.isStar) p.vy += 90 * dtSec;
      p.life -= dtSec * (p.isStar ? 1.6 : 0.75);
    }
    this.#particles = this.#particles.filter(p => p.life > 0);

    if (this.#zoneId === 1) this._renderC1(ctx);
    else if (this.#zoneId === 2) this._renderC2(ctx);
    else this._renderC3(ctx);

    this._drawParticles(ctx);
  }

  _renderC1(ctx) {
    const shake = this.#shake > 0 ? (Math.random() - 0.5) * 6 : 0;
    this._drawPanel(ctx, 450 + shake, 240, 580, 380);

    ctx.textAlign = 'center';

    // Completion state
    if (this.#done) {
      ctx.fillStyle = '#50e050';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText('🎉 All correct!', 450, 200);
      ctx.fillStyle = '#fff';
      ctx.font = '22px sans-serif';
      ctx.fillText(`${this.#c1Correct}/5 solved!`, 450, 250);
      ctx.textAlign = 'left';
      return;
    }

    // Failure state
    if (this.#failed) {
      ctx.fillStyle = '#e05050';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText('❌ Too many mistakes!', 450, 200);
      ctx.fillStyle = '#fff';
      ctx.font = '20px sans-serif';
      ctx.fillText('You lose a life...', 450, 248);
      ctx.textAlign = 'left';
      return;
    }

    const prob = this.#c1Problems[this.#c1Index];
    if (!prob) { ctx.textAlign = 'left'; return; }

    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('⚔️  Number Gnome Challenge  ⚔️', 450 + shake, 115);

    ctx.fillStyle = '#ccc';
    ctx.font = '15px sans-serif';
    ctx.fillText(`Problem ${this.#c1Index + 1}/5  ·  ✓ ${this.#c1Correct}`, 450 + shake, 145);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText(`${prob.q} = ?`, 450 + shake, 210);

    ctx.fillStyle = '#aaa';
    ctx.font = '13px sans-serif';
    ctx.fillText('Click or press 1 / 2 / 3 / 4', 450 + shake, 232);

    const { startY, optH, gap, optW } = C1_LAYOUT;
    const isWrong = this.#feedbackTimer > 0 && this.#feedback.startsWith('✗');
    prob.options.forEach((opt, i) => {
      const oy = startY + i * (optH + gap);
      ctx.fillStyle = isWrong ? 'rgba(200,60,60,0.3)' : 'rgba(40,80,160,0.5)';
      ctx.fillRect(320, oy, optW, optH);
      ctx.strokeStyle = isWrong ? '#ff6060' : '#6af';
      ctx.lineWidth = 2;
      ctx.strokeRect(320, oy, optW, optH);
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${i + 1}.`, 328, oy + optH / 2 + 5);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(opt, 450 + shake, oy + optH / 2 + 7);
    });

    if (this.#feedbackTimer > 0) {
      ctx.fillStyle = this.#feedback.startsWith('✓') ? '#50e050' : '#ff6060';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.#feedback, 450, startY + prob.options.length * (optH + gap) + 16);
    }
    ctx.textAlign = 'left';
  }

  _renderC2(ctx) {
    const shake = this.#shake > 0 ? (Math.random() - 0.5) * 5 : 0;
    this._drawPanel(ctx, 450 + shake, 240, 580, 380);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText("🧙  Witch's Cauldron — Order of Operations  🧙", 450 + shake, 115);

    if (this.#done) {
      ctx.fillStyle = '#50e050';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText('🎉 All done!', 450, 220);
      ctx.textAlign = 'left';
      return;
    }

    if (this.#failed) {
      ctx.fillStyle = '#e05050';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText('❌ Too many mistakes!', 450, 210);
      ctx.fillStyle = '#fff';
      ctx.font = '18px sans-serif';
      ctx.fillText('You lose a life...', 450, 250);
      ctx.textAlign = 'left';
      return;
    }

    ctx.fillStyle = '#ccc';
    ctx.font = '15px sans-serif';
    ctx.fillText(`Problem ${this.#c2Index + 1}/3`, 450 + shake, 145);

    const prob = this.#c2Problems[this.#c2Index];
    if (!prob) { ctx.textAlign = 'left'; return; }

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(prob.q, 450 + shake, 210);

    ctx.fillStyle = '#aaa';
    ctx.font = '13px sans-serif';
    ctx.fillText('Click or press 1 / 2 / 3 / 4', 450 + shake, 232);

    const { startY, optH, gap, optW } = C2_LAYOUT;
    const isWrong = this.#feedbackTimer > 0 && this.#feedback.startsWith('✗');
    prob.options.forEach((opt, i) => {
      const oy = startY + i * (optH + gap);
      ctx.fillStyle = isWrong ? 'rgba(200,60,60,0.3)' : 'rgba(40,80,160,0.5)';
      ctx.fillRect(320, oy, optW, optH);
      ctx.strokeStyle = isWrong ? '#ff6060' : '#6af';
      ctx.lineWidth = 2;
      ctx.strokeRect(320, oy, optW, optH);
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${i + 1}.`, 328, oy + optH / 2 + 5);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(opt, 450 + shake, oy + optH / 2 + 7);
    });

    if (this.#feedbackTimer > 0) {
      ctx.fillStyle = this.#feedback.startsWith('✓') ? '#50e050' : '#ff6060';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.#feedback, 450, startY + prob.options.length * (optH + gap) + 16);
    }
    ctx.textAlign = 'left';
  }

  _renderC3(ctx) {
    const shake = this.#shake > 0 ? (Math.random() - 0.5) * 5 : 0;
    this._drawPanel(ctx, 450 + shake, 240, 600, 380);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText("🐉  Dragon's Riddle — Fractions  🐉", 450 + shake, 115);

    if (this.#done) {
      ctx.fillStyle = '#50e050';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText('🎉 All done!', 450, 220);
      ctx.textAlign = 'left';
      return;
    }

    if (this.#failed) {
      ctx.fillStyle = '#e05050';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText('❌ Too many mistakes!', 450, 210);
      ctx.fillStyle = '#fff';
      ctx.font = '18px sans-serif';
      ctx.fillText('You lose a life...', 450, 250);
      ctx.textAlign = 'left';
      return;
    }

    ctx.fillStyle = '#ccc';
    ctx.font = '15px sans-serif';
    ctx.fillText(`Riddle ${this.#c3Index + 1}/3`, 450 + shake, 145);

    const prob = this.#c3Problems[this.#c3Index];
    if (!prob) { ctx.textAlign = 'left'; return; }

    ctx.fillStyle = '#fff';
    ctx.font = '19px sans-serif';
    this._wrapText(ctx, prob.q, 450, 186, 540, 24);

    ctx.fillStyle = '#aaa';
    ctx.font = '13px sans-serif';
    ctx.fillText('Click or press 1 / 2 / 3', 450 + shake, 248);

    const { startY, optH, gap, optW } = C3_LAYOUT;
    const isWrong = this.#feedbackTimer > 0 && this.#feedback.startsWith('✗');
    prob.options.forEach((opt, i) => {
      const oy = startY + i * (optH + gap);
      ctx.fillStyle = isWrong ? 'rgba(200,60,60,0.3)' : 'rgba(40,80,160,0.5)';
      ctx.fillRect(320, oy, optW, optH);
      ctx.strokeStyle = isWrong ? '#ff6060' : '#6af';
      ctx.lineWidth = 2;
      ctx.strokeRect(320, oy, optW, optH);
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${i + 1}.`, 328, oy + optH / 2 + 5);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(opt, 450 + shake, oy + optH / 2 + 7);
    });

    if (this.#feedbackTimer > 0) {
      ctx.fillStyle = this.#feedback.startsWith('✓') ? '#50e050' : '#ff6060';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.#feedback, 450, startY + prob.options.length * (optH + gap) + 16);
    }
    ctx.textAlign = 'left';
  }

  _drawPanel(ctx, cx, cy, w, h) {
    ctx.fillStyle = 'rgba(10,20,40,0.92)';
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, cy - h / 2, w, h, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(100,160,255,0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  _wrapText(ctx, text, x, y, maxWidth, lineH) {
    const words = text.split(' ');
    let line = '';
    for (const word of words) {
      const test = line + word + ' ';
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, y);
        line = word + ' ';
        y += lineH;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, x, y);
  }
}

// ── Helpers ───────────────────────────────────────────────────

function buildC1Options(prob) {
  const correct = prob.a;
  const d = [];

  // Distractor 1: off by ±1
  d.push(correct % 2 === 0 ? correct - 1 : correct + 1);

  // Distractor 2: wrong operation (addition instead of multiplication, or subtraction for division)
  if (prob.q.includes('×')) {
    const parts = prob.q.replace(/\s/g, '').split('×').map(Number);
    const wrongOp = parts[0] + parts[1];
    d.push(wrongOp !== correct ? wrongOp : correct + 3);
  } else if (prob.q.includes('÷')) {
    const parts = prob.q.replace(/\s/g, '').split('÷').map(Number);
    const wrongOp = parts[0] - parts[1];
    d.push((wrongOp !== correct && wrongOp > 0) ? wrongOp : correct + 3);
  } else {
    d.push(correct + 2);
  }

  // Distractor 3: nearby round number (multiple of 5)
  const multOf5 = Math.round(correct / 5) * 5;
  const nearRound = multOf5 !== correct ? multOf5 : (Math.ceil(correct / 5) * 5 + 5);
  d.push(nearRound !== correct ? nearRound : correct + 4);

  // Deduplicate, ensure positive and different from correct
  const unique = [...new Set(d.filter(x => x !== correct && x > 0))];
  while (unique.length < 3) {
    const pad = correct + unique.length * 2 + 1;
    if (!unique.includes(pad) && pad !== correct) unique.push(pad);
  }

  // 4 options with correct at random position
  const all4 = [...unique.slice(0, 3), correct];
  shuffle(all4);
  return { q: prob.q, options: all4.map(String), a: all4.indexOf(correct) };
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
