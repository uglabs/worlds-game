/**
 * logic.js — World 2 challenges: pattern completion, grid deduction, rule inference.
 * Zone id 1 = Cloud Sequence, 2 = Oracle's Deduction, 3 = Rule Machine.
 *
 * Exports: LogicChallenge — implements { init, render, handleInput, isDone, isFailed, getContext }
 */

// ── Challenge Data ─────────────────────────────────────────────

const SEQUENCES = [
  { seq: [2, 6, 18, 54], options: ['108', '162', '58', '72'], a: 1, rule: '×3' },
  { seq: [1, 4, 9, 16], options: ['20', '25', '24', '30'], a: 1, rule: 'n²' },
  { seq: [3, 7, 11, 15], options: ['18', '19', '20', '17'], a: 1, rule: '+4' },
  { seq: [5, 10, 20, 40], options: ['60', '80', '70', '50'], a: 1, rule: '×2' },
  { seq: [100, 50, 25], options: ['10', '12.5', '15', '20'], a: 1, rule: '÷2' },
];

// Grid deduction puzzle — FIXED solution and clues
const DEDUCTION_PUZZLE = {
  names: ['Knight', 'Wizard', 'Archer'],
  rows: 3, cols: 3,
  clues: [
    'The Wizard is in the top row.',
    'The Knight is in the middle row.',
    'The Archer is in the bottom row.',
    'The heroes line up diagonally, top-left to bottom-right.',
  ],
  solution: [
    [1, -1, -1],
    [-1, 0, -1],
    [-1, -1, 2],
  ],
};

const RULE_MACHINES = [
  { pairs: [[3,7],[5,11],[8,17],[2,5]], options: ['×2+1', '×3−2', '+4', '×2+2'], a: 0 },
  { pairs: [[2,8],[4,16],[6,24],[1,4]], options: ['×4', '×3+2', '+6', '×5−2'], a: 0 },
  { pairs: [[10,7],[8,5],[12,9],[6,3]], options: ['−3', '−2', '÷2+2', '×0.7'], a: 0 },
];

// Layout constants
const SEQ_LAYOUT     = { startY: 228, optH: 44, gap: 9,  optW: 280, cx: 450 };
const MACHINE_LAYOUT = { startY: 268, optH: 38, gap: 7,  optW: 280, cx: 450 };

// ── LogicChallenge ─────────────────────────────────────────────

export class LogicChallenge {
  #zoneId = 1;
  #done = false;
  #failed = false;
  #feedback = '';
  #feedbackTimer = 0;
  #shake = 0;
  #audio = null;
  #onCorrect = null;

  // Particles
  #particles = [];

  // C1 — Sequences
  #sequences = [];
  #seqIndex = 0;
  #seqWrongCount = 0;

  // C2 — Deduction grid
  #grid = null;
  #selectedNameIdx = null;
  #gridErrors = null;
  #deductionDone = false;
  #deductWrongCount = 0;

  // C3 — Rule machines
  #machines = [];
  #machineIndex = 0;
  #machineWrongCount = 0;

  init(zone, worldIndex, audioManager, callbacks = {}) {
    this.#zoneId = zone.id;
    this.#done = false;
    this.#failed = false;
    this.#audio = audioManager;
    this.#onCorrect = callbacks.onCorrect || null;
    this.#feedback = '';
    this.#feedbackTimer = 0;
    this.#shake = 0;
    this.#particles = [];

    if (zone.id === 1) {
      this.#sequences = shuffle([...SEQUENCES]).slice(0, 3);
      this.#seqIndex = 0;
      this.#seqWrongCount = 0;
    } else if (zone.id === 2) {
      this.#grid = Array.from({ length: 3 }, () => [-1, -1, -1]);
      this.#selectedNameIdx = null;
      this.#gridErrors = null;
      this.#deductionDone = false;
      this.#deductWrongCount = 0;
    } else {
      this.#machines = shuffle([...RULE_MACHINES]).slice(0, 3);
      this.#machineIndex = 0;
      this.#machineWrongCount = 0;
    }
  }

