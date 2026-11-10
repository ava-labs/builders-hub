// Preload for CLI scripts that import server modules. `server-only` resolves only
// through Next's build conditions; outside Next, point it at Next's empty module.
const Module = require("node:module");

const empty = require.resolve("next/dist/compiled/server-only/empty.js");
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  return request === "server-only" ? empty : resolve.call(this, request, ...rest);
};
