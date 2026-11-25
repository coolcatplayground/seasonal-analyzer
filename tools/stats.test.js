// The verdict logic in js/stats.js, on series built to have a known answer.
//   node --test tools/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load');

const { SalesStats } = load('js/stats.js');

// mulberry32, so every synthetic series is the same on every run
function rng(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(rand) {
  return Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
}

// Monthly rows from 2019-01. logFn(year index, month 1..12, rand) gives log sales.
function series({ months = 72, start = 0, seed = 1, logFn, sd = 0.12, spikes = {} }) {
  const rand = rng(seed);
  const rows = [];
  for (let i = start; i < start + months; i++) {
    const year = 2019 + Math.floor(i / 12), month = (i % 12) + 1;
    const ymKey = `${year}-${String(month).padStart(2, '0')}`;
    const lift = spikes[ymKey] || 1;
    const sales = Math.round(Math.exp(13 + logFn(year - 2019, month, rand) + sd * gauss(rand)) * lift);
    rows.push({ ymKey, year, month, sales, orderCount: 100, totalCustomers: 80, newCustomers: 20 });
  }
  return rows;
}
const flat = () => 0;
const winterPeak = (y, m) => 0.6 * Math.cos(((m - 12) / 12) * 2 * Math.PI);
const analyze = (rows, key = 'test') => SalesStats.analyze(rows, null, key);

test('a clear yearly pattern is called seasonal, and strong', () => {
  const a = analyze(series({ logFn: winterPeak }));
  assert.equal(a.classification.key, 'seasonal');
  assert.ok(a.test.p < 0.01, `p = ${a.test.p}`);
  assert.ok(a.test.omega2 > 0.8, `ω² = ${a.test.omega2}`);
  const peak = a.seasonal.reduce((m, s) => (s.index > m.index ? s : m));
  assert.equal(peak.month, 12);
});

test('pure noise is rarely called seasonal (false-positive rate near α = 5%)', () => {
  let falsePositives = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const a = analyze(series({ seed, logFn: flat }), 'noise' + seed);
    if (a.test.p < SalesStats.CONFIG.alpha) falsePositives++;
  }
  assert.ok(falsePositives <= 5, `${falsePositives} of 40 noise series were called seasonal`);
});

test('steady growth is not mistaken for a season', () => {
  // Doubling a year, compounding every month: inside one year that looks like "December strong,
  // January weak". The within-year drift is taken out before the fit, so the verdict and the
  // pattern match the same noise without growth.
  for (const seed of [2, 5, 8]) {
    const still = analyze(series({ seed, logFn: flat }), 'g' + seed);
    const growing = analyze(series({ seed, logFn: (y, m) => (y + (m - 1) / 12) * Math.log(2) }), 'g' + seed);
    assert.equal(growing.classification.key, still.classification.key, `seed ${seed}`);
    assert.equal(growing.test.p, still.test.p, `seed ${seed}`);
    assert.ok(Math.abs(growing.amplitude - still.amplitude) < 1e-6, `size ${growing.amplitude} vs ${still.amplitude}`);
    assert.ok(growing.growth > 0.8 && growing.growth < 1.1, `growth removed ${growing.growth}`);
  }
});

test('a season survives steady growth, and still peaks in the right month', () => {
  const a = analyze(series({ seed: 6, logFn: (y, m) => winterPeak(y, m) + (y + (m - 1) / 12) * Math.log(1.5) }));
  assert.equal(a.classification.key, 'seasonal');
  assert.equal(a.seasonal.reduce((x, s) => (s.index > x.index ? s : x)).month, 12);
});

test('one big campaign month is left out of the index and still listed as the top spike', () => {
  const a = analyze(series({ seed: 7, logFn: flat, sd: 0.04, spikes: { '2022-06': 10 } }));
  assert.equal(a.campaignCount, 1);
  assert.equal(a.spikes[0].ymKey, '2022-06');
  assert.equal(a.spikes[0].campaign, true);
  const june = a.seasonal[5].raw;
  assert.ok(june > 0.9 && june < 1.12, `June index ${june}`);
  assert.notEqual(a.classification.key.startsWith('seasonal'), true);
});

