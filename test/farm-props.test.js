'use strict';
/* node test/farm-props.test.js (farm fork): the farm art for capability props is installed into the REAL PropSprites
   draw table and always paints on the module's current canvas.

   PropSprites swaps its canvas internally when it builds a shadow mask (and its idle-art caches). The first farm
   hook captured the canvas from setCtx(), so a mask build painted the farm sprite onto the main world canvas and
   left the mask empty. This runs the real module with a recording canvas and checks where the pixels land. */
const A = require('./_assert.js');

// a recording 2D context: counts fills, accepts every other call
function recorder(name) {
  const log = { name, fills: 0 };
  const target = { canvas: null, isContextLost: () => false, getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) };
  return new Proxy(target, {
    get(t, k) {
      if (k === '__log') return log;
      if (k in t) return t[k];
      if (k === 'fillRect' || k === 'fill') return () => { log.fills++; };
      return () => {};
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}
const made = [];
global.document = {
  createElement() {
    const g = recorder('offscreen' + made.length);
    const cv = { width: 0, height: 0, getContext: () => g, addEventListener() {} };
    made.push(g);
    return cv;
  },
};

global.FarmProps = require('../frontend/app/farmprops.js');
const Sprites = require('../frontend/app/propsprites.js');

/* ---- 1. the farm ids are owned and installed for every facing ---- */
A.eq([...FarmProps.ids].sort(), ['comms_dish', 'desk', 'gigs_servercart', 'studio', 'war_intelcab', 'workbench'], 'the six farm-skinned ids');
A.ok(FarmProps.owns('desk') && !FarmProps.owns('desk2') && !FarmProps.owns('toString'), 'owns() is exact (no prefix or prototype matches)');
{
  const main = recorder('main');
  Sprites.setCtx(main); Sprites.setNow(1000);
  Sprites._F.desk(0, 0, 24, 12, {});
  A.ok(main.__log.fills > 0, 'the desk draws through the farm art onto the canvas given to setCtx');
}

/* ---- 2. a shadow mask paints the farm sprite on the MASK, never on the world canvas ---- */
for (const t of FarmProps.ids) {
  const main = recorder('main');
  Sprites.setCtx(main); Sprites.setNow(2000);
  const before = made.length;
  Sprites.drawShadow({ t, x: 2, y: 2, w: 2, h: 2 });
  const masks = made.slice(before);
  A.ok(masks.length > 0, t + ': drawShadow builds an offscreen mask');
  A.ok(masks.some(g => g.__log.fills > 0), t + ': the farm sprite is painted into the mask');
  A.eq(main.__log.fills, 0, t + ': nothing from the mask build lands on the world canvas');
}

/* ---- 3. install() restores the module's handle after each draw, even when the art throws ---- */
{
  const seen = [];
  const F = { desk: null, 'desk:e': null, desk2: null };
  const a = recorder('a'), b = recorder('b');
  let cur = a;
  FarmProps.install(F, () => cur, () => 5);
  A.ok(typeof F.desk === 'function' && typeof F['desk:e'] === 'function', 'install replaces every facing of an owned id');
  A.eq(F.desk2, null, 'install leaves a different id with a shared prefix alone');
  F.desk(0, 0, 24, 12, {}); seen.push(a.__log.fills);
  cur = b; F.desk(0, 0, 24, 12, {}); seen.push(b.__log.fills);
  A.ok(seen[0] > 0 && seen[1] > 0, 'each call reads the canvas current at that moment');
  cur = null;
  F.desk(0, 0, 24, 12, {});
  A.ok(true, 'no canvas: the draw is a silent no-op');
}

A.report();
