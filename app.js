import * as THREE from './vendor/three.module.min.js';

/* ------------------------------------------------------------------ */
/*  DOM                                                               */
/* ------------------------------------------------------------------ */

const ui = {
  canvas: document.getElementById('scene'),
  atmoGlow: document.getElementById('atmoGlow'),
  seedInput: document.getElementById('seedInput'),
  seedTag: document.getElementById('seedTag'),
  randomBtn: document.getElementById('randomBtn'),
  resetViewBtn: document.getElementById('resetViewBtn'),
  copyBtn: document.getElementById('copyBtn'),
  captureBtn: document.getElementById('captureBtn'),
  recordBtn: document.getElementById('recordBtn'),
  recordLabel: document.getElementById('recordLabel'),
  fullscreenBtn: document.getElementById('fullscreenBtn'),
  fullscreenLabel: document.getElementById('fullscreenLabel'),
  recBadge: document.getElementById('recBadge'),
  recTime: document.getElementById('recTime'),
  watermarkToggle: document.getElementById('watermarkToggle'),
  hqToggle: document.getElementById('hqToggle'),
  starMotionToggle: document.getElementById('starMotionToggle'),
  ringMotionToggle: document.getElementById('ringMotionToggle'),
  autoOrbitToggle: document.getElementById('autoOrbitToggle'),
  postcardToggle: document.getElementById('postcardToggle'),
  perfDialog: document.getElementById('perfDialog'),
  perfBackdrop: document.getElementById('perfBackdrop'),
  perfBody: document.getElementById('perfBody'),
  perfChips: document.getElementById('perfChips'),
  perfDontAsk: document.getElementById('perfDontAsk'),
  perfClose: document.getElementById('perfClose'),
  statClass: document.getElementById('statClass'),
  statOcean: document.getElementById('statOcean'),
  statClouds: document.getElementById('statClouds'),
  statIce: document.getElementById('statIce'),
  statMoons: document.getElementById('statMoons'),
  statRings: document.getElementById('statRings'),
  statSystem: document.getElementById('statSystem'),
  loader: document.getElementById('loader'),
  loaderTitle: document.getElementById('loaderTitle'),
  loaderProgress: document.getElementById('loaderProgress'),
  toast: document.getElementById('toast')
};

const isSmallScreen = window.matchMedia('(max-width: 760px)').matches || (navigator.hardwareConcurrency || 8) <= 4;
const TEXTURE_WIDTH = isSmallScreen ? 768 : 1280;
const TEXTURE_HEIGHT = Math.round(TEXTURE_WIDTH / 2);
const DEFAULT_SEED = 'ORION-7';
const START_VIEW = { azimuth: 0.72, polar: 1.18, distance: 3.9 };

/* ------------------------------------------------------------------ */
/*  Small utilities                                                   */
/* ------------------------------------------------------------------ */

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function hashString(value) {
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(random) {
  const u = Math.max(0.000001, random());
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function normalizeSeed(raw) {
  const cleaned = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 24);

  return cleaned || randomSeed();
}

const SEED_PREFIXES = [
  'ORION',
  'NOVA',
  'KEPLER',
  'VESPER',
  'LYRA',
  'ATLAS',
  'HELIOS',
  'SIRIUS',
  'ZENITH',
  'AURORA',
  'VEGA',
  'RIGEL'
];

function randomSeed() {
  const prefix = SEED_PREFIXES[Math.floor(Math.random() * SEED_PREFIXES.length)];
  const number = 100 + Math.floor(Math.random() * 900);
  return `${prefix}-${number}`;
}

const PLANET_NAMES = [
  'AURELIA',
  'KEPLER',
  'VESPER',
  'THALOS',
  'NYX',
  'ORIN',
  'CYRA',
  'HALCYON',
  'EREBUS',
  'LYRA',
  'TALOS',
  'MIRA',
  'SOLIS',
  'ARGUS',
  'VEGA',
  'CORVUS'
];

const PLANET_TITLES = ['PRIME', 'MINOR', 'MAJOR', 'NOVA', 'ULTIMA', 'BOREAL', 'AUSTRAL', 'SECUNDA'];

function planetName(seed) {
  const hash = hashString(seed);
  const random = mulberry32((hash ^ 0x5bd1e995) >>> 0);
  const prefix = PLANET_NAMES[Math.floor(random() * PLANET_NAMES.length)];
  const number = 100 + Math.floor(random() * 899);
  const suffix =
    random() < 0.45 ? ` ${PLANET_TITLES[Math.floor(random() * PLANET_TITLES.length)]}` : '';
  return `${prefix}-${number}${suffix}`;
}

/* ------------------------------------------------------------------ */
/*  3D Perlin noise + fBm                                              */
/* ------------------------------------------------------------------ */

function makeNoise3(random) {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;

  for (let i = 255; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const temp = p[i];
    p[i] = p[j];
    p[j] = temp;
  }

  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (t, a, b) => a + t * (b - a);

  const grad = (hash, x, y, z) => {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  };

  return function noise3(x, y, z) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;

    x -= Math.floor(x);
    y -= Math.floor(y);
    z -= Math.floor(z);

    const u = fade(x);
    const v = fade(y);
    const w = fade(z);

    const A = perm[X] + Y;
    const AA = perm[A] + Z;
    const AB = perm[A + 1] + Z;
    const B = perm[X + 1] + Y;
    const BA = perm[B] + Z;
    const BB = perm[B + 1] + Z;

    return lerp(
      w,
      lerp(
        v,
        lerp(u, grad(perm[AA], x, y, z), grad(perm[BA], x - 1, y, z)),
        lerp(u, grad(perm[AB], x, y - 1, z), grad(perm[BB], x - 1, y - 1, z))
      ),
      lerp(
        v,
        lerp(u, grad(perm[AA + 1], x, y, z - 1), grad(perm[BA + 1], x - 1, y, z - 1)),
        lerp(u, grad(perm[AB + 1], x, y - 1, z - 1), grad(perm[BB + 1], x - 1, y - 1, z - 1))
      )
    );
  };
}

