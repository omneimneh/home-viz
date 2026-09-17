// Built-in material presets. Sizes are in cm, grout in mm.
// cats: floor | wall | tile | counter | cabinet | wood | fabric | metal | ceramic | ceiling | rug | misc

export const CATEGORIES = [
  ['all', 'All'], ['floor', 'Floors'], ['wall', 'Wall finishes'], ['tile', 'Wall tiles'], ['counter', 'Countertops'],
  ['cabinet', 'Cabinet fronts'], ['wood', 'Wood'], ['fabric', 'Fabrics'], ['rug', 'Rugs'], ['metal', 'Metals'],
  ['ceramic', 'Ceramic & glass'], ['ceiling', 'Ceilings'], ['custom', 'My materials'],
];

const L = [];
function M(id, name, cats, pattern, params = {}, o = {}) {
  L.push({ id, name, cats: Array.isArray(cats) ? cats : cats.split(' '), pattern, params, rough: o.rough ?? 0.6, metal: o.metal ?? 0, rot: o.rot ?? 0, bump: o.bump ?? 0.6, kind: o.kind || 'pattern' });
}
const paint = (id, name, color, cats = 'wall ceiling cabinet') => M(id, name, cats, 'solid', { colors: [color], surface: 'paint', grain: 0.012 }, { rough: 0.9 });

// ---------- paints ----------
paint('paint-warm-white', 'Warm white paint', '#f1ece2');
paint('paint-pure-white', 'Pure white paint', '#f7f7f5');
paint('paint-greige', 'Greige', '#cfc6b8');
paint('paint-clay', 'Clay beige', '#d9c2a6');
paint('paint-sage', 'Sage green', '#a9b59b');
paint('paint-olive', 'Olive', '#7d7f5a');
paint('paint-dusty-pink', 'Dusty pink', '#dfb9b0');
paint('paint-terracotta', 'Terracotta', '#c07455');
paint('paint-mustard', 'Mustard', '#d2a543');
paint('paint-soft-blue', 'Soft blue', '#b7c7d3');
paint('paint-navy', 'Navy', '#2f3b52');
paint('paint-forest', 'Forest green', '#34493d');
paint('paint-charcoal', 'Charcoal', '#3d3e40');
paint('paint-lavender', 'Lavender', '#c5bfd6');
paint('paint-black', 'Matte black', '#1f1f21', 'wall cabinet metal');
paint('paint-limewash', 'Limewash stone', '#d8d0c2');
M('limewash', 'Limewash texture', ['wall', 'ceiling'], 'slab', { tileW: 150, tileH: 150, colors: ['#d9cfbf'], surface: 'concrete', grain: 0.02 }, { rough: 0.95 });

// ---------- wood floors ----------
M('oak-planks', 'Natural oak planks', ['floor', 'wood'], 'planks', { tileW: 20, tileH: 150, grout: 0.6, groutColor: '#6b5236', colors: ['#c49a6c'], variation: 0.08, surface: 'wood' }, { rough: 0.55 });
M('ash-planks', 'Light ash planks', ['floor', 'wood'], 'planks', { tileW: 18, tileH: 140, grout: 0.5, groutColor: '#9a8468', colors: ['#dcc7a6'], variation: 0.06, surface: 'wood' }, { rough: 0.6 });
M('walnut-planks', 'Walnut planks', ['floor', 'wood'], 'planks', { tileW: 19, tileH: 160, grout: 0.6, groutColor: '#2e1e12', colors: ['#6e4a30'], variation: 0.1, surface: 'wood' }, { rough: 0.5 });
M('grey-oak-planks', 'Grey washed oak', ['floor', 'wood'], 'planks', { tileW: 22, tileH: 180, grout: 0.6, groutColor: '#6a655d', colors: ['#b3aa9c'], variation: 0.07, surface: 'wood' }, { rough: 0.65 });
M('smoked-oak-wide', 'Smoked oak wide plank', ['floor', 'wood'], 'planks', { tileW: 28, tileH: 220, grout: 0.8, groutColor: '#2b2118', colors: ['#7a5d44'], variation: 0.08, surface: 'wood' }, { rough: 0.6 });
M('oak-herringbone', 'Oak herringbone', ['floor', 'wood'], 'herringbone', { tileW: 60, tileH: 12, grout: 0.6, groutColor: '#6b5236', colors: ['#c79d6d'], variation: 0.1, surface: 'wood' }, { rough: 0.5 });
M('walnut-herringbone', 'Walnut herringbone', ['floor', 'wood'], 'herringbone', { tileW: 50, tileH: 10, grout: 0.6, groutColor: '#2b1d12', colors: ['#6b4830'], variation: 0.12, surface: 'wood' }, { rough: 0.45 });
M('oak-herringbone-45', 'Oak herringbone (45°)', ['floor', 'wood'], 'herringbone', { tileW: 60, tileH: 12, grout: 0.6, groutColor: '#6b5236', colors: ['#d1ab7f'], variation: 0.1, surface: 'wood' }, { rough: 0.5, rot: 45 });
M('oak-chevron', 'Oak chevron', ['floor', 'wood'], 'chevron', { tileW: 60, tileH: 12, grout: 0.6, groutColor: '#6b5236', colors: ['#caa274'], variation: 0.1, surface: 'wood' }, { rough: 0.5 });
M('vinyl-light', 'Light vinyl planks', ['floor'], 'planks', { tileW: 18, tileH: 120, grout: 0.4, groutColor: '#a8987f', colors: ['#e0cfb4'], variation: 0.04, surface: 'wood' }, { rough: 0.7 });
M('parquet-basket', 'Oak parquet basketweave', ['floor', 'wood'], 'basketweave', { tileW: 30, grout: 0.5, groutColor: '#6b5236', colors: ['#c69a68'], variation: 0.1, surface: 'wood' }, { rough: 0.55 });