  isDone()   { return this.#done; }
  isFailed() { return this.#failed; }

  getContext() {
    if (this.#zoneId === 1) {
      const seq = this.#sequences[this.#seqIndex];
      if (!seq) return 'Cloud Sequence complete!';
      return `Cloud Sequence (pattern): Sequence ${this.#seqIndex + 1}/3: ${seq.seq.join(', ')}, ? — Options: 1) ${seq.options[0]}  2) ${seq.options[1]}  3) ${seq.options[2]}  4) ${seq.options[3]}. Press 1/2/3/4 or click.`;
    } else if (this.#zoneId === 2) {
      const placed = DEDUCTION_PUZZLE.names.map((name, i) => {
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            if (this.#grid[r][c] === i) return `${name} at Row ${r+1}/Col ${c+1}`;
          }
        }
        return `${name} not placed yet`;
      }).join(', ');
      return `Oracle's Deduction: Click a name below to select it, then click a grid cell to place it. Click Submit when done. Clues: ${DEDUCTION_PUZZLE.clues.join(' ')} Current placements: ${placed}.`;
    } else {
      const machine = this.#machines[this.#machineIndex];
      if (!machine) return 'Rule Machine complete!';
      const pairs = machine.pairs.map(([i,o]) => `${i}→${o}`).join(', ');
      return `Rule Machine: Machine ${this.#machineIndex + 1}/3: input→output pairs: ${pairs}. Options: 1) n → ${machine.options[0]}  2) n → ${machine.options[1]}  3) n → ${machine.options[2]}  4) n → ${machine.options[3]}. Press 1/2/3/4 or click.`;
    }
  }

  // ── Input ─────────────────────────────────────────────────────

  handleInput(ev) {
    if (this.#failed || this.#done) return;
    if (this.#zoneId === 1) this._seqInput(ev);
    else if (this.#zoneId === 2) this._deductInput(ev);
    else this._machineInput(ev);
  }

  _seqInput(ev) {
    const seq = this.#sequences[this.#seqIndex];
    if (!seq) return;

    let idx = null;
    if (ev.type === 'click') {
      idx = this._clickedOption(ev.x, ev.y, seq.options.length, SEQ_LAYOUT);
    } else if (ev.type === 'keydown' && ['1','2','3','4'].includes(ev.key)) {
      idx = parseInt(ev.key) - 1;
      if (idx >= seq.options.length) return;
    }
    if (idx === null) return;

    if (idx === seq.a) {
      this.#audio?.playCorrect?.();
      this.#onCorrect?.();
      this.#seqWrongCount = 0;
      this.#feedback = '✓ Correct!';
      this.#feedbackTimer = 1;
      const optY = SEQ_LAYOUT.startY + idx * (SEQ_LAYOUT.optH + SEQ_LAYOUT.gap) + SEQ_LAYOUT.optH / 2;
      this._spawnCorrectParticles(SEQ_LAYOUT.cx, optY);
      this.#seqIndex++;
      if (this.#seqIndex >= this.#sequences.length) this.#done = true;
    } else {
      this.#audio?.playWrong?.();
      this.#shake = 8;
      this.#seqWrongCount++;
      if (this.#seqWrongCount >= 3) {
        this.#failed = true;
        this.#feedback = '❌ Too many mistakes!';
        this.#feedbackTimer = 2.5;
      } else {
        this.#feedback = `✗ Try again (${3 - this.#seqWrongCount} left)`;
        this.#feedbackTimer = 1.5;
      }
    }
  }

  _deductInput(ev) {
    if (ev.type !== 'click') return;

    // Submit button
    if (ev.x >= 350 && ev.x <= 550 && ev.y >= 426 && ev.y <= 454) {
      this._checkDeductSolution();
      return;
    }

    const ni = this._clickedNameToken(ev.x, ev.y);
    if (ni !== null) {
      this.#selectedNameIdx = (this.#selectedNameIdx === ni) ? null : ni;
      this.#gridErrors = null;
      return;
    }

    const cell = this._clickedGridCell(ev.x, ev.y);
    if (cell) {
      if (this.#selectedNameIdx !== null) {
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            if (this.#grid[r][c] === this.#selectedNameIdx) this.#grid[r][c] = -1;
          }
        }
        this.#grid[cell.row][cell.col] = this.#selectedNameIdx;
        this.#selectedNameIdx = null;
      } else {
        this.#grid[cell.row][cell.col] = -1;
      }
      this.#gridErrors = null;
    }
  }

  _clickedNameToken(x, y) {
    const names = DEDUCTION_PUZZLE.names;
    const startX = 180;
    const tokenW = 100;
    const tokenH = 36;
    const ty = 382;
    for (let i = 0; i < names.length; i++) {
      const tx = startX + i * 120;
      if (x >= tx && x <= tx + tokenW && y >= ty && y <= ty + tokenH) return i;
    }
    return null;
  }

  _clickedGridCell(x, y) {
    const gridX = 310, gridY = 168, cellW = 92, cellH = 58;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const cx = gridX + c * cellW;
        const cy = gridY + r * cellH;
        if (x >= cx && x <= cx + cellW && y >= cy && y <= cy + cellH) {
          return { row: r, col: c };
        }
      }
    }
    return null;
  }

  _checkDeductSolution() {
    const sol = DEDUCTION_PUZZLE.solution;
    const errors = Array.from({ length: 3 }, () => [false, false, false]);
    let allCorrect = true;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (sol[r][c] !== -1) {
          if (this.#grid[r][c] !== sol[r][c]) {
            errors[r][c] = true;
            allCorrect = false;
          }
        }
      }
    }
    this.#gridErrors = errors;
    if (allCorrect) {
      this.#audio?.playCorrect?.();
      this.#onCorrect?.();
      this._spawnCorrectParticles(450, 240);
      this.#done = true;
    } else {
      this.#audio?.playWrong?.();
      this.#shake = 8;
      this.#deductWrongCount++;
      if (this.#deductWrongCount >= 3) {
        this.#failed = true;
        this.#feedback = '❌ Too many mistakes!';
        this.#feedbackTimer = 2.5;
      } else {
        this.#feedback = `✗ Some placements are wrong — re-read the clues (${3 - this.#deductWrongCount} tries left)`;
        this.#feedbackTimer = 2.5;
      }
    }
  }

