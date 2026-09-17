// Coordinated style presets. Applying one sets room finishes by room type and the
// global furniture slot materials, so a whole home can be restyled in one click.

const band = (mat, from, to, where) => ({ mat, from, to, where });

export const THEMES = [
  {
    id: 'scandi', name: 'Scandinavian', colors: ['#f1ece2', '#dcc7a6', '#a9b59b', '#2a2a2a'],
    rooms: {
      living: { floorMat: 'ash-planks', wallMat: 'paint-warm-white' },
      kitchen: { floorMat: 'ash-planks', wallMat: 'paint-warm-white', band: band('subway-white', 90, 150, 'counters') },
      bedroom: { floorMat: 'ash-planks', wallMat: 'paint-greige' },
      bathroom: { floorMat: 'hex-white-marble', wallMat: 'paint-pure-white', band: band('subway-white', 0, 210, 'all') },
      other: { floorMat: 'porcelain-60-grey', wallMat: 'paint-warm-white' },
    },
    slots: { cabinet: 'cab-white', countertop: 'ct-white-quartz', wood: 'wood-light', fabric: 'fab-linen', accent: 'fab-sage', metal: 'metal-black', rug: 'rug-jute', bedding: 'fab-white', ceramic: 'ceramic-white', lampshade: 'lampshade' },
  },
  {
    id: 'japandi', name: 'Japandi', colors: ['#d9cfbf', '#c79f72', '#46484b', '#9a9895'],
    rooms: {
      living: { floorMat: 'oak-planks', wallMat: 'limewash' },
      kitchen: { floorMat: 'oak-planks', wallMat: 'limewash', band: band('finger-kitkat', 90, 150, 'counters') },
      bedroom: { floorMat: 'oak-planks', wallMat: 'limewash' },
      bathroom: { floorMat: 'microcement', wallMat: 'microcement', band: band('finger-kitkat', 0, 120, 'all') },
      other: { floorMat: 'microcement', wallMat: 'limewash' },
    },
    slots: { cabinet: 'wood-oak', countertop: 'ct-concrete', wood: 'wood-oak', fabric: 'fab-oat', accent: 'fab-charcoal', metal: 'metal-black', rug: 'rug-grey', bedding: 'fab-linen', ceramic: 'ceramic-sand' },
  },
  {
    id: 'industrial', name: 'Industrial loft', colors: ['#9a9895', '#8a4e2b', '#3a3b3d', '#9c4a33'],
    rooms: {
      living: { floorMat: 'polished-concrete', wallMat: 'brick-white' },
      kitchen: { floorMat: 'polished-concrete', wallMat: 'paint-greige', band: band('subway-white-dark', 90, 150, 'counters') },
      bedroom: { floorMat: 'smoked-oak-wide', wallMat: 'paint-charcoal' },
      bathroom: { floorMat: 'hex-mosaic-bw', wallMat: 'concrete-panels', band: band('subway-white-dark', 0, 210, 'all') },
      other: { floorMat: 'polished-concrete', wallMat: 'paint-greige' },
    },
    slots: { cabinet: 'cab-charcoal', countertop: 'ct-butcher', wood: 'wood-walnut', fabric: 'fab-leather-cognac', accent: 'fab-mustard', metal: 'metal-black', rug: 'rug-grey', bedding: 'fab-grey', ceramic: 'ceramic-white' },
  },
  {
    id: 'mediterranean', name: 'Mediterranean', colors: ['#e7ddca', '#b8674a', '#2e5d86', '#c9a45a'],
    rooms: {
      living: { floorMat: 'travertine', wallMat: 'limewash' },
      kitchen: { floorMat: 'hex-terracotta', wallMat: 'limewash', band: band('encaustic-blue', 90, 150, 'counters') },
      bedroom: { floorMat: 'travertine', wallMat: 'paint-clay' },
      bathroom: { floorMat: 'encaustic-star', wallMat: 'limewash', band: band('zellige-blue', 0, 120, 'all') },
      other: { floorMat: 'hex-terracotta', wallMat: 'limewash' },
    },
    slots: { cabinet: 'cab-white', countertop: 'ct-carrara', wood: 'wood-teak', fabric: 'fab-linen', accent: 'fab-sky', metal: 'metal-brass', rug: 'rug-terracotta', bedding: 'fab-white', ceramic: 'ceramic-white' },
  },
  {
    id: 'moody', name: 'Moody modern', colors: ['#2f3b52', '#6b4830', '#f4f1ea', '#c9a45a'],
    rooms: {
      living: { floorMat: 'walnut-herringbone', wallMat: 'paint-navy' },
      kitchen: { floorMat: 'walnut-herringbone', wallMat: 'paint-charcoal', band: band('marble-slab-wall', 90, 150, 'counters') },
      bedroom: { floorMat: 'walnut-planks', wallMat: 'wallpaper-damask' },
      bathroom: { floorMat: 'nero-marquina', wallMat: 'paint-charcoal', band: band('marble-slab-wall', 0, 240, 'all') },
      other: { floorMat: 'nero-marquina', wallMat: 'paint-charcoal' },
    },
    slots: { cabinet: 'cab-navy', countertop: 'ct-calacatta', wood: 'wood-walnut', fabric: 'fab-emerald-velvet', accent: 'fab-mustard', metal: 'metal-brass', rug: 'rug-blue', bedding: 'fab-charcoal', ceramic: 'ceramic-black' },
  },
  {
    id: 'boho', name: 'Boho warm', colors: ['#dfb9b0', '#c07455', '#eee6d8', '#2f7c7a'],
    rooms: {
      living: { floorMat: 'oak-herringbone', wallMat: 'paint-dusty-pink' },
      kitchen: { floorMat: 'terrazzo-pink', wallMat: 'paint-warm-white', band: band('zellige-pink', 90, 150, 'counters') },
      bedroom: { floorMat: 'oak-planks', wallMat: 'paint-terracotta' },
      bathroom: { floorMat: 'encaustic-petal', wallMat: 'paint-warm-white', band: band('fish-teal', 0, 140, 'all') },
      other: { floorMat: 'terrazzo-pink', wallMat: 'paint-warm-white' },
    },
    slots: { cabinet: 'cab-terracotta', countertop: 'terrazzo-pink', wood: 'wood-rattan', fabric: 'fab-boucle', accent: 'fab-terracotta', metal: 'metal-brass', rug: 'rug-diamond', bedding: 'fab-blush', ceramic: 'ceramic-sand' },
  },
  {
    id: 'classic', name: 'Classic Parisian', colors: ['#f7f7f5', '#222224', '#d1ab7f', '#93a18a'],
    rooms: {
      living: { floorMat: 'oak-herringbone-45', wallMat: 'paint-pure-white' },
      kitchen: { floorMat: 'checker-bw', wallMat: 'paint-pure-white', band: band('subway-white', 90, 150, 'counters') },
      bedroom: { floorMat: 'oak-chevron', wallMat: 'wallpaper-pinstripe' },
      bathroom: { floorMat: 'octagon-dot', wallMat: 'paint-soft-blue', band: band('beadboard', 0, 110, 'all') },
      other: { floorMat: 'checker-bw', wallMat: 'paint-pure-white' },
    },
    slots: { cabinet: 'cab-sage', countertop: 'ct-carrara', wood: 'wood-walnut', fabric: 'fab-navy-velvet', accent: 'fab-stripe', metal: 'metal-brass', rug: 'rug-blue', bedding: 'fab-white', ceramic: 'ceramic-white' },
  },
];

const ALIASES = { dining: 'living', hall: 'living', office: 'bedroom' };

export function applyTheme(plan, theme, { resetWalls = false } = {}) {
  for (const r of plan.rooms) {
    const spec = theme.rooms[r.type] || theme.rooms[ALIASES[r.type]] || theme.rooms.other;
    if (!spec) continue;
    r.floorMat = spec.floorMat;
    r.wallMat = spec.wallMat;
    r.band = spec.band ? { ...spec.band } : null;
  }
  Object.assign(plan.theme, theme.slots);
  if (resetWalls) for (const w of plan.walls) w.sides = { A: {}, B: {} };
  for (const it of plan.items) it.mats = Object.fromEntries(Object.entries(it.mats || {}).filter(([k]) => k === 'rug' && !resetWalls));
}