// ---------- floor tiles ----------
M('porcelain-60-grey', 'Porcelain 60×60 light grey', ['floor'], 'grid', { tileW: 60, tileH: 60, grout: 2, groutColor: '#b7b5b0', colors: ['#d4d2cd'], variation: 0.02, surface: 'concrete' }, { rough: 0.5 });
M('porcelain-60-beige', 'Porcelain 60×60 beige', ['floor'], 'grid', { tileW: 60, tileH: 60, grout: 2, groutColor: '#c7b9a4', colors: ['#e1d6c4'], variation: 0.03, surface: 'stone' }, { rough: 0.45 });
M('porcelain-120-concrete', 'Large format 120×60 concrete', ['floor', 'wall'], 'brick', { tileW: 120, tileH: 60, grout: 2, offset: 0.5, groutColor: '#8e8c88', colors: ['#a6a39d'], variation: 0.04, surface: 'concrete' }, { rough: 0.7 });
M('carrara-60', 'Carrara marble 60×60', ['floor', 'tile'], 'grid', { tileW: 60, tileH: 60, grout: 1.5, groutColor: '#d7d7d7', colors: ['#eeeeec'], variation: 0.02, surface: 'marble', veinColor: '#8c9096' }, { rough: 0.2 });
M('nero-marquina', 'Nero Marquina 60×60', ['floor', 'tile'], 'grid', { tileW: 60, tileH: 60, grout: 1.5, groutColor: '#2a2a2a', colors: ['#1d1d1f'], variation: 0.02, surface: 'marble', veinColor: '#e8e8e8' }, { rough: 0.2 });
M('checker-bw', 'Checkerboard black & white', ['floor'], 'checker', { tileW: 30, grout: 1.5, groutColor: '#9c9c9c', colors: ['#f0efeb', '#222224'], variation: 0.02, surface: 'marble', veinColor: '#9a9a9a' }, { rough: 0.3 });
M('checker-diag', 'Diagonal checker cream/green', ['floor'], 'checker', { tileW: 25, grout: 1.5, groutColor: '#c8c2b0', colors: ['#ece5d3', '#51634f'], variation: 0.03 }, { rough: 0.35, rot: 45 });
M('terrazzo-classic', 'Terrazzo classic', ['floor', 'tile', 'counter'], 'grid', { tileW: 40, tileH: 40, grout: 1, groutColor: '#d9d3c8', colors: ['#e9e4da'], variation: 0.01, surface: 'terrazzo' }, { rough: 0.35 });
M('terrazzo-pink', 'Terrazzo blush', ['floor', 'tile', 'counter'], 'slab', { tileW: 100, tileH: 100, colors: ['#ecd5cb'], surface: 'terrazzo', chipColors: ['#b85f47', '#f6efe8', '#8b8f8e', '#d99c84'] }, { rough: 0.35 });
M('encaustic-blue', 'Cement tile – blue quatrefoil', ['floor', 'tile'], 'motif', { tileW: 20, grout: 1.5, groutColor: '#cfcac0', colors: ['#f0ebe0', '#2c4c7a', '#7fa0c4', '#e0b24d'], motif: 'quatrefoil' }, { rough: 0.75 });
M('encaustic-star', 'Cement tile – terracotta star', ['floor', 'tile'], 'motif', { tileW: 20, grout: 1.5, groutColor: '#cfc7ba', colors: ['#efe6d6', '#b35d3f', '#2f3a3a', '#d8a24b'], motif: 'star' }, { rough: 0.75 });
M('encaustic-grey', 'Cement tile – grey ogee', ['floor', 'tile'], 'motif', { tileW: 20, grout: 1.5, groutColor: '#c9c9c6', colors: ['#e6e5e1', '#6c6e70', '#2d2e30'], motif: 'ogee' }, { rough: 0.75 });
M('encaustic-petal', 'Cement tile – green petal', ['floor', 'tile'], 'motif', { tileW: 20, grout: 1.5, groutColor: '#cfcac0', colors: ['#f2eee4', '#4f6b52', '#c9a15a', '#2f3b33'], motif: 'petal' }, { rough: 0.75 });
M('triangles-bw', 'Graphic triangles B&W', ['floor', 'tile'], 'motif', { tileW: 15, grout: 1.5, groutColor: '#999', colors: ['#f2f2f0', '#1f1f1f'], motif: 'triangles', motifRotate: true }, { rough: 0.6 });
M('truchet-navy', 'Truchet arcs navy', ['floor', 'tile'], 'motif', { tileW: 15, grout: 1, groutColor: '#bbb', colors: ['#f1ede4', '#27395a'], motif: 'truchet', motifRotate: true }, { rough: 0.6 });
M('hex-terracotta', 'Terracotta hexagon', ['floor'], 'hex', { tileW: 20, grout: 5, groutColor: '#bfb3a1', colors: ['#b8674a', '#c2744f', '#a85b40'], mix: 'random', variation: 0.08, surface: 'concrete' }, { rough: 0.85 });
M('hex-white-marble', 'White marble hexagon', ['floor', 'tile'], 'hex', { tileW: 12, grout: 1.5, groutColor: '#c9c9c9', colors: ['#efefee'], surface: 'marble', veinColor: '#8e9398' }, { rough: 0.25 });
M('hex-concrete', 'Large hex concrete', ['floor'], 'hex', { tileW: 25, grout: 2, groutColor: '#7b7a77', colors: ['#9d9b97', '#a8a6a1', '#8f8d88'], mix: 'random', surface: 'concrete' }, { rough: 0.75 });
M('travertine', 'Travertine French pattern', ['floor'], 'brick', { tileW: 40, tileH: 40, grout: 2, offset: 0.5, groutColor: '#c9b89a', colors: ['#e0cfb0', '#d6c29f', '#e8dac0'], mix: 'random', surface: 'stone' }, { rough: 0.7 });
M('slate-dark', 'Dark slate 30×60', ['floor', 'tile'], 'brick', { tileW: 60, tileH: 30, grout: 2, offset: 0.5, groutColor: '#2a2b2d', colors: ['#45484c', '#3b3e42', '#4f5256'], mix: 'random', surface: 'stone' }, { rough: 0.8 });
M('microcement', 'Microcement', ['floor', 'wall', 'counter'], 'slab', { tileW: 200, tileH: 200, colors: ['#bdb6ab'], surface: 'concrete' }, { rough: 0.7 });
M('polished-concrete', 'Polished concrete', ['floor', 'ceiling'], 'slab', { tileW: 200, tileH: 200, colors: ['#9a9895'], surface: 'concrete' }, { rough: 0.35 });
M('octagon-dot', 'Octagon & black dot', ['floor'], 'octagon', { tileW: 15, grout: 1.5, groutColor: '#b9b9b9', colors: ['#f3f2ee', '#1d1d1d'] }, { rough: 0.3 });
M('basket-marble', 'Marble basketweave', ['floor', 'tile'], 'basketweave', { tileW: 10, grout: 1.5, groutColor: '#c8c8c8', colors: ['#eeeeec'], surface: 'marble', veinColor: '#9a9ea3' }, { rough: 0.25 });
M('diamond-cream', 'Diamond cream 20×20', ['floor'], 'diamond', { tileW: 20, grout: 2, groutColor: '#bdb3a1', colors: ['#e7ddca'], variation: 0.04 }, { rough: 0.5 });

