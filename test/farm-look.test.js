'use strict';
/* node test/farm-look.test.js (farm fork): the farm defaults stay a DEFAULT, not a cage, and old stations move once.

   1. Every hull and wall material can still be picked and survives a save round trip. The setters store null for
      "the default", and that rule was hard-coded to the station's old default names, so after the farm defaults
      landed, picking `station` (hull) or `plating` (walls) silently gave clapboard / wainscot instead.
   2. A station saved before the farm fork gets the farm look ONCE: floors still on their kind's old station hue
      and the untouched old starter home move; hand-picked colours stay; a hue picked later is never undone. */
const A = require('./_assert.js');
const M = require('../frontend/app/worldmodel.js');

const roundTrip = st => M.deserialize(JSON.parse(JSON.stringify(st.serialize())));
const home = st => st.serialize().meta.spawnRoomId;

/* ---- 1. every hull / wall material is choosable and round-trips ---- */
{
  const st = M.create(M.starterDoc()), id = home(st);
  A.eq(st.serialize().rooms[id].hullMat, null, 'the farmhouse hull is the default (clapboard), not pinned');
  for (const mat of M.HULL_ORDER) {
    const r = st.setHull(id, { mat });
    A.ok(r && r.ok, 'setHull accepts ' + mat);
    const back = roundTrip(st).serialize().rooms[id];
    const eff = back.hullMat || 'clapboard';
    A.eq(eff, mat === 'insulation' ? 'thermal' : mat, 'hull ' + mat + ' is what renders after a round trip');
  }
  for (const mat of M.WALL_ORDER) {
    if (!M.WALL_MATERIALS[mat]) continue;
    const r = st.setWalls(id, { mat });
    A.ok(r && r.ok, 'setWalls accepts ' + mat);
    const back = roundTrip(st).serialize().rooms[id];
    A.eq(back.wallMat || 'wainscot', mat, 'wall ' + mat + ' is what renders after a round trip');
  }
  st.setHull(id, { mat: 'clapboard' }); st.setWalls(id, { mat: 'wainscot' });
  const rm = st.serialize().rooms[id];
  A.eq([rm.hullMat, rm.wallMat], [null, null], 'picking the farm default stores null (no redundant value in the save)');
}

/* ---- 2. the one-time farm look for pre-fork saves ---- */
{
  const doc = M.starterDoc();
  delete doc.meta.farmLook;                               // a save from before the fork
  const r = doc.rooms[doc.meta.spawnRoomId];
  Object.assign(r, { floorStyle: 'hull', floorMat: 'resin', wallMat: 'panelled', hullStyle: 'bone', hullMat: null });
  const lab = JSON.parse(JSON.stringify(r)); lab.kind = 'lab'; lab.floorStyle = 'cobalt'; lab.floorMat = null; lab.wallMat = null; lab.hullStyle = null;
  doc.rooms.lab = lab; doc.order.push('lab');            // a lab whose owner picked cobalt by hand

  const st = M.create(doc), out = st.serialize();
  const h = out.rooms[out.meta.spawnRoomId], l = out.rooms.lab;
  A.eq(h.floorStyle, 'honey', 'a floor still on its kind\'s old station hue takes the farm hue');
  A.eq([h.floorMat, h.wallMat, h.hullMat, h.hullStyle], [null, null, null, null], 'the untouched old starter home becomes the farmhouse');
  A.eq(l.floorStyle, 'cobalt', 'a hand-picked colour stays');
  A.eq(out.meta.farmLook, 1, 'the save is stamped so the move happens once');

  const st2 = M.deserialize(out); st2.setFloor(out.meta.spawnRoomId, 'hull');
  const again = roundTrip(st2).serialize();
  A.eq(again.rooms[again.meta.spawnRoomId].floorStyle, 'hull', 'a station hue picked after the move is never undone');
  A.eq(M.defaultDoc().meta.farmLook, 1, 'fresh stations are born stamped');
}

A.report();
