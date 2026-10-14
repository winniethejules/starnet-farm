/* STARNET (farm fork), farmprops.js: farm art for the station's capability props.

   The capability model is untouched: a prop still IS its capability (the dish still grants the web, the workbench
   still grants shell + verify). Only the picture changes, so the agents' real work reads as farm chores:

     comms_dish      -> FISHING POND      web search / fetch = casting a line and reeling something in
     workbench       -> CHOPPING BLOCK    running and testing code = splitting wood
     desk            -> KITCHEN TABLE     the agent's own seat; the oil lamp lights while it works
     war_intelcab    -> CHEST OF DRAWERS  files = a drawer slides out when one is read or written
     gigs_servercart -> DIARY LECTERN     memory = the diary, a candle while it writes
     studio          -> EASEL             images = a painting filling in band by band

   How it hooks in: this file loads BEFORE propremaster.js and propsprites.js and only declares FarmProps. Two
   one-line FARM FORK hooks pick it up:
     - propremaster.js skips these ids when it loads the authored art manifest, so no space-art foreground,
       hit mask, screen emitter or surface mount is left behind on top of the farm picture;
     - propsprites.js calls FarmProps.install(F, getCtx, getNow) right before its remaster wrapper, so every
       draw reads the module's CURRENT canvas and clock. PropSprites swaps its canvas internally (shadow masks,
       idle-art caches), so a canvas captured from setCtx() would paint the wrong surface.

   Art is drawn on a HALF-PIXEL grid (u = 0.5 world px) so it sits at the same density as the remastered props. */