test('a real but tiny pattern is not called seasonal (size rule)', () => {
  // ±4% every year with very little noise: significant, but best − worst < 15 points
  const a = analyze(series({ months: 120, seed: 11, sd: 0.015, logFn: (y, m) => 0.04 * Math.sin((m / 12) * 2 * Math.PI) }));
  assert.ok(a.test.p < SalesStats.CONFIG.alpha, `p = ${a.test.p}`);
  assert.equal(a.bigEnough, false);
  assert.equal(a.classification.key, 'stable');
});

test('under 24 months with sales: no verdict', () => {
  const a = analyze(series({ months: 20, logFn: winterPeak }));
  assert.equal(a.classification.key, 'insufficient');
  assert.equal(a.sufficiency.ok, false);
});

test('a 月度 seen only once: no verdict, however many months there are', () => {
  // 36 months, but March has sales in one year only
  const rows = series({ months: 36, logFn: winterPeak }).filter((r) => r.month !== 3 || r.year === 2019);
  const a = analyze(rows);
  assert.equal(a.sufficiency.minPerMonth, 1);
  assert.equal(a.classification.key, 'insufficient');
});

test('months with no sales are left out of the model, not counted as zeros', () => {
  const rows = series({ logFn: winterPeak });
  rows[5].sales = 0;
  rows[17].sales = 0;
  const a = analyze(rows);
  assert.equal(a.sufficiency.excluded, 2);
  assert.equal(a.sufficiency.months, rows.length - 2);
  assert.equal(a.classification.key, 'seasonal');
});

test('campaign months are found as spikes, and many of them make a product spike-driven', () => {
  const spikes = { '2019-05': 3, '2020-09': 3, '2021-02': 3.5, '2022-07': 3, '2023-11': 3.2, '2024-03': 3 };
  const a = analyze(series({ seed: 3, logFn: flat, spikes }));
  assert.equal(a.classification.key, 'spiky');
  // Array.from: a plain array of this realm, so deepEqual compares values, not prototypes
  const found = Array.from(a.spikes.filter((s) => s.z > SalesStats.CONFIG.spikeZ), (s) => s.ymKey).sort();
  assert.deepEqual(found, Object.keys(spikes).sort());
});

test('a season with campaigns on top is seasonal + spikes', () => {
  const spikes = { '2019-05': 3, '2020-09': 3, '2021-02': 3.5, '2022-07': 3, '2023-08': 3.2, '2024-03': 3 };
  const a = analyze(series({ seed: 4, logFn: winterPeak, spikes }));
  assert.equal(a.classification.key, 'seasonal-spiky');
});

test('the permutation p-value is reproducible for the same series', () => {
  const rows = series({ seed: 9, logFn: (y, m) => 0.08 * Math.cos((m / 12) * 2 * Math.PI) });
  assert.equal(analyze(rows, 'same').test.p, analyze(rows, 'same').test.p);
});

test('a short history leans on the shop pattern more than a long one does', () => {
  const ctx = SalesStats.buildContext([{ rows: series({ months: 94, logFn: winterPeak }) }]);
  const short = SalesStats.analyze(series({ months: 26, seed: 5, logFn: winterPeak }), ctx, 's');
  const long = SalesStats.analyze(series({ months: 94, seed: 5, logFn: winterPeak }), ctx, 'l');
  assert.ok(short.weight < long.weight, `own-data weight short ${short.weight} vs long ${long.weight}`);
  assert.ok(short.weight > 0 && long.weight <= 1);
});

test('the shop-wide pattern peaks where its products do', () => {
  const records = [1, 2, 3].map((seed) => ({ rows: series({ seed, logFn: winterPeak }) }));
  const ctx = SalesStats.buildContext(records);
  const peak = ctx.mu.indexOf(Math.max(...ctx.mu));
  assert.equal(peak + 1, 12);
});
