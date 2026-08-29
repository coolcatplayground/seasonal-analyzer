# Sales Ledger — 商品別 季節性・トレンド分析

A static web app that answers one question for every product in a catalogue:

> **When this product sells well, is that the season — or was it something we did?**

Upload a monthly sales export per product and it runs a one-way ANOVA of sales ratio against calendar
month, reports η² and F, classifies the product as season-driven / campaign-driven / mixed, and lays
every product's monthly seasonal index side by side in one sortable, filterable calendar.

No backend, no account, no build step. Open `index.html` and it works.

**Try it:** press **🐱 デモデータを読み込む** on the upload tab to load a fictional cat-supply
catalogue and see the whole app populated in one click.

---

## Why

A colleague and I had been doing this by hand: export a product's monthly numbers, eyeball the peaks,
argue about whether December was the gift season or that campaign we ran, then copy the conclusion
into a master spreadsheet. It worked for a handful of products and did not scale to hundreds — and
"eyeball the peaks" is not a method. Two people looking at the same chart reached different
conclusions depending on which year they anchored on.

The distinction matters commercially. A season-driven product should be *stocked* against the
calendar. A campaign-driven product should be *scheduled* — its good months are the ones you choose.
Confusing the two means either buying inventory for a peak that was really a promotion, or waiting
for a season that was never going to arrive on its own.

So the judgement call got replaced with a statistic, and the master spreadsheet got replaced with a
calendar the app generates.

## The method

For each product, given monthly rows across several years:

1. **Ratio** — each month's sales as a proportion of that year's average. This strips out the growth
   trend, so a 2019 December and a 2025 December are comparable.
2. **Seasonal index** — the mean ratio for each calendar month across all years.
3. **η² and F** — a one-way ANOVA of ratio grouped by calendar month. η² is the share of variance
   explained by month-of-year; F says whether that share is more than sampling noise would produce.
4. **Classification** — η² < 10% campaign-driven, 10–25% mixed, ≥ 25% season-driven.

```js
// stats.js
groups.forEach((g) => { const gm = mean(g); ssBetween += g.length * (gm - grand) ** 2; });
rowsWithRatio.forEach((r) => { ssTotal += (r.ratio - grand) ** 2; });
const eta2 = ssTotal > 0 ? ssBetween / ssTotal : 0;
```

**Read η² together with F, not on its own.** With twelve month-groups and only a few years of data,
η² carries an upward bias — even a completely flat product lands somewhere near `dfBetween / dfTotal`.
The litter product in the demo shows exactly this: η² = 0.147 looks like mild seasonality, but
F = 1.2 says the pattern is indistinguishable from noise. The app reports both numbers for that
reason. More years of history shrinks the bias.

**Spike diagnosis** compares a spike month against the product's own baseline on three axes — average
order value, customer count, and new-customer share — and offers a hypothesis: 客単価上昇 (bigger
baskets), 既存顧客の再購買 (existing customers returning), or 新規顧客の増加 (an acquisition wave).
It is a starting hypothesis, not a verdict, so every month carries a free-text note field. When you
learn the real reason — a campaign name, a magazine feature, a stockout — you write it on that month,
and the note survives every future re-upload.

## The demo catalogue

The real data is confidential, so the bundled demo is a fictional cat-supply store. The eight
products were chosen so the classifier has something to separate — not to flatter it:

| Product | What it is | η² | F | Verdict |
|---|---|---:|---:|---|
| 猫のおせち にゃん重 | New Year feast, for cats | 0.997 | 2171.9 | 季節性主導型 |
| ハロウィン仮装 かぼちゃニャン | Halloween costume | 0.977 | 279.0 | 季節性主導型 |
| ひんやりニャンモック | Cooling hammock | 0.947 | 128.5 | 季節性主導型 |
| こたつニャンハウス | Heated dome | 0.915 | 77.3 | 季節性主導型 |
| 毛玉ケアフード 毎日ブラッシュ | Hairball care food | 0.245 | 2.3 | 混合型 |
| 高級ちゅーるタワー ギフト箱 | Premium gift tower | 0.184 | 1.6 | 混合型 |
| ミラクル猫砂 10L | Litter | 0.147 | 1.2 | 混合型 |
| またたびスティック30本 | Matatabi sticks | 0.061 | 0.5 | キャンペーン主導型 |

