# HomeViz

A browser app for laying out a home, furnishing it, and checking finishes (tiles, patterns, paint, countertops, fabrics) in 3D under different lighting.

Built with plain JavaScript, Three.js and Vite. Everything is metric: plans are stored in cm, lengths are shown in m and areas in m².

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static build in dist/
```

## What you can do

| Area | Features |
|---|---|
| **Floor plan (2D)** | Draw rectangular rooms, polygon rooms or free walls. Snapping works to the grid, to wall endpoints and to 45° angles. Walls are split automatically at T-junctions, so each segment can take its own finish. Open-plan zones are rooms without walls, e.g. a kitchen area inside a living room. You can drag wall endpoints and whole walls, reshape rooms, and edit lengths as numbers. |
| **Doors & windows** | 7 door styles (interior, entry, French glass, double, sliding patio, pocket, open passage) and 7 window styles (casement, single, sliding, picture, divided lites, frosted, floor-to-ceiling). Each has editable width, height, sill, swing side and hinge side. |
| **Furniture** | About 60 simple parametric items for kitchen, living, dining, bedroom, bathroom and lighting. They snap to walls, and you can rotate, resize, duplicate and nudge them. Every item has named finish *slots* (upholstery, wood, cabinet fronts, countertop, metal, …). |
| **Materials** | About 150 procedural, real-scale materials: wood planks, herringbone, chevron, parquet, porcelain, marble, terrazzo, cement/encaustic tiles, hexagon, penny, fish-scale, zellige, subway, kit-kat, brick, wallpapers, paints, countertops, fabrics, rugs and metals. The pattern editor lets you change tile size, grout width and colour, colour mixes, surface type and gloss. |
| **Your own tiles** | *Materials → Tile from photo*: take or upload a photo and drag four corners onto one tile (perspective is corrected). Then enter its real size in cm and choose a repeat (grid, half offset, mirror, rotate, random rotation). |
| **Finish rules** | Each room has floor, wall and ceiling finishes, plus an optional tiled band: a backsplash behind counters only, a wainscot, or a shower-height band. Any wall side can override these. Furniture takes global finishes from the Styles tab unless an item overrides a slot. |
| **Styles** | 7 whole-home presets (Scandinavian, Japandi, Industrial, Mediterranean, Moody modern, Boho, Classic Parisian). |
| **3D** | Orbit, or walk (first person, with wall collision). Lighting presets: Day, Sunset, Overcast and Night. Bulb colour temperature runs from 2200 K to 6500 K. There are controls for brightness, exposure, sun direction and tone mapping (Neutral by default, for faithful colours). You can also cut walls at 1.2 m, hide ceilings, and set how far doors are open. **Compare** renders the same view under 4 lighting setups side by side. Clicking any surface in 3D selects it for editing. |
| **Files** | Autosave, named saves in the browser, and JSON export/import. |

## Samples

* **1+1 apartment** (about 56 m²): open kitchen with island, living room, bedroom, bathroom and entry
* **Studio** (about 33 m²): kitchenette and shower room
* **2+1 family apartment** (about 88 m²): separate kitchen, laundry and two bedrooms
* **Blank canvas**

## Code map

```
src/
  main.js                 bootstrap
  store.js                plan state, undo/redo, persistence
  editor2d.js             canvas floor-plan editor
  view3d.js               three.js scene, lighting, orbit/walk, picking
  plan/model.js           walls/rooms/openings/items + finish resolution
  plan/samples.js         sample plans
  plan/themes.js          style presets
  materials/patterns.js   procedural seamless pattern renderer (real scale)
  materials/library.js    built-in materials
  materials/textures.js   material → THREE material cache, thumbnails
  catalog/items.js        furniture catalogue (2D symbols + 3D builders)
  catalog/openings3d.js   doors and windows
  ui/panels.js            sidebars, properties, 3D toolbar
  ui/materialsUI.js       material picker, pattern editor, photo-tile tool
```

## Notes on lighting

Interior lighting is approximate. Real-time rendering has no global illumination, so the app adds the following:

* Area lights at each window for daylight.
* A hemisphere fill light.
* A small bounce term tinted by the bulb colour.

Ceiling lights come from room area (about 140 lm/m², adjustable per room) and cast shadows, so light doesn't leak through walls. Treat colours as a guide to how finishes relate to each other under warm and cool light, not as a physically exact render.
