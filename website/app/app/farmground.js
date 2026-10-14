/* STARNET (farm fork) — farmground.js : THE MEADOW. A warm, lived-in farmstead for the station to stand in.

   A ground in the Terrain registry (terrain.js register hook), so it pans, zooms, bakes off-thread and shows
   up in the appearance picker exactly like FOREST and THE MOON. Everything is its own pixels, drawn here:

     1. THE PATCH   — sunny grass, dithered across a five-step ramp, with blades, clover and the odd daisy.
     2. THE YARD    — a fence round the station with a gate on the south side, a dirt path running out of it,
                      a crop field to the west and a lily pond to the east. Anchored to the station's rect,
                      so it follows the station wherever it is built.
     3. THE SCATTER — fruit trees, pines, bushes, wildflowers, tufts, rocks and stumps, hashed per world cell
                      (infinite, stored nowhere, identical every visit). Groves far out, open meadow near home.

   Style: a 3/4 view to match the station's tilted camera, soft top-left sun, dark outlines on everything
   that stands up, opaque pixels only (hardEdge drops anything translucent). */
'use strict';
(function () {
  if (typeof Terrain === 'undefined' || !Terrain.register || !Terrain.util) return;
  const { mkCv, clamp01, dither, hardEdge, h01, vnoise, noiseField, SUN } = Terrain.util;

  const PAL = {
    GRASS: [[62, 112, 52], [72, 128, 56], [84, 142, 60], [98, 156, 66], [112, 168, 72]],
    BLADE: [54, 100, 48], BLADE_HI: [136, 186, 86], CLOVER: [70, 134, 64],
    SHADOW: [52, 96, 48],
    LEAF: [[34, 70, 44], [44, 88, 50], [58, 112, 56], [76, 136, 62], [100, 160, 70], [134, 186, 84]],
    PINE: [[22, 56, 50], [30, 74, 60], [42, 96, 70], [58, 118, 80], [80, 140, 90]],
    OUTLINE: [30, 48, 34],
    TRUNK: [[70, 46, 32], [96, 64, 42], [124, 86, 54]],
    FRUIT: [[[176, 42, 40], [226, 84, 64]], [[208, 120, 40], [244, 172, 80]], [[196, 64, 110], [236, 120, 156]]],
    STONE: [[92, 90, 86], [122, 118, 110], [154, 148, 136], [186, 180, 164]],
    SOIL: [[78, 52, 34], [98, 66, 42], [118, 82, 52], [138, 100, 64]],
    PATH: [[150, 116, 76], [170, 134, 90], [190, 154, 106], [206, 174, 126]],
    WATER: [[40, 92, 132], [52, 112, 152], [66, 134, 174], [92, 162, 198]], GLINT: [196, 232, 240],
    SAND: [[176, 150, 104], [204, 180, 130]],
    WOOD: [[92, 60, 38], [132, 92, 58], [168, 124, 80], [196, 156, 104]],
    FLOWERS: [[246, 242, 228], [248, 210, 80], [240, 138, 168], [170, 140, 222], [222, 82, 72], [112, 152, 232]],
    CENTER: [236, 176, 60],
  };

  /* ---- a tiny pixel painter: ImageData in, hard-edged canvas out ---- */
  function Pix(w, h) {
    const cv = mkCv(w, h), c = cv.getContext('2d'), img = c.createImageData(w, h), D = img.data;
    const inside = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
    return {
      cv, w, h,
      put(x, y, col) { x |= 0; y |= 0; if (!inside(x, y)) return; const i = (y * w + x) * 4; D[i] = col[0]; D[i + 1] = col[1]; D[i + 2] = col[2]; D[i + 3] = 255; },
      under(x, y, col) { x |= 0; y |= 0; if (inside(x, y) && !D[(y * w + x) * 4 + 3]) this.put(x, y, col); },
      has(x, y) { x |= 0; y |= 0; return inside(x, y) && D[(y * w + x) * 4 + 3] > 0; },
      rect(x, y, rw, rh, col) { for (let yy = 0; yy < rh; yy++) for (let xx = 0; xx < rw; xx++) this.put(x + xx, y + yy, col); },
      /* a dark rim round everything drawn so far — the cozy read lives in this line */
      outline(col) {
        const rim = [];
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          if (this.has(x, y)) continue;
          if (this.has(x - 1, y) || this.has(x + 1, y) || this.has(x, y - 1) || this.has(x, y + 1)) rim.push(x, y);
        }
        for (let i = 0; i < rim.length; i += 2) this.put(rim[i], rim[i + 1], col);
      },
      done() { c.putImageData(img, 0, 0); return hardEdge(cv); },
    };
  }

  // light on a sphere-ish surface: top-left lit, a little ambient from above
  const shadeAt = (nx, ny) => {
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    return clamp01(0.30 * nz + 0.70 * (0.5 + 0.5 * (nx * SUN.x + ny * SUN.y)));
  };

  /* a lumpy shaded blob: one big body plus lobes, lit from the top-left, dithered through a ramp */
  function blob(p, cx, cy, R, ramp, rnd, lobes, seed) {
    const L = [{ x: cx, y: cy, r: R }];
    for (let i = 0; i < lobes; i++) {
      const a = (i / lobes) * Math.PI * 2 + rnd() * 0.6, d = R * (0.45 + rnd() * 0.2);
      L.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d * 0.85, r: R * (0.48 + rnd() * 0.18) });
    }
    const x0 = Math.floor(cx - R * 1.8), x1 = Math.ceil(cx + R * 1.8), y0 = Math.floor(cy - R * 1.8), y1 = Math.ceil(cy + R * 1.8);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      let best = null, bk = 0;
      for (const l of L) {
        const dx = (x + 0.5 - l.x) / l.r, dy = (y + 0.5 - l.y) / l.r, k = 1 - (dx * dx + dy * dy);
        if (k > bk) { bk = k; best = { dx, dy }; }
      }
      if (!best) continue;
      const mx = (x + 0.5 - cx) / (R * 1.4), my = (y + 0.5 - cy) / (R * 1.4);
      const t = shadeAt(Math.max(-1, Math.min(1, mx)), Math.max(-1, Math.min(1, my))) * 0.6 + shadeAt(best.dx, best.dy) * 0.4;
      p.put(x, y, dither(ramp, t * 1.15 - 0.08, x, y, seed));
    }
    return L;
  }

  const MEADOW = {
    label: 'MEADOW',
    blurb: 'Landed in a summer meadow. Fruit trees, wildflowers, a slow afternoon.',
    base: '#548c42',
    PATCH: 256,
    CELL: 40,

    /* ---- the tiling grass ---- */
    buildPatch(rnd) {
      const P = MEADOW.PATCH, p = Pix(P, P);
      const g1 = noiseField(4, rnd), g2 = noiseField(13, rnd), g3 = noiseField(37, rnd), clov = noiseField(9, rnd);
      for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) {
        const u = x / P, v = y / P;
        const t = g1(u, v) * 0.45 + g2(u, v) * 0.33 + g3(u, v) * 0.22;
        p.put(x, y, dither(PAL.GRASS, t * 1.2 - 0.1, x, y, 3));
      }
      const wrap = n => ((n % P) + P) % P;
      // clover patches: little three-dot leaves where the clover field runs high
      for (let i = 0; i < 900; i++) {
        const x = (rnd() * P) | 0, y = (rnd() * P) | 0;
        if (clov(x / P, y / P) < 0.6) continue;
        p.put(wrap(x), wrap(y), PAL.CLOVER); p.put(wrap(x + 1), wrap(y), PAL.CLOVER); p.put(wrap(x), wrap(y + 1), PAL.CLOVER);
      }
      // grass blades: a dark stroke with a sunlit tip
      for (let i = 0; i < 2600; i++) {
        const x = (rnd() * P) | 0, y = (rnd() * P) | 0, len = 2 + ((rnd() * 3) | 0), lean = rnd() < 0.5 ? 0 : (rnd() < 0.5 ? -1 : 1);
        for (let k = 0; k < len; k++) p.put(wrap(x + (k === len - 1 ? lean : 0)), wrap(y - k), PAL.BLADE);
        if (rnd() < 0.55) p.put(wrap(x + lean), wrap(y - len), PAL.BLADE_HI);
      }
      // a sprinkle of tiny daisies and buttercups
      for (let i = 0; i < 70; i++) {
        const x = (rnd() * P) | 0, y = (rnd() * P) | 0, col = rnd() < 0.6 ? PAL.FLOWERS[0] : PAL.FLOWERS[1];
        p.put(wrap(x), wrap(y), col); p.put(wrap(x + 1), wrap(y), col);
      }
      return p.done();
    },

    /* ---- everything that stands on the grass, built once ---- */
    buildSprites(rnd) {
      const out = [];
      const add = (kind, cv, ox, oy, z) => out.push({ kind, cv, ox, oy, z: z || 0 });

      // FRUIT + LEAF TREES — round crowns on a short trunk, some carrying fruit
      for (let v = 0; v < 12; v++) {
        const R = 13 + Math.round(rnd() * 6), trunkH = 9 + ((rnd() * 5) | 0);
        const W = Math.ceil(R * 3.4), H = Math.ceil(R * 2.6 + trunkH + 8), p = Pix(W, H), cx = W / 2, foot = H - 3;
        const tw = 5;
        for (let y = foot - trunkH - 6; y < foot; y++) for (let x = 0; x < tw; x++) {
          p.put(Math.round(cx - tw / 2 + x), y, PAL.TRUNK[x === 0 ? 2 : x === tw - 1 ? 0 : 1]);
        }
        p.put(Math.round(cx - tw / 2) - 1, foot - 1, PAL.TRUNK[0]); p.put(Math.round(cx + tw / 2), foot - 1, PAL.TRUNK[0]);   // root flare
        const cy = foot - trunkH - R * 0.85;
        const lobes = blob(p, cx, cy, R, PAL.LEAF, rnd, 5 + ((rnd() * 3) | 0), 7 + v);
        // leaf clusters: sunlit flecks on the lit half, dark gaps on the shaded half
        for (let i = 0; i < R * 5; i++) {
          const l = lobes[(rnd() * lobes.length) | 0], a = rnd() * Math.PI * 2, d = rnd() * l.r * 0.8;
          const x = Math.round(l.x + Math.cos(a) * d), y = Math.round(l.y + Math.sin(a) * d);
          if (!p.has(x, y)) continue;
          const lit = (x - cx) * SUN.x + (y - cy) * SUN.y > 0;
          p.put(x, y, lit ? PAL.LEAF[5] : PAL.LEAF[1]); if (lit) p.put(x + 1, y, PAL.LEAF[4]);
        }
        if (v % 3 !== 2) {
          const F = PAL.FRUIT[v % PAL.FRUIT.length];
          for (let i = 0; i < 6 + ((rnd() * 5) | 0); i++) {
            const a = rnd() * Math.PI * 2, d = rnd() * R * 0.9, x = Math.round(cx + Math.cos(a) * d), y = Math.round(cy + Math.sin(a) * d * 0.9);
            if (!p.has(x, y) || !p.has(x + 1, y + 1)) continue;
            p.put(x, y, F[1]); p.put(x + 1, y, F[0]); p.put(x, y + 1, F[0]); p.put(x + 1, y + 1, F[0]);
          }
        }
        p.outline(PAL.OUTLINE);
        for (let y = -3; y <= 3; y++) for (let x = -R; x <= R; x++) {
          if ((x * x) / (R * R) + (y * y) / 9 <= 1) p.under(Math.round(cx + x + 2), foot + y - 1, PAL.SHADOW);
        }
        add('tree', p.done(), cx, foot);
      }

      // PINES — three stacked tiers, lit left, shaded right
      for (let v = 0; v < 6; v++) {
        const Wd = 22 + ((rnd() * 8) | 0), tiers = 3, tierH = 10 + ((rnd() * 3) | 0), trunkH = 5;
        const W = Wd + 10, H = tiers * tierH + trunkH + 14, p = Pix(W, H), cx = W / 2, foot = H - 3;
        p.rect(Math.round(cx - 2), foot - trunkH - 2, 4, trunkH + 2, PAL.TRUNK[1]);
        for (let t = 0; t < tiers; t++) {
          const half = (Wd / 2) * (1 - t * 0.22), base = foot - trunkH - t * (tierH * 0.72), top = base - tierH - 2;
          for (let y = top; y <= base; y++) {
            const f = (y - top) / (base - top), hw = Math.max(1, half * f);
            for (let x = -hw; x <= hw; x++) {
              const side = x / hw, k = clamp01(0.62 - side * 0.42 - (1 - f) * -0.1);
              p.put(Math.round(cx + x), Math.round(y), dither(PAL.PINE, k, Math.round(cx + x), Math.round(y), 21 + v));
            }
          }
        }
        p.outline(PAL.OUTLINE);
        for (let x = -Wd / 2; x <= Wd / 2; x++) for (let y = -2; y <= 2; y++) {
          if ((x * x) / (Wd * Wd / 4) + (y * y) / 4 <= 1) p.under(Math.round(cx + x + 2), foot + y - 1, PAL.SHADOW);
        }
        add('pine', p.done(), cx, foot);
      }

      // BUSHES — low and round, some with berries
      for (let v = 0; v < 6; v++) {
        const R = 5 + ((rnd() * 4) | 0), W = R * 4, H = R * 3, p = Pix(W, H), cx = W / 2, foot = H - 2;
        blob(p, cx, foot - R * 0.9, R, PAL.LEAF, rnd, 3, 40 + v);
        if (v % 2 === 0) for (let i = 0; i < 4; i++) {
          const x = Math.round(cx - R * 0.6 + rnd() * R * 1.2), y = Math.round(foot - R * 1.4 + rnd() * R);
          if (p.has(x, y)) { p.put(x, y, PAL.FRUIT[v % 3][1]); p.put(x, y + 1, PAL.FRUIT[v % 3][0]); }
        }
        p.outline(PAL.OUTLINE);
        for (let x = -R; x <= R; x++) p.under(Math.round(cx + x + 1), foot, PAL.SHADOW);
        add('bush', p.done(), cx, foot);
      }

      // WILDFLOWERS — little clusters on stems
      for (let v = 0; v < 10; v++) {
        const p = Pix(16, 12), n = 3 + ((rnd() * 4) | 0), col = PAL.FLOWERS[v % PAL.FLOWERS.length];
        for (let i = 0; i < n; i++) {
          const x = 2 + ((rnd() * 11) | 0), top = 2 + ((rnd() * 5) | 0);
          for (let y = top + 1; y < 11; y++) p.put(x, y, PAL.BLADE);
          p.put(x - 1, top, col); p.put(x + 1, top, col); p.put(x, top - 1, col); p.put(x, top + 1, col);
          p.put(x, top, v % PAL.FLOWERS.length === 1 ? PAL.TRUNK[1] : PAL.CENTER);
        }
        add('flowers', p.done(), 8, 11);
      }

      // TUFTS — tall grass
      for (let v = 0; v < 6; v++) {
        const p = Pix(12, 10);
        for (let i = 0; i < 6; i++) {
          const x = 2 + ((rnd() * 8) | 0), len = 4 + ((rnd() * 5) | 0), lean = rnd() < 0.5 ? -1 : 1;
          for (let k = 0; k < len; k++) p.put(x + (k > len / 2 ? lean : 0), 9 - k, k > len - 2 ? PAL.BLADE_HI : PAL.LEAF[2 + (i & 1)]);
        }
        add('tuft', p.done(), 6, 9);
      }

      // ROCKS — warm grey, round, outlined
      for (let v = 0; v < 5; v++) {
        const rw = 4 + ((rnd() * 4) | 0), rh = Math.max(3, Math.round(rw * 0.7)), W = rw * 2 + 6, H = rh * 2 + 5, p = Pix(W, H), cx = W / 2, cy = H - rh - 3;
        for (let y = -rh; y <= rh; y++) for (let x = -rw; x <= rw; x++) {
          const nx = x / rw, ny = y / rh; if (nx * nx + ny * ny > 1) continue;
          p.put(Math.round(cx + x), Math.round(cy + y), dither(PAL.STONE, shadeAt(nx, ny) * 1.2 - 0.1, x, y, 60 + v));
        }
        p.outline(PAL.OUTLINE);
        for (let x = -rw; x <= rw; x++) p.under(Math.round(cx + x + 1), cy + rh + 1, PAL.SHADOW);
        add('rock', p.done(), cx, cy + rh + 1);
      }

      // STUMPS — rings on top, bark on the side
      for (let v = 0; v < 3; v++) {
        const rw = 5 + v, W = rw * 2 + 6, H = 16, p = Pix(W, H), cx = W / 2, top = 6;
        p.rect(Math.round(cx - rw), top, rw * 2 + 1, 6, PAL.TRUNK[1]);
        p.rect(Math.round(cx - rw), top, 2, 6, PAL.TRUNK[2]);
        for (let y = -2; y <= 2; y++) for (let x = -rw; x <= rw; x++) {
          const d = (x * x) / (rw * rw) + (y * y) / 4; if (d > 1) continue;
          p.put(Math.round(cx + x), top + y, d > 0.65 ? PAL.WOOD[2] : (d > 0.25 ? PAL.WOOD[3] : PAL.WOOD[2]));
        }
        p.outline(PAL.OUTLINE);
        add('stump', p.done(), cx, top + 7);
      }

      // FENCE — a south-facing run (posts + two rails) and a side run (posts stacked away from us)
      const SEG = MEADOW.FENCE_SEG;
      {
        const p = Pix(SEG + 2, 16);
        for (const x0 of [0, SEG - 4]) {
          p.rect(x0 + 1, 2, 4, 13, PAL.WOOD[1]); p.rect(x0 + 1, 2, 1, 13, PAL.WOOD[2]); p.rect(x0 + 1, 1, 4, 1, PAL.WOOD[3]);
        }
        for (const ry of [5, 10]) { p.rect(1, ry, SEG, 2, PAL.WOOD[2]); p.rect(1, ry, SEG, 1, PAL.WOOD[3]); }
        p.outline(PAL.WOOD[0]);
        add('fenceH', p.done(), 0, 15);
      }
      {
        const p = Pix(8, SEG + 16);
        p.rect(3, 0, 2, SEG + 4, PAL.WOOD[2]); p.rect(3, 0, 1, SEG + 4, PAL.WOOD[3]);
        p.rect(2, SEG, 4, 14, PAL.WOOD[1]); p.rect(2, SEG, 1, 14, PAL.WOOD[2]); p.rect(2, SEG - 1, 4, 1, PAL.WOOD[3]);
        p.outline(PAL.WOOD[0]);
        add('fenceV', p.done(), 4, SEG + 15);
      }

      // DIRT PATH — soft irregular patches laid end to end
      for (let v = 0; v < 6; v++) {
        const W = 34, H = 20, p = Pix(W, H);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const nx = (x - W / 2) / (W / 2), ny = (y - H / 2) / (H / 2), wob = (h01(x, y, 80 + v) - 0.5) * 0.25;
          if (nx * nx + ny * ny > 0.9 + wob) continue;
          p.put(x, y, dither(PAL.PATH, 0.55 - ny * 0.2 + (h01(x, y, 90 + v) - 0.5) * 0.4, x, y, 95 + v));
        }
        for (let i = 0; i < 6; i++) { const x = 6 + ((rnd() * 22) | 0), y = 5 + ((rnd() * 10) | 0); if (p.has(x, y)) p.put(x, y, PAL.STONE[2]); }
        add('path', p.done(), W / 2, H / 2, -1);
      }

      // CROP FIELDS — tilled rows with something growing on every ridge
      const crops = [
        (p, x, y) => { p.rect(x - 2, y - 3, 5, 4, [70, 140, 70]); p.rect(x - 1, y - 4, 3, 1, [120, 190, 96]); p.put(x, y - 2, [150, 206, 120]); },          // cabbage
        (p, x, y) => { p.put(x, y, [232, 128, 48]); for (let k = 1; k < 5; k++) { p.put(x - 1 + (k & 1), y - k, [86, 162, 70]); } p.put(x + 1, y - 4, [120, 190, 96]); }, // carrot
        (p, x, y) => { p.rect(x - 2, y - 3, 5, 4, [222, 132, 46]); p.rect(x - 2, y - 3, 1, 4, [244, 170, 80]); p.put(x, y - 4, [86, 140, 60]); },        // pumpkin
        (p, x, y) => { for (let k = 0; k < 3; k++) { p.rect(x - 2 + k * 2, y - 6, 1, 6, [214, 182, 86]); p.put(x - 2 + k * 2, y - 7, [240, 214, 120]); } },  // wheat
      ];
      for (let v = 0; v < 3; v++) {
        const W = MEADOW.FIELD.w, H = MEADOW.FIELD.h, p = Pix(W, H);
        p.rect(0, 0, W, H, PAL.SOIL[1]);
        for (let y = 4; y < H - 2; y += 10) {
          p.rect(2, y, W - 4, 2, PAL.SOIL[0]); p.rect(2, y + 2, W - 4, 2, PAL.SOIL[3]); p.rect(2, y + 4, W - 4, 1, PAL.SOIL[2]);
          const kind = crops[(v + (y / 10 | 0)) % crops.length];
          for (let x = 7; x < W - 5; x += 9) if (h01(x, y, 140 + v) > 0.12) kind(p, x, y + 3);
        }
        p.outline(PAL.WOOD[1]);
        add('field', p.done(), 0, 0, -1);
      }

      // LILY POND — sandy rim, deep middle, pads and a pink bloom, reeds on the bank
      {
        const W = MEADOW.POND.w, H = MEADOW.POND.h, p = Pix(W + 8, H + 8), cx = (W + 8) / 2, cy = (H + 8) / 2;
        for (let y = 0; y < H + 8; y++) for (let x = 0; x < W + 8; x++) {
          const nx = (x - cx) / (W / 2), ny = (y - cy) / (H / 2), d = nx * nx + ny * ny + (h01(x >> 2, y >> 2, 150) - 0.5) * 0.08;
          if (d > 1) continue;
          if (d > 0.82) { p.put(x, y, PAL.SAND[d > 0.92 ? 0 : 1]); continue; }
          p.put(x, y, dither(PAL.WATER, 0.25 + d * 0.9 - ny * 0.1, x, y, 151));
        }
        for (let i = 0; i < 14; i++) {                     // glints
          const x = Math.round(cx + (rnd() - 0.5) * W * 0.6), y = Math.round(cy + (rnd() - 0.5) * H * 0.5);
          p.rect(x, y, 3, 1, PAL.GLINT);
        }
        for (let i = 0; i < 5; i++) {                      // lily pads
          const x = Math.round(cx + (rnd() - 0.5) * W * 0.55), y = Math.round(cy + (rnd() - 0.5) * H * 0.45);
          for (let yy = -2; yy <= 2; yy++) for (let xx = -3; xx <= 3; xx++) {
            if ((xx * xx) / 9 + (yy * yy) / 4 <= 1 && !(xx > 0 && yy === 0)) p.put(x + xx, y + yy, xx < 0 ? [96, 166, 74] : [70, 136, 62]);
          }
          if (i % 2 === 0) { p.put(x - 1, y - 1, PAL.FLOWERS[2]); p.put(x, y - 2, PAL.FLOWERS[2]); p.put(x - 1, y - 2, PAL.FLOWERS[0]); }
        }
        for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {   // reeds
          const x = Math.round(cx + side * (W / 2 - 4 - i * 3)), base = Math.round(cy + 4 - i), len = 8 + ((rnd() * 6) | 0);
          for (let k = 0; k < len; k++) p.put(x, base - k, PAL.LEAF[2]);
          p.rect(x, base - len - 2, 1, 3, PAL.TRUNK[1]);
        }
        add('pond', p.done(), 4, 4, -1);
      }
      return out;
    },

    FENCE_SEG: 24,
    YARD: 34,                              // world px of grass between the station and its fence
    FIELD: { w: 112, h: 86 },
    POND: { w: 120, h: 70 },

    /* the fixed landmarks round the station, derived from its rect (null before the first bake) */
    yard(clr) {
      if (!clr) return null;
      const Y = MEADOW.YARD, SEG = MEADOW.FENCE_SEG;
      const fx = clr.x - Y, fy = clr.y - Y;
      const nx = Math.max(2, Math.ceil((clr.w + Y * 2) / SEG)), ny = Math.max(2, Math.ceil((clr.h + Y * 2) / SEG));
      const fence = { x: fx, y: fy, w: nx * SEG, h: ny * SEG, nx, ny };
      const gate = { x: fence.x + Math.floor(nx / 2) * SEG - SEG, w: SEG * 2, y: fence.y + fence.h };
      const field = { x: fence.x - 40 - MEADOW.FIELD.w, y: fence.y + 24, w: MEADOW.FIELD.w, h: MEADOW.FIELD.h };
      const pond = { x: fence.x + fence.w + 44, y: fence.y + fence.h * 0.5 - MEADOW.POND.h / 2, w: MEADOW.POND.w + 8, h: MEADOW.POND.h + 8 };
      return { fence, gate, field, pond, gx: gate.x + gate.w / 2 };
    },
    pathX(yd, wy) {                        // the path wanders a little as it leaves the gate
      const t = clamp01((wy - yd.gate.y) / 260);
      return yd.gx + (vnoise(0.5, wy / 240, 61) - 0.5) * 90 * t;
    },

    place(push, x0, y0, x1, y1, clr, scale, pools) {
      const C = MEADOW.CELL, SEG = MEADOW.FENCE_SEG, yd = MEADOW.yard(clr);
      const pick = (kind, k) => { const a = pools[kind]; return a && a.length ? a[(k * a.length) | 0] : null; };
      const pad = (r, m) => r && { x: r.x - m, y: r.y - m, w: r.w + m * 2, h: r.h + m * 2 };
      const inRect = (r, x, y) => r && x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h;
      const stn = clr ? { x: clr.x + C * 0.5, y: clr.y + C * 0.5, w: clr.w - C, h: clr.h - C } : null;

      if (yd) {
        const f = yd.fence, gate = yd.gate;
        // flat things first (z -1): path, field, pond
        // stones every 13 px from the gate; start at the first one in view (same phase) instead of walking there
        const p0 = gate.y + 4, k0 = Math.max(0, Math.ceil((y0 - 20 - p0) / 13));
        if (pools.path) for (let wy = p0 + k0 * 13; wy < y1 + 20; wy += 13) {
          push(pick('path', h01(0, wy | 0, 70)), MEADOW.pathX(yd, wy), wy);
        }
        if (pools.field && x1 > yd.field.x && x0 < yd.field.x + yd.field.w) push(pools.field[0], yd.field.x, yd.field.y);
        if (pools.pond && x1 > yd.pond.x && x0 < yd.pond.x + yd.pond.w) push(pools.pond[0], yd.pond.x, yd.pond.y);
        // the fence, with the gate left open on the south side
        if (pools.fenceH) for (let i = 0; i < f.nx; i++) {
          const sx = f.x + i * SEG;
          push(pools.fenceH[0], sx, f.y);
          if (sx < gate.x || sx >= gate.x + gate.w) push(pools.fenceH[0], sx, f.y + f.h);
        }
        if (pools.fenceV) for (let i = 1; i <= f.ny; i++) {
          push(pools.fenceV[0], f.x + 2, f.y + i * SEG);
          push(pools.fenceV[0], f.x + f.w + 2, f.y + i * SEG);
        }
      }

      const fenceZone = yd ? pad(yd.fence, 14) : (clr ? pad(clr, C) : null);
      const fieldZone = yd ? pad(yd.field, 16) : null, pondZone = yd ? pad(yd.pond, 14) : null;
      const onPath = (x, y) => yd && y > yd.gate.y - 6 && Math.abs(x - MEADOW.pathX(yd, y)) < 26;
      const clutter = scale >= 0.5;
      const cx0 = Math.floor(x0 / C), cx1 = Math.ceil(x1 / C), cy0 = Math.floor(y0 / C), cy1 = Math.ceil(y1 / C);
      for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
        const wx0 = cx * C, wy0 = cy * C;
        const blocked = (x, y, tall) => onPath(x, y) || inRect(fieldZone, x, y) || inRect(pondZone, x, y) ||
          (tall ? inRect(fenceZone, x, y + 30) || inRect(fenceZone, x, y) : inRect(stn, x, y));

        /* groves out in the meadow, open grass close to home */
        const dens = vnoise(wx0 / 380, wy0 / 380, 3) * 0.6 + vnoise(wx0 / 150, wy0 / 150, 11) * 0.4;
        let near = 0;
        if (clr) {
          const dx = Math.max(clr.x - wx0, 0, wx0 - (clr.x + clr.w)), dy = Math.max(clr.y - wy0, 0, wy0 - (clr.y + clr.h));
          near = clamp01(1 - Math.sqrt(dx * dx + dy * dy) / 320);
        }
        const want = dens * 1.25 - near * 0.55;
        const nTree = want > 0.62 ? (h01(cx, cy, 1) < 0.45 ? 2 : 1) : (want > 0.46 && h01(cx, cy, 1) < 0.28 ? 1 : 0);
        for (let k = 0; k < nTree; k++) {
          const wx = wx0 + h01(cx, cy, 20 + k) * C, wy = wy0 + h01(cx, cy, 30 + k) * C;
          if (blocked(wx, wy, true)) continue;
          const cold = vnoise(wx / 300, wy / 300, 7);
          const sp = pick(cold > 0.62 ? 'pine' : 'tree', h01(cx, cy, 40 + k));
          if (sp) push(sp, wx, wy);
        }
        if (!clutter) continue;
        const nSmall = 1 + ((h01(cx, cy, 5) * (2 + dens * 2)) | 0);
        for (let k = 0; k < nSmall; k++) {
          const wx = wx0 + h01(cx, cy, 60 + k) * C, wy = wy0 + h01(cx, cy, 70 + k) * C;
          const r = h01(cx, cy, 80 + k);
          const kind = r < 0.38 ? 'flowers' : r < 0.66 ? 'tuft' : r < 0.80 ? 'bush' : r < 0.93 ? 'rock' : 'stump';
          if (blocked(wx, wy, kind === 'bush' || kind === 'stump')) continue;
          const sp = pick(kind, h01(cx, cy, 90 + k));
          if (sp) push(sp, wx, wy);
        }
      }
    },
  };

  Terrain.register('meadow', MEADOW, true);
})();
