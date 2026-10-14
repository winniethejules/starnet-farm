/* STARNET (farm fork), farmlight.js: DAYLIGHT for a landed farmstead.

   The station's lighting was tuned for vacuum: nothing lights the hull but starlight, so the exterior is
   exposed down to near-black and fades into the void at the skirt's foot. A farmhouse in a sunny meadow is
   the opposite case, so the shell gets a full daylight exposure here. Interior ambient lives in stationui's
   ROOM_LIGHTING_STEPS (the user's LOW / MEDIUM / HIGH choice), which the fork brightens at the source; the
   baked-in ambient below is set to the farm LOW so "LOW" still means "the approved look, untouched".

   Loaded right after stationbake.js, before the first bake. */
'use strict';
(function () {
  if (typeof StationBake === 'undefined' || !StationBake.WALL) return;
  // exterior exposure at the deck line / at the skirt's foot (stationbake ships 0.70 / 0.34)
  Object.assign(StationBake.WALL, { hullLit: 1.1, hullVoid: 0.7 });
  // interior ambient before any setting is applied = the farm LOW step (stationbake ships 0.82)
  if (StationBake.LIGHT) StationBake.LIGHT.ambient = 0.52;
})();