// ---------- wall tiles ----------
M('subway-white', 'White subway 7.5×15 gloss', ['tile'], 'brick', { tileW: 15, tileH: 7.5, grout: 2, groutColor: '#d2d0cb', colors: ['#f7f6f2'], variation: 0.02 }, { rough: 0.12 });
M('subway-white-dark', 'White subway, charcoal grout', ['tile'], 'brick', { tileW: 15, tileH: 7.5, grout: 2, groutColor: '#3d3d3d', colors: ['#f5f4f0'], variation: 0.02 }, { rough: 0.12 });
M('subway-stack-v', 'Vertical stack 7.5×30 sage', ['tile'], 'grid', { tileW: 7.5, tileH: 30, grout: 2, groutColor: '#d7d6cf', colors: ['#a7b39b'], variation: 0.05 }, { rough: 0.15 });
M('subway-herring', 'Subway herringbone white', ['tile'], 'herringbone', { tileW: 20, tileH: 5, grout: 2, groutColor: '#cfcdc7', colors: ['#f4f3ef'], variation: 0.02 }, { rough: 0.15 });
M('zellige-green', 'Zellige emerald 10×10', ['tile'], 'grid', { tileW: 10, tileH: 10, grout: 1.5, groutColor: '#c9c6bd', colors: ['#2f6b58', '#2a5f4f', '#377a64'], mix: 'random', variation: 0.12, surface: 'zellige' }, { rough: 0.08 });
M('zellige-blue', 'Zellige ocean 10×10', ['tile'], 'grid', { tileW: 10, tileH: 10, grout: 1.5, groutColor: '#cfcbc0', colors: ['#2e5d86', '#3a6f9a', '#284f73'], mix: 'random', variation: 0.12, surface: 'zellige' }, { rough: 0.08 });
M('zellige-white', 'Zellige white 5×15', ['tile'], 'brick', { tileW: 15, tileH: 5, offset: 0.5, grout: 1.5, groutColor: '#d9d5cb', colors: ['#f3efe6', '#ebe5d9', '#f7f4ee'], mix: 'random', variation: 0.06, surface: 'zellige' }, { rough: 0.08 });
M('zellige-pink', 'Zellige blush', ['tile'], 'grid', { tileW: 10, tileH: 10, grout: 1.5, groutColor: '#dcd2c9', colors: ['#e2b3a4', '#d9a797', '#e9c0b2'], mix: 'random', variation: 0.1, surface: 'zellige' }, { rough: 0.08 });
M('chevron-sage', 'Ceramic chevron sage', ['tile'], 'chevron', { tileW: 20, tileH: 5, grout: 1.5, groutColor: '#d1d1c9', colors: ['#9fae96'], variation: 0.05 }, { rough: 0.15 });
M('fish-teal', 'Fish scale teal', ['tile'], 'fishscale', { tileW: 10, grout: 1.5, groutColor: '#e0ddd5', colors: ['#2f7c7a', '#3b8b88', '#276a69'], mix: 'random', variation: 0.08, surface: 'zellige' }, { rough: 0.1 });
M('fish-deco', 'Art-deco fan', ['wall', 'tile'], 'fishscale', { tileW: 20, grout: 1, groutColor: '#c6a864', colors: ['#1f3b35', '#c6a864'], surface: 'deco' }, { rough: 0.5 });
M('hex-mosaic-bw', 'Hex mosaic black/white', ['tile', 'floor'], 'hex', { tileW: 2.5, grout: 1, groutColor: '#9a9a9a', colors: ['#f4f4f2', '#f4f4f2', '#f4f4f2', '#1c1c1c'], mix: 'random' }, { rough: 0.25 });
M('mosaic-blue', 'Pool mosaic blue mix', ['tile'], 'grid', { tileW: 2.5, tileH: 2.5, grout: 1.5, groutColor: '#e6e6e6', colors: ['#3d7fb8', '#5c9bd0', '#2a6599', '#8cbde3', '#ffffff'], mix: 'random', variation: 0.05 }, { rough: 0.1 });
M('penny-black', 'Penny round black', ['tile', 'floor'], 'penny', { tileW: 2, grout: 2, groutColor: '#d9d9d9', colors: ['#1d1d1f'] }, { rough: 0.15 });
M('penny-white', 'Penny round white', ['tile', 'floor'], 'penny', { tileW: 2, grout: 2, groutColor: '#7a7a7a', colors: ['#f3f3f1'] }, { rough: 0.15 });
M('finger-kitkat', 'Kit-kat finger tiles green', ['tile'], 'grid', { tileW: 2, tileH: 10, grout: 1.5, groutColor: '#dcdcd6', colors: ['#5b7f63', '#638a6b', '#557659'], mix: 'random', variation: 0.06, surface: 'zellige' }, { rough: 0.1 });
M('square-white-10', 'Square white 10×10', ['tile'], 'grid', { tileW: 10, tileH: 10, grout: 2, groutColor: '#cfcfcf', colors: ['#f7f7f5'] }, { rough: 0.15 });
M('square-terracotta', 'Glazed terracotta 13×13', ['tile'], 'grid', { tileW: 13, tileH: 13, grout: 2, groutColor: '#e2d6c6', colors: ['#c06a45', '#b25f3e', '#cc7650'], mix: 'random', variation: 0.08, surface: 'zellige' }, { rough: 0.15 });
M('marble-slab-wall', 'Calacatta slab wall', ['tile', 'wall'], 'grid', { tileW: 120, tileH: 240, grout: 1, groutColor: '#e5e2dc', colors: ['#f3f0ea'], surface: 'marble', veinColor: '#9a8a70' }, { rough: 0.15 });
M('marble-herring-mosaic', 'Marble herringbone mosaic', ['tile', 'floor'], 'herringbone', { tileW: 7.5, tileH: 2.5, grout: 1, groutColor: '#cfcfcf', colors: ['#ededeb', '#dcdcda'], mix: 'random', surface: 'marble', veinColor: '#9ca0a5' }, { rough: 0.2 });
M('porcelain-30x60-white', 'Porcelain 30×60 white matt', ['tile', 'floor'], 'brick', { tileW: 60, tileH: 30, grout: 2, offset: 0, groutColor: '#d8d8d6', colors: ['#ecebe8'], variation: 0.01 }, { rough: 0.45 });

