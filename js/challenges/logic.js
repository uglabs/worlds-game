/**
 * logic.js — World 2 challenges: pattern completion, grid deduction, rule inference.
 * Zone id 1 = Cloud Sequence, 2 = Oracle's Deduction, 3 = Rule Machine.
 *
 * Exports: LogicChallenge — implements { init, render, handleInput, isDone, getContext }
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
// names: index 0=Knight, 1=Wizard, 2=Archer
// solution[row][col]: value = name index, -1 = don't check
// Wizard(1) at row0/col0, Knight(0) at row1/col1, Archer(2) at row2/col2
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
    [1, -1, -1],   // row 0 (top): Wizard at col 0
    [-1, 0, -1],   // row 1 (middle): Knight at col 1
    [-1, -1, 2],   // row 2 (bottom): Archer at col 2
  ],
};

const RULE_MACHINES = [
  { pairs: [[3,7],[5,11],[8,17],[2,5]], options: ['×2+1', '×3−2', '+4', '×2+2'], a: 0 },
  { pairs: [[2,8],[4,16],[6,24],[1,4]], options: ['×4', '×3+2', '+6', '×5−2'], a: 0 },
  { pairs: [[10,7],[8,5],[12,9],[6,3]], options: ['−3', '−2', '÷2+2', '×0.7'], a: 0 },
];

// Layout constants
// Seq panel: _drawPanel(ctx, 450, 240, 580, 400) → y=40 to y=440
// 4 options: startY=228, optH=44, gap=9 → items at 228,281,334,387 → bottom=431 ✓ (1px over, fine)
const SEQ_LAYOUT = { startY: 228, optH: 44, gap: 9, optW: 280, cx: 450 };

// Machine panel: _drawPanel(ctx, 450, 240, 580, 400) → y=40 to y=440
// 4 options: startY=268, optH=38, gap=7 → items at 268,313,358,403 → bottom=441 ✓
const MACHINE_LAYOUT = { startY: 268, optH: 38, gap: 7, optW: 280, cx: 450 };

// ── LogicChallenge ─────────────────────────────────────────────

export class LogicChallenge {
  #zoneId = 1;
  #done = false;
  #feedback = '';
  #feedbackTimer = 0;
  #shake = 0;
  #audio = null;

  // C1 — Sequences
  #sequences = [];
  #seqIndex = 0;

  // C2 — Deduction grid
  #grid = null;          // 3×3 array of name indices, -1=empty
  #selectedNameIdx = null; // click-to-select interaction
  #gridErrors = null;
  #deductionDone = false;

  // C3 — Rule machines
  #machines = [];
  #machineIndex = 0;

  init(zone, worldIndex, audioManager) {
    this.#zoneId = zone.id;
    this.#done = false;
    this.#audio = audioManager;
    this.#feedback = '';
    this.#feedbackTimer = 0;
    this.#shake = 0;

    if (zone.id === 1) {
      this.#sequences = shuffle([...SEQUENCES]).slice(0, 3);
      this.#seqIndex = 0;
    } else if (zone.id === 2) {
      this.#grid = Array.from({ length: 3 }, () => [-1, -1, -1]);
      this.#selectedNameIdx = null;
      this.#gridErrors = null;
      this.#deductionDone = false;
    } else {
      this.#machines = shuffle([...RULE_MACHINES]).slice(0, 3);
      this.#machineIndex = 0;
    }
  }

  isDone() { return this.#done; }

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
      this.#feedback = '✓ Correct!';
      this.#feedbackTimer = 1;
      this.#seqIndex++;
      if (this.#seqIndex >= this.#sequences.length) this.#done = true;
    } else {
      this.#audio?.playWrong?.();
      this.#shake = 8;
      this.#feedback = '✗ Try again';
      this.#feedbackTimer = 1.5;
    }
  }

  _deductInput(ev) {
    if (ev.type !== 'click') return;

    // Submit button (y=426 to y=454)
    if (ev.x >= 350 && ev.x <= 550 && ev.y >= 426 && ev.y <= 454) {
      this._checkDeductSolution();
      return;
    }

    // Click a name token — select it (or deselect if same)
    const ni = this._clickedNameToken(ev.x, ev.y);
    if (ni !== null) {
      this.#selectedNameIdx = (this.#selectedNameIdx === ni) ? null : ni;
      this.#gridErrors = null;
      return;
    }

    // Click a grid cell
    const cell = this._clickedGridCell(ev.x, ev.y);
    if (cell) {
      if (this.#selectedNameIdx !== null) {
        // Remove prior placement of selected name
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            if (this.#grid[r][c] === this.#selectedNameIdx) {
              this.#grid[r][c] = -1;
            }
          }
        }
        this.#grid[cell.row][cell.col] = this.#selectedNameIdx;
        this.#selectedNameIdx = null;
      } else {
        // No selection: clear the cell
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
      this.#done = true;
    } else {
      this.#audio?.playWrong?.();
      this.#shake = 8;
      this.#feedback = '✗ Some placements are wrong — re-read the clues';
      this.#feedbackTimer = 2.5;
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
      this.#feedback = '✓ You found the rule!';
      this.#feedbackTimer = 1;
      this.#machineIndex++;
      if (this.#machineIndex >= this.#machines.length) this.#done = true;
    } else {
      this.#audio?.playWrong?.();
      this.#shake = 8;
      this.#feedback = '✗ Not quite — look at the pattern again';
      this.#feedbackTimer = 2;
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

  // ── Render ────────────────────────────────────────────────────

  render(ctx) {
    if (this.#feedbackTimer > 0) this.#feedbackTimer -= 1 / 60;
    if (this.#shake > 0) this.#shake -= 1;

    if (this.#zoneId === 1) this._renderSeq(ctx);
    else if (this.#zoneId === 2) this._renderDeduct(ctx);
    else this._renderMachine(ctx);
  }

  _renderSeq(ctx) {
    const shake = this.#shake > 0 ? (Math.random() - 0.5) * 5 : 0;
    // Panel: y=40 to y=440
    this._drawPanel(ctx, 450 + shake, 240, 580, 400);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#a0d8ef';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('☁️  Cloud Sequence Challenge  ☁️', 450, 115);
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

    // Options — use SEQ_LAYOUT
    const { startY, optH, gap, optW } = SEQ_LAYOUT;
    seq.options.forEach((opt, i) => {
      const oy = startY + i * (optH + gap);
      ctx.fillStyle = 'rgba(30,80,160,0.5)';
      ctx.fillRect(310, oy, optW, optH);
      ctx.strokeStyle = '#6af';
      ctx.lineWidth = 2;
      ctx.strokeRect(310, oy, optW, optH);
      // Number label
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${i + 1}.`, 318, oy + optH / 2 + 5);
      // Option text
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
    // Panel: _drawPanel(450, 240, 640, 440) → y=20 to y=460
    this._drawPanel(ctx, 450 + shake, 240, 640, 440);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd080';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText("⚡  Oracle's Deduction — Grid Puzzle  ⚡", 450, 80);

    // Clues
    ctx.font = '13px sans-serif';
    DEDUCTION_PUZZLE.clues.forEach((c, i) => {
      ctx.fillStyle = i < 3 ? '#9cf' : '#ffdd80';
      ctx.textAlign = 'left';
      ctx.fillText(`${i + 1}. ${c}`, 142, 104 + i * 18);
    });

    // Grid
    const gridX = 310, gridY = 168, cellW = 92, cellH = 58;
    // Column labels
    ctx.fillStyle = '#aaa';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ['Col 1', 'Col 2', 'Col 3'].forEach((label, c) => {
      ctx.fillText(label, gridX + c * cellW + cellW / 2, gridY - 8);
    });
    // Row labels
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

    // Name tokens (click to select)
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
      ctx.font = `bold 14px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(name, tx + 50, tokenY + 23);
    });

    // Submit button (y=426 to y=454)
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
      ctx.fillStyle = '#ff6060';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.#feedback, 450, 458);
    }
    ctx.textAlign = 'left';
  }

  _renderMachine(ctx) {
    const shake = this.#shake > 0 ? (Math.random() - 0.5) * 5 : 0;
    // Panel: y=40 to y=440
    this._drawPanel(ctx, 450 + shake, 240, 580, 400);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffa040';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('⚙️  Rule Machine Challenge  ⚙️', 450, 110);
    ctx.fillStyle = '#ccc';
    ctx.font = '14px sans-serif';
    ctx.fillText(`Machine ${this.#machineIndex + 1}/3 — Identify the rule`, 450, 134);

    const machine = this.#machines[this.#machineIndex];
    if (!machine) { ctx.textAlign = 'left'; return; }

    // Pairs in 2-column layout to save vertical space
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
    ctx.fillStyle = '#aaa';
    ctx.font = '13px sans-serif';
    ctx.fillText('Click or press 1 / 2 / 3 / 4', 450, 248);

    // Options — use MACHINE_LAYOUT
    const { startY, optH, gap, optW } = MACHINE_LAYOUT;
    machine.options.forEach((opt, i) => {
      const oy = startY + i * (optH + gap);
      ctx.fillStyle = 'rgba(30,80,160,0.5)';
      ctx.fillRect(310, oy, optW, optH);
      ctx.strokeStyle = '#6af';
      ctx.lineWidth = 2;
      ctx.strokeRect(310, oy, optW, optH);
      // Number label
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${i + 1}.`, 318, oy + optH / 2 + 5);
      // Option text
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