function fbm(noise, x, y, z, octaves) {
  let sum = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let norm = 0;

  for (let i = 0; i < octaves; i++) {
    sum += amplitude * noise(x * frequency, y * frequency, z * frequency);
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return sum / norm;
}

/* ------------------------------------------------------------------ */
/*  Palettes                                                          */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Biomes and generated palettes                                     */
/* ------------------------------------------------------------------ */

const lerp = (a, b, t) => a + (b - a) * t;

function hsl(h, s, l) {
  h = (((h % 360) + 360) % 360) / 360;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h * 12) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

const BIOMES = [
  {
    id: 'terran',
    name: 'TEMPERATE',
    weight: 1.45,
    waterHue: [195, 225],
    waterSat: [0.55, 0.78],
    waterLight: [0.12, 0.28],
    landHue: [85, 145],
    landSat: [0.3, 0.52],
    landLight: [0.28, 0.45],
    rockHue: [18, 48],
    rockSat: [0.1, 0.28],
    rockLight: [0.3, 0.55],
    beachHue: [35, 55],
    beachSat: [0.34, 0.5],
    beachLight: [0.62, 0.74],
    dryHue: [25, 45],
    drySat: [0.4, 0.56],
    dryLight: [0.5, 0.66],
    iceHue: [195, 220],
    iceSat: [0.04, 0.18],
    iceLight: [0.86, 0.96],
    atmoHue: [198, 220],
    atmoSat: [0.6, 0.9],
    atmoLight: [0.55, 0.7],
    sea: [0.47, 0.55],
    iceEdge: [0.72, 0.86],
    cloud: [0.43, 0.52],
    cloudOpacity: [0.78, 0.94],
    ridge: [0.04, 0.1]
  },
  {
    id: 'verdant',
    name: 'VERDANT',
    weight: 1.1,
    waterHue: [170, 200],
    waterSat: [0.55, 0.78],
    waterLight: [0.11, 0.27],
    landHue: [95, 150],
    landSat: [0.35, 0.58],
    landLight: [0.26, 0.43],
    rockHue: [25, 55],
    rockSat: [0.12, 0.3],
    rockLight: [0.28, 0.52],
    beachHue: [38, 58],
    beachSat: [0.35, 0.52],
    beachLight: [0.62, 0.75],
    dryHue: [35, 58],
    drySat: [0.38, 0.55],
    dryLight: [0.5, 0.66],
    iceHue: [175, 200],
    iceSat: [0.05, 0.18],
    iceLight: [0.86, 0.96],
    atmoHue: [165, 195],
    atmoSat: [0.55, 0.85],
    atmoLight: [0.55, 0.7],
    sea: [0.46, 0.54],
    iceEdge: [0.76, 0.9],
    cloud: [0.48, 0.58],
    cloudOpacity: [0.8, 0.96],
    ridge: [0.04, 0.1]
  },
  {
    id: 'arid',
    name: 'ARID',
    weight: 1.0,
    waterHue: [190, 215],
    waterSat: [0.45, 0.68],
    waterLight: [0.1, 0.24],
    landHue: [22, 52],
    landSat: [0.4, 0.62],
    landLight: [0.34, 0.52],
    rockHue: [15, 40],
    rockSat: [0.18, 0.37],
    rockLight: [0.32, 0.55],
    beachHue: [35, 55],
    beachSat: [0.35, 0.55],
    beachLight: [0.66, 0.78],
    dryHue: [20, 45],
    drySat: [0.45, 0.64],
    dryLight: [0.52, 0.68],
    iceHue: [200, 220],
    iceSat: [0.04, 0.14],
    iceLight: [0.88, 0.97],
    atmoHue: [200, 225],
    atmoSat: [0.55, 0.8],
    atmoLight: [0.55, 0.7],
    sea: [0.4, 0.48],
    iceEdge: [0.84, 0.94],
    cloud: [0.32, 0.42],
    cloudOpacity: [0.6, 0.82],
    ridge: [0.03, 0.08]
  },
  {
    id: 'frozen',
    name: 'FROZEN',
    weight: 0.8,
    waterHue: [195, 220],
    waterSat: [0.4, 0.62],
    waterLight: [0.14, 0.28],
    landHue: [190, 220],
    landSat: [0.08, 0.2],
    landLight: [0.45, 0.62],
    rockHue: [200, 225],
    rockSat: [0.05, 0.15],
    rockLight: [0.4, 0.6],
    beachHue: [200, 220],
    beachSat: [0.05, 0.16],
    beachLight: [0.7, 0.82],
    dryHue: [200, 215],
    drySat: [0.05, 0.15],
    dryLight: [0.55, 0.7],
    iceHue: [195, 225],
    iceSat: [0.03, 0.1],
    iceLight: [0.9, 0.98],
    atmoHue: [195, 220],
    atmoSat: [0.45, 0.7],
    atmoLight: [0.6, 0.75],
    sea: [0.5, 0.58],
    iceEdge: [0.52, 0.66],
    cloud: [0.42, 0.56],
    cloudOpacity: [0.78, 0.95],
    ridge: [0.02, 0.06]
  },
  {
    id: 'volcanic',
    name: 'VOLCANIC',
    weight: 0.5,
    waterHue: [5, 25],
    waterSat: [0.8, 0.98],
    waterLight: [0.08, 0.22],
    landHue: [0, 25],
    landSat: [0.25, 0.5],
    landLight: [0.12, 0.28],
    rockHue: [0, 30],
    rockSat: [0.15, 0.35],
    rockLight: [0.18, 0.38],
    beachHue: [15, 35],
    beachSat: [0.5, 0.7],
    beachLight: [0.3, 0.45],
    dryHue: [0, 25],
    drySat: [0.3, 0.5],
    dryLight: [0.18, 0.32],
    iceHue: [200, 220],
    iceSat: [0.02, 0.08],
    iceLight: [0.9, 0.97],
    atmoHue: [5, 30],
    atmoSat: [0.8, 1.0],
    atmoLight: [0.55, 0.7],
    sea: [0.46, 0.54],
    iceEdge: [0.92, 0.99],
    cloud: [0.5, 0.68],
    cloudOpacity: [0.7, 0.9],
    ridge: [0.06, 0.14]
  },
  {
    id: 'toxic',
    name: 'TOXIC',
    weight: 0.6,
    waterHue: [70, 100],
    waterSat: [0.6, 0.85],
    waterLight: [0.1, 0.25],
    landHue: [70, 120],
    landSat: [0.35, 0.6],
    landLight: [0.25, 0.45],
    rockHue: [60, 95],
    rockSat: [0.2, 0.4],
    rockLight: [0.25, 0.45],
    beachHue: [70, 100],
    beachSat: [0.3, 0.5],
    beachLight: [0.55, 0.68],
    dryHue: [50, 80],
    drySat: [0.3, 0.5],
    dryLight: [0.45, 0.6],
    iceHue: [90, 120],
    iceSat: [0.08, 0.2],
    iceLight: [0.85, 0.95],
    atmoHue: [80, 110],
    atmoSat: [0.7, 0.95],
    atmoLight: [0.55, 0.7],
    sea: [0.45, 0.54],
    iceEdge: [0.82, 0.92],
    cloud: [0.55, 0.7],
    cloudOpacity: [0.8, 0.95],
    ridge: [0.04, 0.1]
  },
  {
    id: 'crystal',
    name: 'CRYSTALLINE',
    weight: 0.5,
    waterHue: [255, 290],
    waterSat: [0.6, 0.9],
    waterLight: [0.12, 0.28],
    landHue: [255, 300],
    landSat: [0.35, 0.65],
    landLight: [0.3, 0.5],
    rockHue: [260, 310],
    rockSat: [0.2, 0.45],
    rockLight: [0.3, 0.55],
    beachHue: [270, 310],
    beachSat: [0.2, 0.4],
    beachLight: [0.62, 0.76],
    dryHue: [250, 280],
    drySat: [0.2, 0.4],
    dryLight: [0.5, 0.65],
    iceHue: [250, 290],
    iceSat: [0.08, 0.2],
    iceLight: [0.86, 0.96],
    atmoHue: [260, 300],
    atmoSat: [0.7, 0.95],
    atmoLight: [0.58, 0.72],
    sea: [0.45, 0.53],
    iceEdge: [0.8, 0.9],
    cloud: [0.4, 0.55],
    cloudOpacity: [0.75, 0.92],
    ridge: [0.04, 0.12]
  },
  {
    id: 'oceanic',
    name: 'OCEANIC',
    weight: 0.9,
    waterHue: [190, 225],
    waterSat: [0.55, 0.78],
    waterLight: [0.1, 0.26],
    landHue: [140, 190],
    landSat: [0.3, 0.52],
    landLight: [0.28, 0.44],
    rockHue: [30, 60],
    rockSat: [0.1, 0.28],
    rockLight: [0.3, 0.52],
    beachHue: [40, 60],
    beachSat: [0.3, 0.5],
    beachLight: [0.64, 0.76],
    dryHue: [40, 60],
    drySat: [0.35, 0.52],
    dryLight: [0.5, 0.66],
    iceHue: [195, 220],
    iceSat: [0.04, 0.16],
    iceLight: [0.86, 0.96],
    atmoHue: [195, 220],
    atmoSat: [0.6, 0.9],
    atmoLight: [0.55, 0.7],
    sea: [0.62, 0.72],
    iceEdge: [0.76, 0.9],
    cloud: [0.5, 0.65],
    cloudOpacity: [0.8, 0.95],
    ridge: [0.03, 0.08]
  }
];

function pickBiome(random) {
  const total = BIOMES.reduce((sum, biome) => sum + biome.weight, 0);
  let value = random() * total;
  for (const biome of BIOMES) {
    value -= biome.weight;
    if (value <= 0) return biome;
  }
  return BIOMES[0];
}

const BIOME_BY_ID = Object.fromEntries(BIOMES.map((biome) => [biome.id, biome]));

function pickPlanetKind(value) {
  if (value < 0.14) return 'gas';
  if (value < 0.22) return 'lava';
  if (value < 0.34) return 'ocean';
  return 'terrestrial';
}

function makePalette(random, biome) {
  const range = (values) => lerp(values[0], values[1], random());
  const waterHue = range(biome.waterHue);
  const waterSat = range(biome.waterSat);
  const waterLight = range(biome.waterLight);
  const landHue = range(biome.landHue);
  const landSat = range(biome.landSat);
  const landLight = range(biome.landLight);
  const rockHue = range(biome.rockHue);
  const rockSat = range(biome.rockSat);
  const rockLight = range(biome.rockLight);
  const dryHue = range(biome.dryHue);
  const drySat = range(biome.drySat);
  const dryLight = range(biome.dryLight);

  const shallowLight = clamp(waterLight + 0.14 + random() * 0.1, 0.2, 0.55);
  const shoreLight = clamp(shallowLight + 0.1 + random() * 0.05, 0.32, 0.68);
  const midLight = clamp(landLight + 0.1 + random() * 0.06, 0.3, 0.66);
  const atmo = hsl(range(biome.atmoHue), range(biome.atmoSat), range(biome.atmoLight));

  const cloud =
    biome.id === 'volcanic'
      ? [198, 184, 172]
      : biome.id === 'toxic'
        ? [226, 237, 208]
        : biome.id === 'crystal'
          ? [242, 238, 255]
          : [246, 250, 255];

  return {
    id: biome.id,
    name: biome.name,
    biome,
    deep: hsl(waterHue, waterSat, waterLight),
    shallow: hsl(waterHue + 4, waterSat * 0.92, shallowLight),
    shore: hsl(waterHue + 10, waterSat * 0.72, shoreLight),
    beach: hsl(range(biome.beachHue), range(biome.beachSat), range(biome.beachLight)),
    low: hsl(landHue, landSat, landLight),
    mid: hsl(landHue + 12, landSat * 0.9, midLight),
    high: hsl(rockHue, rockSat, rockLight),
    rock: hsl(rockHue + 5, rockSat * 0.82, clamp(rockLight - 0.06, 0.18, 0.5)),
    peak: hsl(rockHue, 0.04 + random() * 0.06, 0.86 + random() * 0.07),
    dryLow: hsl(dryHue, drySat, dryLight),
    dryMid: hsl(dryHue + 10, drySat * 0.9, clamp(dryLight + 0.08, 0.35, 0.75)),
    tundra: hsl(landHue, 0.05 + random() * 0.05, 0.55 + random() * 0.1),
    ice: hsl(range(biome.iceHue), range(biome.iceSat), range(biome.iceLight)),
    cloud,
    atmo: [atmo[0] / 255, atmo[1] / 255, atmo[2] / 255]
  };
}

function makeGasPalette(random) {
  const families = [
    { hue: [28, 46], sat: [0.34, 0.54], light: [0.46, 0.62] },
    { hue: [188, 214], sat: [0.3, 0.5], light: [0.44, 0.6] },
    { hue: [8, 26], sat: [0.36, 0.56], light: [0.4, 0.56] },
    { hue: [266, 300], sat: [0.24, 0.44], light: [0.46, 0.62] },
    { hue: [172, 202], sat: [0.24, 0.44], light: [0.42, 0.58] }
  ];
  const family = families[Math.floor(random() * families.length)];
  const hue = lerp(family.hue[0], family.hue[1], random());
  const sat = lerp(family.sat[0], family.sat[1], random());
  const light = lerp(family.light[0], family.light[1], random());
  const stormCount = 1 + Math.floor(random() * 2);

  const storms = [];
  for (let i = 0; i < stormCount; i++) {
    storms.push({
      lat: (random() * 2 - 1) * 0.72,
      lon: random() * Math.PI * 2 - Math.PI,
      width: 0.16 + random() * 0.16,
      height: 0.06 + random() * 0.07,
      strength: 0.45 + random() * 0.35
    });
  }

  return {
    bands: 6 + Math.floor(random() * 8),
    turbulence: 0.45 + random() * 0.75,
    offset: { x: random() * 90, y: random() * 90, z: random() * 90 },
    colorA: hsl(hue, sat * 0.82, clamp(light + 0.1, 0.36, 0.78)),
    colorB: hsl(hue + 8, sat, light),
    colorC: hsl(hue - 14, sat * 1.06, clamp(light - 0.12, 0.12, 0.58)),
    pole: hsl(hue, sat * 0.6, clamp(light - 0.26, 0.08, 0.4)),
    spot: hsl(hue + 28 + random() * 28, sat * 0.92, clamp(light + 0.06, 0.26, 0.72)),
    atmo: (() => {
      const color = hsl(hue + 6, sat * 0.85, clamp(light + 0.04, 0.4, 0.78));
      return [color[0] / 255, color[1] / 255, color[2] / 255];
    })(),
    storms
  };
}


const setRGB = (out, color) => {
  out.r = color[0];
  out.g = color[1];
  out.b = color[2];
};

const mixRGB = (out, from, to, t) => {
  out.r = from[0] + (to[0] - from[0]) * t;
  out.g = from[1] + (to[1] - from[1]) * t;
  out.b = from[2] + (to[2] - from[2]) * t;
};

const blendRGB = (out, color, t) => {
  out.r += (color[0] - out.r) * t;
  out.g += (color[1] - out.g) * t;
  out.b += (color[2] - out.b) * t;
};

/* ------------------------------------------------------------------ */
/*  Planet parameters + texture generation                            */
/* ------------------------------------------------------------------ */

const STAR_TYPES = [
  { id: 'M', label: 'M DWARF', color: 0xff8d5f, weight: 2.0 },
  { id: 'K', label: 'K DWARF', color: 0xffbb7a, weight: 2.5 },
  { id: 'G', label: 'G DWARF', color: 0xfff1d6, weight: 3.0 },
  { id: 'F', label: 'F STAR', color: 0xd6e7ff, weight: 1.2 },
  { id: 'A', label: 'A STAR', color: 0xb9d4ff, weight: 0.4 }
];

function pickStarType(random) {
  const total = STAR_TYPES.reduce((sum, type) => sum + type.weight, 0);
  let value = random() * total;
  for (const type of STAR_TYPES) {
    value -= type.weight;
    if (value <= 0) return type;
  }
  return STAR_TYPES[0];
}

function makeStars(random) {
  const roll = random();
  const count = roll < 0.46 ? 1 : roll < 0.8 ? 2 : 3;
  const base = new THREE.Vector3(4.0, 2.2, -0.8).normalize();
  const yAxis = new THREE.Vector3(0, 1, 0);
  const sinPolar = Math.sin(START_VIEW.polar);
  const cameraDir = new THREE.Vector3(
    sinPolar * Math.sin(START_VIEW.azimuth),
    Math.cos(START_VIEW.polar),
    sinPolar * Math.cos(START_VIEW.azimuth)
  ).normalize();
  const viewDir = cameraDir.clone().negate();
  const side = new THREE.Vector3().crossVectors(viewDir, yAxis).normalize();
  const up = new THREE.Vector3().crossVectors(side, viewDir).normalize();
  const stars = [];

  for (let i = 0; i < count; i++) {
    const type = pickStarType(random);
    let direction;

    if (i === 0) {
      const angle = (random() * 2 - 1) * 0.42;
      direction = base.clone().applyAxisAngle(yAxis, angle);
      direction.y += random() * 0.28 - 0.14;
      direction.normalize();
    } else {
      const angle = 0.3 + random() * 0.12;
      const azimuth = (random() < 0.5 ? 0 : Math.PI) + (random() - 0.5) * 0.35;
      direction = viewDir
        .clone()
        .multiplyScalar(Math.cos(angle))
        .add(side.clone().multiplyScalar(Math.sin(angle) * Math.cos(azimuth)))
        .add(up.clone().multiplyScalar(Math.sin(angle) * Math.sin(azimuth)))
        .normalize();
    }

    stars.push({
      type,
      direction,
      intensity: i === 0 ? 2.2 + random() * 0.6 : i === 1 ? 0.5 + random() * 0.4 : 0.2 + random() * 0.3,
      size: i === 0 ? 6 + random() * 3 : i === 1 ? 3.5 + random() * 2 : 3 + random() * 1.5
    });
  }

  return {
    stars,
    label:
      count === 1
        ? stars[0].type.label
        : count === 2
          ? `BINARY ${stars.map((star) => star.type.id).join('+')}`
          : `TRINARY ${stars.map((star) => star.type.id).join('+')}`
  };
}

const RING_STYLES = [
  { id: 'ice', name: 'ICE', hue: [190, 225], sat: [0.06, 0.22], light: [0.78, 0.96] },
  { id: 'dust', name: 'DUST', hue: [30, 55], sat: [0.18, 0.38], light: [0.55, 0.78] },
  { id: 'gold', name: 'GOLD', hue: [40, 60], sat: [0.35, 0.55], light: [0.6, 0.8] },
  { id: 'rust', name: 'RUST', hue: [8, 32], sat: [0.35, 0.58], light: [0.42, 0.65] },
  { id: 'ember', name: 'EMBER', hue: [0, 25], sat: [0.5, 0.75], light: [0.45, 0.7] },
  { id: 'teal', name: 'TEAL', hue: [160, 195], sat: [0.25, 0.5], light: [0.5, 0.75] },
  { id: 'violet', name: 'VIOLET', hue: [260, 300], sat: [0.3, 0.55], light: [0.5, 0.75] },
  { id: 'charcoal', name: 'CHARCOAL', hue: [210, 250], sat: [0.04, 0.12], light: [0.2, 0.4] },
  { id: 'silver', name: 'SILVER', hue: [210, 235], sat: [0.03, 0.1], light: [0.72, 0.9] }
];

const RING_PREFERENCES = {
  frozen: ['ice', 'silver'],
  crystal: ['violet', 'ice'],
  volcanic: ['ember', 'rust'],
  toxic: ['teal', 'dust'],
  arid: ['dust', 'gold'],
  oceanic: ['ice', 'teal'],
  verdant: ['dust', 'ice'],
  terran: ['ice', 'dust']
};

function makeRingParams(random, palette) {
  const inner = 1.28 + random() * 0.2;
  const outer = inner + 0.45 + random() * 0.55;
  const preferred = RING_PREFERENCES[palette.biome.id] || ['ice', 'dust'];
  const pool = RING_STYLES.filter((entry) => preferred.includes(entry.id));
  const usePreferredPool = random() < 0.72;
  const finalPool = usePreferredPool ? pool : RING_STYLES;
  const style = finalPool[Math.floor(random() * finalPool.length)];
  const range = (values) => lerp(values[0], values[1], random());
  const hueA = range(style.hue);
  const hueB = hueA + 18 + random() * 52;
  const hueC = hueA - 22 - random() * 48;
  const satA = range(style.sat);
  const lightA = range(style.light);

  return {
    inner,
    outer,
    opacity: 0.2 + random() * 0.2,
    seed: random() * 1000,
    tilt: (random() * 2 - 1) * 0.06,
    style,
    colorA: hsl(hueA, satA, lightA),
    colorB: hsl(hueB, satA * 0.66, clamp(lightA * 0.58, 0.16, 0.78)),
    colorC: hsl(hueC, satA * 0.82, clamp(lightA * 0.9, 0.25, 0.92)),
    bandFrequency: 55 + random() * 50,
    gap: 0.42 + random() * 0.26,
    density: 0.55 + random() * 1.05,
    thickness: 0.008 + random() * 0.03,
    grain: 0.75 + random() * 0.5,
    brightness: 0.8 + random() * 0.4
  };
}

function makeMoonParams(random, palette) {
  const count = Math.floor(random() * 4);
  const moons = [];

  for (let i = 0; i < count; i++) {
    const icy = random() < 0.48;
    const base = icy ? palette.ice : palette.rock;
    const phaseOffset = i === 0 ? 0.95 : i === 1 ? -0.95 : 2.35;

    moons.push({
      size: 0.035 + random() * 0.05,
      distance: 1.35 + random() * 0.55,
      speed: (0.05 + random() * 0.16) * (random() < 0.5 ? -1 : 1),
      inclination: (random() * 2 - 1) * 0.8,
      phase: START_VIEW.azimuth + phaseOffset + (random() - 0.5) * 0.35,
      color: base.map((value) => clamp(value + (random() * 30 - 15), 0, 255)),
      seed: random() * 1000,
      icy
    });
  }

  return moons;
}

function makeNeighborParams(random) {
  const count = 1 + Math.floor(random() * 3);
  const neighbors = [];
  const sinPolar = Math.sin(START_VIEW.polar);
  const cameraDir = new THREE.Vector3(
    sinPolar * Math.sin(START_VIEW.azimuth),
    Math.cos(START_VIEW.polar),
    sinPolar * Math.cos(START_VIEW.azimuth)
  ).normalize();
  const viewDir = cameraDir.clone().negate();
  const side = new THREE.Vector3().crossVectors(viewDir, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(side, viewDir).normalize();

  for (let i = 0; i < count; i++) {
    const gas = random() < 0.36;
    const angle = 0.28 + random() * 0.17;
    const azimuth = (random() < 0.5 ? 0 : Math.PI) + (random() - 0.5) * 0.55;
    const distance = 95 + random() * 60;
    const direction = viewDir
      .clone()
      .multiplyScalar(Math.cos(angle))
      .add(side.clone().multiplyScalar(Math.sin(angle) * Math.cos(azimuth)))
      .add(up.clone().multiplyScalar(Math.sin(angle) * Math.sin(azimuth)))
      .normalize();

    neighbors.push({
      direction,
      distance,
      size: distance * (0.012 + random() * 0.01),
      gas,
      ringed: random() < (gas ? 0.45 : 0.14),
      ringTilt: (random() * 2 - 1) * 1.05,
      moon: random() < 0.36,
      moonAngle: random() * Math.PI * 2,
      moonDistance: 1.2 + random() * 0.25,
      moonSize: 0.055 + random() * 0.045,
      hue: random() * 360,
      seed: random() * 1000
    });
  }

  return neighbors;
}

function makePlanetParams(seed) {
  const hash = hashString(seed);
  const random = mulberry32(hash);
  const kindRandom = mulberry32((hash ^ 0x9e3779b9) >>> 0);
  const kind = pickPlanetKind(kindRandom());
  const gas = kind === 'gas' ? makeGasPalette(kindRandom) : null;

  let biome = pickBiome(random);
  if (kind === 'lava') biome = BIOME_BY_ID.volcanic;
  if (kind === 'ocean') biome = BIOME_BY_ID.oceanic;

  const palette = makePalette(random, biome);
  if (gas) palette.atmo = gas.atmo;

  const stars = makeStars(random);
  const ringChance = kind === 'gas' ? 0.74 : kind === 'ocean' ? 0.5 : biome.id === 'oceanic' ? 0.55 : 0.4;
  const rings = random() < ringChance ? makeRingParams(random, palette) : null;
  const moons = makeMoonParams(random, palette);
  const neighbors = makeNeighborParams(random);
  let seaLevel = lerp(biome.sea[0], biome.sea[1], random());
  let iceEdge = lerp(biome.iceEdge[0], biome.iceEdge[1], random());
  const cloudThreshold = lerp(biome.cloud[0], biome.cloud[1], random());
  let cloudOpacity = lerp(biome.cloudOpacity[0], biome.cloudOpacity[1], random());
  const ridgeStrength = lerp(biome.ridge[0], biome.ridge[1], random());

  // Draw order matters here: these values are produced in the same sequence as
  // before planet kinds existed, so terrestrial seeds keep their exact look.
  const axialTilt = (random() < 0.5 ? -1 : 1) * (0.14 + random() * 0.18);
  let continentScale = 1.05 + random() * 0.65;
  const detailScale = 3.6 + random() * 2.2;
  const warpStrength = 0.08 + random() * 0.12;
  const cloudScale = 2.6 + random() * 1.8;
  const cloudBand = random() * Math.PI * 2;
  const noiseSeed = Math.floor(random() * 0xffffffff);
  const warpOffset = { x: random() * 100, y: random() * 100, z: random() * 100 };
  const terrainOffset = { x: random() * 100, y: random() * 100, z: random() * 100 };
  const cloudOffset = { x: random() * 100, y: random() * 100, z: random() * 100 };
  const moistureOffset = { x: random() * 100, y: random() * 100, z: random() * 100 };

  if (kind === 'ocean') {
    seaLevel = 0.66 + kindRandom() * 0.08;
    iceEdge = clamp(0.74 + kindRandom() * 0.12, 0.4, 0.97);
    continentScale = 1.9 + kindRandom() * 0.9;
  } else if (kind === 'lava') {
    seaLevel = 0.4 + kindRandom() * 0.1;
    cloudOpacity *= 0.55;
  } else if (kind === 'gas') {
    cloudOpacity *= 0.45;
  }

  return {
    seed,
    hash,
    kind,
    gas,
    biome,
    palette,
    stars: stars.stars,
    starLabel: stars.label,
    rings,
    moons,
    neighbors,
    seaLevel,
    iceEdge: clamp(iceEdge, 0.4, 0.97),
    axialTilt,
    continentScale,
    detailScale,
    warpStrength,
    ridgeStrength,
    cloudScale,
    cloudThreshold,
    cloudOpacity,
    cloudBand,
    noiseSeed,
    warpOffset,
    terrainOffset,
    cloudOffset,
    moistureOffset
  };
}


function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

const nextTick = () =>
  new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close();
      resolve();
    };
    channel.port2.postMessage(null);
  });