// ---------- other wall finishes ----------
M('wallpaper-pinstripe', 'Wallpaper pinstripe', ['wall'], 'stripes', { tileW: 4, colors: ['#e9e3d6', '#c9bfae'], widths: [4, 0.6], grain: 0.01 }, { rough: 0.85 });
M('wallpaper-wide-stripe', 'Wallpaper wide stripe', ['wall'], 'stripes', { tileW: 10, colors: ['#dfe6e1', '#9cb2a6'], grain: 0.01 }, { rough: 0.85 });
M('wallpaper-trellis', 'Wallpaper trellis', ['wall'], 'motif', { tileW: 25, grout: 0, colors: ['#ece6da', '#b89a6a', '#b89a6a'], motif: 'trellis' }, { rough: 0.85 });
M('wallpaper-botanical', 'Wallpaper botanical', ['wall'], 'motif', { tileW: 35, grout: 0, colors: ['#e9e4d6', '#4f6f52', '#7d9a6a'], motif: 'leaf' }, { rough: 0.85 });
M('wallpaper-damask', 'Wallpaper navy quatrefoil', ['wall'], 'motif', { tileW: 30, grout: 0, colors: ['#26324a', '#3a4a6a', '#c3a96b', '#c3a96b'], motif: 'quatrefoil' }, { rough: 0.85 });
M('wallpaper-circles', 'Wallpaper geometric circles', ['wall'], 'motif', { tileW: 20, grout: 0, colors: ['#efe9df', '#c79e7b', '#c79e7b'], motif: 'circles' }, { rough: 0.85 });
M('brick-red', 'Exposed red brick', ['wall'], 'brick', { tileW: 21.5, tileH: 6.5, grout: 10, offset: 0.5, groutColor: '#b9ab98', colors: ['#9c4a33', '#8a3f2b', '#a85a3e', '#7a3a2a'], mix: 'random', variation: 0.1, surface: 'brick' }, { rough: 0.95, bump: 1.2 });
M('brick-white', 'White-washed brick', ['wall'], 'brick', { tileW: 21.5, tileH: 6.5, grout: 10, offset: 0.5, groutColor: '#cfcac1', colors: ['#ece8e1', '#e2dcd2', '#f1eee8'], mix: 'random', variation: 0.06, surface: 'brick' }, { rough: 0.95, bump: 1.2 });
M('wood-slats', 'Oak slat panelling', ['wall', 'ceiling'], 'grid', { tileW: 4, tileH: 240, grout: 12, groutColor: '#231d17', colors: ['#b58a5c'], variation: 0.06, surface: 'wood' }, { rough: 0.6, bump: 1.5 });
M('concrete-panels', 'Concrete panels', ['wall', 'ceiling'], 'grid', { tileW: 120, tileH: 60, grout: 3, groutColor: '#6d6b67', colors: ['#a19e98'], variation: 0.05, surface: 'concrete' }, { rough: 0.85 });
M('stone-cladding', 'Stacked stone', ['wall'], 'planks', { tileW: 6, tileH: 40, grout: 4, groutColor: '#57524a', colors: ['#9b8f7c', '#857a68', '#b0a590', '#6f675a'], mix: 'random', variation: 0.1, surface: 'stone' }, { rough: 0.95, bump: 1.5 });
M('beadboard', 'White beadboard', ['wall'], 'grid', { tileW: 10, tileH: 240, grout: 3, groutColor: '#c9c7c0', colors: ['#f2f1ec'] }, { rough: 0.6, bump: 1 });

