// demo-data.js — a fictional cat-supply store for the "デモデータ" button.
// Built here in the browser, in the same shape as products.json (see db.js for the fields),
// and loaded through the same import path, so the demo exercises exactly what real data does:
// SKUs, buyer types, order channels, an ended series, a short-history product and a second
// 会計区分. Seeded, so every visitor sees the same numbers. Nothing in it is real.

const SalesDemo = (() => {
  const FIRST = '2019-01';
  const LAST = '2026-10';   // the latest complete 月度 in the demo

  // mulberry32: small, fast, seedable
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const gauss = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());

  const ym = (y, m) => `${y}-${String(m).padStart(2, '0')}`;
  function months(from, to) {
    const out = [];
    let [y, m] = from.split('-').map(Number);
    for (;;) {
      const k = ym(y, m);
      if (k > to) return out;
      out.push({ ymKey: k, year: y, month: m });
      if (++m > 12) { m = 1; y++; }
    }
  }
  const monthsBetween = (a, b) => {
    const [ya, ma] = a.split('-').map(Number), [yb, mb] = b.split('-').map(Number);
    return (yb - ya) * 12 + (mb - ma);
  };

  // Seasonal effects on the log scale, 月度 1..12. 0 = an ordinary month.
  const flat = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  // 受注方法: share of sales per group at the start and at the end of the demo (it drifts
  // linearly between), and how a group's share splits over its codes.
  const CODES = {
    web: [['11', 1]],
    mall: [['12', 0.55], ['13', 0.15], ['14', 0.30]],
    phone: [['41', 0.45], ['42', 0.25], ['44', 0.30]],
    mail: [['43', 0.35], ['45', 0.65]],
    store: [['31', 0.40], ['32', 0.35], ['33', 0.15], ['34', 0.10]],
    seminar: [['71', 0.40], ['72', 0.25], ['73', 0.15], ['74', 0.12], ['75', 0.08]],
    other: [['81', 0.6], ['91', 0.4]],
  };
  const CH_DEFAULT = {
    from: { web: 0.42, mall: 0.22, phone: 0.15, mail: 0.08, store: 0.07, seminar: 0.04, other: 0.02 },
    to: { web: 0.47, mall: 0.31, phone: 0.10, mail: 0.04, store: 0.05, seminar: 0.02, other: 0.01 },
  };

  // Buyer types: [店舗新規, 商品初回, 継続, 復帰]. A spike's type moves the mix:
  //   reach   — members reached by a DM or magazine: 商品初回 and 復帰 swell
  //   acquire — the shop wins new customers: 店舗新規 swells
  //   regular — the usual buyers buy more often
  //   bigger  — about the same people, each spending more
  const SPIKE_MIX = {
    reach: [1.2, 2.6, 1.1, 2.4],
    acquire: [3.4, 1.4, 1.0, 1.2],
    regular: [1.0, 1.1, 2.3, 1.1],
    bigger: [1.0, 1.0, 1.0, 1.0],
  };

  const CATALOGUE = [
    {
      name: '猫のおせち にゃん重', seed: 11, start: '2019-01', level: 520000, growth: 0.07, noise: 0.10,
      // pre-orders open in 11月度, the feast ships in 12月度, a tail of late orders in 1月度
      season: [0.9, -1.6, -2.4, -2.6, -2.6, -2.6, -2.6, -2.6, -2.2, -1.2, 0.8, 2.3],
      price: 3980, mix: [0.34, 0.30, 0.24, 0.12], seasonMix: { 11: 'acquire', 12: 'acquire' },
      ch: { from: { web: 0.46, mall: 0.10, phone: 0.24, mail: 0.12, store: 0.05, seminar: 0.02, other: 0.01 },
        to: { web: 0.55, mall: 0.14, phone: 0.17, mail: 0.07, store: 0.05, seminar: 0.01, other: 0.01 } },
      repeat: [0.24, 0.18],
      skus: [
        { code: 'CO101', name: 'にゃん重 一段', share: [0.55, 0.42] },
        { code: 'CO102', name: 'にゃん重 二段', share: [0.45, 0.38] },
        { code: 'CO103', name: 'にゃん重 ミニ', share: [0, 0.20], start: '2023-10' },
      ],
    },
    {
      name: 'ハロウィン仮装 かぼちゃニャン', seed: 12, start: '2019-01', end: '2025-11', level: 260000, growth: 0.02, noise: 0.12,
      season: [-2.4, -2.6, -2.6, -2.6, -2.6, -2.6, -2.4, -1.8, 0.4, 2.2, -0.6, -2.0],
      price: 2480, mix: [0.30, 0.38, 0.20, 0.12], active: false, repeat: [0.20, 0.14],
      skus: [
        { code: 'CH201', name: 'かぼちゃニャン S', share: [0.6, 0.55], active: false },
        { code: 'CH202', name: 'かぼちゃニャン M', share: [0.4, 0.45], active: false },
      ],
    },
    {
      name: 'ひんやりニャンモック', seed: 13, start: '2019-01', level: 560000, growth: 0.05, noise: 0.09,
      season: [-0.85, -0.95, -0.65, -0.30, 0.25, 0.75, 1.15, 1.05, 0.30, -0.45, -0.80, -0.95],
      price: 3480, mix: [0.22, 0.36, 0.30, 0.12], repeat: [0.30, 0.22],
      spikes: [{ at: '2024-07', lift: 1.7, type: 'acquire' }],
      skus: [
        { code: 'CT301', name: 'ニャンモック レギュラー', share: [1, 0.62] },
        { code: 'CT302', name: 'ニャンモック ワイド', share: [0, 0.38], start: '2022-04' },
      ],
    },
    {
      name: 'こたつニャンハウス', seed: 14, start: '2019-01', level: 640000, growth: -0.06, noise: 0.10,
      season: [0.85, 0.55, -0.10, -0.65, -1.05, -1.20, -1.25, -1.15, -0.55, 0.30, 0.95, 1.15],
      price: 5980, mix: [0.14, 0.24, 0.48, 0.14], repeat: [0.26, 0.16],
      // this autumn's early orders are well under the usual path
      dip: { from: '2026-07', to: '2026-10', factor: 0.74 },
      skus: [
        { code: 'CF401', name: 'こたつニャンハウス 角型', share: [0.7, 0.6] },
        { code: 'CF402', name: 'こたつニャンハウス 丸型', share: [0.3, 0.4] },
      ],
    },
    {
      name: '毛玉ケアフード 毎日ブラッシュ', seed: 15, start: '2019-01', level: 980000, growth: 0.12, noise: 0.08,
      // spring and autumn coat changes
      season: [-0.18, -0.06, 0.20, 0.30, 0.22, -0.04, -0.20, -0.22, -0.06, 0.16, 0.02, -0.14],
      price: 2180, mix: [0.12, 0.20, 0.58, 0.10], repeat: [0.52, 0.36],
      spikes: [{ at: '2019-10', lift: 1.6, type: 'reach' }, { at: '2021-04', lift: 1.6, type: 'reach' },
        { at: '2022-11', lift: 1.5, type: 'regular' }, { at: '2024-09', lift: 1.9, type: 'acquire' },
        { at: '2025-06', lift: 1.5, type: 'reach' }],
      lift: { from: '2026-04', factor: 1.22 },   // running ahead of its usual path lately
      skus: [
        { code: 'CS501', name: '毎日ブラッシュ 500g', share: [0.65, 0.48] },
        { code: 'CS502', name: '毎日ブラッシュ 1.5kg', share: [0.35, 0.40] },
        { code: 'CS503', name: '毎日ブラッシュ シニア 500g', share: [0, 0.12], start: '2024-03' },
      ],
    },
    {
      name: '高級ちゅーるタワー ギフト箱', seed: 16, start: '2019-01', level: 450000, growth: 0.09, noise: 0.11,
      season: [-0.25, 0.10, -0.20, -0.25, -0.10, -0.15, -0.25, -0.20, -0.15, -0.05, 0.15, 0.95],
      price: 4800, mix: [0.18, 0.40, 0.30, 0.12], repeat: [0.28, 0.20],
      // 猫の日 (2/22) gift boxes: bigger orders, not more people
      spikes: [{ at: '2021-02', lift: 1.6, type: 'bigger' }, { at: '2022-02', lift: 1.7, type: 'bigger' },
        { at: '2023-02', lift: 1.8, type: 'bigger' }, { at: '2024-02', lift: 1.7, type: 'bigger' },
        { at: '2025-02', lift: 1.9, type: 'bigger' }, { at: '2026-02', lift: 1.8, type: 'bigger' }],
      ch: { from: { web: 0.40, mall: 0.20, phone: 0.15, mail: 0.08, store: 0.10, seminar: 0.05, other: 0.02 },
        to: { web: 0.33, mall: 0.47, phone: 0.08, mail: 0.03, store: 0.06, seminar: 0.02, other: 0.01 } },
      skus: [
        { code: 'CG601', name: 'ちゅーるタワー 30本箱', share: [0.6, 0.5] },
        { code: 'CG602', name: 'ちゅーるタワー 60本箱', share: [0.4, 0.5] },
      ],
    },
    {
      name: 'ミラクル猫砂 10L', seed: 17, start: '2019-01', level: 1250000, growth: 0.03, noise: 0.11,
      season: flat, price: 1680, mix: [0.10, 0.12, 0.70, 0.08], repeat: [0.64, 0.40],
      ch: { from: { web: 0.34, mall: 0.38, phone: 0.12, mail: 0.06, store: 0.07, seminar: 0.01, other: 0.02 },
        to: { web: 0.30, mall: 0.53, phone: 0.07, mail: 0.03, store: 0.05, seminar: 0.01, other: 0.01 } },
      skus: [
        { code: 'CL701', name: 'ミラクル猫砂 10L', share: [0.8, 0.6] },
        { code: 'CL702', name: 'ミラクル猫砂 10L ×3袋', share: [0.2, 0.4] },
      ],
    },
    {
      name: 'またたびスティック30本', seed: 18, start: '2019-01', level: 380000, growth: 0.04, noise: 0.10,
      season: flat, price: 980, mix: [0.16, 0.30, 0.42, 0.12], repeat: [0.40, 0.28],
      // DM and magazine promotions, scattered over the calendar
      spikes: [{ at: '2019-05', lift: 2.3, type: 'reach' }, { at: '2019-11', lift: 2.0, type: 'reach' },
        { at: '2020-03', lift: 2.4, type: 'reach' }, { at: '2020-09', lift: 2.1, type: 'reach' },
        { at: '2021-06', lift: 2.5, type: 'reach' }, { at: '2022-02', lift: 2.2, type: 'reach' },
        { at: '2022-08', lift: 2.6, type: 'reach' }, { at: '2023-04', lift: 2.3, type: 'reach' },
        { at: '2023-10', lift: 2.4, type: 'reach' }, { at: '2024-01', lift: 2.1, type: 'regular' },
        { at: '2024-07', lift: 2.5, type: 'reach' }, { at: '2025-03', lift: 2.2, type: 'reach' },
        { at: '2025-09', lift: 2.6, type: 'reach' }, { at: '2026-06', lift: 2.4, type: 'reach' }],
      skus: [
        { code: 'CS801', name: 'またたびスティック30本', share: [1, 0.85] },
        { code: 'CS802', name: 'またたびスティック 旧パッケージ', share: [0, 0], active: false, start: '2019-01', end: '2021-03', early: 0.3 },
        { code: 'CS803', name: 'またたびスティック お試し5本', share: [0, 0.15], start: '2023-04' },
      ],
    },
    {
      name: 'にゃんファウンテン 自動給水器', seed: 19, start: '2025-02', level: 190000, growth: 0.06, noise: 0.09,
      season: [-0.10, -0.10, 0.00, 0.05, 0.15, 0.25, 0.30, 0.25, 0.05, -0.15, -0.20, -0.20],
      price: 6980, mix: [0.38, 0.40, 0.14, 0.08], repeat: [0.18, 0.14], rampUp: 5,
      skus: [{ code: 'CW901', name: 'にゃんファウンテン 2L', share: [1, 1] }],
    },
    {
      name: 'しつけ教室チケット', seed: 20, start: '2019-01', level: 420000, growth: 0.05, noise: 0.10,
      accounting: 'サービス売上高',
      season: [-0.30, -0.10, 0.25, 0.35, 0.20, -0.05, -0.25, -0.35, 0.10, 0.25, 0.05, -0.15],
      price: 3300, mix: [0.20, 0.30, 0.40, 0.10], repeat: [0.46, 0.30],
      ch: { from: { web: 0.30, mall: 0, phone: 0.15, mail: 0.02, store: 0.20, seminar: 0.33, other: 0 },
        to: { web: 0.38, mall: 0, phone: 0.10, mail: 0.01, store: 0.16, seminar: 0.35, other: 0 } },
      skus: [
        { code: 'CE101', name: 'しつけ教室チケット S', share: [0.6, 0.55] },
        { code: 'CE102', name: 'しつけ教室チケット M', share: [0.4, 0.45] },
      ],
    },
  ];

  // Notes, as someone on the team would have written them after finding out.
  const NOTES = [
    ['またたびスティック30本', '2019-05', 'DM 春号に同封クーポン'],
    ['またたびスティック30本', '2021-06', '猫雑誌「ねこびより」7月号に掲載'],
    ['またたびスティック30本', '2022-02', '猫の日 DM（会員向け）'],
    ['またたびスティック30本', '2025-09', '秋の会員 DM'],
    ['高級ちゅーるタワー ギフト箱', '2025-02', '猫の日ギフト特集ページ'],
    ['高級ちゅーるタワー ギフト箱', '2026-02', '猫の日ギフト特集ページ（楽天にも出稿）'],
    ['毛玉ケアフード 毎日ブラッシュ', '2024-09', 'テレビ通販で紹介 → 新規が急増'],
    ['ひんやりニャンモック', '2024-07', '猛暑報道のあと Amazon で急上昇'],
  ];

  function jitterMix(base, r) {
    const nudge = Object.fromEntries(Object.keys(base.from).map((g) => [g, Math.exp(gauss(r) * 0.35)]));
    const drift = Object.fromEntries(Object.keys(base.from).map((g) => [g, Math.exp(gauss(r) * 0.2)]));
    const from = {}, to = {};
    Object.keys(base.from).forEach((g) => { from[g] = base.from[g] * nudge[g]; to[g] = base.to[g] * nudge[g] * drift[g]; });
    return { from, to };
  }

  const round10 = (v) => Math.max(0, Math.round(v / 10) * 10);

  // Split an integer total over weights; the remainder goes to the largest share.
  function split(total, weights, unit) {
    const sum = weights.reduce((s, w) => s + w, 0) || 1;
    const parts = weights.map((w) => Math.floor((total * w) / sum / unit) * unit);
    const big = weights.indexOf(Math.max(...weights));
    parts[big] += total - parts.reduce((s, v) => s + v, 0);
    return parts;
  }

  function buildSeries(def) {
    const r = rng(def.seed);
    const ms = months(def.start, def.end || LAST);
    const span = monthsBetween(FIRST, LAST);
    const spikes = new Map((def.spikes || []).map((s) => [s.at, s]));
    const chDef = def.ch || jitterMix(CH_DEFAULT, rng(def.seed * 7919));
    const groups = Object.keys(CODES);
    const repeatCut = months('2026-05', LAST).map((x) => x.ymKey);   // too recent to know

    const rows = ms.map(({ ymKey, year, month }, i) => {
      const t = monthsBetween(FIRST, ymKey);
      let mult = Math.exp(def.season[month - 1] + gauss(r) * def.noise) * Math.pow(1 + def.growth, t / 12);
      if (def.rampUp && i < def.rampUp) mult *= (i + 1) / (def.rampUp + 1);
      if (def.dip && ymKey >= def.dip.from && ymKey <= def.dip.to) mult *= def.dip.factor;
      if (def.lift && ymKey >= def.lift.from) mult *= def.lift.factor;
      const spike = spikes.get(ymKey);
      if (spike) mult *= spike.lift;
      const type = spike ? spike.type : (def.seasonMix && def.seasonMix[month]) || null;

      const sales = round10(def.level * mult);
      // spend per buyer rises in a 'bigger' month; otherwise a little noise around the price
      const perBuyer = def.price * 1.18 * (type === 'bigger' ? 1.55 : 1) * (1 + gauss(r) * 0.04);
      const n = Math.max(1, Math.round(sales / perBuyer));
      const qty = Math.max(1, Math.round((sales / def.price) * (1 + gauss(r) * 0.03)));
      const lines = Math.max(1, Math.min(qty, Math.round(qty / (1.12 + r() * 0.08))));
      const orders = Math.max(1, Math.min(lines, Math.round(lines / (1.05 + r() * 0.06))));

      const w = def.mix.map((s, k) => s * (type ? SPIKE_MIX[type][k] : 1) * (1 + gauss(r) * 0.08));
      const b = split(n, w, 1);
      const newc = b[0] + b[1] + b[3];
      const late = repeatCut.includes(ymKey);
      const rep = late ? null : Math.min(n, Math.round(n * def.repeat[0] * (1 + gauss(r) * 0.08)));
      const newRep = late ? null : Math.min(newc, Math.round(newc * def.repeat[1] * (1 + gauss(r) * 0.12)));

      const f = Math.min(1, t / span);
      const gShare = groups.map((g) => chDef.from[g] + (chDef.to[g] - chDef.from[g]) * f);
      const gSales = split(sales, gShare, 10);
      const ch = {};
      groups.forEach((g, gi) => {
        if (!gSales[gi]) return;
        split(gSales[gi], CODES[g].map((c) => c[1]), 10).forEach((v, ci) => { if (v) ch[CODES[g][ci][0]] = v; });
      });

      return {
        ymKey, year, month, sales, qty, orderCount: lines, orders,
        totalCustomers: n, newCustomers: b[0], existingCustomers: n - b[0],
        buyers: [b[0], b[1], b[2], b[3], rep, newRep], ch,
      };
    });

    // SKUs: each month's figures split by the SKU's share at that point in time
    const skus = def.skus.map((s) => ({ code: s.code, name: s.name, active: s.active !== false && !def.end ? true : false, rows: [], ch: {} }));
    rows.forEach((row) => {
      const f = Math.min(1, monthsBetween(FIRST, row.ymKey) / monthsBetween(FIRST, LAST));
      const shares = def.skus.map((s) => {
        if (s.start && row.ymKey < s.start) return 0;
        if (s.end && row.ymKey > s.end) return 0;
        if (s.early) return s.early;   // an old SKU, replaced part-way through
        return s.share[0] + (s.share[1] - s.share[0]) * f || 0.0001;
      });
      const sales = split(row.sales, shares, 10);
      const qty = split(row.qty, shares, 1);
      const lines = split(row.orderCount, shares, 1);
      const codes = Object.keys(row.ch);
      def.skus.forEach((s, i) => {
        if (!shares[i] || !sales[i]) return;
        const sh = sales[i] / (row.sales || 1);
        // a buyer can buy two SKUs, so SKU buyer counts add up to a little more than the series
        const b = row.buyers.slice(0, 4).map((v) => Math.round(v * Math.min(1, sh * 1.08)));
        const rep = row.buyers[4] == null ? null : Math.round(row.buyers[4] * Math.min(1, sh * 1.08));
        const nrep = row.buyers[5] == null ? null : Math.round(row.buyers[5] * Math.min(1, sh * 1.08));
        skus[i].rows.push([row.ymKey, sales[i], qty[i], lines[i], ...b, rep, nrep]);
        // the SKU's own sales over the series' channel mix, so each SKU adds up exactly
        const c = {};
        split(sales[i], codes.map((code) => row.ch[code]), 10).forEach((v, ci) => { if (v) c[codes[ci]] = v; });
        skus[i].ch[row.ymKey] = c;
      });
    });

    return {
      name: def.name,
      accounting: def.accounting || '商品売上高',
      salesType: '',
      active: def.active !== false,
      skus: skus.filter((s) => s.rows.length),
      rows,
    };
  }

  function bundle() {
    return { dataThrough: LAST, generatedAt: 'demo', series: CATALOGUE.map(buildSeries) };
  }

  return { bundle, NOTES };
})();