  _machineInput(ev) {
    const machine = this.#machines[this.#machineIndex];
    if (!machine) return;

    let idx = null;
    if (ev.type === 'click') {
      idx = this._clickedOption(ev.x, ev.y, machine.options.length, MACHINE_LAYOUT);
    } else if (ev.type === 'keydown' && ['1','2','3','4'].includes(ev.key)) {
      idx = parseInt(ev.key) - 1;
      if (idx >= machine.options.length) return;
    }
    if (idx === null) return;

    if (idx === machine.a) {
      this.#audio?.playCorrect?.();
      this.#onCorrect?.();
      this.#machineWrongCount = 0;
      this.#feedback = '✓ You found the rule!';
      this.#feedbackTimer = 1;
      const optY = MACHINE_LAYOUT.startY + idx * (MACHINE_LAYOUT.optH + MACHINE_LAYOUT.gap) + MACHINE_LAYOUT.optH / 2;
      this._spawnCorrectParticles(MACHINE_LAYOUT.cx, optY);
      this.#machineIndex++;
      if (this.#machineIndex >= this.#machines.length) this.#done = true;
    } else {
      this.#audio?.playWrong?.();
      this.#shake = 8;
      this.#machineWrongCount++;
      if (this.#machineWrongCount >= 3) {
        this.#failed = true;
        this.#feedback = '❌ Too many mistakes!';
        this.#feedbackTimer = 2.5;
      } else {
        this.#feedback = `✗ Not quite — look at the pattern (${3 - this.#machineWrongCount} left)`;
        this.#feedbackTimer = 2;
      }
    }
  }

  _clickedOption(mx, my, count, layout) {
    const { startY, optH, gap, optW, cx } = layout;
    for (let i = 0; i < count; i++) {
      const oy = startY + i * (optH + gap);
      if (mx >= cx - optW / 2 && mx <= cx + optW / 2 && my >= oy && my <= oy + optH) return i;
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
        hue: 180 + Math.floor(Math.random() * 60),
      });
    }
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