// ---------- countertops ----------
M('ct-carrara', 'Carrara marble', ['counter', 'wood'], 'slab', { tileW: 120, tileH: 120, colors: ['#efefed'], surface: 'marble', veinColor: '#8d9196' }, { rough: 0.2 });
M('ct-calacatta', 'Calacatta gold', ['counter'], 'slab', { tileW: 140, tileH: 140, colors: ['#f4f1ea'], surface: 'marble', veinColor: '#9c8157' }, { rough: 0.15 });
M('ct-green-marble', 'Verde marble', ['counter'], 'slab', { tileW: 100, tileH: 100, colors: ['#2f4a3f'], surface: 'marble', veinColor: '#d9e3dc' }, { rough: 0.15 });
M('ct-black-granite', 'Black galaxy granite', ['counter'], 'slab', { tileW: 80, tileH: 80, colors: ['#1a1a1c'], surface: 'speckle', chipColors: ['#3a3a3c', '#c9a56a', '#0e0e0f'], density: 1 }, { rough: 0.15 });
M('ct-grey-granite', 'Grey granite', ['counter'], 'slab', { tileW: 80, tileH: 80, colors: ['#8b8a88'], surface: 'speckle', chipColors: ['#2b2b2b', '#dcdcdc', '#6b5f58'], density: 3 }, { rough: 0.25 });
M('ct-white-quartz', 'White quartz', ['counter'], 'slab', { tileW: 80, tileH: 80, colors: ['#f3f2ef'], surface: 'speckle', chipColors: ['#d8d6d1', '#bdbab3', '#ffffff'], density: 0.8 }, { rough: 0.2 });
M('ct-concrete', 'Concrete worktop', ['counter'], 'slab', { tileW: 120, tileH: 120, colors: ['#9d9a95'], surface: 'concrete' }, { rough: 0.55 });
M('ct-butcher', 'Oak butcher block', ['counter', 'wood'], 'planks', { tileW: 4, tileH: 100, grout: 0.3, groutColor: '#7c5a36', colors: ['#c39461', '#b8864f', '#cfa06c'], mix: 'random', variation: 0.08, surface: 'wood' }, { rough: 0.5 });
M('ct-steel', 'Stainless steel', ['counter', 'metal'], 'slab', { tileW: 60, tileH: 60, colors: ['#b9bcbf'], surface: 'metal' }, { rough: 0.35, metal: 1 });
M('ct-black-soapstone', 'Soapstone black', ['counter'], 'slab', { tileW: 100, tileH: 100, colors: ['#3a3d3e'], surface: 'marble', veinColor: '#8a9092' }, { rough: 0.5 });