async function buildPlanetTextures(params, onProgress) {
  const width = TEXTURE_WIDTH;
  const height = TEXTURE_HEIGHT;
  const total = width * height;
  const noise = makeNoise3(mulberry32(params.noiseSeed));
  const heightData = new Float32Array(total);
  const iceData = new Float32Array(total);
  const moistureData = new Float32Array(total);
  const crackData = params.kind === 'lava' ? new Float32Array(total) : null;
  const colorCanvas = makeCanvas(width, height);
  const heightCanvas = makeCanvas(width, height);
  const roughnessCanvas = makeCanvas(width, height);
  const emissiveCanvas = params.kind === 'lava' ? makeCanvas(width, height) : null;
  const colorCtx = colorCanvas.getContext('2d');
  const heightCtx = heightCanvas.getContext('2d');
  const roughnessCtx = roughnessCanvas.getContext('2d');
  const emissiveCtx = emissiveCanvas ? emissiveCanvas.getContext('2d') : null;

  let oceanCount = 0;
  let iceCount = 0;

  for (let y = 0; y < height; y++) {
    const lat = Math.PI / 2 - ((y + 0.5) / height) * Math.PI;
    const cosLat = Math.cos(lat);
    const sinLat = Math.sin(lat);

    for (let x = 0; x < width; x++) {
      const lon = ((x + 0.5) / width) * Math.PI * 2 - Math.PI;
      const px = cosLat * Math.cos(lon);
      const py = sinLat;
      const pz = cosLat * Math.sin(lon);

      const warp = fbm(
        noise,
        px * 1.35 + params.warpOffset.x,
        py * 1.35 + params.warpOffset.y,
        pz * 1.35 + params.warpOffset.z,
        3
      );

      const qx = px + warp * params.warpStrength;
      const qy = py + warp * params.warpStrength * 0.75;
      const qz = pz + warp * params.warpStrength * 0.55;

      const base = fbm(
        noise,
        qx * params.continentScale + params.terrainOffset.x,
        qy * params.continentScale + params.terrainOffset.y,
        qz * params.continentScale + params.terrainOffset.z,
        5
      );

      const detail = fbm(
        noise,
        qx * params.detailScale + params.terrainOffset.x * 2.1,
        qy * params.detailScale + params.terrainOffset.y * 2.1,
        qz * params.detailScale + params.terrainOffset.z * 2.1,
        3
      );

      let h = 0.5 + base * 0.7 + detail * 0.17;
      let ridgeValue = 0;

      if (h > params.seaLevel) {
        ridgeValue = 1 - Math.abs(
          fbm(
            noise,
            qx * params.detailScale * 1.65 + 31.7,
            qy * params.detailScale * 1.65 + 18.4,
            qz * params.detailScale * 1.65 + 7.9,
            3
          )
        );
        h += ridgeValue * params.ridgeStrength * smoothstep(params.seaLevel, params.seaLevel + 0.14, h);
      }

      h = clamp(h, 0, 1);

      const absLat = Math.abs(lat) / (Math.PI / 2);
      const iceWobble = detail * 0.065;
      const ice = smoothstep(
        params.iceEdge + iceWobble,
        params.iceEdge + iceWobble + 0.065,
        absLat
      );

      const moisture = clamp(
        0.5 +
          fbm(
            noise,
            qx * 2.15 + params.moistureOffset.x,
            qy * 2.15 + params.moistureOffset.y,
            qz * 2.15 + params.moistureOffset.z,
            3
          ) *
            0.9,
        0,
        1
      );

      const index = y * width + x;
      heightData[index] = h;
      iceData[index] = ice;
      moistureData[index] = moisture;
      if (crackData) crackData[index] = ridgeValue;

      if (h < params.seaLevel) oceanCount++;
      if (ice > 0.35) iceCount++;
    }

    if ((y & 31) === 0) {
      onProgress((y / height) * 0.54);
      await nextTick();
    }
  }

  /* --- colour + bump map --- */
  const colorImage = colorCtx.createImageData(width, height);
  const heightImage = heightCtx.createImageData(width, height);
  const roughnessImage = roughnessCtx.createImageData(width, height);
  const emissiveImage = emissiveCtx ? emissiveCtx.createImageData(width, height) : null;
  const colorData = colorImage.data;
  const bumpData = heightImage.data;
  const roughnessData = roughnessImage.data;
  const emissiveData = emissiveImage ? emissiveImage.data : null;
  const palette = params.palette;
  const sea = params.seaLevel;
  const col = { r: 0, g: 0, b: 0 };

  for (let y = 0; y < height; y++) {
    const lat = Math.PI / 2 - ((y + 0.5) / height) * Math.PI;
    const absLat = Math.abs(lat) / (Math.PI / 2);

    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      const h = heightData[index];
      const ice = iceData[index];
      const moisture = moistureData[index];
      const aridity = 1 - smoothstep(0.3, 0.64, moisture);
      const tundra = smoothstep(0.6, 0.82, absLat) * (1 - ice) * 0.32;

      const left = y * width + (x === 0 ? width - 1 : x - 1);
      const right = y * width + (x === width - 1 ? 0 : x + 1);
      const up = (y === 0 ? y : y - 1) * width + x;
      const down = (y === height - 1 ? y : y + 1) * width + x;
      const slope = clamp(
        Math.hypot(heightData[right] - heightData[left], heightData[down] - heightData[up]) * 7,
        0,
        1
      );

      if (h < sea) {
        const depth = Math.pow(clamp(h / sea, 0, 1), 0.78);
        mixRGB(col, palette.deep, palette.shallow, depth);
        if (h > sea - 0.022) {
          blendRGB(col, palette.shore, smoothstep(sea - 0.022, sea, h));
        }
      } else {
        const land = clamp((h - sea) / (1 - sea), 0, 1);

        if (land < 0.05) {
          setRGB(col, palette.beach);
        } else if (land < 0.28) {
          mixRGB(col, palette.beach, palette.low, smoothstep(0.05, 0.2, land));
          blendRGB(col, palette.dryLow, aridity * 0.82);
        } else if (land < 0.58) {
          mixRGB(col, palette.low, palette.mid, smoothstep(0.28, 0.52, land));
          blendRGB(col, palette.dryMid, aridity * 0.88);
        } else if (land < 0.8) {
          mixRGB(col, palette.mid, palette.high, smoothstep(0.58, 0.76, land));
        } else {
          mixRGB(col, palette.high, palette.peak, smoothstep(0.8, 0.97, land));
        }

        if (tundra > 0) {
          blendRGB(col, palette.tundra, tundra * (1 - smoothstep(0.55, 0.85, land)));
        }

        const rockAmount = slope * (0.22 + 0.34 * Math.min(1, land * 1.25));
        blendRGB(col, palette.rock, rockAmount);

        if (land > 0.78) {
          blendRGB(col, palette.peak, smoothstep(0.78, 0.97, land));
        }
      }

      blendRGB(col, palette.ice, ice * 0.96);

      const offset = index * 4;
      colorData[offset] = Math.round(clamp(col.r, 0, 255));
      colorData[offset + 1] = Math.round(clamp(col.g, 0, 255));
      colorData[offset + 2] = Math.round(clamp(col.b, 0, 255));
      colorData[offset + 3] = 255;

      const bump = Math.round(h * 255);
      bumpData[offset] = bump;
      bumpData[offset + 1] = bump;
      bumpData[offset + 2] = bump;
      bumpData[offset + 3] = 255;

      // Water is smooth enough to catch a sun glint, land stays matte.
      const roughness = h < sea ? 0.14 + clamp(h / sea, 0, 1) * 0.15 : 0.84 + slope * 0.14;
      const roughnessByte = Math.round(clamp(roughness, 0, 1) * 255);
      roughnessData[offset] = roughnessByte;
      roughnessData[offset + 1] = roughnessByte;
      roughnessData[offset + 2] = roughnessByte;
      roughnessData[offset + 3] = 255;

      if (emissiveData) {
        let glow = 0;
        if (h >= sea) {
          const crack = crackData[index];
          glow =
            smoothstep(0.945, 0.996, crack) * smoothstep(sea, sea + 0.03, h) +
            smoothstep(0.78, 0.98, crack) * 0.05 * smoothstep(sea, sea + 0.07, h);
        } else {
          glow = smoothstep(sea - 0.045, sea, h) * 0.3;
        }
        glow = clamp(glow, 0, 1);
        emissiveData[offset] = Math.round(255 * glow);
        emissiveData[offset + 1] = Math.round(148 * glow);
        emissiveData[offset + 2] = Math.round(56 * glow);
        emissiveData[offset + 3] = 255;
      }
    }

    if ((y & 31) === 0) {
      onProgress(0.54 + (y / height) * 0.28);
      await nextTick();
    }
  }

  colorCtx.putImageData(colorImage, 0, 0);
  heightCtx.putImageData(heightImage, 0, 0);
  roughnessCtx.putImageData(roughnessImage, 0, 0);
  if (emissiveCtx) emissiveCtx.putImageData(emissiveImage, 0, 0);

  /* --- cloud map --- */
  const cloudWidth = Math.round(width * 0.55);
  const cloudHeight = Math.round(height * 0.55);
  const cloudCanvas = makeCanvas(cloudWidth, cloudHeight);
  const cloudCtx = cloudCanvas.getContext('2d');
  const cloudImage = cloudCtx.createImageData(cloudWidth, cloudHeight);
  const cloudData = cloudImage.data;
  let cloudCount = 0;

  for (let y = 0; y < cloudHeight; y++) {
    const lat = Math.PI / 2 - ((y + 0.5) / cloudHeight) * Math.PI;
    const cosLat = Math.cos(lat);
    const sinLat = Math.sin(lat);

    for (let x = 0; x < cloudWidth; x++) {
      const lon = ((x + 0.5) / cloudWidth) * Math.PI * 2 - Math.PI;
      const px = cosLat * Math.cos(lon);
      const py = sinLat;
      const pz = cosLat * Math.sin(lon);

      const qx = px * params.cloudScale + params.cloudOffset.x;
      const qy = py * params.cloudScale + params.cloudOffset.y;
      const qz = pz * params.cloudScale + params.cloudOffset.z;

      const base = fbm(noise, qx, qy, qz, 5);
      const wisp = fbm(noise, qx * 2.4 + 13.1, qy * 2.4 + 7.7, qz * 2.4 + 3.9, 3);
      const value = 0.5 + base * 0.58 + wisp * 0.2;
      const band = 0.72 + 0.28 * (0.5 + 0.5 * Math.sin(lat * 5.5 + params.cloudBand));
      const alpha = clamp(
        smoothstep(params.cloudThreshold, params.cloudThreshold + 0.17, value) * band,
        0,
        1
      );

      const offset = (y * cloudWidth + x) * 4;
      cloudData[offset] = 246;
      cloudData[offset + 1] = 250;
      cloudData[offset + 2] = 255;
      cloudData[offset + 3] = Math.round(alpha * 238);

      if (alpha > 0.16) cloudCount++;
    }

    if ((y & 31) === 0) {
      onProgress(0.82 + (y / cloudHeight) * 0.17);
      await nextTick();
    }
  }

  cloudCtx.putImageData(cloudImage, 0, 0);

  const ocean = (oceanCount / total) * 100;
  const ice = (iceCount / total) * 100;
  const clouds = (cloudCount / (cloudWidth * cloudHeight)) * 100;

  onProgress(1);

  return {
    colorCanvas,
    heightCanvas,
    roughnessCanvas,
    emissiveCanvas,
    cloudCanvas,
    stats: {
      ocean,
      ice,
      clouds,
      class: classifyPlanet(ocean, ice, params)
    }
  };
}

/* --- gas giant surface: banded, turbulent, no terrain --- */

