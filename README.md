# Planet Forge — Procedural Planet

A seeded procedural 3D planet built with Three.js. Every seed produces a different world with continents, oceans, ice caps, clouds, rings, moons, a star system, and distant planets.

- Drag to orbit
- Scroll or pinch to zoom
- Double-click or press `0` to reset the view
- Type a seed and generate, or roll a random one
- Capture a clean PNG of the scene, including the atmosphere and a seed watermark
- The seed is stored in the URL, so worlds are shareable
- No textures, models, fonts, or other runtime assets — everything is generated in the browser

## Run locally

ES modules require a local server (opening `index.html` directly with `file://` will not work in most browsers):

```bash
python -m http.server 8000
# then visit http://localhost:8000
```

## Deploy with GitHub Pages

1. Push the folder to a GitHub repository.
2. Open **Settings → Pages**.
3. Set **Source** to **Deploy from a branch**.
4. Choose `main` and `/ (root)`, then save.

The project is fully static: `index.html`, `style.css`, `app.js`, and `vendor/three.module.min.js`.

## How it works

- A seeded PRNG drives all world and system parameters.
- A seed-based 3D Perlin noise field is sampled on the sphere to build:
  - a height/displacement map,
  - a moisture map for deserts, forests, and tundra,
  - a colour map,
  - a cloud alpha map.
- Palettes are generated from biome-specific hue, saturation, and lightness ranges, so worlds are not limited to a fixed set of colours.
- Three.js maps those to a displaced sphere, a slightly larger cloud shell, and a soft CSS atmosphere halo.
- Rings are pure particle disks: seeded density, thickness, grain, brightness, radial gaps, planet shadows, and styles such as ice, dust, gold, rust, ember, teal, violet, charcoal, and silver.
- Moons are generated with surface and bump maps, orbiting the planet on seeded inclinations.
- Star systems can contain one, two, or three suns; background worlds are real 3D spheres with slow seeded orbital drift, rings, atmosphere halos, and companion moons.
- The screenshot capture composites the WebGL scene with the atmosphere halo and a seed watermark.

## Controls

- **Generate** — generate the typed seed; if the seed is unchanged, it rolls a new one
- **Seed field + Enter** — generate a specific seed
- **Copy share link** — copy a clean shareable URL
- **Image** — download a PNG of the current scene
- **Record** — record the animated scene to WebM; press Stop to download
- **Watermark** — include or remove the seed watermark from images and videos
- **HQ video** — record at higher resolution and a higher bitrate
- **Full / F** — enter or exit fullscreen
- **Reset view** — return to the default camera

## Customize

- **Quality** — `TEXTURE_WIDTH` in `app.js`; the mobile fallback is selected automatically.
- **Biomes and palettes** — the `BIOMES` array and `makePalette()`.
- **Terrain and moisture** — `makePlanetParams()` and `buildPlanetTextures()`.
- **Rings and moons** — `makeRingParams()`, `makeMoonParams()`, and `applyRings()`.
- **Star systems** — `STAR_TYPES`, `makeStars()`, and `applyStarSystem()`.
- **Background planets** — `makeNeighborParams()` and `makeNeighborTexture()`.
- **Look** — colours and UI styles in `style.css`.

## Credits

Three.js is © three.js authors, MIT licensed. The bundled license is in `vendor/THREE-LICENSE.txt`.