'use strict';
const FarmProps = (function () {
  let ctx = null, now = 0;

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

  /* a lantern / candle halo: the one translucent thing we draw, so warm light reads as light */
  function halo(cx, cy, r, a) {
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#ffc870';
    ctx.beginPath(); ctx.arc(OX + cx * U, OY + cy * U, r * U, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  // a table-like wooden slab: lit top, darker apron, outlined
  function slab(x, y, w, d, apron) {
    px(x - 1, y - 1, w + 2, d + apron + 2, C.OUT);
    px(x, y, w, d, C.WOOD[3]); px(x, y + d - 1, w, 1, C.WOOD[2]);
    px(x, y + d, w, apron, C.WOOD[1]);
    for (let i = 6; i < w - 2; i += 9) px(x + i, y + 1, 1, d - 2, C.WOOD[2]);   // board joints
  }

  /* ------------------------------------------------------- KITCHEN TABLE (the desk) ---- */
  function table(x, y, w, h, o) {
    OX = x; OY = y;
    const W = w / U, H = h / U, t = o.still ? 0 : now / 1000;
    if (H > W) {                                            // turned east/west: a narrow table seen end-on
      slab(4, 2, W - 8, H - 12, 3);
      px(W / 2 - 3, 8, 6, 4, C.WHITE); px(W / 2, 8, 1, 4, C.RING[0]);
      return;
    }
    // legs, then the top over them
    for (const lx of [4, W - 7]) { px(lx - 1, 4, 5, H - 4, C.OUT); px(lx, 4, 3, H - 5, C.WOOD[1]); }
    slab(2, -6, W - 4, 8, 3);
    // an open book on the table, pages turning while the agent works
    px(W / 2 - 8, -4, 16, 6, C.OUT); px(W / 2 - 7, -4, 7, 5, C.WHITE); px(W / 2, -4, 7, 5, '#ece4cc');
    for (let k = 0; k < 3; k++) { px(W / 2 - 6, -3 + k * 1.5, 5, 0.5, C.STEEL[1]); px(W / 2 + 1, -3 + k * 1.5, 5, 0.5, C.STEEL[1]); }
    if (o.work && !o.still && (t * 1.2) % 1 < 0.25) px(W / 2 - 1, -6, 4, 6, C.WHITE);   // a page mid-turn
    // a little potted herb on the left
    px(6, -9, 5, 4, C.OUT); px(7, -8, 3, 3, '#b8643c'); px(6, -12, 5, 4, C.GRASS[2]); px(7, -13, 2, 2, C.GRASS[1]);
    // the oil lamp on the right: dark frame, glass that glows when someone is at the table
    const lx = W - 12;
    px(lx - 1, -15, 7, 11, C.OUT); px(lx, -14, 5, 9, o.work ? '#ffd27a' : '#c8b48a');
    px(lx + 2, -12, 1, 4, o.work ? '#fff4c8' : C.WOOD[2]); px(lx, -16, 5, 1, C.STEEL[0]); px(lx + 1, -18, 3, 2, C.STEEL[0]);
    if (o.work) halo(lx + 2.5, -10, 14 + (o.still ? 0 : Math.sin(t * 6) * 0.8), 0.18);
    // a stool tucked under the near edge
    px(W / 2 - 5, H - 7, 10, 4, C.OUT); px(W / 2 - 4, H - 7, 8, 3, C.WOOD[2]); px(W / 2 - 4, H - 4, 1, 3, C.WOOD[0]); px(W / 2 + 3, H - 4, 1, 3, C.WOOD[0]);
  }

  /* -------------------------------------------------- CHEST OF DRAWERS (the files) ---- */
  function dresser(x, y, w, h, o) {
    OX = x; OY = y;
    const W = w / U, H = h / U, t = o.still ? 0 : now / 1000;
    const top = 2, bot = H - 2;
    px(1, top - 1, W - 2, bot - top + 2, C.OUT);
    px(2, top, W - 4, bot - top, C.WOOD[1]); px(2, top, W - 4, 3, C.WOOD[3]); px(2, top + 3, 1, bot - top - 3, C.WOOD[2]);
    const n = Math.max(2, Math.floor((bot - top - 6) / 9)), dh = (bot - top - 6) / n;
    for (let i = 0; i < n; i++) {
      const dy = top + 5 + i * dh, open = (o.fired && i === 0) ? 2 : 0;
      if (open) { px(4, dy, W - 8, 2, '#2a1c12'); px(6, dy + 0.5, 4, 1, C.WHITE); }   // drawer pulled out, a paper inside
      px(4, dy + open, W - 8, dh - 2, C.WOOD[2]); px(4, dy + open, W - 8, 1, C.WOOD[3]);
      px(W / 2 - 1, dy + open + dh / 2 - 2, 2, 2, C.RING[2]);
    }
    // a jar of wildflowers on top
    px(W / 2 - 3, top - 6, 6, 6, C.OUT); px(W / 2 - 2, top - 5, 4, 5, '#9cc4c8');
    const sway = o.still ? 0 : Math.round(Math.sin(t * 1.3));
    px(W / 2 - 3 + sway, top - 9, 2, 2, C.PINK); px(W / 2 + 1, top - 10, 2, 2, '#f8d250'); px(W / 2 - 1, top - 11 + sway, 2, 2, C.WHITE);
    px(W / 2 - 1, top - 8, 1, 3, C.GRASS[1]); px(W / 2 + 1, top - 8, 1, 3, C.GRASS[1]);
  }

  /* --------------------------------------------------- DIARY LECTERN (the memory) ---- */
  function lectern(x, y, w, h, o) {
    OX = x; OY = y;
    const W = w / U, H = h / U, t = o.still ? 0 : now / 1000;
    px(W / 2 - 2, 4, 4, H - 6, C.OUT); px(W / 2 - 1, 4, 2, H - 7, C.WOOD[1]);              // post
    px(W / 2 - 6, H - 3, 12, 2, C.WOOD[0]);                                                  // foot
    px(2, -4, W - 4, 9, C.OUT); px(3, -3, W - 6, 7, C.WOOD[2]); px(3, -3, W - 6, 1, C.WOOD[3]);   // slanted rest
    px(5, -2, W / 2 - 5, 5, C.WHITE); px(W / 2, -2, W / 2 - 5, 5, '#ece4cc');                // the open diary
    px(W / 2 - 1, -3, 1, 7, '#a83c3c');                                                      // ribbon
    // a candle on the corner
    px(W - 5, -9, 2, 5, '#f4ecd8'); const fl = o.still ? 0 : Math.round(Math.sin(t * 9) * 0.5);
    px(W - 5 + fl, -11, 2, 2, o.work ? '#ffcc4c' : '#e8a040');
    if (o.work) halo(W - 4, -10, 9, 0.2);
    if (o.fired) for (let i = 0; i < 3; i++) px(6 + i * 4, -5 - ((now / 120 + i) % 4), 1, 1, '#fff4c8');   // remembered: a few motes rise
  }

  /* ---------------------------------------------------------- EASEL (the studio) ---- */
  function easel(x, y, w, h, o) {
    OX = x; OY = y;
    const W = w / U, H = h / U, t = o.still ? 0 : now / 1000;
    const cx = W / 2 - 4;
    // tripod legs
    for (let k = 0; k < H + 4; k++) { px(Math.round(cx - 8 + k * 0.25), k - 6, 1, 1, C.WOOD[1]); px(Math.round(cx + 8 - k * 0.25), k - 6, 1, 1, C.WOOD[1]); }
    px(cx, -8, 1, H + 4, C.WOOD[0]);
    // the canvas
    const cw = 20, ch = 16, cx0 = cx - cw / 2, cy0 = -14;
    px(cx0 - 1, cy0 - 1, cw + 2, ch + 2, C.OUT); px(cx0, cy0, cw, ch, '#f4ecd8');
    // the painting comes in band by band while the agent works; complete once something has rendered
    const p = o.fired ? 1 : (o.work ? (t * 0.25) % 1 : 1);
    const rows = Math.round(ch * p);
    for (let r = 0; r < rows; r++) {
      const yy = cy0 + ch - 1 - r, f = 1 - (yy - cy0) / ch;
      const col = f < 0.3 ? '#5a9c48' : f < 0.45 ? '#84b858' : '#9ccce4';
      px(cx0, yy, cw, 1, col);
    }
    if (rows > ch * 0.7) { px(cx0 + cw - 6, cy0 + 2, 3, 3, '#f8d250'); }                     // the sun, last
    px(cx0 - 2, cy0 + ch + 1, cw + 4, 2, C.WOOD[2]);                                          // the ledge
    // paint pots on a little stool beside it
    const sx = W - 12, sy = H - 12;
    px(sx - 1, sy - 1, 11, 4, C.OUT); px(sx, sy, 9, 3, C.WOOD[2]); px(sx + 1, sy + 3, 1, 5, C.WOOD[0]); px(sx + 7, sy + 3, 1, 5, C.WOOD[0]);
    [['#d8504a', 0], ['#4a86c8', 3], ['#f8d250', 6]].forEach(([c, dx]) => { px(sx + dx, sy - 3, 3, 3, C.OUT); px(sx + dx + 0.5, sy - 2.5, 2, 2, c); });
    if (o.work && !o.still) halo(cx, cy0 + ch / 2, 16, 0.08 + 0.05 * Math.sin(t * 4));
  }

  const ART = { comms_dish: pond, workbench: chopping, desk: table, war_intelcab: dresser, gigs_servercart: lectern, studio: easel };
  const owns = id => Object.prototype.hasOwnProperty.call(ART, id);

  // Replace the draw fn for every facing of each farm id (`id` and `id:<facing>`). getCtx/getNow are read on
  // EVERY call: the canvas can change between the world pass, a shadow mask and an idle-art cache.
  function install(F, getCtx, getNow) {
    for (const k of Object.keys(F)) {
      const id = k.split(':')[0];
      if (!owns(id)) continue;
      const fn = ART[id];
      F[k] = (x, y, w, h, o) => {
        const c = getCtx(); if (!c) return;
        const prevCtx = ctx, prevNow = now;
        ctx = c; now = getNow() || 0;
        try { fn(x, y, w, h, o || {}); } finally { ctx = prevCtx; now = prevNow; }
      };
    }
  }

  return { ids: Object.freeze(Object.keys(ART)), owns, install };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = FarmProps;
