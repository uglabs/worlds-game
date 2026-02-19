/**
 * World 1 — Enchanted Forest
 * Challenge zones sit ON elevated platforms — player must navigate to reach them.
 */
export function createWorld1() {
  return {
    worldIndex: 0,
    name: 'Enchanted Forest',
    width: 3600,
    bg: '#0d2b0d',
    groundY: 400,
    groundColor: '#2a5a10',
    groundTopColor: '#3a8a18',

    platforms: [
      // ─── Zone 1 approach: step up to platform at y=270 ───
      { x: 220,  y: 350, w: 90,  h: 18, color: '#4a6a30', topColor: '#5a8a38' }, // step 1
      { x: 380,  y: 300, w: 80,  h: 18, color: '#4a6a30', topColor: '#5a8a38' }, // step 2
      { x: 490,  y: 250, w: 130, h: 18, color: '#3d8a22', topColor: '#4aaa2a' }, // ZONE 1 platform ★
      { x: 670,  y: 330, w: 90,  h: 18, color: '#4a6a30', topColor: '#5a8a38' },
      { x: 820,  y: 280, w: 80,  h: 18, color: '#4a6a30', topColor: '#5a8a38' },

      // ─── Zone 2 approach: higher climb ───
      { x: 960,  y: 340, w: 80,  h: 18, color: '#3d5528', topColor: '#4d7030' },
      { x: 1080, y: 290, w: 75,  h: 18, color: '#3d5528', topColor: '#4d7030' },
      { x: 1180, y: 230, w: 130, h: 18, color: '#3d8a22', topColor: '#4aaa2a' }, // ZONE 2 platform ★
      { x: 1360, y: 310, w: 80,  h: 18, color: '#4a6a30', topColor: '#5a8a38' },
      { x: 1480, y: 260, w: 80,  h: 18, color: '#4a6a30', topColor: '#5a8a38' },

      // Giant leaves (mid-section)
      { x: 1600, y: 290, w: 120, h: 18, color: '#2d7a1a', topColor: '#3a9a22' },
      { x: 1780, y: 240, w: 100, h: 18, color: '#2d7a1a', topColor: '#3a9a22' },

      // ─── Zone 3 approach: 3-step staircase to highest point ───
      { x: 1920, y: 340, w: 80,  h: 18, color: '#4a6a30', topColor: '#5a8a38' },
      { x: 2050, y: 290, w: 80,  h: 18, color: '#4a6a30', topColor: '#5a8a38' },
      { x: 2180, y: 240, w: 75,  h: 18, color: '#4a6a30', topColor: '#5a8a38' },
      { x: 2300, y: 195, w: 130, h: 18, color: '#3d8a22', topColor: '#4aaa2a' }, // ZONE 3 platform ★
      { x: 2490, y: 290, w: 90,  h: 18, color: '#4a6a30', topColor: '#5a8a38' },

      // Final stretch to portal
      { x: 2650, y: 330, w: 80,  h: 18, color: '#3d5528', topColor: '#4d7030' },
      { x: 2800, y: 280, w: 90,  h: 18, color: '#4a6a30', topColor: '#5a8a38' },
      { x: 2980, y: 320, w: 80,  h: 18, color: '#3d5528', topColor: '#4d7030' },
      { x: 3120, y: 260, w: 90,  h: 18, color: '#4a6a30', topColor: '#5a8a38' },
      { x: 3280, y: 300, w: 80,  h: 18, color: '#3d5528', topColor: '#4d7030' },
    ],

    decorations: [
      { type: 'tree', x: 60,   y: 280, w: 80, h: 120, color: '#1a5a1a', layer: 'back' },
      { type: 'tree', x: 160,  y: 300, w: 70, h: 100, color: '#1a5a1a', layer: 'back' },
      { type: 'tree', x: 340,  y: 270, w: 90, h: 130, color: '#236a23', layer: 'back' },
      { type: 'tree', x: 620,  y: 260, w: 75, h: 115, color: '#1a5a1a', layer: 'back' },
      { type: 'tree', x: 880,  y: 280, w: 85, h: 120, color: '#236a23', layer: 'back' },
      { type: 'tree', x: 1050, y: 270, w: 80, h: 110, color: '#1a5a1a', layer: 'back' },
      { type: 'tree', x: 1300, y: 260, w: 90, h: 130, color: '#236a23', layer: 'back' },
      { type: 'tree', x: 1540, y: 275, w: 75, h: 115, color: '#1a5a1a', layer: 'back' },
      { type: 'tree', x: 1740, y: 280, w: 80, h: 120, color: '#236a23', layer: 'back' },
      { type: 'tree', x: 1990, y: 260, w: 90, h: 130, color: '#1a5a1a', layer: 'back' },
      { type: 'tree', x: 2450, y: 270, w: 80, h: 110, color: '#236a23', layer: 'back' },
      { type: 'tree', x: 2700, y: 265, w: 85, h: 125, color: '#1a5a1a', layer: 'back' },
      { type: 'tree', x: 2950, y: 270, w: 80, h: 120, color: '#236a23', layer: 'back' },
      { type: 'tree', x: 3200, y: 275, w: 75, h: 115, color: '#1a5a1a', layer: 'back' },

      { type: 'mushroom', x: 120,  y: 365, w: 38, h: 36, color: '#cc2222', layer: 'front' },
      { type: 'mushroom', x: 310,  y: 368, w: 30, h: 30, color: '#8822cc', layer: 'front' },
      { type: 'mushroom', x: 700,  y: 363, w: 42, h: 40, color: '#cc2222', layer: 'front' },
      { type: 'mushroom', x: 890,  y: 366, w: 34, h: 32, color: '#8822cc', layer: 'front' },
      { type: 'mushroom', x: 1410, y: 363, w: 40, h: 38, color: '#cc2222', layer: 'front' },
      { type: 'mushroom', x: 1670, y: 365, w: 36, h: 34, color: '#8822cc', layer: 'front' },
      { type: 'mushroom', x: 2540, y: 362, w: 42, h: 40, color: '#cc2222', layer: 'front' },
      { type: 'mushroom', x: 2840, y: 366, w: 34, h: 32, color: '#8822cc', layer: 'front' },

      { type: 'firefly', x: 200,  y: 310, layer: 'front' },
      { type: 'firefly', x: 450,  y: 290, layer: 'front' },
      { type: 'firefly', x: 750,  y: 300, layer: 'front' },
      { type: 'firefly', x: 1000, y: 285, layer: 'front' },
      { type: 'firefly', x: 1250, y: 295, layer: 'front' },
      { type: 'firefly', x: 1600, y: 300, layer: 'front' },
      { type: 'firefly', x: 1850, y: 290, layer: 'front' },
      { type: 'firefly', x: 2100, y: 305, layer: 'front' },
      { type: 'firefly', x: 2600, y: 285, layer: 'front' },
      { type: 'firefly', x: 2900, y: 295, layer: 'front' },
    ],

    // Zones sit ON their platforms (zone.y + zone.h = platform.y)
    challengeZones: [
      { id: 1, x: 508,  y: 170, w: 64, h: 80, label: 'Number Gnome',    solved: false, _playerNear: false },
      { id: 2, x: 1198, y: 150, w: 64, h: 80, label: "Witch's Cauldron", solved: false, _playerNear: false },
      { id: 3, x: 2318, y: 115, w: 64, h: 80, label: "Dragon's Riddle",  solved: false, _playerNear: false },
    ],

    portal: { x: 3400, y: 280, locked: true },
    musicFreqs: [174.61, 196.00, 220.00, 261.63],
  };
}
