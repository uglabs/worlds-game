/**
 * World 2 — Sky Kingdom
 * Challenge zones on elevated cloud/island platforms.
 */
export function createWorld2() {
  return {
    worldIndex: 1,
    name: 'Sky Kingdom',
    width: 3600,
    bg: '#0a1a4a',
    groundY: 430,
    groundColor: '#0a1a4a',
    groundTopColor: '#0a1a4a',

    platforms: [
      // ─── Zone 1 approach: step clouds ───
      { x: 180, y: 360, w: 110, h: 22, color: '#c8ddf5', topColor: '#e8f4ff' },
      { x: 360, y: 300, w: 110, h: 22, color: '#c8ddf5', topColor: '#e8f4ff' },
      { x: 530, y: 240, w: 140, h: 22, color: '#e0eeff', topColor: '#f0f8ff' }, // ZONE 1 platform ★ (cloud)
      { x: 730, y: 320, w: 100, h: 22, color: '#c8ddf5', topColor: '#e8f4ff' },
      { x: 870, y: 270, w: 90,  h: 22, color: '#c8ddf5', topColor: '#e8f4ff' },

      // Stone island 1 (bridge)
      { x: 980,  y: 310, w: 160, h: 30, color: '#7a8a6a', topColor: '#8a9a7a' },

      // ─── Zone 2 approach ───
      { x: 1170, y: 355, w: 100, h: 22, color: '#c8ddf5', topColor: '#e8f4ff' },
      { x: 1320, y: 295, w: 100, h: 22, color: '#c8ddf5', topColor: '#e8f4ff' },
      { x: 1460, y: 235, w: 170, h: 30, color: '#8a9a7a', topColor: '#9aaa8a' }, // ZONE 2 platform ★ (island)
      { x: 1680, y: 310, w: 100, h: 22, color: '#c8ddf5', topColor: '#e8f4ff' },
      { x: 1820, y: 260, w: 110, h: 22, color: '#c8ddf5', topColor: '#e8f4ff' },

      // Wooden bridge section
      { x: 1980, y: 300, w: 130, h: 22, color: '#a0784a', topColor: '#b08858' },
      { x: 2160, y: 255, w: 110, h: 22, color: '#c8ddf5', topColor: '#e8f4ff' },

      // ─── Zone 3 approach: big staircase ───
      { x: 2320, y: 360, w: 90,  h: 22, color: '#c8ddf5', topColor: '#e8f4ff' },
      { x: 2460, y: 300, w: 90,  h: 22, color: '#c8ddf5', topColor: '#e8f4ff' },
      { x: 2590, y: 245, w: 160, h: 30, color: '#8a9a7a', topColor: '#9aaa8a' }, // ZONE 3 platform ★ (island)
      { x: 2800, y: 310, w: 100, h: 22, color: '#c8ddf5', topColor: '#e8f4ff' },
      { x: 2940, y: 260, w: 110, h: 22, color: '#c8ddf5', topColor: '#e8f4ff' },
      { x: 3100, y: 310, w: 100, h: 22, color: '#c8ddf5', topColor: '#e8f4ff' },
      { x: 3260, y: 265, w: 100, h: 22, color: '#c8ddf5', topColor: '#e8f4ff' },
    ],

    decorations: [
      // Background clouds (large, slow-drifting)
      { type: 'cloud', x: 40,   y: 100, w: 180, h: 65, layer: 'back' },
      { type: 'cloud', x: 280,  y: 75,  w: 160, h: 58, layer: 'back' },
      { type: 'cloud', x: 530,  y: 110, w: 200, h: 72, layer: 'back' },
      { type: 'cloud', x: 820,  y: 85,  w: 170, h: 62, layer: 'back' },
      { type: 'cloud', x: 1100, y: 115, w: 185, h: 67, layer: 'back' },
      { type: 'cloud', x: 1390, y: 90,  w: 165, h: 60, layer: 'back' },
      { type: 'cloud', x: 1700, y: 110, w: 190, h: 68, layer: 'back' },
      { type: 'cloud', x: 2020, y: 95,  w: 175, h: 63, layer: 'back' },
      { type: 'cloud', x: 2340, y: 115, w: 195, h: 70, layer: 'back' },
      { type: 'cloud', x: 2680, y: 88,  w: 168, h: 61, layer: 'back' },
      { type: 'cloud', x: 3000, y: 105, w: 178, h: 64, layer: 'back' },
      { type: 'cloud', x: 3300, y: 92,  w: 162, h: 58, layer: 'back' },

      // Decorative floating islands (visual depth)
      { type: 'island', x: 650,  y: 365, w: 90, h: 44, color: '#9aaf8a', layer: 'back' },
      { type: 'island', x: 1280, y: 370, w: 80, h: 40, color: '#9aaf8a', layer: 'back' },
      { type: 'island', x: 2230, y: 360, w: 95, h: 46, color: '#9aaf8a', layer: 'back' },
    ],

    // Zones: bottom of zone = platform top
    challengeZones: [
      { id: 1, x: 568,  y: 160, w: 64, h: 80, label: 'Cloud Sequence',    solved: false, _playerNear: false },
      { id: 2, x: 1518, y: 155, w: 64, h: 80, label: "Oracle's Deduction", solved: false, _playerNear: false },
      { id: 3, x: 2648, y: 165, w: 64, h: 80, label: 'Rule Machine',       solved: false, _playerNear: false },
    ],

    portal: { x: 3400, y: 290, locked: true },
    musicFreqs: [293.66, 349.23, 392.00, 493.88],
  };
}