// ---------- cabinet fronts ----------
M('cab-white', 'Matte white', ['cabinet'], 'solid', { colors: ['#f2f1ed'], grain: 0.008 }, { rough: 0.6 });
M('cab-gloss-white', 'Gloss white', ['cabinet'], 'solid', { colors: ['#f7f7f7'], grain: 0.005 }, { rough: 0.08 });
M('cab-sage', 'Sage shaker', ['cabinet'], 'solid', { colors: ['#93a18a'], grain: 0.01 }, { rough: 0.55 });
M('cab-navy', 'Navy', ['cabinet'], 'solid', { colors: ['#2c3a55'], grain: 0.01 }, { rough: 0.5 });
M('cab-forest', 'Deep green', ['cabinet'], 'solid', { colors: ['#2f4a3c'], grain: 0.01 }, { rough: 0.5 });
M('cab-charcoal', 'Charcoal matte', ['cabinet'], 'solid', { colors: ['#3a3b3d'], grain: 0.01 }, { rough: 0.6 });
M('cab-greige', 'Cashmere', ['cabinet'], 'solid', { colors: ['#cfc4b3'], grain: 0.01 }, { rough: 0.55 });
M('cab-terracotta', 'Terracotta', ['cabinet'], 'solid', { colors: ['#b8694c'], grain: 0.01 }, { rough: 0.55 });
M('cab-blush', 'Blush pink', ['cabinet'], 'solid', { colors: ['#e2bfb3'], grain: 0.01 }, { rough: 0.55 });
M('wood-oak', 'Oak veneer', ['cabinet', 'wood'], 'planks', { tileW: 25, tileH: 240, grout: 0, colors: ['#c79f72'], variation: 0.05, surface: 'wood' }, { rough: 0.55 });
M('wood-light', 'Birch / light wood', ['cabinet', 'wood'], 'planks', { tileW: 25, tileH: 240, grout: 0, colors: ['#e0c9a3'], variation: 0.04, surface: 'wood' }, { rough: 0.6 });
M('wood-walnut', 'Walnut veneer', ['cabinet', 'wood'], 'planks', { tileW: 25, tileH: 240, grout: 0, colors: ['#6a4630'], variation: 0.06, surface: 'wood' }, { rough: 0.5 });
M('wood-black', 'Black stained oak', ['cabinet', 'wood'], 'planks', { tileW: 25, tileH: 240, grout: 0, colors: ['#2a2623'], variation: 0.05, surface: 'wood' }, { rough: 0.55 });
M('wood-teak', 'Teak', ['cabinet', 'wood'], 'planks', { tileW: 25, tileH: 240, grout: 0, colors: ['#9a6a3d'], variation: 0.06, surface: 'wood' }, { rough: 0.5 });
M('wood-rattan', 'Rattan cane', ['wood', 'cabinet'], 'slab', { tileW: 30, tileH: 30, colors: ['#c9a66f'], surface: 'jute' }, { rough: 0.7 });

