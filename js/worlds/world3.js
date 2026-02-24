/**
 * World 3 — Volcano Arena
 * Challenge zones on elevated obsidian platforms — dangerous but rewarding climb.
 * Platforms updated to be much more visible against the dark volcanic background.
 */
export function createWorld3() {
  return {
    worldIndex: 2,
    name: 'Volcano Arena',
    width: 3600,
    bg: '#1a0808',
    groundY: 415,
    groundColor: '#3a1010',
    groundTopColor: '#4a1818',

    platforms: [
      // ─── Zone 1 approach ───
      { x: 160, y: 350, w: 100, h: 20, color: '#8a4828', topColor: '#c06040' },
      { x: 320, y: 290, w: 90,  h: 20, color: '#8a4828', topColor: '#c06040' },
      { x: 460, y: 235, w: 100, h: 18, color: '#7a3818', topColor: '#b05030' },
      // ZONE 1 platform ★ — bright orange-red with glow
      { x: 600, y: 185, w: 130, h: 18, color: '#c05020', topColor: '#e07830', glowColor: 'rgba(255,120,40,ALPHA)' },
      { x: 780, y: 280, w: 90,  h: 18, color: '#8a4828', topColor: '#c06040' },
      { x: 920, y: 330, w: 80,  h: 20, color: '#8a4828', topColor: '#c06040' },

      // ─── Zone 2 approach ───
      { x: 1050, y: 355, w: 90,  h: 20, color: '#8a4828', topColor: '#c06040' },
      { x: 1190, y: 300, w: 85,  h: 18, color: '#7a3818', topColor: '#b05030' },
      { x: 1330, y: 250, w: 80,  h: 18, color: '#7a3818', topColor: '#b05030' },
      // ZONE 2 platform ★
      { x: 1460, y: 195, w: 130, h: 18, color: '#c05020', topColor: '#e07830', glowColor: 'rgba(255,120,40,ALPHA)' },
      { x: 1640, y: 295, w: 80,  h: 18, color: '#8a4828', topColor: '#c06040' },
      { x: 1780, y: 340, w: 80,  h: 20, color: '#8a4828', topColor: '#c06040' },

      // ─── Zone 3 approach: most dramatic climb ───
      { x: 1920, y: 355, w: 80,  h: 20, color: '#8a4828', topColor: '#c06040' },
      { x: 2060, y: 305, w: 80,  h: 18, color: '#7a3818', topColor: '#b05030' },
      { x: 2190, y: 260, w: 75,  h: 18, color: '#7a3818', topColor: '#b05030' },
      { x: 2320, y: 210, w: 70,  h: 18, color: '#7a3818', topColor: '#b05030' },
      // ZONE 3 platform ★
      { x: 2440, y: 165, w: 130, h: 18, color: '#c05020', topColor: '#e07830', glowColor: 'rgba(255,120,40,ALPHA)' },
      { x: 2630, y: 295, w: 80,  h: 18, color: '#8a4828', topColor: '#c06040' },

      // Final approach to portal
      { x: 2780, y: 340, w: 80,  h: 20, color: '#8a4828', topColor: '#c06040' },
      { x: 2920, y: 290, w: 90,  h: 18, color: '#7a3818', topColor: '#b05030' },
      { x: 3080, y: 330, w: 80,  h: 20, color: '#8a4828', topColor: '#c06040' },
      { x: 3230, y: 280, w: 90,  h: 18, color: '#7a3818', topColor: '#b05030' },
    ],

    decorations: [
      // Lava pools
      { type: 'lava', x: 80,   y: 396, w: 70,  h: 19, layer: 'back' },
      { type: 'lava', x: 260,  y: 398, w: 55,  h: 17, layer: 'back' },
      { type: 'lava', x: 430,  y: 394, w: 90,  h: 21, layer: 'back' },
      { type: 'lava', x: 730,  y: 396, w: 80,  h: 19, layer: 'back' },
      { type: 'lava', x: 990,  y: 398, w: 60,  h: 17, layer: 'back' },
      { type: 'lava', x: 1160, y: 394, w: 100, h: 21, layer: 'back' },
      { type: 'lava', x: 1430, y: 396, w: 75,  h: 19, layer: 'back' },
      { type: 'lava', x: 1700, y: 398, w: 85,  h: 17, layer: 'back' },
      { type: 'lava', x: 1880, y: 394, w: 70,  h: 21, layer: 'back' },
      { type: 'lava', x: 2150, y: 396, w: 90,  h: 19, layer: 'back' },
      { type: 'lava', x: 2600, y: 398, w: 65,  h: 17, layer: 'back' },
      { type: 'lava', x: 2850, y: 394, w: 80,  h: 21, layer: 'back' },
      { type: 'lava', x: 3050, y: 396, w: 70,  h: 19, layer: 'back' },
      { type: 'lava', x: 3300, y: 398, w: 60,  h: 17, layer: 'back' },

      // Spires — flanking the platform climbs
      { type: 'spire', x: 100,  y: 300, w: 40, h: 100, color: '#3a2020', layer: 'back' },
      { type: 'spire', x: 400,  y: 310, w: 35, h: 90,  color: '#3a2020', layer: 'back' },
      { type: 'spire', x: 570,  y: 295, w: 45, h: 110, color: '#4a2525', layer: 'back' },
      { type: 'spire', x: 870,  y: 305, w: 38, h: 95,  color: '#3a2020', layer: 'back' },
      { type: 'spire', x: 1100, y: 300, w: 42, h: 100, color: '#3a2020', layer: 'back' },
      { type: 'spire', x: 1420, y: 295, w: 36, h: 105, color: '#4a2525', layer: 'back' },
      { type: 'spire', x: 1700, y: 305, w: 40, h: 95,  color: '#3a2020', layer: 'back' },
      { type: 'spire', x: 2050, y: 300, w: 44, h: 100, color: '#3a2020', layer: 'back' },
      { type: 'spire', x: 2400, y: 295, w: 38, h: 110, color: '#4a2525', layer: 'back' },
      { type: 'spire', x: 2700, y: 300, w: 42, h: 95,  color: '#3a2020', layer: 'back' },
      { type: 'spire', x: 3000, y: 305, w: 36, h: 100, color: '#3a2020', layer: 'back' },
      { type: 'spire', x: 3300, y: 300, w: 40, h: 95,  color: '#4a2525', layer: 'back' },
    ],

    // Zones: zone.y + zone.h = platform.y
    challengeZones: [
      { id: 1, x: 618,  y: 105, w: 64, h: 80, label: 'Click Battle',    solved: false, _playerNear: false },
      { id: 2, x: 1478, y: 115, w: 64, h: 80, label: 'Lightning Catch', solved: false, _playerNear: false },
      { id: 3, x: 2458, y: 85,  w: 64, h: 80, label: 'Rhythm Drums',    solved: false, _playerNear: false },
    ],

    portal: { x: 3400, y: 295, locked: true },
    musicFreqs: [110.00, 146.83, 164.81, 185.00],
  };
}
