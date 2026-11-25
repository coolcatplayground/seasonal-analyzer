// The demo store: its numbers add up, it goes through the real products.json import, and
// every product still lands on the verdict the README's "Specimens" table promises.
//   node --test tools/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load');

const { SalesStats, SalesDemo, SalesParser } = load('js/stats.js', 'js/demo-data.js', 'js/parse.js');
const doc = SalesDemo.bundle();
const byName = new Map(doc.series.map((s) => [s.name, s]));
const find = (prefix) => doc.series.find((s) => s.name.startsWith(prefix));

const README_VERDICTS = {
  '猫のおせち': 'seasonal',
  'ハロウィン仮装': 'seasonal',
  'ひんやりニャンモック': 'seasonal',
  'こたつニャンハウス': 'seasonal',
  '高級ちゅーるタワー': 'seasonal',
  '毛玉ケアフード': 'seasonal-spiky',
  'またたびスティック': 'spiky',
  'ミラクル猫砂': 'stable',
  'にゃんファウンテン': 'insufficient',
  'しつけ教室チケット': 'seasonal',
  '毎日カリカリ': 'stable',
};

test('eleven series, January 2019 to October 2026', () => {
  assert.equal(doc.series.length, 11);
  assert.equal(doc.dataThrough, '2026-10');
  assert.equal(find('猫のおせち').rows[0].ymKey, '2019-01');
});

test('every month adds up: channels, buyer types, customers, SKUs', () => {
  for (const s of doc.series) {
    for (const r of s.rows) {
      const where = `${s.name} ${r.ymKey}`;
      assert.equal(Object.values(r.ch).reduce((a, b) => a + b, 0), r.sales, `${where}: channels`);
      const b = r.buyers;
      assert.equal(b[0] + b[1] + b[2] + b[3], r.totalCustomers, `${where}: buyer types`);
      assert.equal(r.newCustomers + r.existingCustomers, r.totalCustomers, `${where}: new + existing`);
      assert.ok(r.orders <= r.orderCount && r.orderCount <= r.qty, `${where}: orders ≤ lines ≤ units`);
      const skuSales = s.skus.reduce((a, k) => a + ((k.rows.find((x) => x[0] === r.ymKey) || [0, 0])[1]), 0);
      assert.equal(skuSales, r.sales, `${where}: SKUs`);
    }
    for (const k of s.skus) {
      for (const x of k.rows) {
        assert.equal(Object.values(k.ch[x[0]] || {}).reduce((a, b) => a + b, 0), x[1], `${s.name} ${k.code} ${x[0]}: SKU channels`);
      }
    }
  }
});

test('the demo goes through the products.json import unchanged', async () => {
  const file = new File([JSON.stringify(doc)], 'demo-products.json', { type: 'application/json' });
  const parsed = await SalesParser.parseBundle(file);
  assert.equal(parsed.series.length, doc.series.length);
  assert.equal(parsed.dataThrough, doc.dataThrough);
  for (const s of parsed.series) {
    const src = byName.get(s.name);
    assert.ok(src, s.name);
    assert.equal(s.rows.length, src.rows.length);
    assert.equal(s.active, src.active !== false);
  }
});

test('the bundle is generated the same way every time', () => {
  assert.equal(JSON.stringify(SalesDemo.bundle()), JSON.stringify(doc));
});

test('each product gets the verdict the README promises', () => {
  // the app's shop-wide pattern comes from the 商品売上高 series
  const ctx = SalesStats.buildContext(doc.series.filter((s) => s.accounting === '商品売上高'));
  for (const [prefix, verdict] of Object.entries(README_VERDICTS)) {
    const s = find(prefix);
    assert.ok(s, `no series starting ${prefix}`);
    assert.equal(SalesStats.analyze(s.rows, ctx, s.name).classification.key, verdict, s.name);
  }
});

test('the README specifics: litter p ≈ 0.44, matatabi has 14 spikes, kibble is too small to call seasonal, the fountain is new, Halloween ended', () => {
  const ctx = SalesStats.buildContext(doc.series.filter((s) => s.accounting === '商品売上高'));
  const run = (prefix) => { const s = find(prefix); return SalesStats.analyze(s.rows, ctx, s.name); };
  assert.equal(run('ミラクル猫砂').test.p.toFixed(2), '0.44');
  const matatabi = run('またたびスティック');
  assert.equal(matatabi.spikeCount, 14);
  assert.equal(matatabi.campaignCount, 14);
  const kibble = run('毎日カリカリ');
  assert.ok(kibble.test.p < 0.05, `kibble p ${kibble.test.p}`);
  assert.equal(kibble.bigEnough, false);
  assert.equal(Math.round(kibble.amplitude * 100), 11);
  // its lowest 月度 is 3月度, the 28-day one
  assert.equal(kibble.seasonal.reduce((x, s) => (s.raw < x.raw ? s : x)).month, 3);
  assert.equal(find('にゃんファウンテン').rows[0].ymKey, '2025-02');
  assert.equal(find('ハロウィン仮装').active, false);
  assert.equal(find('しつけ教室チケット').accounting, 'サービス売上高');
});

test('demo notes point at real series and months', () => {
  assert.ok(SalesDemo.NOTES.length > 0);
  for (const [name, ymKey] of SalesDemo.NOTES) {
    assert.ok(byName.has(name), name);
    assert.ok(byName.get(name).rows.some((r) => r.ymKey === ymKey), `${name} ${ymKey}`);
  }
});