async function buildGasTextures(params, onProgress) {
  const width = Math.round(TEXTURE_WIDTH * 0.75);
  const height = Math.round(width / 2);
  const noise = makeNoise3(mulberry32((params.noiseSeed ^ 0x5f356495) >>> 0));
  const gas = params.gas;
  const colorCanvas = makeCanvas(width, height);
  const colorCtx = colorCanvas.getContext('2d');
  const colorImage = colorCtx.createImageData(width, height);
  const colorData = colorImage.data;
  const cloudWidth = Math.round(width * 0.5);
  const cloudHeight = Math.round(height * 0.5);
  const cloudCanvas = makeCanvas(cloudWidth, cloudHeight);
  const cloudCtx = cloudCanvas.getContext('2d');
  const cloudImage = cloudCtx.createImageData(cloudWidth, cloudHeight);
  const cloudData = cloudImage.data;
  const col = { r: 0, g: 0, b: 0 };
  const offset = gas.offset;

  for (let y = 0; y < height; y++) {
    const lat = Math.PI / 2 - ((y + 0.5) / height) * Math.PI;
    const cosLat = Math.cos(lat);
    const sinLat = Math.sin(lat);
    const absLat = Math.abs(lat) / (Math.PI / 2);

    for (let x = 0; x < width; x++) {
      const lon = ((x + 0.5) / width) * Math.PI * 2 - Math.PI;
      const px = cosLat * Math.cos(lon);
      const py = sinLat;
      const pz = cosLat * Math.sin(lon);

      const swirl = fbm(
        noise,
        px * 1.45 + offset.x,
        py * 1.45 + offset.y,
        pz * 1.45 + offset.z,
        4
      );
      const fine = fbm(
        noise,
        px * 5.2 + offset.z,
        py * 5.2 + offset.x,
        pz * 5.2 + offset.y,
        3
      );
      const streak = fbm(
        noise,
        px * 2.3 + 13.7,
        py * 8.4 + offset.y,
        pz * 2.3 + 4.1,
        3
      );

      const warp = swirl * gas.turbulence * 1.15;
      const phase = lat * gas.bands * 2.05;
      const shade =
        Math.sin(phase + warp) * 0.56 +
        Math.sin(phase * 2.31 + warp * 1.6 + 1.9) * 0.28 +
        Math.sin(phase * 4.9 + warp * 2.2 + 0.6) * 0.16;
      const belt = smoothstep(-0.82, 0.82, shade);

      if (belt < 0.5) {
        mixRGB(col, gas.colorC, gas.colorB, belt * 2);
      } else {
        mixRGB(col, gas.colorB, gas.colorA, (belt - 0.5) * 2);
      }

      const grain = 0.9 + (0.5 + 0.5 * fine) * 0.12 + streak * 0.07;
      col.r *= grain;
      col.g *= grain;
      col.b *= grain;
      blendRGB(col, gas.colorB, Math.max(0, streak) * 0.06);

      blendRGB(col, gas.pole, smoothstep(0.64, 0.98, absLat) * 0.62);

      for (const storm of gas.storms) {
        let deltaLon = Math.abs(lon - storm.lon);
        if (deltaLon > Math.PI) deltaLon = Math.PI * 2 - deltaLon;
        const dx = (deltaLon * Math.cos(lat)) / storm.width;
        const dy = (lat - storm.lat) / storm.height;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < 1.5) {
          const falloff = Math.pow(1 - clamp(distance / 1.5, 0, 1), 1.5) * storm.strength;
          blendRGB(col, gas.spot, falloff);
        }
      }

      const index = (y * width + x) * 4;
      colorData[index] = Math.round(clamp(col.r, 0, 255));
      colorData[index + 1] = Math.round(clamp(col.g, 0, 255));
      colorData[index + 2] = Math.round(clamp(col.b, 0, 255));
      colorData[index + 3] = 255;
    }

    if ((y & 31) === 0) {
      onProgress((y / height) * 0.84);
      await nextTick();
    }
  }

  colorCtx.putImageData(colorImage, 0, 0);

  for (let y = 0; y < cloudHeight; y++) {
    const lat = Math.PI / 2 - ((y + 0.5) / cloudHeight) * Math.PI;
    const cosLat = Math.cos(lat);
    const sinLat = Math.sin(lat);

    for (let x = 0; x < cloudWidth; x++) {
      const lon = ((x + 0.5) / cloudWidth) * Math.PI * 2 - Math.PI;
      const px = cosLat * Math.cos(lon);
      const py = sinLat;
      const pz = cosLat * Math.sin(lon);
      const value =
        0.5 +
        fbm(noise, px * 3.1 + offset.y, py * 3.1 + offset.z, pz * 3.1 + offset.x, 3) * 0.75;
      const alpha = smoothstep(0.62, 0.9, value) * 0.55;
      const index = (y * cloudWidth + x) * 4;
      cloudData[index] = 255;
      cloudData[index + 1] = 252;
      cloudData[index + 2] = 246;
      cloudData[index + 3] = Math.round(alpha * 255);
    }
  }

  cloudCtx.putImageData(cloudImage, 0, 0);
  onProgress(1);

  return {
    colorCanvas,
    heightCanvas: null,
    roughnessCanvas: null,
    emissiveCanvas: null,
    cloudCanvas,
    stats: {
      ocean: 0,
      ice: 0,
      clouds: 100,
      class: 'GAS GIANT'
    }
  };
}

function classifyPlanet(ocean, ice, params) {
  if (params.kind === 'gas') return 'GAS GIANT';
  if (params.kind === 'lava') return 'LAVA WORLD';
  if (params.kind === 'ocean') return 'OCEAN WORLD';
  if (params.biome.id === 'frozen') return 'FROZEN';
  if (ice > 36) return 'GLACIAL';
  if (params.biome.id === 'volcanic') return 'VOLCANIC';
  if (params.biome.id === 'toxic') return 'TOXIC';
  if (params.biome.id === 'crystal') return 'CRYSTALLINE';
  if (params.biome.id === 'arid') return 'ARID';
  if (ocean > 72 && params.biome.id !== 'oceanic') return 'OCEANIC';
  return params.biome.name;
}

/* ------------------------------------------------------------------ */
/*  Three.js scene                                                    */
/* ------------------------------------------------------------------ */

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.05, 400);

// The canvas is styled to fill the viewport with CSS. Reading its layout size
// keeps the drawing buffer in sync with what is actually displayed, which is
// what browsers report differently while entering/leaving fullscreen.
function viewportSize() {
  const canvas = ui.canvas;
  const width = canvas.clientWidth || window.innerWidth;
  const height = canvas.clientHeight || window.innerHeight;
  return { width, height };
}

function updateProjection() {
  const { width, height } = viewportSize();
  const aspect = width / Math.max(1, height);
  camera.aspect = aspect;
  const baseFov = (38 * Math.PI) / 180;
  camera.fov =
    aspect < 1
      ? (2 * Math.atan(Math.tan(baseFov / 2) / aspect) * 180) / Math.PI
      : 38;
  camera.updateProjectionMatrix();
}

updateProjection();

let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas: ui.canvas,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance'
  });
} catch (error) {
  document.body.innerHTML = '<p style="color:#e9f2f8;font:16px system-ui;padding:40px">This browser does not support WebGL, which Planet Forge needs.</p>';
  throw error;
}

renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
// Keep CSS sizing (100% of the viewport) instead of pixel sizes so the canvas
// scales correctly when the window or fullscreen size changes.
ui.canvas.style.width = '';
ui.canvas.style.height = '';
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const maxAnisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* --- lights --- */
const starLights = [0, 1, 2].map(() => {
  const light = new THREE.DirectionalLight(0xffffff, 0);
  light.visible = false;
  scene.add(light);
  scene.add(light.target);
  return light;
});

const fillLight = new THREE.DirectionalLight(0x5d8fba, 0.8);
fillLight.position.set(-4, 1, -3);
scene.add(fillLight);

const hemiLight = new THREE.HemisphereLight(0x6f9fc4, 0x070a0f, 1.15);
scene.add(hemiLight);

/* --- planet --- */
const world = new THREE.Group();
world.rotation.z = 0.1;
scene.add(world);

let ringParticles = null;
const moonPivots = [];
const neighborGroup = new THREE.Group();
const neighborBodies = [];
scene.add(neighborGroup);

const planetGeometry = new THREE.SphereGeometry(1, isSmallScreen ? 160 : 224, isSmallScreen ? 80 : 112);
const planetMaterial = new THREE.MeshStandardMaterial({
  roughness: 0.93,
  metalness: 0.02,
  bumpScale: 0.045,
  displacementScale: 0.04,
  displacementBias: -0.012
});

const planetRingShadow = {
  inner: { value: 0 },
  outer: { value: 0 },
  normal: { value: new THREE.Vector3(0, 1, 0) },
  sun: { value: new THREE.Vector3(1, 0, 0) },
  strength: { value: 0 }
};

const lavaGlow = {
  strength: { value: 0 },
  sun: { value: new THREE.Vector3(1, 0, 0) }
};

planetMaterial.onBeforeCompile = (shader) => {
  shader.uniforms.uRingInner = planetRingShadow.inner;
  shader.uniforms.uRingOuter = planetRingShadow.outer;
  shader.uniforms.uRingNormal = planetRingShadow.normal;
  shader.uniforms.uRingSunDirection = planetRingShadow.sun;
  shader.uniforms.uRingShadowStrength = planetRingShadow.strength;
  shader.uniforms.uGlowStrength = lavaGlow.strength;
  shader.uniforms.uGlowSunDirection = lavaGlow.sun;

  shader.vertexShader = shader.vertexShader
    .replace(
      '#include <common>',
      '#include <common>\nvarying vec3 vPlanetWorldPosition;\nvarying vec3 vPlanetWorldNormal;'
    )
    .replace(
      '#include <beginnormal_vertex>',
      '#include <beginnormal_vertex>\nvPlanetWorldNormal = normalize(mat3(modelMatrix) * objectNormal);'
    )
    .replace(
      '#include <displacementmap_vertex>',
      '#include <displacementmap_vertex>\nvPlanetWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;'
    );

  shader.fragmentShader = shader.fragmentShader
    .replace(
      '#include <common>',
      `#include <common>
      varying vec3 vPlanetWorldPosition;
      varying vec3 vPlanetWorldNormal;
      uniform float uRingInner;
      uniform float uRingOuter;
      uniform vec3 uRingNormal;
      uniform vec3 uRingSunDirection;
      uniform float uRingShadowStrength;
      uniform float uGlowStrength;
      uniform vec3 uGlowSunDirection;`
    )
    .replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      if (uGlowStrength > 0.0) {
        float facing = dot(normalize(vPlanetWorldNormal), normalize(uGlowSunDirection));
        float nightSide = smoothstep(0.16, -0.24, facing);
        totalEmissiveRadiance *= mix(0.1, 1.0, nightSide);
      }`
    )
    .replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      if (uRingShadowStrength > 0.0) {
        vec3 sunDirection = normalize(uRingSunDirection);
        float denominator = dot(sunDirection, uRingNormal);
        if (abs(denominator) > 0.0001) {
          float t = -dot(vPlanetWorldPosition, uRingNormal) / denominator;
          if (t > 0.0) {
            vec3 hit = vPlanetWorldPosition + sunDirection * t;
            float radius = length(hit);
            float inside = smoothstep(uRingInner, uRingInner + 0.035, radius)
              * (1.0 - smoothstep(uRingOuter - 0.035, uRingOuter, radius));
            diffuseColor.rgb *= 1.0 - inside * uRingShadowStrength;
          }
        }
      }`
    );
};
const planet = new THREE.Mesh(planetGeometry, planetMaterial);
planet.renderOrder = 0;
world.add(planet);

/* --- clouds --- */
const cloudGeometry = new THREE.SphereGeometry(1.013, isSmallScreen ? 96 : 144, isSmallScreen ? 48 : 72);
const cloudMaterial = new THREE.MeshStandardMaterial({
  transparent: true,
  opacity: 0.9,
  depthWrite: false,
  roughness: 1,
  metalness: 0
});
const clouds = new THREE.Mesh(cloudGeometry, cloudMaterial);
clouds.renderOrder = 1;
world.add(clouds);

/* Atmosphere is a soft billboard halo, added after the glow texture below. */