Roughly seven years of monthly data each. Several things are deliberate:

- **おせち and ハロウィン** are the extreme end — products that essentially exist for one month a year.
- **またたびスティック** has a flat baseline with promotions scattered across nine different months.
  Its variance is real but not aligned to the calendar, which is exactly what a low η² means.
- **ミラクル猫砂** is the honest edge case described above: middling η², meaningless F.
- **ハロウィン仮装** stops at 2025-11 on purpose, so the `更新推奨` staleness tag has something to flag.

The same eight products ship twice: as `.xlsx` files under `demo-data/` (drag them onto the dropzone
to exercise the real parser) and as `js/demo-data.js` (the one-click button, which writes to
IndexedDB through the same merge path an upload uses).

## Features

- **Upload** — drag & drop `.xlsx`. Finds the sheet whose header row contains the expected columns,
  and takes the product name from the sheet name.
- **Merge, don't overwrite** — re-uploading merges by year-month, so you can drop in the full history
  again or just the newest months. The log reports `新規 X ヶ月 / 更新 Y ヶ月`, or `変更なし`.
- **Staleness tags** — any product whose latest month is 2+ months behind today gets `更新推奨`.
- **Product detail** — η²/F, seasonal index bars, year-over-year table, top spikes with diagnosed
  factor and editable notes, weakest months, and the full raw monthly table.
- **季節カレンダー** — every product's twelve monthly indices in one colour-coded grid, each row's
  peak month starred, sortable by any month or by η², with Excel-style checklist filters on 商品名
  and 判定.
- **Error banner** — any uncaught JS error surfaces at the top of the page instead of failing
  silently. This exists because a partial deploy (new `app.js`, stale `index.html`) produced a blank
  table with no explanation, twice.

## Input format

One sheet per product. Column order is free; the header strings must match exactly. The sheet name
becomes the product name.

| 月別推移 | 売上金額 | 購入個数 | 購入件数 | 総顧客数 | 新規顧客数 | 既存顧客数 |
|---|---|---|---|---|---|---|
| 25_04 | 1294060 | 223 | 179 | 121 | 36 | 85 |

This is not an arbitrary schema — it is the output of the `KPI1_MONTHLY` query in my **EC Sales KPI
& Basket Analysis** tool. The two chain together: that tool pulls monthly figures out of SQL Server,
this one decides what the shape of those figures means.

## Stack and structure

Vanilla JS — no framework, no bundler. SheetJS from a CDN for `.xlsx` parsing; everything else is
hand-written.

```
sales-analyzer/
├── index.html
├── css/style.css
├── demo-data/          # eight fictional .xlsx exports
└── js/
    ├── db.js           # IndexedDB wrapper + merge-by-year-month upsert
    ├── parse.js        # xlsx → structured rows (SheetJS)
    ├── stats.js        # seasonal index / eta² / F / spike diagnosis
    ├── demo-data.js    # the cat catalogue, as data
    └── app.js          # view routing + rendering
```

The split is deliberate: `parse.js` and `stats.js` know nothing about where data is stored, so
swapping `db.js` for a hosted database to get multi-device sync would leave the parsing and analysis
untouched.

## Run it

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

Opening `index.html` over `file://` mostly works, but IndexedDB and the CDN script are more reliable
over `http://`.

## Deploy

Push the folder to a repo, then **Settings → Pages → Deploy from a branch**, `main` / `/ (root)`.
There is no backend to configure.

## Limitations

- **Storage is per-browser.** GitHub Pages serves static files only, so data lives in that browser's
  IndexedDB. It does not sync across devices, and clearing site data wipes it. Fine for one person's
  analysis workflow, which is what this is scoped to.
- **η² needs history.** Under about three years the statistic is noisy enough to mislead; F is shown
  alongside it precisely so you can tell when that is happening.
- **Spike diagnosis is a heuristic**, not causal inference. Treat it as the question, not the answer.

## License

MIT