// ---------- fabrics ----------
const fab = (id, name, color, surface = 'fabric', rough = 0.95) => M(id, name, ['fabric'], 'slab', { tileW: 20, tileH: 20, colors: [color], surface, grain: 0.02 }, { rough });
fab('fab-linen', 'Natural linen', '#d8cfbf');
fab('fab-oat', 'Oatmeal', '#c8b9a1');
fab('fab-grey', 'Grey felt', '#8e9092');
fab('fab-charcoal', 'Charcoal', '#46484b');
fab('fab-navy-velvet', 'Navy velvet', '#27324d', 'fabric', 0.7);
fab('fab-emerald-velvet', 'Emerald velvet', '#1f5a47', 'fabric', 0.7);
fab('fab-mustard', 'Mustard', '#c99a33');
fab('fab-terracotta', 'Rust', '#a85537');
fab('fab-blush', 'Blush', '#dcb2a6');
fab('fab-sage', 'Sage', '#9aa88f');
fab('fab-sky', 'Sky blue', '#a7bfd4');
fab('fab-white', 'White cotton', '#f2f1ec');
fab('fab-boucle', 'Cream bouclé', '#eee6d8', 'boucle');
fab('fab-leather-cognac', 'Cognac leather', '#8a4e2b', 'paint', 0.45);
fab('fab-leather-black', 'Black leather', '#1f1f20', 'paint', 0.4);
M('fab-stripe', 'Ticking stripe', ['fabric'], 'stripes', { tileW: 2, colors: ['#f1eee6', '#3b4d6b'], widths: [2.2, 0.5] }, { rough: 0.95 });
M('fab-plaid', 'Wool plaid', ['fabric'], 'plaid', { tileW: 16, colors: ['#8c3a2d', '#2d3a2f', '#e2d4b8', '#d9b44a'] }, { rough: 0.95 });
M('fab-gingham', 'Gingham sage', ['fabric'], 'plaid', { tileW: 3, colors: ['#f4f1e8', '#8fa283', '#8fa283', '#8fa283'] }, { rough: 0.95 });

// ---------- rugs ----------
M('rug-jute', 'Jute rug', ['rug'], 'slab', { tileW: 30, tileH: 30, colors: ['#bfa27a'], surface: 'jute' }, { rough: 1 });
M('rug-stripe', 'Berber stripe rug', ['rug'], 'stripes', { tileW: 12, colors: ['#ece6d8', '#2f2f2f', '#ece6d8', '#b86b4b'], widths: [18, 2, 6, 2] }, { rough: 1 });
M('rug-diamond', 'Beni diamond rug', ['rug'], 'motif', { tileW: 40, grout: 0, colors: ['#efe9dd', '#3a3530', '#3a3530'], motif: 'trellis' }, { rough: 1 });
M('rug-grey', 'Grey wool rug', ['rug', 'fabric'], 'slab', { tileW: 20, tileH: 20, colors: ['#a3a3a0'], surface: 'boucle' }, { rough: 1 });
M('rug-terracotta', 'Terracotta kilim', ['rug'], 'motif', { tileW: 30, grout: 0, colors: ['#b1583c', '#e8c99b', '#2f3a3a', '#e8c99b'], motif: 'star' }, { rough: 1 });
M('rug-blue', 'Indigo rug', ['rug'], 'motif', { tileW: 35, grout: 0, colors: ['#2b3c5e', '#c7cfdc', '#8a9bbd', '#e0c38a'], motif: 'quatrefoil' }, { rough: 1 });