/* --- stars --- */
function makeStarfield() {
  const count = isSmallScreen ? 3600 : 7600;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const twinkleSpeeds = new Float32Array(count);
  const random = mulberry32(0x51a7c0de);
  const bandMatrix = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.55, -0.3, 0.18));
  const temp = new THREE.Vector3();

  for (let i = 0; i < count; i++) {
    const inBand = random() < 0.36;
    const radius = 55 + random() * 50;

    if (inBand) {
      const angle = random() * Math.PI * 2;
      const spread = gaussian(random) * 0.1 * radius;
      temp.set(Math.cos(angle) * radius, spread, Math.sin(angle) * radius);
      temp.applyMatrix4(bandMatrix);
    } else {
      const u = random() * 2 - 1;
      const theta = random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      temp.set(s * Math.cos(theta) * radius, u * radius, s * Math.sin(theta) * radius);
    }

    positions[i * 3] = temp.x;
    positions[i * 3 + 1] = temp.y;
    positions[i * 3 + 2] = temp.z;

    const warm = random() < 0.14;
    const brightness = 0.55 + random() * 0.45;
    let r = 0.82 + random() * 0.18;
    let g = 0.88 + random() * 0.12;
    let b = 1.0;

    if (warm) {
      r = 1.0;
      g = 0.78 + random() * 0.14;
      b = 0.56 + random() * 0.18;
    }

    colors[i * 3] = r * brightness;
    colors[i * 3 + 1] = g * brightness;
    colors[i * 3 + 2] = b * brightness;

    const bright = random() < 0.018;
    sizes[i] = bright ? 2.1 + random() * 1.5 : 0.45 + random() * 1.05;

    phases[i] = random() * Math.PI * 2;
    twinkleSpeeds[i] = 0.55 + random() * 1.6;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute('aTwinkleSpeed', new THREE.BufferAttribute(twinkleSpeeds, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uPixelRatio: { value: renderer.getPixelRatio() },
      uTime: { value: 0 },
      uMotion: { value: 0 }
    },
    vertexShader: `
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aPhase;
      attribute float aTwinkleSpeed;
      uniform float uPixelRatio;
      uniform float uTime;
      uniform float uMotion;
      varying vec3 vColor;
      varying float vTwinkle;

      void main() {
        vColor = aColor;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float pulse = 0.82 + 0.18 * sin(uTime * aTwinkleSpeed + aPhase);
        vTwinkle = mix(1.0, pulse, uMotion);
        gl_PointSize = aSize * uPixelRatio * (160.0 / max(1.0, -mvPosition.z));
        gl_PointSize *= mix(1.0, 0.92 + 0.08 * pulse, uMotion);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vTwinkle;

      void main() {
        vec2 centered = gl_PointCoord - vec2(0.5);
        float distanceToCenter = length(centered);
        if (distanceToCenter > 0.5) discard;
        float alpha = smoothstep(0.5, 0.04, distanceToCenter);
        gl_FragColor = vec4(vColor * vTwinkle, alpha * vTwinkle);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const stars = new THREE.Points(geometry, material);
  stars.frustumCulled = false;
  return { stars, material };
}

const { stars, material: starMaterial } = makeStarfield();
scene.add(stars);

/* --- shooting stars (only while star motion is on) --- */

function makeStreakTexture() {
  const canvas = makeCanvas(256, 16);
  const ctx = canvas.getContext('2d');
  const horizontal = ctx.createLinearGradient(0, 0, 256, 0);
  horizontal.addColorStop(0, 'rgba(190, 220, 255, 0)');
  horizontal.addColorStop(0.62, 'rgba(214, 234, 255, 0.55)');
  horizontal.addColorStop(1, 'rgba(255, 255, 255, 1)');
  ctx.fillStyle = horizontal;
  ctx.fillRect(0, 0, 256, 16);
  const vertical = ctx.createLinearGradient(0, 0, 0, 16);
  vertical.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vertical.addColorStop(0.5, 'rgba(0, 0, 0, 1)');
  vertical.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = vertical;
  ctx.fillRect(0, 0, 256, 16);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const streakTexture = makeStreakTexture();
const meteors = Array.from({ length: 3 }, () => {
  const material = new THREE.MeshBasicMaterial({
    map: streakTexture,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0,
    side: THREE.DoubleSide,
    toneMapped: false
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  mesh.frustumCulled = false;
  mesh.matrixAutoUpdate = false;
  mesh.visible = false;
  scene.add(mesh);
  return {
    mesh,
    material,
    active: false,
    progress: 0,
    duration: 1,
    travel: 30,
    start: new THREE.Vector3(),
    direction: new THREE.Vector3(),
    scale: new THREE.Vector3()
  };
});

const meteorState = {
  timer: 2.5,
  forward: new THREE.Vector3(),
  right: new THREE.Vector3(),
  up: new THREE.Vector3(),
  toCamera: new THREE.Vector3(),
  xAxis: new THREE.Vector3(),
  yAxis: new THREE.Vector3(),
  zAxis: new THREE.Vector3(),
  scaleX: new THREE.Vector3(),
  scaleY: new THREE.Vector3(),
  position: new THREE.Vector3()
};

function spawnMeteor() {
  const meteor = meteors.find((entry) => !entry.active) || meteors[0];
  const state = meteorState;

  camera.getWorldDirection(state.forward);
  state.right.crossVectors(camera.up, state.forward).normalize();
  state.up.crossVectors(state.forward, state.right).normalize();

  const offsetX = (Math.random() * 2 - 1) * 0.75;
  const offsetY = (Math.random() * 2 - 1) * 0.5;
  meteor.start
    .copy(camera.position)
    .addScaledVector(state.forward, 58)
    .addScaledVector(state.right, offsetX * 42)
    .addScaledVector(state.up, offsetY * 30);

  const angle = Math.PI * (0.75 + Math.random() * 0.45);
  meteor.direction
    .copy(state.right)
    .multiplyScalar(Math.cos(angle))
    .addScaledVector(state.up, Math.sin(angle))
    .normalize();

  meteor.progress = 0;
  meteor.duration = 0.75 + Math.random() * 0.65;
  meteor.travel = 26 + Math.random() * 22;
  meteor.active = true;
  meteor.mesh.visible = true;
  meteor.material.opacity = 0;
}

function updateMeteors(dt, amount) {
  if (amount > 0.35) {
    meteorState.timer -= dt;
    if (meteorState.timer <= 0) {
      spawnMeteor();
      meteorState.timer = 5 + Math.random() * 9;
    }
  }

  for (const meteor of meteors) {
    if (!meteor.active) continue;

    meteor.progress += dt / meteor.duration;
    if (meteor.progress >= 1) {
      meteor.active = false;
      meteor.mesh.visible = false;
      meteor.material.opacity = 0;
      continue;
    }

    const eased = meteor.progress;
    meteorState.position
      .copy(meteor.start)
      .addScaledVector(meteor.direction, meteor.travel * eased);

    const fade = Math.sin(Math.PI * Math.min(1, meteor.progress)) ** 1.3;
    meteor.material.opacity = fade * 0.85 * amount;

    meteorState.toCamera.copy(camera.position).sub(meteorState.position).normalize();
    meteorState.xAxis.copy(meteor.direction);
    meteorState.yAxis.crossVectors(meteorState.toCamera, meteorState.xAxis).normalize();
    meteorState.zAxis.crossVectors(meteorState.xAxis, meteorState.yAxis).normalize();

    const length = 9 + eased * 7;
    const width = 0.55;
    meteorState.scaleX.copy(meteorState.xAxis).multiplyScalar(length);
    meteorState.scaleY.copy(meteorState.yAxis).multiplyScalar(width);
    meteor.mesh.matrix.makeBasis(
      meteorState.scaleX,
      meteorState.scaleY,
      meteorState.zAxis
    );
    meteor.mesh.matrix.setPosition(meteorState.position);
  }
}

/* --- distant sun --- */
function makeGlowTexture() {
  const canvas = makeCanvas(256, 256);
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.04, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.12, 'rgba(255, 255, 255, 0.9)');
  gradient.addColorStop(0.28, 'rgba(255, 255, 255, 0.35)');
  gradient.addColorStop(0.55, 'rgba(255, 255, 255, 0.06)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const glowTexture = makeGlowTexture();

const starSprites = [0, 1, 2].map(() => {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0xffffff,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  sprite.visible = false;
  scene.add(sprite);

  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0xffffff,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  halo.visible = false;
  scene.add(halo);

  return { sprite, halo };
});

/* Atmosphere is a soft CSS halo behind the transparent WebGL canvas. */

/* ------------------------------------------------------------------ */
/*  Camera orbit controls                                             */
/* ------------------------------------------------------------------ */

const view = {
  azimuth: START_VIEW.azimuth,
  polar: START_VIEW.polar,
  distance: START_VIEW.distance,
  targetAzimuth: START_VIEW.azimuth,
  targetPolar: START_VIEW.polar,
  targetDistance: START_VIEW.distance
};

const cinematic = {
  amount: 0,
  phase: 0,
  basePolar: START_VIEW.polar,
  baseDistance: START_VIEW.distance
};

function cinematicEnabled() {
  return ui.autoOrbitToggle.checked;
}

function rebaseCinematic() {
  cinematic.basePolar = view.targetPolar;
  cinematic.baseDistance = view.targetDistance;
}

const pointers = new Map();
let pinchDistance = null;

function pinchLength() {
  const values = Array.from(pointers.values());
  if (values.length < 2) return null;
  return Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y);
}

function updateCamera(dt) {
  const ease = 1 - Math.exp(-9 * dt);
  view.azimuth += (view.targetAzimuth - view.azimuth) * ease;
  view.polar += (view.targetPolar - view.polar) * ease;
  view.distance += (view.targetDistance - view.distance) * ease;

  const sinPolar = Math.sin(view.polar);
  camera.position.set(
    sinPolar * Math.sin(view.azimuth) * view.distance,
    Math.cos(view.polar) * view.distance,
    sinPolar * Math.cos(view.azimuth) * view.distance
  );
  camera.lookAt(0, 0, 0);

  const radiusPx =
    (1 / view.distance) /
    Math.tan((camera.fov * Math.PI) / 360) *
    (window.innerHeight / 2);
  const glowSize = Math.round(clamp(radiusPx * 2.8, 260, 6200));
  if (ui.atmoGlow.dataset.size !== String(glowSize)) {
    ui.atmoGlow.style.width = `${glowSize}px`;
    ui.atmoGlow.style.height = `${glowSize}px`;
    ui.atmoGlow.dataset.size = String(glowSize);
  }
}

function resetView() {
  view.targetAzimuth = START_VIEW.azimuth;
  view.targetPolar = START_VIEW.polar;
  view.targetDistance = START_VIEW.distance;
  cinematic.basePolar = START_VIEW.polar;
  cinematic.baseDistance = START_VIEW.distance;
}

ui.canvas.addEventListener('pointerdown', (event) => {
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

  if (pointers.size === 1) {
    ui.canvas.classList.add('dragging');
    ui.canvas.setPointerCapture?.(event.pointerId);
  }

  if (pointers.size === 2) {
    pinchDistance = pinchLength();
  }
});

ui.canvas.addEventListener('pointermove', (event) => {
  const pointer = pointers.get(event.pointerId);
  if (!pointer) return;

  const dx = event.clientX - pointer.x;
  const dy = event.clientY - pointer.y;
  pointer.x = event.clientX;
  pointer.y = event.clientY;

  if (pointers.size === 1) {
    view.targetAzimuth -= dx * 0.0065;
    view.targetPolar = clamp(view.targetPolar - dy * 0.0065, 0.22, 2.92);
    if (cinematicEnabled()) rebaseCinematic();
  } else if (pointers.size >= 2) {
    const length = pinchLength();
    if (length && pinchDistance) {
      view.targetDistance = clamp(view.targetDistance * (pinchDistance / length), 1.78, 7.5);
      if (cinematicEnabled()) rebaseCinematic();
    }
    pinchDistance = length;
  }
});

function endPointer(event) {
  pointers.delete(event.pointerId);
  if (pointers.size < 2) pinchDistance = null;
  if (pointers.size === 0) ui.canvas.classList.remove('dragging');
}

ui.canvas.addEventListener('pointerup', endPointer);
ui.canvas.addEventListener('pointercancel', endPointer);
ui.canvas.addEventListener('lostpointercapture', endPointer);

ui.canvas.addEventListener(
  'wheel',
  (event) => {
    event.preventDefault();
    const factor = Math.exp(event.deltaY * 0.00115);
    view.targetDistance = clamp(view.targetDistance * factor, 1.78, 7.5);
    if (cinematicEnabled()) rebaseCinematic();
  },
  { passive: false }
);

ui.canvas.addEventListener('dblclick', (event) => {
  event.preventDefault();
  resetView();
});

ui.resetViewBtn.addEventListener('click', resetView);

window.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
  if (!ui.perfDialog.hidden) return;

  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    view.targetAzimuth += 0.14;
  } else if (event.key === 'ArrowRight') {
    event.preventDefault();
    view.targetAzimuth -= 0.14;
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    view.targetPolar = clamp(view.targetPolar - 0.1, 0.22, 2.92);
  } else if (event.key === 'ArrowDown') {
    event.preventDefault();
    view.targetPolar = clamp(view.targetPolar + 0.1, 0.22, 2.92);
  } else if (event.key === '+' || event.key === '=') {
    view.targetDistance = clamp(view.targetDistance * 0.9, 1.78, 7.5);
  } else if (event.key === '-' || event.key === '_') {
    view.targetDistance = clamp(view.targetDistance * 1.1, 1.78, 7.5);
  } else if (event.key === '0') {
    resetView();
  } else if (event.key.toLowerCase() === 'f') {
    event.preventDefault();
    toggleFullscreen();
  }
});

/* ------------------------------------------------------------------ */
/*  Texture application + UI                                          */
/* ------------------------------------------------------------------ */

const state = {
  seed: DEFAULT_SEED,
  generation: 0,
  generating: false,
  atmoRgb: [143, 216, 255],
  params: null,
  stats: null
};

function makeTextureFromCanvas(canvas, srgb) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

function applyStarSystem(params) {
  const keyStar = params.stars[0];
  const keyColor = new THREE.Color(keyStar.type.color);

  for (let i = 0; i < starLights.length; i++) {
    const star = params.stars[i];
    const light = starLights[i];
    const sprites = starSprites[i];

    if (!star) {
      light.visible = false;
      light.intensity = 0;
      sprites.sprite.visible = false;
      sprites.halo.visible = false;
      continue;
    }

    light.visible = true;
    light.color.setHex(star.type.color);
    light.intensity = star.intensity;
    light.position.copy(star.direction).multiplyScalar(14);

    const position = star.direction.clone().multiplyScalar(120);
    sprites.sprite.visible = true;
    sprites.halo.visible = true;
    sprites.sprite.position.copy(position);
    sprites.halo.position.copy(position);
    sprites.sprite.material.color.setHex(star.type.color);
    sprites.halo.material.color.setHex(star.type.color);
    sprites.sprite.scale.set(star.size, star.size, 1);
    sprites.halo.scale.set(star.size * 3.2, star.size * 3.2, 1);
    sprites.halo.material.opacity = i === 0 ? 0.12 : 0.08;
  }

  hemiLight.color.copy(keyColor).lerp(new THREE.Color(0x6f9fc4), 0.45);
  fillLight.color.setHex(params.stars[1] ? params.stars[1].type.color : 0x5d8fba);
  fillLight.intensity = params.stars.length > 1 ? 0.65 : 0.8;
}

function createRingParticles(ring, sunDirection) {
  const baseCount = isSmallScreen ? 32000 : 110000;
  const count = Math.min(180000, Math.max(12000, Math.floor(baseCount * ring.density)));
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const alphas = new Float32Array(count);
  const phases = new Float32Array(count);
  const random = mulberry32(Math.floor(ring.seed * 100000) + 17);
  let filled = 0;

  while (filled < count) {
    const radial = Math.pow(random(), 0.9);
    const radius = ring.inner + (ring.outer - ring.inner) * radial;
    const angle = random() * Math.PI * 2;
    const thickness = ring.thickness * (0.7 + radial * 0.8);
    const vertical = gaussian(random) * thickness * 0.55;
    const band = 0.5 + 0.5 * Math.sin(radius * ring.bandFrequency + ring.seed * 2);
    const fineBand = 0.5 + 0.5 * Math.sin(radius * ring.bandFrequency * 2.85 + ring.seed * 5 + Math.sin(radius * 16));
    const density = 0.22 + band * 0.3 + fineBand * 0.12 + random() * 0.06;

    let gap = 1;
    if (Math.abs(radial - ring.gap) < 0.018) gap *= 0.1;
    if (Math.abs(radial - 0.22) < 0.009) gap *= 0.25;
    if (Math.abs(radial - 0.78) < 0.012) gap *= 0.35;

    const fade = Math.min(1, radial / 0.045) * Math.min(1, (1 - radial) / 0.045);
    const alpha = clamp(
      (0.28 + band * 0.5) * (0.4 + ring.opacity) * gap * fade * ring.brightness,
      0,
      0.82
    );

    if (alpha < 0.02) continue;

    const bandMix = clamp(
      band * 0.6 + fineBand * 0.4 + (random() - 0.5) * 0.4,
      0,
      1
    );
    let red;
    let green;
    let blue;

    if (bandMix < 0.5) {
      const t = bandMix / 0.5;
      red = ring.colorB[0] + (ring.colorA[0] - ring.colorB[0]) * t;
      green = ring.colorB[1] + (ring.colorA[1] - ring.colorB[1]) * t;
      blue = ring.colorB[2] + (ring.colorA[2] - ring.colorB[2]) * t;
    } else {
      const t = (bandMix - 0.5) / 0.5;
      red = ring.colorA[0] + (ring.colorC[0] - ring.colorA[0]) * t;
      green = ring.colorA[1] + (ring.colorC[1] - ring.colorA[1]) * t;
      blue = ring.colorA[2] + (ring.colorC[2] - ring.colorA[2]) * t;
    }

    const grainLight = 0.72 + random() * 0.55;
    const offset = filled * 3;

    positions[offset] = Math.cos(angle) * radius;
    positions[offset + 1] = vertical;
    positions[offset + 2] = Math.sin(angle) * radius;

    colors[offset] = clamp(red * grainLight + (random() * 2 - 1) * 9, 0, 255) / 255;
    colors[offset + 1] = clamp(green * grainLight + (random() * 2 - 1) * 9, 0, 255) / 255;
    colors[offset + 2] = clamp(blue * grainLight + (random() * 2 - 1) * 9, 0, 255) / 255;

    sizes[filled] = (1 + random() * 2 + band * 0.6) * ring.grain;
    alphas[filled] = alpha;
    phases[filled] = random() * Math.PI * 2;
    filled++;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uPixelRatio: { value: renderer.getPixelRatio() },
      uSunDirection: { value: sunDirection },
      uPlanetRadius: { value: 1.01 },
      uTime: { value: 0 },
      uMotion: { value: 0 }
    },
    vertexShader: `
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aAlpha;
      attribute float aPhase;
      uniform float uPixelRatio;
      uniform float uTime;
      uniform float uMotion;

      varying vec3 vColor;
      varying float vAlpha;
      varying float vShimmer;
      varying vec3 vWorldPosition;

      void main() {
        vColor = aColor;
        vAlpha = aAlpha;

        // Gentle differential drift: inner grains sweep faster than outer ones,
        // which slowly shears the bands without moving the ring as a whole.
        vec3 local = position;
        float radius = max(0.45, length(local.xz));
        float orbit = uTime * uMotion * 0.012 / pow(radius, 1.5);
        float spinCos = cos(orbit);
        float spinSin = sin(orbit);
        local.xz = vec2(
          local.x * spinCos - local.z * spinSin,
          local.x * spinSin + local.z * spinCos
        );
        local.y += sin(uTime * (0.45 + fract(aPhase) * 0.5) + aPhase) * 0.0022 * uMotion;

        float shimmer = 0.9 + 0.1 * sin(uTime * (0.7 + fract(aPhase * 0.37) * 1.1) + aPhase * 2.0);
        vShimmer = mix(1.0, shimmer, uMotion);

        vec4 worldPosition = modelMatrix * vec4(local, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_PointSize = aSize * uPixelRatio;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uSunDirection;
      uniform float uPlanetRadius;

      varying vec3 vColor;
      varying float vAlpha;
      varying float vShimmer;
      varying vec3 vWorldPosition;

      void main() {
        vec2 centered = gl_PointCoord - vec2(0.5);
        float distanceToCenter = length(centered);
        if (distanceToCenter > 0.5) discard;
        float mask = smoothstep(0.5, 0.12, distanceToCenter);

        vec3 sunDirection = normalize(uSunDirection);
        float along = dot(vWorldPosition, sunDirection);
        float perpendicular = length(vWorldPosition - along * sunDirection);
        float antiSun = 1.0 - smoothstep(-0.05, 0.0, along);
        float shadow = 1.0 - antiSun * (1.0 - smoothstep(uPlanetRadius * 0.98, uPlanetRadius * 1.06, perpendicular)) * 0.38;

        gl_FragColor = vec4(
          vColor * (0.82 + 0.18 * shadow) * vShimmer,
          vAlpha * mask * (0.5 + 0.5 * shadow) * vShimmer
        );
      }
    `,
    transparent: true,
    depthWrite: false
  });

  const particles = new THREE.Points(geometry, material);
  particles.renderOrder = 2.5;
  return particles;
}

function applyRings(params) {
  planetRingShadow.strength.value = 0;

  if (ringParticles) {
    world.remove(ringParticles);
    ringParticles.geometry.dispose();
    ringParticles.material.dispose();
    ringParticles = null;
  }

  if (!params.rings) return;

  const ring = params.rings;
  const sunDirection = params.stars[0].direction.clone().normalize();

  ringParticles = createRingParticles(ring, sunDirection);
  ringParticles.rotation.x = ring.tilt;
  ringParticles.renderOrder = 2;
  world.add(ringParticles);

  ringParticles.updateWorldMatrix(true, false);
  const ringNormal = new THREE.Vector3(0, 1, 0)
    .applyQuaternion(ringParticles.getWorldQuaternion(new THREE.Quaternion()))
    .normalize();

  planetRingShadow.inner.value = ring.inner;
  planetRingShadow.outer.value = ring.outer;
  planetRingShadow.normal.value.copy(ringNormal);
  planetRingShadow.sun.value.copy(sunDirection);
  planetRingShadow.strength.value = 0.18 + ring.opacity * 0.3;
}

function makeMoonTexture(moon) {
  const width = 512;
  const height = 256;
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const bumpCanvas = makeCanvas(width, height);
  const bumpCtx = bumpCanvas.getContext('2d');
  const random = mulberry32(Math.floor(moon.seed * 10000) + 1);
  const base = moon.color;

  ctx.fillStyle = `rgb(${base[0]}, ${base[1]}, ${base[2]})`;
  ctx.fillRect(0, 0, width, height);
  bumpCtx.fillStyle = '#808080';
  bumpCtx.fillRect(0, 0, width, height);

  for (let i = 0; i < 52; i++) {
    const delta = random() < 0.5 ? 18 + random() * 34 : -(8 + random() * 30);
    const color = base.map((value) => clamp(value + delta, 0, 255)).join(',');
    const x = random() * width;
    const y = random() * height;
    const rx = 7 + random() * 52;
    const ry = 5 + random() * 24;
    const rotation = random() * Math.PI;
    ctx.fillStyle = `rgba(${color}, ${0.05 + random() * 0.11})`;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2);
    ctx.fill();

    const bumpValue = delta > 0 ? 150 + random() * 40 : 70 + random() * 40;
    bumpCtx.fillStyle = `rgba(${bumpValue}, ${bumpValue}, ${bumpValue}, ${0.08 + random() * 0.12})`;
    bumpCtx.beginPath();
    bumpCtx.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2);
    bumpCtx.fill();
  }

  for (let i = 0; i < 22; i++) {
    const x = random() * width;
    const y = random() * height;
    const radius = 2 + random() * 11;
    const gradient = ctx.createRadialGradient(x - radius * 0.25, y - radius * 0.25, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(0, 0, 0, ${0.16 + random() * 0.14})`);
    gradient.addColorStop(0.7, 'rgba(0, 0, 0, 0.04)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0.08)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    const crater = bumpCtx.createRadialGradient(x, y, 0, x, y, radius * 1.15);
    crater.addColorStop(0, 'rgba(40, 40, 40, 0.8)');
    crater.addColorStop(0.75, 'rgba(40, 40, 40, 0.25)');
    crater.addColorStop(1, 'rgba(230, 230, 230, 0.5)');
    bumpCtx.fillStyle = crater;
    bumpCtx.beginPath();
    bumpCtx.arc(x, y, radius * 1.15, 0, Math.PI * 2);
    bumpCtx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = maxAnisotropy;

  const bump = new THREE.CanvasTexture(bumpCanvas);
  bump.colorSpace = THREE.NoColorSpace;
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.ClampToEdgeWrapping;
  bump.anisotropy = 4;

  return { map: texture, bump };
}

function disposePivot(pivot) {
  world.remove(pivot);
  pivot.traverse((object) => {
    if (!object.isMesh && !object.isLine) return;
    object.geometry.dispose();
    if (object.material.map) object.material.map.dispose();
    if (object.material.bumpMap) object.material.bumpMap.dispose();
    object.material.dispose();
  });
}

function applyMoons(params) {
  for (const moon of moonPivots) disposePivot(moon.pivot);
  moonPivots.length = 0;

  for (const moon of params.moons) {
    const textures = makeMoonTexture(moon);
    const material = new THREE.MeshStandardMaterial({
      map: textures.map,
      bumpMap: textures.bump,
      bumpScale: 0.012,
      roughness: 0.96,
      metalness: 0.01
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(moon.size, 32, 16), material);
    mesh.position.x = moon.distance;

    const pivot = new THREE.Group();
    pivot.rotation.x = moon.inclination;
    pivot.rotation.y = moon.phase;
    pivot.add(mesh);
    world.add(pivot);

    moonPivots.push({ pivot, speed: moon.speed });
  }
}

function makeNeighborMap(neighbor) {
  const width = 512;
  const height = 256;
  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const random = mulberry32(Math.floor(neighbor.seed * 1000) + 1);
  const base = hsl(neighbor.hue, 0.45 + random() * 0.3, neighbor.gas ? 0.48 : 0.38);

  ctx.fillStyle = `rgb(${base[0]}, ${base[1]}, ${base[2]})`;
  ctx.fillRect(0, 0, width, height);

  const drawWrappedEllipse = (x, y, rx, ry, rotation) => {
    for (const offset of [-width, 0, width]) {
      ctx.beginPath();
      ctx.ellipse(x + offset, y, rx, ry, rotation, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  if (neighbor.gas) {
    for (let y = 0; y < height; y += 2 + random() * 5) {
      const t = y / height;
      const color = hsl(
        neighbor.hue + Math.sin(t * 9) * 28,
        0.42 + random() * 0.2,
        0.34 + 0.2 * Math.sin(t * 12)
      );
      ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${0.35 + random() * 0.25})`;
      ctx.fillRect(0, y, width, 2 + random() * 5);
    }

    const stormX = random() * width;
    const stormY = height * (0.3 + random() * 0.4);
    const storm = ctx.createRadialGradient(stormX, stormY, 0, stormX, stormY, 48 + random() * 48);
    storm.addColorStop(0, 'rgba(255, 244, 225, 0.32)');
    storm.addColorStop(0.65, 'rgba(255, 225, 190, 0.1)');
    storm.addColorStop(1, 'rgba(255, 225, 190, 0)');
    ctx.fillStyle = storm;
    drawWrappedEllipse(stormX, stormY, 48 + random() * 42, 18 + random() * 14, random() * 0.4);
  } else {
    for (let i = 0; i < 46; i++) {
      const color = hsl(
        neighbor.hue + (random() * 2 - 1) * 42,
        0.3 + random() * 0.35,
        0.24 + random() * 0.34
      );
      ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${0.07 + random() * 0.14})`;
      drawWrappedEllipse(
        random() * width,
        random() * height,
        4 + random() * 48,
        4 + random() * 28,
        random() * Math.PI
      );
    }

    if (random() < 0.55) {
      const cap = ctx.createLinearGradient(0, 0, 0, height * 0.2);
      cap.addColorStop(0, 'rgba(245, 250, 255, 0.62)');
      cap.addColorStop(1, 'rgba(245, 250, 255, 0)');
      ctx.fillStyle = cap;
      ctx.fillRect(0, 0, width, height * 0.2);

      const bottomCap = ctx.createLinearGradient(0, height, 0, height * 0.8);
      bottomCap.addColorStop(0, 'rgba(245, 250, 255, 0.45)');
      bottomCap.addColorStop(1, 'rgba(245, 250, 255, 0)');
      ctx.fillStyle = bottomCap;
      ctx.fillRect(0, height * 0.8, width, height * 0.2);
    }

    for (let i = 0; i < 24; i++) {
      const x = random() * width;
      const y = random() * height;
      const radius = 2 + random() * 10;
      const crater = ctx.createRadialGradient(x, y, 0, x, y, radius);
      crater.addColorStop(0, 'rgba(0, 0, 0, 0.18)');
      crater.addColorStop(0.72, 'rgba(0, 0, 0, 0.05)');
      crater.addColorStop(1, 'rgba(255, 255, 255, 0.08)');
      ctx.fillStyle = crater;
      drawWrappedEllipse(x, y, radius, radius, 0);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = maxAnisotropy;
  return texture;
}

function applyNeighbors(params) {
  while (neighborGroup.children.length) {
    const body = neighborGroup.children[neighborGroup.children.length - 1];
    neighborGroup.remove(body);
    body.traverse((object) => {
      if (object.isSprite) {
        object.material.dispose();
        return;
      }
      if (!object.isMesh) return;
      object.geometry.dispose();
      if (object.material.map) object.material.map.dispose();
      object.material.dispose();
    });
  }

  neighborBodies.length = 0;

  for (const neighbor of params.neighbors) {
    const orbit = new THREE.Group();
    const body = new THREE.Group();
    body.position.copy(neighbor.direction).multiplyScalar(neighbor.distance);
    orbit.add(body);

    const map = makeNeighborMap(neighbor);
    const material = new THREE.MeshStandardMaterial({
      map,
      roughness: neighbor.gas ? 0.98 : 0.9,
      metalness: 0
    });
    const planet = new THREE.Mesh(new THREE.SphereGeometry(neighbor.size, 48, 24), material);
    body.add(planet);

    if (neighbor.ringed) {
      const ringColor = hsl(neighbor.hue + 175, 0.28, 0.76);
      const rings = [
        [1.3, 1.48, 0.3],
        [1.5, 1.64, 0.22],
        [1.66, 1.84, 0.15]
      ];

      rings.forEach(([inner, outer, opacity], index) => {
        const ringMaterial = new THREE.MeshBasicMaterial({
          color: new THREE.Color(ringColor[0] / 255, ringColor[1] / 255, ringColor[2] / 255),
          transparent: true,
          opacity,
          side: THREE.DoubleSide,
          depthWrite: false
        });
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(neighbor.size * inner, neighbor.size * outer, 96, 1),
          ringMaterial
        );
        ring.rotation.x = Math.PI / 2 + neighbor.ringTilt;
        ring.position.y = (index - 1) * neighbor.size * 0.012;
        ring.renderOrder = 1;
        body.add(ring);
      });
    }

    const haloColor = hsl(neighbor.hue + 15, 0.55, 0.68);
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color: new THREE.Color(haloColor[0] / 255, haloColor[1] / 255, haloColor[2] / 255),
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    halo.scale.set(neighbor.size * 3.4, neighbor.size * 3.4, 1);
    body.add(halo);

    let moonPivot = null;
    if (neighbor.moon) {
      moonPivot = new THREE.Group();
      moonPivot.rotation.x = neighbor.moonAngle * 0.25;
      moonPivot.rotation.y = neighbor.moonAngle;

      const moonColor = hsl(neighbor.hue + 30, 0.14, 0.62);
      const moon = new THREE.Mesh(
        new THREE.SphereGeometry(neighbor.size * neighbor.moonSize, 16, 8),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(moonColor[0] / 255, moonColor[1] / 255, moonColor[2] / 255),
          roughness: 0.95,
          metalness: 0
        })
      );
      moon.position.x = neighbor.size * neighbor.moonDistance;
      moonPivot.add(moon);
      body.add(moonPivot);
    }

    neighborGroup.add(orbit);
    neighborBodies.push({
      orbit,
      body,
      planet,
      moonPivot,
      orbitSpeed: (0.004 + (neighbor.seed % 1) * 0.005) * (neighbor.seed % 2 < 1 ? 1 : -1),
      spin: 0.01 + (neighbor.seed % 1) * 0.07,
      moonSpeed: 0.05 + (neighbor.seed % 1) * 0.12
    });
  }
}

function applyPlanet(result, params) {
  const oldTextures = new Set([
    planetMaterial.map,
    planetMaterial.bumpMap,
    planetMaterial.displacementMap,
    planetMaterial.roughnessMap,
    planetMaterial.emissiveMap,
    cloudMaterial.map
  ]);
  oldTextures.forEach((texture) => {
    if (texture) texture.dispose();
  });

  const colorTexture = makeTextureFromCanvas(result.colorCanvas, true);
  const heightTexture = result.heightCanvas ? makeTextureFromCanvas(result.heightCanvas, false) : null;
  const cloudTexture = makeTextureFromCanvas(result.cloudCanvas, true);
  const roughnessTexture = result.roughnessCanvas
    ? makeTextureFromCanvas(result.roughnessCanvas, false)
    : null;
  const emissiveTexture = result.emissiveCanvas
    ? makeTextureFromCanvas(result.emissiveCanvas, true)
    : null;

  planetMaterial.map = colorTexture;
  planetMaterial.bumpMap = heightTexture;
  planetMaterial.displacementMap = heightTexture;
  planetMaterial.roughnessMap = roughnessTexture;
  planetMaterial.emissiveMap = emissiveTexture;

  const isGas = params.kind === 'gas';
  planetMaterial.bumpScale = isGas ? 0 : 0.045;
  planetMaterial.displacementScale = isGas ? 0 : 0.04;
  planetMaterial.displacementBias = isGas ? 0 : -0.012;
  planetMaterial.roughness = roughnessTexture ? 1 : 0.93;

  if (emissiveTexture) {
    planetMaterial.emissive.setHex(0xffffff);
    planetMaterial.emissiveIntensity = 1.35;
    planetMaterial.color.setRGB(0.74, 0.7, 0.68);
    lavaGlow.strength.value = 1;
  } else {
    planetMaterial.emissive.setHex(0x000000);
    planetMaterial.emissiveIntensity = 1;
    planetMaterial.color.setHex(0xffffff);
    lavaGlow.strength.value = 0;
  }
  lavaGlow.sun.value.copy(params.stars[0].direction).normalize();
  planetMaterial.needsUpdate = true;

  cloudMaterial.map = cloudTexture;
  cloudMaterial.opacity = params.cloudOpacity;
  clouds.visible = params.kind !== 'gas';
  cloudMaterial.color.setRGB(
    params.palette.cloud[0] / 255,
    params.palette.cloud[1] / 255,
    params.palette.cloud[2] / 255
  );
  cloudMaterial.needsUpdate = true;

  world.rotation.z = params.axialTilt;

  applyStarSystem(params);
  applyRings(params);
  applyMoons(params);
  applyNeighbors(params);

  state.params = params;
  state.stats = result.stats;

  const [ar, ag, ab] = params.palette.atmo;
  const atmoRed = Math.round(ar * 255);
  const atmoGreen = Math.round(ag * 255);
  const atmoBlue = Math.round(ab * 255);
  state.atmoRgb = [atmoRed, atmoGreen, atmoBlue];

  document.documentElement.style.setProperty('--atmo-rgb', `${atmoRed}, ${atmoGreen}, ${atmoBlue}`);
  document.documentElement.style.setProperty(
    '--atmo-glow',
    `rgba(${atmoRed}, ${atmoGreen}, ${atmoBlue}, 0.2)`
  );

  applyStats(result.stats, params);
}

function applyStats(stats, params) {
  const seed = params.seed;
  ui.seedTag.textContent = seed;
  ui.statClass.textContent = stats.class;
  ui.statOcean.textContent = `${Math.round(stats.ocean)}%`;
  ui.statClouds.textContent = `${Math.round(stats.clouds)}%`;
  ui.statIce.textContent = `${Math.round(stats.ice)}%`;
  ui.statMoons.textContent = params.moons.length ? String(params.moons.length) : 'NONE';
  ui.statRings.textContent = params.rings ? params.rings.style.name : 'NONE';
  ui.statSystem.textContent = `${params.starLabel} · ${params.neighbors.length} ${
    params.neighbors.length === 1 ? 'PLANET' : 'PLANETS'
  }`;
  document.title = `Planet Forge — ${seed}`;
}

function setLoaderProgress(value) {
  ui.loaderProgress.textContent = `${Math.round(clamp(value, 0, 1) * 100)}%`;
}

function showLoader(seed) {
  ui.loaderTitle.textContent = `Surveying ${seed}`;
  setLoaderProgress(0);
  ui.loader.classList.add('visible');
  ui.loader.setAttribute('aria-hidden', 'false');
}

function hideLoader() {
  ui.loader.classList.remove('visible');
  ui.loader.setAttribute('aria-hidden', 'true');
}

function setGenerating(generating) {
  state.generating = generating;
  ui.randomBtn.disabled = generating;
  ui.captureBtn.disabled = generating;
}

async function generate(rawSeed, { updateUrl = true } = {}) {
  if (state.generating) return;

  const seed = normalizeSeed(rawSeed);
  if (!seed) return;

  const token = ++state.generation;
  state.seed = seed;
  ui.seedInput.value = seed;
  setGenerating(true);
  showLoader(seed);

  await new Promise((resolve) => setTimeout(resolve, 60));

  try {
    const params = makePlanetParams(seed);
    const buildTextures = params.kind === 'gas' ? buildGasTextures : buildPlanetTextures;
    const result = await buildTextures(params, (progress) => {
      if (token === state.generation) setLoaderProgress(progress);
    });

    if (token !== state.generation) return;

    applyPlanet(result, params);
    if (updateUrl) updateHash(seed);
    hideLoader();
  } catch (error) {
    console.error(error);
    hideLoader();
    showToast('Could not forge that world. Try another seed.');
  } finally {
    if (token === state.generation) setGenerating(false);
  }
}

let toastTimer = null;

function showToast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 2400);
}

function updateHash(seed) {
  try {
    const params = new URLSearchParams();
    params.set('seed', seed);
    history.replaceState(null, '', `#${params.toString()}`);
  } catch {
    /* Ignore history restrictions in some embedded contexts. */
  }
}

function seedFromHash() {
  try {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    return params.get('seed');
  } catch {
    return null;
  }
}

async function copyShareLink() {
  updateHash(state.seed);
  const params = new URLSearchParams();
  params.set('seed', state.seed);
  const url =
    window.location.origin && window.location.origin !== 'null'
      ? `${window.location.origin}${window.location.pathname}#${params.toString()}`
      : `${window.location.href.split('#')[0]}#${params.toString()}`;

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(url);
    } else {
      window.prompt('Copy this planet link:', url);
    }
    showToast('Share link copied.');
  } catch {
    window.prompt('Copy this planet link:', url);
  }
}

const recording = {
  active: false,
  recorder: null,
  stream: null,
  canvas: null,
  ctx: null,
  chunks: [],
  startedAt: 0,
  timer: null,
  drawTimer: null,
  fps: 30,
  mimeType: '',
  highQuality: false,
  watermark: true
};

function standardPixelRatio() {
  return Math.min(window.devicePixelRatio || 1, 2);
}

function highQualityPixelRatio() {
  return Math.min(3, Math.max(2, (window.devicePixelRatio || 1) * 1.35));
}

const adaptiveQuality = {
  scale: 1,
  frames: 0,
  elapsed: 0,
  lowStreak: 0,
  highStreak: 0
};

function qualityAdjustedPixelRatio() {
  const base = recording.active && recording.highQuality ? highQualityPixelRatio() : standardPixelRatio();
  if (recording.active && recording.highQuality) return base;
  return Math.max(0.55, base * adaptiveQuality.scale);
}

function monitorQuality(dt) {
  const quality = adaptiveQuality;

  // Recording resolution must stay stable for the whole clip.
  if (recording.active) {
    quality.frames = 0;
    quality.elapsed = 0;
    return;
  }

  quality.frames += 1;
  quality.elapsed += dt;
  if (quality.elapsed < 1.5) return;

  const fps = quality.frames / quality.elapsed;
  quality.frames = 0;
  quality.elapsed = 0;

  if (fps < 42) {
    quality.lowStreak += 1;
    quality.highStreak = 0;
  } else if (fps > 57) {
    quality.highStreak += 1;
    quality.lowStreak = 0;
  } else {
    quality.lowStreak = 0;
    quality.highStreak = 0;
  }

  if (quality.lowStreak >= 2 && quality.scale > 0.55) {
    quality.scale = Math.max(0.55, quality.scale - 0.15);
    quality.lowStreak = 0;
    resizeRenderer();
  } else if (quality.highStreak >= 5 && quality.scale < 1) {
    quality.scale = Math.min(1, quality.scale + 0.1);
    quality.highStreak = 0;
    resizeRenderer();
  }
}

function setRendererPixelRatio(ratio) {
  renderer.setPixelRatio(ratio);
  const { width, height } = viewportSize();
  renderer.setSize(width, height, false);
  starMaterial.uniforms.uPixelRatio.value = renderer.getPixelRatio();
  if (ringParticles) {
    ringParticles.material.uniforms.uPixelRatio.value = renderer.getPixelRatio();
  }
}

function restoreRendererScale() {
  setRendererPixelRatio(qualityAdjustedPixelRatio());
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function drawCompositeFrame(ctx, width, height, showWatermark = true) {
  const scale = width / Math.max(1, viewportSize().width);
  const centerX = width / 2;
  const centerY = height / 2;
  const [red, green, blue] = state.atmoRgb;

  ctx.fillStyle = '#03060a';
  ctx.fillRect(0, 0, width, height);

  const bodyGlow = ctx.createRadialGradient(
    width * 0.18,
    height * 0.1,
    0,
    width * 0.18,
    height * 0.1,
    Math.max(width, height) * 0.8
  );
  bodyGlow.addColorStop(0, `rgba(${red}, ${green}, ${blue}, 0.16)`);
  bodyGlow.addColorStop(1, 'rgba(3, 6, 10, 0)');
  ctx.fillStyle = bodyGlow;
  ctx.fillRect(0, 0, width, height);

  const warmGlow = ctx.createRadialGradient(
    width * 0.88,
    height * 0.92,
    0,
    width * 0.88,
    height * 0.92,
    Math.max(width, height) * 0.62
  );
  warmGlow.addColorStop(0, 'rgba(86, 50, 34, 0.16)');
  warmGlow.addColorStop(1, 'rgba(3, 6, 10, 0)');
  ctx.fillStyle = warmGlow;
  ctx.fillRect(0, 0, width, height);

  const glowSize = parseFloat(ui.atmoGlow.style.width) || 600;
  const glowRadius = (glowSize / 2) * scale;
  const atmosphere = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, glowRadius);
  atmosphere.addColorStop(0, 'rgba(0, 0, 0, 0)');
  atmosphere.addColorStop(0.69, 'rgba(0, 0, 0, 0)');
  atmosphere.addColorStop(0.705, `rgba(${red}, ${green}, ${blue}, 0.55)`);
  atmosphere.addColorStop(0.76, `rgba(${red}, ${green}, ${blue}, 0.28)`);
  atmosphere.addColorStop(0.86, `rgba(${red}, ${green}, ${blue}, 0.08)`);
  atmosphere.addColorStop(0.97, `rgba(${red}, ${green}, ${blue}, 0)`);
  atmosphere.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = atmosphere;
  ctx.fillRect(0, 0, width, height);

  ctx.drawImage(ui.canvas, 0, 0, width, height);

  const vignette = ctx.createRadialGradient(
    centerX,
    centerY,
    Math.min(width, height) * 0.34,
    centerX,
    centerY,
    Math.max(width, height) * 0.72
  );
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(1, 3, 6, 0.5)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  if (showWatermark) {
    const pad = 26 * scale;
    ctx.textBaseline = 'bottom';
    ctx.font = `${11 * scale}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
    ctx.fillStyle = 'rgba(233, 242, 248, 0.72)';
    ctx.fillText('PLANET FORGE', pad, height - pad);
    ctx.fillStyle = 'rgba(255, 207, 138, 0.86)';
    ctx.fillText(state.seed, pad, height - pad - 18 * scale);
  }
}

function drawPostcard(ctx, width, height, showWatermark) {
  const scale = width / Math.max(1, viewportSize().width);
  const stats = state.stats;
  const params = state.params;
  const name = planetName(state.seed);
  const mono = (size, weight = 400) =>
    `${weight} ${Math.max(7, size * scale)}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  const sans = (size, weight = 600) =>
    `${weight} ${Math.max(10, size * scale)}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;

  drawCompositeFrame(ctx, width, height, false);

  const topScrim = ctx.createLinearGradient(0, 0, 0, height * 0.42);
  topScrim.addColorStop(0, 'rgba(2, 5, 9, 0.88)');
  topScrim.addColorStop(1, 'rgba(2, 5, 9, 0)');
  ctx.fillStyle = topScrim;
  ctx.fillRect(0, 0, width, height * 0.42);

  const bottomScrim = ctx.createLinearGradient(0, height * 0.68, 0, height);
  bottomScrim.addColorStop(0, 'rgba(2, 5, 9, 0)');
  bottomScrim.addColorStop(0.7, 'rgba(2, 5, 9, 0.78)');
  bottomScrim.addColorStop(1, 'rgba(2, 5, 9, 0.92)');
  ctx.fillStyle = bottomScrim;
  ctx.fillRect(0, height * 0.68, width, height * 0.32);

  const pad = 34 * scale;

  ctx.textBaseline = 'top';
  ctx.font = mono(9, 500);
  ctx.fillStyle = showWatermark ? 'rgba(255, 207, 138, 0.9)' : 'rgba(233, 242, 248, 0.6)';
  ctx.fillText(showWatermark ? 'PLANET FORGE · WORLD SURVEY' : 'WORLD SURVEY', pad, pad);

  ctx.font = sans(31);
  ctx.fillStyle = '#f3f9fd';
  ctx.fillText(name, pad, pad + 22 * scale);

  ctx.font = mono(10);
  ctx.fillStyle = 'rgba(233, 242, 248, 0.62)';
  ctx.fillText(
    `${state.seed}${stats ? `  ·  ${stats.class}` : ''}`,
    pad,
    pad + 66 * scale
  );

  // rounded corner brackets
  const corner = 30 * scale;
  const inset = 18 * scale;
  ctx.strokeStyle = 'rgba(143, 216, 255, 0.5)';
  ctx.lineWidth = Math.max(1, 1.3 * scale);
  ctx.beginPath();
  ctx.moveTo(inset, inset + corner);
  ctx.lineTo(inset, inset);
  ctx.lineTo(inset + corner, inset);
  ctx.moveTo(width - inset - corner, inset);
  ctx.lineTo(width - inset, inset);
  ctx.lineTo(width - inset, inset + corner);
  ctx.moveTo(width - inset, height - inset - corner);
  ctx.lineTo(width - inset, height - inset);
  ctx.lineTo(width - inset - corner, height - inset);
  ctx.moveTo(inset + corner, height - inset);
  ctx.lineTo(inset, height - inset);
  ctx.lineTo(inset, height - inset - corner);
  ctx.stroke();

  const statRows = [];
  if (stats) {
    statRows.push(
      `OCEAN ${Math.round(stats.ocean)}%    CLOUDS ${Math.round(stats.clouds)}%    ICE ${Math.round(stats.ice)}%`
    );
  }
  if (params) {
    const moonCount = params.moons.length;
    statRows.push(
      `${moonCount ? `${moonCount} ${moonCount === 1 ? 'MOON' : 'MOONS'}` : 'NO MOONS'}    RINGS ${
        params.rings ? params.rings.style.name : 'NONE'
      }    ${params.starLabel}`
    );
  }

  ctx.textBaseline = 'bottom';
  let lineY = height - pad;
  for (let i = statRows.length - 1; i >= 0; i--) {
    ctx.font = mono(9.5);
    ctx.fillStyle = i === 0 ? 'rgba(233, 242, 248, 0.86)' : 'rgba(233, 242, 248, 0.62)';
    ctx.fillText(statRows[i], pad, lineY);
    lineY -= 19 * scale;
  }

  if (showWatermark) {
    ctx.textBaseline = 'bottom';
    ctx.font = mono(8.5);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(233, 242, 248, 0.55)';
    ctx.fillText('PLANET FORGE', width - pad, height - pad);
    ctx.textAlign = 'left';
  }
}

function captureImage() {
  if (state.generating) {
    showToast('Still forging this world…');
    return;
  }

  renderer.render(scene, camera);
  const output = makeCanvas(ui.canvas.width, ui.canvas.height);
  const ctx = output.getContext('2d');
  const watermark = ui.watermarkToggle.checked;
  const postcard = ui.postcardToggle.checked;

  if (postcard) {
    drawPostcard(ctx, output.width, output.height, watermark);
  } else {
    drawCompositeFrame(ctx, output.width, output.height, watermark);
  }

  output.toBlob((blob) => {
    if (!blob) return;
    downloadBlob(blob, `planet-forge-${state.seed}.png`);
    showToast(postcard ? 'Postcard captured.' : 'Image captured.');
  }, 'image/png');
}

function updateRecordingBadge() {
  if (!recording.active) {
    ui.recBadge.hidden = true;
    return;
  }

  const elapsed = Math.max(0, Math.floor((performance.now() - recording.startedAt) / 1000));
  const minutes = Math.floor(elapsed / 60);
  const seconds = String(elapsed % 60).padStart(2, '0');
  ui.recTime.textContent = `${minutes}:${seconds}`;
  ui.recBadge.hidden = false;
}

function updateRecordUI() {
  ui.recordBtn.classList.toggle('recording', recording.active);
  ui.recordBtn.setAttribute('aria-pressed', String(recording.active));
  ui.recordLabel.textContent = recording.active ? 'Stop' : 'Record';
  ui.recordBtn.title = recording.active ? 'Stop recording' : 'Record scene video';
  ui.recordBtn.setAttribute('aria-label', recording.active ? 'Stop recording' : 'Record scene video');
  ui.watermarkToggle.disabled = recording.active;
  ui.hqToggle.disabled = recording.active;
  ui.recBadge.hidden = !recording.active;
}

function startRecording() {
  if (state.generating) {
    showToast('Wait for the world to finish…');
    return;
  }

  if (!window.MediaRecorder || typeof ui.canvas.captureStream !== 'function') {
    showToast('Video recording is not supported in this browser.');
    return;
  }

  const highQuality = ui.hqToggle.checked;
  const includeWatermark = ui.watermarkToggle.checked;
  const maxWidth = highQuality ? 2560 : 1920;
  const fps = 30;
  const bitrate = highQuality ? 12_000_000 : 10_000_000;

  recording.highQuality = highQuality;
  recording.watermark = includeWatermark;
  recording.fps = fps;

  if (highQuality) {
    setRendererPixelRatio(highQualityPixelRatio());
  }

  const targetWidth = Math.min(ui.canvas.width, maxWidth);
  const targetHeight = Math.round((targetWidth / ui.canvas.width) * ui.canvas.height);
  const canvas = makeCanvas(targetWidth, targetHeight);
  const ctx = canvas.getContext('2d');

  renderer.render(scene, camera);
  drawCompositeFrame(ctx, targetWidth, targetHeight, includeWatermark);

  let stream;
  try {
    stream = canvas.captureStream(fps);
  } catch {
    if (highQuality) restoreRendererScale();
    showToast('Could not start video capture.');
    return;
  }

  const mimeTypes = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4'
  ];
  const supportsMime = typeof MediaRecorder.isTypeSupported === 'function';
  const mimeType = supportsMime
    ? mimeTypes.find((type) => MediaRecorder.isTypeSupported(type)) || ''
    : '';

  let recorder;
  try {
    recorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType, videoBitsPerSecond: bitrate } : { videoBitsPerSecond: bitrate }
    );
  } catch {
    stream.getTracks().forEach((track) => track.stop());
    if (highQuality) restoreRendererScale();
    showToast('Could not start recording.');
    return;
  }

  recording.active = true;
  recording.recorder = recorder;
  recording.stream = stream;
  recording.canvas = canvas;
  recording.ctx = ctx;
  recording.chunks = [];
  recording.startedAt = performance.now();
  recording.mimeType = mimeType;

  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) recording.chunks.push(event.data);
  };

  recorder.onstop = () => {
    const chunks = recording.chunks;
    const extension = recording.mimeType.includes('mp4') ? 'mp4' : 'webm';

    const wasHighQuality = recording.highQuality;
    recording.active = false;
    recording.highQuality = false;
    if (wasHighQuality) restoreRendererScale();
    clearInterval(recording.timer);
    recording.timer = null;
    clearInterval(recording.drawTimer);
    recording.drawTimer = null;
    if (recording.stream) recording.stream.getTracks().forEach((track) => track.stop());

    recording.recorder = null;
    recording.stream = null;
    recording.canvas = null;
    recording.ctx = null;
    updateRecordUI();

    if (chunks.length) {
      downloadBlob(
        new Blob(chunks, { type: recording.mimeType || 'video/webm' }),
        `planet-forge-${state.seed}.${extension}`
      );
      showToast('Recording saved.');
    } else {
      showToast('No video data was captured.');
    }
  };

  try {
    recorder.start(250);
  } catch {
    const wasHighQuality = recording.highQuality;
    recording.active = false;
    recording.highQuality = false;
    if (wasHighQuality) restoreRendererScale();
    recording.recorder = null;
    recording.stream = null;
    recording.canvas = null;
    recording.ctx = null;
    stream.getTracks().forEach((track) => track.stop());
    updateRecordUI();
    showToast('Could not start recording.');
    return;
  }

  recording.timer = setInterval(updateRecordingBadge, 500);
  drawCompositeFrame(recording.ctx, recording.canvas.width, recording.canvas.height, recording.watermark);
  recording.drawTimer = setInterval(() => {
    if (!recording.active || !recording.ctx) return;
    drawCompositeFrame(recording.ctx, recording.canvas.width, recording.canvas.height, recording.watermark);
  }, Math.max(16, Math.round(1000 / fps)));
  updateRecordingBadge();
  updateRecordUI();
  showToast('Recording started.');
}

function stopRecording() {
  if (!recording.active || !recording.recorder) return;

  if (recording.recorder.state !== 'inactive') {
    recording.recorder.stop();
  } else {
    const wasHighQuality = recording.highQuality;
    recording.active = false;
    recording.highQuality = false;
    if (wasHighQuality) restoreRendererScale();
    updateRecordUI();
  }
}

function toggleRecording() {
  if (recording.active) stopRecording();
  else startRecording();
}

function toggleFullscreen() {
  const doc = document;
  const element = document.documentElement;

  if (doc.fullscreenElement || doc.webkitFullscreenElement) {
    const exit = doc.exitFullscreen || doc.webkitExitFullscreen;
    if (exit) {
      try {
        const result = exit.call(doc);
        if (result && result.catch) result.catch(() => {});
      } catch {
        /* ignore */
      }
    }
    return;
  }

  const request = element.requestFullscreen || element.webkitRequestFullscreen;
  if (!request) {
    showToast('Fullscreen is not supported in this browser.');
    return;
  }

  try {
    const result = request.call(element);
    if (result && result.catch) {
      result.catch(() => showToast('Fullscreen is not available.'));
    }
  } catch {
    showToast('Fullscreen is not available.');
  }
}

function syncFullscreenUI() {
  const active = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
  ui.fullscreenBtn.setAttribute('aria-pressed', String(active));
  ui.fullscreenLabel.textContent = active ? 'Exit' : 'Full';
  ui.fullscreenBtn.title = active ? 'Exit fullscreen' : 'Enter fullscreen';
  ui.fullscreenBtn.setAttribute('aria-label', active ? 'Exit fullscreen' : 'Enter fullscreen');

  // Browsers do not reliably emit a resize event when fullscreen changes,
  // so force a renderer + camera resize after the transition.
  requestAnimationFrame(resizeRenderer);
  setTimeout(resizeRenderer, 120);
  setTimeout(resizeRenderer, 360);
}

ui.randomBtn.addEventListener('click', () => {
  const typed = normalizeSeed(ui.seedInput.value);
  const nextSeed = typed !== state.seed ? typed : randomSeed();
  ui.seedInput.value = nextSeed;
  generate(nextSeed);
});
ui.copyBtn.addEventListener('click', copyShareLink);
ui.captureBtn.addEventListener('click', captureImage);
ui.recordBtn.addEventListener('click', toggleRecording);
ui.fullscreenBtn.addEventListener('click', toggleFullscreen);
ui.autoOrbitToggle.addEventListener('change', () => {
  if (ui.autoOrbitToggle.checked) rebaseCinematic();
});
document.addEventListener('fullscreenchange', syncFullscreenUI);
document.addEventListener('webkitfullscreenchange', syncFullscreenUI);

/* --- performance notice for the heavier options --- */

const PERF_NOTICE_KEY = 'planet-forge:perf-notice';

const perfNotes = {
  hqToggle: {
    label: 'HQ video',
    text: 'HQ video records at a higher resolution and bitrate. It is the heaviest export option and can drop frames on older hardware.'
  },
  starMotionToggle: {
    label: 'Star motion',
    text: 'Star motion animates thousands of stars every frame. Most GPUs handle it easily, but low-power devices may start to stutter.'
  },
  ringMotionToggle: {
    label: 'Ring motion',
    text: 'Ring motion animates 100,000+ grains inside the shader. It is usually fine, but can tax integrated graphics.'
  }
};

const perfSeen = new Set();
let perfHideTimer = null;
let perfReturnFocus = null;

function perfNoticeSuppressed() {
  try {
    return localStorage.getItem(PERF_NOTICE_KEY) === 'off';
  } catch {
    return false;
  }
}

function rememberPerfChoice() {
  try {
    localStorage.setItem(PERF_NOTICE_KEY, 'off');
  } catch {
    /* storage can be unavailable; the notice simply reappears next visit */
  }
}

function openPerfNotice(key) {
  const note = perfNotes[key];
  if (!note) return;

  ui.perfBody.textContent = `${note.text} Nothing breaks — it just runs smoothest on stronger hardware.`;
  const enabled = Object.keys(perfNotes).filter((id) => document.getElementById(id).checked);
  ui.perfChips.innerHTML = enabled
    .map((id) => `<li>${perfNotes[id].label}</li>`)
    .join('');
  ui.perfChips.hidden = enabled.length < 2;
  ui.perfDontAsk.checked = false;

  clearTimeout(perfHideTimer);
  perfReturnFocus = document.getElementById(key) || document.activeElement;
  ui.perfDialog.classList.remove('is-closing');
  ui.perfDialog.hidden = false;
  ui.perfClose.focus({ preventScroll: true });
}

function closePerfNotice() {
  if (ui.perfDialog.hidden) return;

  if (ui.perfDontAsk.checked) rememberPerfChoice();
  ui.perfDialog.classList.add('is-closing');
  clearTimeout(perfHideTimer);
  perfHideTimer = setTimeout(() => {
    ui.perfDialog.hidden = true;
    ui.perfDialog.classList.remove('is-closing');
  }, 200);

  if (perfReturnFocus && typeof perfReturnFocus.focus === 'function') {
    perfReturnFocus.focus({ preventScroll: true });
    perfReturnFocus = null;
  }
}

for (const key of Object.keys(perfNotes)) {
  document.getElementById(key).addEventListener('change', (event) => {
    if (!event.target.checked) return;
    if (perfNoticeSuppressed() || perfSeen.has(key)) return;
    perfSeen.add(key);
    openPerfNotice(key);
  });
}

ui.perfClose.addEventListener('click', closePerfNotice);
ui.perfBackdrop.addEventListener('click', closePerfNotice);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !ui.perfDialog.hidden) {
    event.preventDefault();
    closePerfNotice();
  }
});

updateRecordUI();
syncFullscreenUI();

ui.seedInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    generate(ui.seedInput.value);
  }
});

/* ------------------------------------------------------------------ */
/*  Resize + render loop                                              */
/* ------------------------------------------------------------------ */

window.addEventListener('resize', resizeRenderer);
window.addEventListener('orientationchange', () => setTimeout(resizeRenderer, 120));

if (typeof ResizeObserver === 'function') {
  // Fullscreen transitions usually change the canvas layout size without a
  // matching window resize event, so track the element itself.
  new ResizeObserver(() => resizeRenderer()).observe(ui.canvas);
}

function resizeRenderer() {
  updateProjection();
  const { width, height } = viewportSize();
  renderer.setPixelRatio(qualityAdjustedPixelRatio());
  renderer.setSize(width, height, false);
  starMaterial.uniforms.uPixelRatio.value = renderer.getPixelRatio();
  if (ringParticles) {
    ringParticles.material.uniforms.uPixelRatio.value = renderer.getPixelRatio();
  }
}

const clock = new THREE.Clock();
let starMotionAmount = 0;
let ringMotionAmount = 0;

function updateScene(dt) {
  const cinematicTarget = cinematicEnabled() ? 1 : 0;
  cinematic.amount += (cinematicTarget - cinematic.amount) * Math.min(1, dt * 1.8);
  if (cinematic.amount < 0.001 && cinematicTarget === 0) cinematic.amount = 0;
  if (cinematic.amount > 0) {
    cinematic.phase += dt * cinematic.amount;
    view.targetAzimuth += dt * 0.055 * cinematic.amount;
    view.targetPolar = clamp(
      cinematic.basePolar + Math.sin(cinematic.phase * 0.31) * 0.055 * cinematic.amount,
      0.24,
      2.9
    );
    view.targetDistance = clamp(
      cinematic.baseDistance + (1 - Math.cos(cinematic.phase * 0.22)) * 0.32 * cinematic.amount,
      1.85,
      7.2
    );
  }

  updateCamera(dt);
  monitorQuality(dt);

  const targetStarMotion = ui.starMotionToggle.checked ? 1 : 0;
  starMotionAmount += (targetStarMotion - starMotionAmount) * Math.min(1, dt * 3.2);
  if (starMotionAmount < 0.001 && targetStarMotion === 0) starMotionAmount = 0;
  starMaterial.uniforms.uTime.value += dt;
  starMaterial.uniforms.uMotion.value = starMotionAmount;

  if (starMotionAmount > 0) {
    stars.rotation.y += dt * 0.0022 * starMotionAmount;
  }

  updateMeteors(dt, starMotionAmount);

  const targetRingMotion = ui.ringMotionToggle.checked ? 1 : 0;
  ringMotionAmount += (targetRingMotion - ringMotionAmount) * Math.min(1, dt * 3.2);
  if (ringMotionAmount < 0.001 && targetRingMotion === 0) ringMotionAmount = 0;

  if (ringParticles) {
    const ringUniforms = ringParticles.material.uniforms;
    ringUniforms.uTime.value += dt;
    ringUniforms.uMotion.value = ringMotionAmount;
  }

  if (!reduceMotion) {
    planet.rotation.y += dt * 0.045;
    clouds.rotation.y += dt * 0.075;

    for (const moon of moonPivots) {
      moon.pivot.rotation.y += moon.speed * dt;
    }

    if (ringParticles) {
      ringParticles.rotation.y += dt * 0.006;
    }

    for (const neighbor of neighborBodies) {
      neighbor.orbit.rotation.y += neighbor.orbitSpeed * dt;
      neighbor.planet.rotation.y += neighbor.spin * dt;
      if (neighbor.moonPivot) {
        neighbor.moonPivot.rotation.y += neighbor.moonSpeed * dt;
      }
    }
  }
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  updateScene(dt);
  renderer.render(scene, camera);
}

/* ------------------------------------------------------------------ */
/*  Start                                                             */
/* ------------------------------------------------------------------ */

const initialSeed = normalizeSeed(seedFromHash() || DEFAULT_SEED);
ui.seedInput.value = initialSeed;
state.seed = initialSeed;
updateHash(initialSeed);
updateCamera(1);
animate();
generate(initialSeed, { updateUrl: false });
