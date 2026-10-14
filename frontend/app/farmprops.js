/* STARNET (farm fork) — farmprops.js : farm art for the station's capability props.

   The capability model is untouched: a prop still IS its capability (the dish still grants the web, the workbench
   still grants shell + verify). Only the picture changes, so the agents' real work reads as farm chores:

     comms_dish -> FISHING POND   web search / fetch = casting a line and reeling something in
     workbench  -> CHOPPING BLOCK running and testing code = splitting wood

   How it hooks in WITHOUT editing propsprites.js: PropSprites exposes its draw-fn table as `_F` and takes its canvas
   through setCtx/setNow. We wrap those two setters to keep our own handle on the context, then replace the draw fns
   for these ids (every facing). Loaded right after propsprites.js, before anything is drawn.

   Art is drawn on a HALF-PIXEL grid (u = 0.5 world px) so it sits at the same density as the remastered props. */
'use strict';
(function () {
  if (typeof PropSprites === 'undefined' || !PropSprites._F || !PropSprites.setCtx) return;

  let ctx = null, now = 0;
  const setCtx0 = PropSprites.setCtx, setNow0 = PropSprites.setNow;
  PropSprites.setCtx = c => { ctx = c; return setCtx0(c); };
  PropSprites.setNow = t => { now = t; return setNow0(t); };

  const U = 0.5;
  const C = {
    WOOD: ['#5c3c26', '#845c3a', '#a87c50', '#c49c68'], BARK: ['#4a3020', '#62402a', '#7a5434'],
    RING: ['#b88a58', '#d0a874', '#e2c08c'],
    WATER: ['#285c84', '#347098', '#4286ae', '#5ca2c6'], GLINT: '#c4e8f0',
    SAND: ['#b09668', '#ccb482'], GRASS: ['#3e7034', '#548c42', '#6ea84e'],
    LILY: ['#467c3c', '#60a64a'], PINK: '#f08aa8', WHITE: '#f6f2e4',
    STEEL: ['#5a5e64', '#8a9098', '#c4c8cc'], RED: '#d8504a', FISH: ['#d8742c', '#f4a454'],
    LINE: '#e8e4d8', OUT: '#2c241c',
  };

  // a rect on the half-pixel grid, anchored at the prop box origin
  let OX = 0, OY = 0;
  const px = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(OX + x * U, OY + y * U, w * U, h * U); };
  // a filled ellipse, one span per row (cheap, crisp)
  function ell(cx, cy, rx, ry, col, fn) {
    for (let y = Math.ceil(cy - ry); y < cy + ry; y++) {
      const dy = (y + 0.5 - cy) / ry, hw = rx * Math.sqrt(Math.max(0, 1 - dy * dy));
      const x0 = Math.round(cx - hw), x1 = Math.round(cx + hw);
      if (x1 > x0) px(x0, y, x1 - x0, 1, fn ? fn(y, dy) : col);
    }
  }
  const ring = (cx, cy, rx, ry, col) => {           // an ellipse outline, sampled
    for (let a = 0; a < 24; a++) { const t = a / 24 * Math.PI * 2; px(Math.round(cx + Math.cos(t) * rx), Math.round(cy + Math.sin(t) * ry), 1, 1, col); }
  };

  /* ---------------------------------------------------------------- FISHING POND ---- */
  function pond(x, y, w, h, o) {
    OX = x; OY = y;
    const W = w / U, H = h / U, t = o.still ? 0 : now / 1000;
    const cx = W / 2, cy = H * 0.52, rx = W / 2 - 1, ry = H * 0.40;
    ell(cx, cy + 1, rx + 1, ry + 1, C.OUT);                                       // bank edge
    ell(cx, cy, rx + 0.5, ry + 0.5, null, (yy, dy) => dy > 0.55 ? C.SAND[0] : C.SAND[1]);
    ell(cx, cy + 0.5, rx - 2, ry - 2, null, (yy, dy) => C.WATER[dy < -0.45 ? 0 : dy < 0.0 ? 1 : dy < 0.5 ? 2 : 3]);
    // glints drift slowly
    for (let i = 0; i < 4; i++) {
      const gx = cx - rx * 0.5 + ((i * 13 + t * 2) % (rx * 1.1)), gy = cy - ry * 0.3 + i * 3;
      px(Math.round(gx), Math.round(gy), 3, 1, C.GLINT);
    }
    // lily pad + bloom on the left
    ell(cx - rx * 0.55, cy + 2, 4, 2.5, C.LILY[0]); ell(cx - rx * 0.55 - 1, cy + 1.5, 2.5, 1.5, C.LILY[1]);
    px(Math.round(cx - rx * 0.55), Math.round(cy), 2, 1, C.PINK); px(Math.round(cx - rx * 0.55), Math.round(cy - 1), 1, 1, C.WHITE);
    // reeds on the right bank
    for (let i = 0; i < 4; i++) {
      const rxp = Math.round(cx + rx - 3 - i * 2), sway = o.still ? 0 : Math.round(Math.sin(t * 1.4 + i) * 0.6), len = 8 + (i % 2) * 4;
      px(rxp, Math.round(cy - len + 3), 1, len, C.GRASS[1 + (i & 1)]);
      px(rxp + sway, Math.round(cy - len + 1), 1, 3, C.BARK[1]);
    }
    // a little plank jetty on the near bank, where the angler stands
    const jx = Math.round(cx - 5), jy = Math.round(cy + ry - 5);
    px(jx - 1, jy - 1, 12, 9, C.OUT);
    for (let k = 0; k < 3; k++) { px(jx, jy + k * 3, 10, 2, C.WOOD[2]); px(jx, jy + k * 3 + 2, 10, 1, C.WOOD[1]); }
    px(jx, jy + 8, 2, 3, C.WOOD[0]); px(jx + 8, jy + 8, 2, 3, C.WOOD[0]);

    if (o.work || o.fired) {
      // the line goes out from the jetty to a bobbing float, with rings spreading round it
      const bob = o.still ? 0 : Math.round(Math.sin(t * 3.2) * 0.8);
      const bx = Math.round(cx + rx * 0.25), by = Math.round(cy - ry * 0.25) + bob;
      const steps = 12;
      for (let s = 1; s < steps; s++) {
        const f = s / steps, lx = jx + 5 + (bx - jx - 5) * f, ly = jy - 2 + (by - jy + 2) * f - Math.sin(f * Math.PI) * 4;
        px(Math.round(lx), Math.round(ly), 1, 1, C.LINE);
      }
      const ph = (t * 0.8) % 1;
      ring(bx, by + 2, 2 + ph * 6, 1 + ph * 3, ph < 0.6 ? C.WATER[3] : C.WATER[2]);
      px(bx - 1, by - 1, 2, 1, C.WHITE); px(bx - 1, by, 2, 2, C.RED);
    }
    if (o.fired) {
      // a fish jumps clear: the "found something" beat, gone in under a second
      const arc = Math.sin(Math.min(1, +o.fired || 0) * Math.PI);          // fired decays 1 -> 0 over the pulse
      const fx = Math.round(cx + rx * 0.05), fy = Math.round(cy - ry * 0.2 - arc * 10);
      px(fx, fy, 5, 2, C.FISH[0]); px(fx, fy, 3, 1, C.FISH[1]); px(fx + 5, fy - 1, 2, 4, C.FISH[0]); px(fx + 1, fy, 1, 1, C.OUT);
      for (let i = 0; i < 4; i++) px(fx - 2 + i * 3, Math.round(cy - ry * 0.2 + 2 - (i & 1) * 2), 1, 1, C.GLINT);
    }
  }

  /* -------------------------------------------------------------- CHOPPING BLOCK ---- */
  function logEnd(cx, cy, r) {
    ell(cx, cy, r + 0.6, r + 0.6, C.OUT);
    ell(cx, cy, r, r, C.RING[0]); ell(cx, cy, r * 0.62, r * 0.62, C.RING[1]); ell(cx, cy, r * 0.25, r * 0.25, C.RING[2]);
  }
  function chopping(x, y, w, h, o) {
    OX = x; OY = y;
    const W = w / U, H = h / U, t = o.still ? 0 : now / 1000;
    const vertical = H > W;
    // where the pile and the block sit inside the box
    const pile = vertical ? { x: W / 2 - 9, y: 4 } : { x: 2, y: H - 14 };
    const blk = vertical ? { x: W / 2, y: H - 8 } : { x: W - 12, y: H - 6 };

    // the woodpile: a stack of log ends, 3-2-1, on two bearers
    px(pile.x - 1, pile.y + 12, 20, 2, C.WOOD[0]);
    const r = 2.6;
    for (let row = 0; row < 3; row++) for (let i = 0; i < 3 - row; i++) {
      logEnd(pile.x + 3 + i * 6 + row * 3, pile.y + 9 - row * 4.6, r);
    }

    // the block: a stump with rings on top and bark round the side
    ell(blk.x, blk.y + 3, 8, 2.5, '#2e4a28');                                   // contact shadow
    px(blk.x - 7, blk.y - 5, 14, 8, C.OUT);
    px(blk.x - 6, blk.y - 5, 12, 7, C.BARK[1]); px(blk.x - 6, blk.y - 5, 3, 7, C.BARK[2]); px(blk.x + 3, blk.y - 5, 3, 7, C.BARK[0]);
    ell(blk.x, blk.y - 5, 7, 2.6, C.OUT); ell(blk.x, blk.y - 5, 6.2, 2.0, C.RING[1]); ell(blk.x, blk.y - 5, 3.2, 1.0, C.RING[0]);

    // the axe: bitten into the block at rest, lifted and swinging while an agent works
    const swing = (o.work && !o.still) ? (Math.sin(t * 5) * 0.5 + 0.5) : 0;
    const hx = blk.x + 1, hy = blk.y - 6 - swing * 6;
    for (let k = 0; k < 9; k++) px(Math.round(hx + k * 0.7), Math.round(hy - k * (0.9 - swing * 0.3)), 1, 1, C.WOOD[3]);
    const ex = Math.round(hx - 2), ey = Math.round(hy - 1);
    px(ex, ey, 4, 3, C.STEEL[1]); px(ex, ey, 1, 3, C.STEEL[2]); px(ex + 3, ey, 1, 3, C.STEEL[0]);

    if (o.work && !o.still) {
      // wood chips fly off on each stroke
      const ph = (t * 2.5) % 1;
      if (ph < 0.5) for (let i = 0; i < 3; i++) {
        px(Math.round(blk.x - 4 + i * 4 + (i - 1) * ph * 6), Math.round(blk.y - 8 - ph * 8 + i), 1, 1, i === 1 ? C.RING[2] : C.RING[1]);
      }
    }
    if (o.fired) {
      // a clean split: two halves fall either side of the block (a failed check splits crooked, in grey)
      const col = o.bad ? C.STEEL[0] : C.RING[1];
      px(blk.x - 10, blk.y - 2, 3, 4, col); px(blk.x - 10, blk.y - 2, 3, 1, C.RING[2]);
      px(blk.x + 7, blk.y - 2, 3, 4, col); px(blk.x + 7, blk.y - 2, 3, 1, C.RING[2]);
    }
  }

  function skin(id, fn) {
    const F = PropSprites._F;
    for (const k of Object.keys(F)) if (k === id || k.indexOf(id + ':') === 0) F[k] = (x, y, w, h, o) => { if (ctx) fn(x, y, w, h, o || {}); };
  }
  skin('comms_dish', pond);
  skin('workbench', chopping);
})();