    if (this.#zoneId === 1) this._renderSeq(ctx);
    else if (this.#zoneId === 2) this._renderDeduct(ctx);
    else this._renderMachine(ctx);

    this._drawParticles(ctx);
  }

  _renderSeq(ctx) {
    const shake = this.#shake > 0 ? (Math.random() - 0.5) * 5 : 0;
    this._drawPanel(ctx, 450 + shake, 240, 580, 400);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#a0d8ef';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('☁️  Cloud Sequence Challenge  ☁️', 450, 115);

    if (this.#done) {
      ctx.fillStyle = '#50e050';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText('🎉 All sequences solved!', 450, 220);
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
    ctx.font = '14px sans-serif';
    ctx.fillText(`Sequence ${this.#seqIndex + 1}/3 — What comes next?`, 450, 143);

    const seq = this.#sequences[this.#seqIndex];
    if (!seq) { ctx.textAlign = 'left'; return; }

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px sans-serif';
    const display = [...seq.seq.map(String), '?'].join('  ,  ');
    ctx.fillText(display, 450 + shake, 204);

    ctx.fillStyle = '#aaa';
    ctx.font = '13px sans-serif';
    ctx.fillText('Click or press 1 / 2 / 3 / 4', 450, 220);

    const { startY, optH, gap, optW } = SEQ_LAYOUT;
    const isWrong = this.#feedbackTimer > 0 && this.#feedback.startsWith('✗');
    seq.options.forEach((opt, i) => {
      const oy = startY + i * (optH + gap);
      ctx.fillStyle = isWrong ? 'rgba(200,60,60,0.35)' : 'rgba(30,80,160,0.5)';
      ctx.fillRect(310, oy, optW, optH);
      ctx.strokeStyle = isWrong ? '#ff6060' : '#6af';
      ctx.lineWidth = 2;
      ctx.strokeRect(310, oy, optW, optH);
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${i + 1}.`, 318, oy + optH / 2 + 5);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(opt, 450 + shake, oy + optH / 2 + 8);
    });

    if (this.#feedbackTimer > 0) {
      ctx.fillStyle = this.#feedback.startsWith('✓') ? '#50e050' : '#ff6060';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.#feedback, 450, startY + seq.options.length * (optH + gap) + 16);
    }
    ctx.textAlign = 'left';
  }

  _renderDeduct(ctx) {
    const shake = this.#shake > 0 ? (Math.random() - 0.5) * 4 : 0;
    this._drawPanel(ctx, 450 + shake, 240, 640, 440);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd080';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText("⚡  Oracle's Deduction — Grid Puzzle  ⚡", 450, 80);

    if (this.#done) {
      ctx.fillStyle = '#50e050';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText('🎉 Perfect placement!', 450, 240);
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

    // Clues
    ctx.font = '13px sans-serif';
    DEDUCTION_PUZZLE.clues.forEach((c, i) => {
      ctx.fillStyle = i < 3 ? '#9cf' : '#ffdd80';
      ctx.textAlign = 'left';
      ctx.fillText(`${i + 1}. ${c}`, 142, 104 + i * 18);
    });

    // Grid
    const gridX = 310, gridY = 168, cellW = 92, cellH = 58;
    ctx.fillStyle = '#aaa';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ['Col 1', 'Col 2', 'Col 3'].forEach((label, c) => {
      ctx.fillText(label, gridX + c * cellW + cellW / 2, gridY - 8);
    });
    ['Row 1', 'Row 2', 'Row 3'].forEach((label, r) => {
      ctx.fillText(label, gridX - 36, gridY + r * cellH + cellH / 2 + 4);
    });

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const cx2 = gridX + c * cellW;
        const cy2 = gridY + r * cellH;
        const hasError = this.#gridErrors?.[r][c];
        ctx.fillStyle = hasError ? 'rgba(200,50,50,0.4)' : 'rgba(30,60,120,0.5)';
        ctx.fillRect(cx2, cy2, cellW, cellH);
        ctx.strokeStyle = hasError ? '#ff6060' : '#6af';
        ctx.lineWidth = 2;
        ctx.strokeRect(cx2, cy2, cellW, cellH);
        const nameIdx = this.#grid[r][c];
        if (nameIdx >= 0) {
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 14px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(DEDUCTION_PUZZLE.names[nameIdx], cx2 + cellW / 2, cy2 + cellH / 2 + 5);
        }
      }
    }

    // Name tokens
    const names = DEDUCTION_PUZZLE.names;
    const tokenY = 382;
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#cce';
    ctx.fillText(this.#selectedNameIdx !== null
      ? `"${names[this.#selectedNameIdx]}" selected — click a cell to place`
      : 'Click a name to select it, then click a grid cell', 450, 373);

    names.forEach((name, i) => {
      const tx = 180 + i * 120;
      const isSelected = this.#selectedNameIdx === i;
      ctx.fillStyle = isSelected ? 'rgba(255,200,0,0.8)' : 'rgba(60,40,160,0.7)';
      ctx.fillRect(tx, tokenY, 100, 36);
      ctx.strokeStyle = isSelected ? '#ffd700' : '#88f';
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.strokeRect(tx, tokenY, 100, 36);
      ctx.fillStyle = isSelected ? '#000' : '#fff';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(name, tx + 50, tokenY + 23);
    });

    // Submit button
    ctx.fillStyle = 'rgba(40,140,60,0.8)';
    ctx.fillRect(350, 426, 200, 28);
    ctx.strokeStyle = '#6f6';
    ctx.lineWidth = 2;
    ctx.strokeRect(350, 426, 200, 28);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Submit', 450, 445);

    if (this.#feedbackTimer > 0) {
      ctx.fillStyle = this.#feedback.startsWith('✗') ? '#ff6060' : '#50e050';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.#feedback, 450, 458);
    }
    ctx.textAlign = 'left';
  }

  _renderMachine(ctx) {
    const shake = this.#shake > 0 ? (Math.random() - 0.5) * 5 : 0;
    this._drawPanel(ctx, 450 + shake, 240, 580, 400);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffa040';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('⚙️  Rule Machine Challenge  ⚙️', 450, 110);

    if (this.#done) {
      ctx.fillStyle = '#50e050';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText('🎉 All rules found!', 450, 220);
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
    ctx.font = '14px sans-serif';
    ctx.fillText(`Machine ${this.#machineIndex + 1}/3 — Identify the rule`, 450, 134);

    const machine = this.#machines[this.#machineIndex];
    if (!machine) { ctx.textAlign = 'left'; return; }

    ctx.fillStyle = '#fff';
    ctx.font = '17px sans-serif';
    machine.pairs.forEach(([inp, out], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const px = col === 0 ? 310 : 530;
      ctx.textAlign = col === 0 ? 'right' : 'left';
      ctx.fillText(`${inp}  →  ${out}`, px, 162 + row * 26);
    });

    ctx.fillStyle = '#aaa';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Which rule produces these results?', 450, 228);
    ctx.font = '13px sans-serif';
    ctx.fillText('Click or press 1 / 2 / 3 / 4', 450, 248);

    const { startY, optH, gap, optW } = MACHINE_LAYOUT;
    const isWrong = this.#feedbackTimer > 0 && this.#feedback.startsWith('✗');
    machine.options.forEach((opt, i) => {
      const oy = startY + i * (optH + gap);
      ctx.fillStyle = isWrong ? 'rgba(200,60,60,0.35)' : 'rgba(30,80,160,0.5)';
      ctx.fillRect(310, oy, optW, optH);
      ctx.strokeStyle = isWrong ? '#ff6060' : '#6af';
      ctx.lineWidth = 2;
      ctx.strokeRect(310, oy, optW, optH);
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${i + 1}.`, 318, oy + optH / 2 + 5);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`n → ${opt}`, 450 + shake, oy + optH / 2 + 6);
    });

    if (this.#feedbackTimer > 0) {
      ctx.fillStyle = this.#feedback.startsWith('✓') ? '#50e050' : '#ff6060';
      ctx.font = '15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.#feedback, 450, startY + machine.options.length * (optH + gap) + 16);
    }
    ctx.textAlign = 'left';
  }

  _drawPanel(ctx, cx, cy, w, h) {
    ctx.fillStyle = 'rgba(8,15,35,0.93)';
    ctx.beginPath();
    ctx.roundRect(cx - w / 2, cy - h / 2, w, h, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(100,160,255,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
