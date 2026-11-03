// Load the app's browser scripts into one Node context, the way index.html does, so the
// tests run the exact files the page runs. No build step, no test framework beyond node:test.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

function load(...files) {
  const ctx = vm.createContext({ console, File, Blob });
  for (const f of files) {
    // top-level const in a classic script is not a property of the global; re-export it
    const name = fs.readFileSync(path.join(ROOT, f), 'utf8').match(/^const (\w+) = /m)[1];
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8') + `\n;globalThis.${name} = ${name};`, ctx, { filename: f });
  }
  return ctx;
}

module.exports = { load, ROOT };
