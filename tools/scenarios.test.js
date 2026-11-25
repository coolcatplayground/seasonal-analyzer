// The scenario page (tests.html → js/tests.js) run in Node: the same scenarios a person sees in the
// browser, each repeated with 200 seeded noise draws. A tiny stand-in for the page's DOM collects
// the rows; any FAIL row fails this test and names the scenario.
//   node --test tools/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { load, ROOT } = require('./load');

test('every scenario in tests.html passes', { timeout: 300000 }, async () => {
  const ctx = load('js/stats.js');
  const rows = [];
  const el = () => ({ textContent: '', className: '', innerHTML: '', appendChild(tr) { rows.push(tr.innerHTML); } });
  const body = el(), summary = el();
  ctx.document = {
    getElementById: (id) => (id === 'results' ? body : summary),
    createElement: () => el(),
  };
  ctx.window = ctx;
  ctx.performance = performance;
  ctx.setTimeout = setTimeout;
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/tests.js'), 'utf8'), ctx, { filename: 'js/tests.js' });
  while (!ctx.__testResult) await new Promise((r) => setTimeout(r, 20));
  const failed = rows.filter((r) => r.startsWith('<td>FAIL')).map((r) => r.replace(/<[^>]+>/g, ' | ').replace(/\s+/g, ' '));
  assert.deepEqual(failed, []);
  assert.equal(ctx.__testResult.passed, ctx.__testResult.total);
});
