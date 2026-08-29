# Seasonal Analyzer — 商品別 季節性・トレンド分析

A static web app that answers one question for every product in a catalogue:

> **When this product sells well, is that the season — or was it something we did?**

Upload a monthly sales export, and it runs a one-way ANOVA of sales ratio against calendar
month, reports η² and F, classifies each product as season-driven / campaign-driven / mixed,
and lays every product's monthly seasonal index side by side in one sortable calendar.

No backend, no account, no build step.

**[▶ Live demo](https://coolcatplayground.github.io/seasonal-analyzer/)** · press
**🐱 デモデータを読み込む** to populate the whole app with a fictional catalogue in one click

---

## The problem it solves

A colleague and I were doing this by hand: export a product's monthly numbers, eyeball the
peaks, argue about whether December was the gift season or the campaign we ran, then copy the
conclusion into a master spreadsheet. It worked for a handful of products and did not scale to
hundreds — and "eyeball the peaks" is not a method. Two people looking at the same chart
reached different conclusions depending on which year they anchored on.

The distinction carries real commercial weight. A season-driven product should be **stocked**
against the calendar. A campaign-driven product should be **scheduled** — its good months are
the ones you choose. Confusing the two means either buying inventory for a peak that was
really a promotion, or waiting for a season that was never going to arrive on its own.

So the judgement call was replaced with a statistic, and the master spreadsheet was replaced
with a calendar the app generates.

## What it demonstrates

Applied statistics in service of a business decision · awareness of where the chosen statistic
misleads, and designing the UI around that · idempotent merge semantics over local storage ·
turning a recurring manual analysis into a reproducible tool · dependency-light vanilla
JavaScript with a clean separation between parsing, analysis, and storage.

---

## Method

For each product, given monthly rows across several years:

1. **Ratio** — each month's sales as a proportion of that year's average. This strips the
   growth trend out, so a 2019 December and a 2025 December become comparable.
2. **Seasonal index** — the mean ratio for each calendar month across all years.
3. **η² and F** — a one-way ANOVA of ratio grouped by calendar month. η² is the share of
   variance explained by month-of-year; F says whether that share exceeds what sampling noise
   alone would produce.
4. **Classification** — η² < 10% campaign-driven, 10–25% mixed, ≥ 25% season-driven.

### The part worth reading

**η² is reported alongside F because η² alone would mislead.** With twelve month-groups and
only a few years of history, η² carries a systematic upward bias — even a perfectly flat
product lands somewhere near `dfBetween / dfTotal`. The litter product in the demo catalogue
is exactly this trap: η² = 0.147 reads as mild seasonality, while F = 1.2 says the pattern is
indistinguishable from noise. Surfacing one number without the other would have produced a
tool that confidently invents seasons. More years of history shrinks the bias, and the app
shows both figures so the user can see when it is biting.

**Spike diagnosis is framed as a hypothesis, not a verdict.** When a month spikes, the app
compares it against that product's own baseline on three axes — average order value, customer
count, and new-customer share — and proposes a cause: 客単価上昇 (bigger baskets),
既存顧客の再購買 (existing customers returning), or 新規顧客の増加 (an acquisition wave).
This is correlational and the app says so. Every month therefore carries a free-text note
field: when you learn the real reason — a campaign name, a magazine feature, a stockout — you
write it on that month, and the note survives every future re-upload. The heuristic's job is
to raise the question and let a human close it.

**Re-uploading merges rather than overwrites.** Uploads reconcile by year-month, so you can
drop in the full history again or only the newest months and get the same result either way.
The log reports `新規 X ヶ月 / 更新 Y ヶ月`, or `変更なし`. Making the operation idempotent
removes the "which file was newest?" question entirely.

---

## Features

- **Upload** — drag & drop `.xlsx`. Locates the sheet whose header row matches the expected
  columns and takes the product name from the sheet name.
- **Product detail** — η² and F, seasonal index bars, year-over-year table, top spikes with
  diagnosed factor and editable notes, weakest months, full raw monthly table.
- **季節カレンダー** — every product's twelve monthly indices in one colour-coded grid, peak
  month starred per row, sortable by any month or by η², with Excel-style checklist filters on
  商品名 and 判定.
- **Staleness tags** — any product whose latest month is 2+ months behind today is flagged
  `更新推奨`.
- **Error banner** — uncaught JS errors surface at the top of the page rather than failing
  silently. This exists because a partial deploy — new `app.js` against a stale `index.html` —
  produced a blank table with no explanation, twice.

## Demo catalogue

The real data is confidential, so the bundled demo is a fictional cat-supply store. The eight
products were chosen to give the classifier something to separate, not to flatter it:

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

Roughly seven years of monthly data each. Several cases are deliberate: **おせち** and
**ハロウィン** are the extreme end, products that exist for one month a year.
**またたびスティック** has a flat baseline with promotions scattered across nine different
months — real variance, not aligned to the calendar, which is precisely what a low η² means.
**ミラクル猫砂** is the honest edge case above. **ハロウィン仮装** stops at 2025-11 on purpose,
so the `更新推奨` staleness tag has something to flag.

The full eight-product catalogue loads from `js/demo-data.js` via the one-click button, writing
to IndexedDB through the same merge path a real upload uses. Two of those products
(`ひんやりニャンモック.xlsx`, `またたびスティック30本.xlsx`) also ship as real `.xlsx` files at
the repo root — drag them onto the dropzone to exercise the actual parser end to end.

## Input format

One sheet per product. Column order is free; header strings must match exactly. The sheet name
becomes the product name.

| 月別推移 | 売上金額 | 購入個数 | 購入件数 | 総顧客数 | 新規顧客数 | 既存顧客数 |
|---|---|---|---|---|---|---|
| 25_04 | 1294060 | 223 | 179 | 121 | 36 | 85 |

This is not an arbitrary schema — it is the output of the `KPI1_MONTHLY` query in my **EC Sales
KPI & Basket Analysis** tool. The two chain together: that tool pulls monthly figures out of
SQL Server, this one decides what the shape of those figures means.

## Stack

Vanilla JavaScript, no framework or bundler. SheetJS from CDN for `.xlsx` parsing; everything
else hand-written. Storage is IndexedDB.

```
index.html
css/style.css
js/
  db.js          IndexedDB wrapper + merge-by-year-month upsert
  parse.js       xlsx → structured rows (SheetJS)
  stats.js       seasonal index / η² / F / spike diagnosis
  demo-data.js   the cat catalogue, as data
  app.js         view routing + rendering
```

`parse.js` and `stats.js` know nothing about where data is stored, so swapping `db.js` for a
hosted database to gain multi-device sync would leave parsing and analysis untouched.

## Run it locally

```bash
python3 -m http.server 8000    # then open http://localhost:8000
```

`file://` mostly works, but IndexedDB and the CDN script are more reliable over `http://`.

## Limitations

- **Storage is per-browser.** Static hosting means data lives in that browser's IndexedDB. It
  does not sync across devices, and clearing site data wipes it. Acceptable for the
  single-analyst workflow this is scoped to.
- **η² needs history.** Under roughly three years the statistic is noisy enough to mislead; F
  is shown alongside it precisely so you can tell when that is happening.
- **Spike diagnosis is a heuristic**, not causal inference. Treat it as the question, not the
  answer.

## License

MIT
