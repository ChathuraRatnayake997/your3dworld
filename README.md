# Planet Forge — Procedural Planet

A seeded procedural 3D planet built with Three.js. Every seed produces a different world with continents, oceans, ice caps, clouds, rings, moons, a star system, and distant planets.

- Drag to orbit
- Scroll or pinch to zoom
- Double-click or press `0` to reset the view
- Type a seed and generate, or roll a random one
- Capture a clean PNG of the scene, including the atmosphere and a seed watermark
- The seed is stored in the URL, so worlds are shareable
- No textures, models, fonts, or other runtime assets — everything is generated in the browser

## Controls

- **Generate** — generate the typed seed; if the seed is unchanged, it rolls a new one
- **Seed field + Enter** — generate a specific seed
- **Copy share link** — copy a clean shareable URL
- **Image** — download a PNG of the current scene
- **Record** — record the animated scene to WebM; press Stop to download
- **Watermark** — include or remove the seed watermark from images and videos
- **HQ video** — record at higher resolution and a higher bitrate
- **Star motion** — subtly drift and twinkle the starfield
- **Ring motion** — subtly shear and shimmer the ring particles
- **Full / F** — enter or exit fullscreen
- **Reset view** — return to the default camera

The heavier options (HQ video, star motion, ring motion) show a short performance heads-up when first enabled. Tick **Don't show again** to silence it for good.

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