// ---------- metals ----------
M('metal-steel', 'Brushed steel', ['metal'], 'slab', { tileW: 30, tileH: 30, colors: ['#c3c6c9'], surface: 'metal' }, { rough: 0.3, metal: 0.75 });
M('metal-chrome', 'Chrome', ['metal'], 'solid', { colors: ['#e3e6e8'], grain: 0 }, { rough: 0.05, metal: 1 });
M('metal-brass', 'Brushed brass', ['metal'], 'slab', { tileW: 30, tileH: 30, colors: ['#c9a45a'], surface: 'metal' }, { rough: 0.3, metal: 1 });
M('metal-black', 'Black metal', ['metal'], 'solid', { colors: ['#232324'], grain: 0.01 }, { rough: 0.45, metal: 0.6 });
M('metal-copper', 'Copper', ['metal'], 'slab', { tileW: 30, tileH: 30, colors: ['#c27a52'], surface: 'metal' }, { rough: 0.3, metal: 1 });

// ---------- ceramic, glass, misc ----------
M('ceramic-white', 'White ceramic', ['ceramic'], 'solid', { colors: ['#f8f8f6'], grain: 0 }, { rough: 0.08 });
M('ceramic-black', 'Matte black ceramic', ['ceramic'], 'solid', { colors: ['#262627'], grain: 0 }, { rough: 0.4 });
M('ceramic-sand', 'Sand ceramic', ['ceramic'], 'solid', { colors: ['#e3d6c3'], grain: 0.01 }, { rough: 0.3 });
M('glass-clear', 'Clear glass', ['ceramic', 'misc'], 'solid', { colors: ['#dfeef0'], grain: 0 }, { rough: 0.02, kind: 'glass' });
M('glass-fluted', 'Frosted glass', ['ceramic', 'misc'], 'solid', { colors: ['#e8f0f0'], grain: 0 }, { rough: 0.3, kind: 'frosted' });
M('mirror', 'Mirror', ['misc'], 'solid', { colors: ['#e6eaec'], grain: 0 }, { rough: 0.0, metal: 1, kind: 'mirror' });
M('appliance-steel', 'Appliance steel', ['metal', 'misc'], 'slab', { tileW: 40, tileH: 40, colors: ['#c4c7ca'], surface: 'metal' }, { rough: 0.35, metal: 0.55 });
M('appliance-white', 'Appliance white', ['misc'], 'solid', { colors: ['#f1f1f0'], grain: 0 }, { rough: 0.3 });
M('appliance-black', 'Appliance black glass', ['misc'], 'solid', { colors: ['#161617'], grain: 0 }, { rough: 0.1 });
M('screen', 'TV screen', ['misc'], 'solid', { colors: ['#0b0c0e'], grain: 0 }, { rough: 0.15 });
M('plant-green', 'Leaf green', ['misc'], 'solid', { colors: ['#3f6b3a'], grain: 0.03 }, { rough: 0.7 });
M('soil', 'Soil', ['misc'], 'solid', { colors: ['#3d2c20'], grain: 0.05 }, { rough: 1 });
M('lampshade', 'Linen lampshade', ['fabric', 'misc'], 'slab', { tileW: 10, tileH: 10, colors: ['#f3ead8'], surface: 'fabric' }, { rough: 0.9, kind: 'light' });
M('bulb', 'Light emitter', ['misc'], 'solid', { colors: ['#ffffff'], grain: 0 }, { rough: 1, kind: 'light' });
M('art-abstract', 'Abstract print', ['misc'], 'motif', { tileW: 60, grout: 0, colors: ['#efe8dc', '#c96d4b', '#2f4858', '#e3b25c'], motif: 'truchet' }, { rough: 0.8 });
M('exterior-render', 'Exterior render', ['wall'], 'slab', { tileW: 200, tileH: 200, colors: ['#e7e2d8'], surface: 'concrete' }, { rough: 0.95 });
M('wall-cut', 'Wall section', ['misc'], 'solid', { colors: ['#4a4a4d'], grain: 0 }, { rough: 1 });
M('grass', 'Lawn', ['misc'], 'slab', { tileW: 100, tileH: 100, colors: ['#5d7a45'], surface: 'speckle', chipColors: ['#4a6636', '#6f8c52', '#3f5a2e'], density: 3 }, { rough: 1 });

export const LIBRARY = L;
export const LIB_BY_ID = Object.fromEntries(L.map((m) => [m.id, m]));

export const FALLBACK = LIB_BY_ID['paint-warm-white'];

export function getMaterialDef(plan, id) {
  if (!id) return null;
  return plan?.materials?.[id] || LIB_BY_ID[id] || null;
}
