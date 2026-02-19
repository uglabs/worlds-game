/**
 * math.js — World 1 challenges: arithmetic, PEMDAS, fractions/percentages.
 * Three sub-challenges selected by zone.id.
 *
 * Exports: MathChallenge — implements { init, render, handleInput, isDone, getContext }
 */

// ── World 1 Challenge Data ─────────────────────────────────────

const C1_PROBLEMS = [
  { q: '7 × 8', a: 56 },
  { q: '63 ÷ 9', a: 7 },
  { q: '12 × 6', a: 72 },
  { q: '144 ÷ 12', a: 12 },
  { q: '9 × 7', a: 63 },
  { q: '56 ÷ 7', a: 8 },
  { q: '15 × 4', a: 60 },
  { q: '108 ÷ 9', a: 12 },
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

// Layout constants — options must fit within the panel
// Panel for C2/C3: _drawPanel(ctx, 450, 240, 580, 380) → y=50 to y=430

// C2: 4 options, startY=242, optH=38, gap=9 → items at 242,289,336,383 → bottom=421 ✓
const C2_LAYOUT = { startY: 242, optH: 38, gap: 9, optW: 260, cx: 450 };

// C3: 3 options, startY=260, optH=48, gap=10 → items at 260,318,376 → bottom=424 ✓
const C3_LAYOUT = { startY: 260, optH: 48, gap: 10, optW: 260, cx: 450 };

// ── MathChallenge ─────────────────────────────────────────────

export class MathChallenge {
  #zoneId = 1;
  #done = false;
  #input = '';
  #shake = 0;
  #feedback = '';
  #feedbackTimer = 0;
  #audio = null;

  // C1 state
  #c1Problems = [];
  #c1Index = 0;
  #c1Correct = 0;
  #c1Timer = 30;
  #c1LastTick = 0;
  #c1Result = null; // null | 'pass' | 'fail'

  // C2 state
  #c2Problems = [];
  #c2Index = 0;
  #c2Selected = null;
  #c2Wrong = false;

  // C3 state
  #c3Problems = [];
  #c3Index = 0;
  #c3Selected = null;
  #c3Wrong = false;

  init(zone, worldIndex, audioManager) {
    this.#zoneId = zone.id;
    this.#done = false;
    this.#audio = audioManager;
    this.#input = '';

    if (zone.id === 1) {
      this.#c1Problems = shuffle([...C1_PROBLEMS]).slice(0, 5);
      this.#c1Index = 0;
      this.#c1Correct = 0;
      this.#c1Timer = 30;
      this.#c1LastTick = Date.now();
      this.#c1Result = null;
    } else if (zone.id === 2) {
      this.#c2Problems = shuffle([...C2_PROBLEMS]).slice(0, 3);
      this.#c2Index = 0;
      this.#c2Selected = null;
      this.#c2Wrong = false;
    } else {
      this.#c3Problems = shuffle([...C3_PROBLEMS]).slice(0, 3);
      this.#c3Index = 0;
      this.#c3Selected = null;
      this.#c3Wrong = false;
    }
  }

  isDone() { return this.#done; }

  getContext() {
    if (this.#zoneId === 1) {
      const prob = this.#c1Problems[this.#c1Index];
      if (!prob) return 'Number Gnome challenge complete!';
      return `Number Gnome (speed arithmetic): Problem ${this.#c1Index + 1}/5: "${prob.q} = ?" — type the answer and press Enter. Timer: ${Math.ceil(this.#c1Timer)}s left, ${this.#c1Correct} correct so far.`;
    } else if (this.#zoneId === 2) {
      const prob = this.#c2Problems[this.#c2Index];
      if (!prob) return "Witch's Cauldron complete!";
      return `Witch's Cauldron (order of operations): Problem ${this.#c2Index + 1}/3: "${prob.q}" Options: 1) ${prob.options[0]}  2) ${prob.options[1]}  3) ${prob.options[2]}  4) ${prob.options[3]}. Press 1/2/3/4 or click to choose.`;
    } else {
      const prob = this.#c3Problems[this.#c3Index];
      if (!prob) return "Dragon's Riddle complete!";
      return `Dragon's Riddle (fractions/percentages): Riddle ${this.#c3Index + 1}/3: "${prob.q}" Options: 1) ${prob.options[0]}  2) ${prob.options[1]}  3) ${prob.options[2]}. Press 1/2/3 or click to choose.`;
    }
  }

  // ── Input ─────────────────────────────────────────────────────

  handleInput(ev) {
    if (ev.type !== 'keydown' && ev.type !== 'click') return;

    if (this.#zoneId === 1) this._c1Input(ev);
    else if (this.#zoneId === 2) this._c2Input(ev);
    else this._c3Input(ev);
  }

  _c1Input(ev) {
    if (this.#c1Result) return;
    if (ev.type === 'keydown') {
      if (ev.key === 'Enter') {
        const val = parseInt(this.#input, 10);
        const problem = this.#c1Problems[this.#c1Index];
        if (!isNaN(val)) {
          if (val === problem.a) {
            this.#audio?.playCorrect?.();
            this.#c1Correct++;
            this.#c1Index++;
            this.#input = '';
            this.#feedback = '✓ Correct!';
            this.#feedbackTimer = 1;
            if (this.#c1Index >= this.#c1Problems.length) {
              this.#c1Result = this.#c1Correct >= 4 ? 'pass' : 'fail';
              if (this.#c1Result === 'pass') this.#done = true;
            }
          } else {
            this.#audio?.playWrong?.();
            this.#shake = 8;
            this.#feedback = '✗ Try again';
            this.#feedbackTimer = 1.5;
            this.#input = '';
          }
        }
      } else if (ev.key === 'Backspace') {
        this.#input = this.#input.slice(0, -1);
      } else if (/^[0-9\-]$/.test(ev.key) && this.#input.length < 6) {
        this.#input += ev.key;
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
      this.#feedback = '✓ Correct!';
      this.#feedbackTimer = 1;
      this.#c2Index++;
      this.#c2Selected = null;
      this.#c2Wrong = false;
      if (this.#c2Index >= this.#c2Problems.length) this.#done = true;
    } else {
      this.#audio?.playWrong?.();
      this.#shake = 8;
      this.#c2Wrong = true;
      this.#feedback = '✗ Not quite — try again';
      this.#feedbackTimer = 1.5;
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
      this.#feedback = '✓ Correct!';
      this.#feedbackTimer = 1;
      this.#c3Index++;
      this.#c3Selected = null;
      this.#c3Wrong = false;
      if (this.#c3Index >= this.#c3Problems.length) this.#done = true;
    } else {
      this.#audio?.playWrong?.();
      this.#shake = 8;
      this.#c3Wrong = true;
      this.#feedback = '✗ Wrong — try again';
      this.#feedbackTimer = 1.5;
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

  // ── Render ────────────────────────────────────────────────────

  render(ctx) {
    const now = Date.now();
    if (this.#zoneId === 1 && !this.#c1Result) {
      const elapsed = (now - this.#c1LastTick) / 1000;
      this.#c1LastTick = now;
      this.#c1Timer = Math.max(0, this.#c1Timer - elapsed);
      if (this.#c1Timer <= 0 && !this.#c1Result) {
        this.#c1Result = this.#c1Correct >= 4 ? 'pass' : 'fail';
        if (this.#c1Result === 'pass') this.#done = true;
      }
    }
    if (this.#feedbackTimer > 0) this.#feedbackTimer -= 1 / 60;
    if (this.#shake > 0) this.#shake -= 1;

    if (this.#zoneId === 1) this._renderC1(ctx);
    else if (this.#zoneId === 2) this._renderC2(ctx);
    else this._renderC3(ctx);
  }

  _renderC1(ctx) {
    const shake = this.#shake > 0 ? (Math.random() - 0.5) * 6 : 0;

    this._drawPanel(ctx, 450 + shake, 240, 540, 320);

    ctx.textAlign = 'center';

    if (this.#c1Result) {
      ctx.fillStyle = this.#c1Result === 'pass' ? '#50e050' : '#e05050';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText(this.#c1Result === 'pass' ? '🎉 Well done!' : '⏱ Time\'s up!', 450, 210);
      ctx.fillStyle = '#fff';
      ctx.font = '20px sans-serif';
      ctx.fillText(`You got ${this.#c1Correct}/5 correct.`, 450, 250);
      if (this.#c1Result === 'fail') {
        ctx.fillStyle = '#ffd700';
        ctx.font = '16px sans-serif';
        ctx.fillText('Press Esc and try again', 450, 290);
      }
      ctx.textAlign = 'left';
      return;
    }

    const prob = this.#c1Problems[this.#c1Index];
    if (!prob) return;

    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('⚔️  Number Gnome Challenge  ⚔️', 450, 115);

    ctx.fillStyle = '#ccc';
    ctx.font = '15px sans-serif';
    ctx.fillText(`Problem ${this.#c1Index + 1}/5  ·  ✓ ${this.#c1Correct}  ·  ⏱ ${Math.ceil(this.#c1Timer)}s`, 450, 145);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText(`${prob.q} = ?`, 450, 210);

    ctx.strokeStyle = '#6af';
    ctx.lineWidth = 2;
    ctx.strokeRect(350, 230 + shake, 200, 44);
    ctx.fillStyle = 'rgba(0,100,200,0.2)';
    ctx.fillRect(350, 230 + shake, 200, 44);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(this.#input || '|', 450, 260 + shake);

    ctx.fillStyle = '#aaa';
    ctx.font = '13px sans-serif';
    ctx.fillText('Type your answer and press Enter', 450, 300);

    if (this.#feedbackTimer > 0) {
      ctx.fillStyle = this.#feedback.startsWith('✓') ? '#50e050' : '#ff6060';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(this.#feedback, 450, 330);
    }
    ctx.textAlign = 'left';
  }

  _renderC2(ctx) {
    const shake = this.#shake > 0 ? (Math.random() - 0.5) * 5 : 0;
    // Panel: y=50 to y=430
    this._drawPanel(ctx, 450 + shake, 240, 580, 380);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText("🧙  Witch's Cauldron — Order of Operations  🧙", 450 + shake, 115);

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

    // Options — use C2_LAYOUT so they stay within panel
    const { startY, optH, gap, optW } = C2_LAYOUT;
    prob.options.forEach((opt, i) => {
      const oy = startY + i * (optH + gap);
      const isWrong = this.#c2Wrong;
      ctx.fillStyle = isWrong ? 'rgba(200,60,60,0.3)' : 'rgba(40,80,160,0.5)';
      ctx.fillRect(320, oy, optW, optH);
      ctx.strokeStyle = isWrong ? '#ff6060' : '#6af';
      ctx.lineWidth = 2;
      ctx.strokeRect(320, oy, optW, optH);
      // Number label on left
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${i + 1}.`, 328, oy + optH / 2 + 5);
      // Option text centered
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
    // Panel: y=50 to y=430
    this._drawPanel(ctx, 450 + shake, 240, 600, 380);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText("🐉  Dragon's Riddle — Fractions  🐉", 450 + shake, 115);

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

    // Options — use C3_LAYOUT so they stay within panel
    const { startY, optH, gap, optW } = C3_LAYOUT;
    prob.options.forEach((opt, i) => {
      const oy = startY + i * (optH + gap);
      ctx.fillStyle = this.#c3Wrong ? 'rgba(200,60,60,0.3)' : 'rgba(40,80,160,0.5)';
      ctx.fillRect(320, oy, optW, optH);
      ctx.strokeStyle = this.#c3Wrong ? '#ff6060' : '#6af';
      ctx.lineWidth = 2;
      ctx.strokeRect(320, oy, optW, optH);
      // Number label
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${i + 1}.`, 328, oy + optH / 2 + 5);
      // Option text
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

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
