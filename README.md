# Seasonal Analyzer — 商品別 季節性・トレンド分析

### When a product sells well, is it the season, or something we did?

A small web app that answers that question for every product in a catalogue at once. Drop in monthly sales files, and it sorts each product into **season-driven**, **campaign-driven** or **mixed**, then lays every product's year out side by side in one calendar.

**[▶ Open the live demo](https://coolcatplayground.github.io/seasonal-analyzer/)** — press ** デモデータを読み込む** to fill the whole app with a fictional cat-supply store in one click. No sign-in, nothing to install.

---

## Field notes: the creature in the wild

A colleague and I were doing this by hand. Export a product's monthly numbers, squint at the peaks, argue about whether December was the gift season or the campaign we ran, then copy the verdict into a master spreadsheet. It worked for a handful of products and fell apart at hundreds. Worse, two people looking at the same chart would reach different conclusions depending on which year caught their eye.

The answer matters more than it sounds:

- A **season-driven** product should be **stocked** against the calendar. Its peak arrives whether you do anything or not.
- A **campaign-driven** product should be **scheduled**. Its good months are the ones you choose.

Mix them up, and you either buy stock for a "peak" that was really a promotion, or wait for a season that was never coming on its own. So the squinting was replaced with a calculation, and the master spreadsheet with a calendar the app builds itself.

## What it does

**A verdict for every product.** The app compares each month with the rest of that year, so growth over time doesn't get mistaken for seasonality, and measures how much of a product's ups and downs are explained by the time of year. A lot means season-driven, very little means campaign-driven, and anything in between is mixed.

**It admits when it isn't sure.** With only a few years of history, the "how seasonal" score tends to run high, even for a product with no real season. So the app always shows a second number that says whether the pattern is stronger than plain luck. A tool that confidently invents seasons would be worse than no tool at all.

**Spikes come with a suspect, not a conviction.** When a month jumps, the app checks what changed: bigger baskets (客単価上昇), existing customers coming back (既存顧客の再購買), or a wave of new customers (新規顧客の増加). It offers that as a hypothesis. Every month has a note field, so once someone learns the real reason (a campaign, a magazine feature, a stockout), it gets written down and stays there.

**The season calendar (季節カレンダー).** Every product's twelve months in one colour-coded grid, with each product's best month starred. Sort by any month, or filter by product name and verdict, much like a spreadsheet.

**Re-uploading is safe.** Files merge by month instead of overwriting. Upload the whole history again or just the newest months, and you end up in the same place. The log tells you how many months were new, how many were updated, or that nothing changed.

**Stale products get a tag.** Anything whose latest month is two or more months behind is marked `更新推奨` (update recommended).

## Method: how a verdict is reached

For each product, with several years of monthly rows:

1. **Ratio.** Each month's sales divided by that year's monthly average. This takes growth out of the picture, so a December in 2019 and a December in 2025 can be compared fairly.
2. **Seasonal index.** The average ratio for each calendar month across all years. Above 1 means that month usually beats the year's average; below 1 means it usually lags.
3. **How seasonal: η² (eta squared).** How much of the ups and downs is explained by *which month it is*, from 0% to 100%.
4. **Is it real: F.** Whether that pattern is stronger than chance alone would produce. A one-way ANOVA across the twelve months gives both numbers.
5. **Verdict.** η² under 10% → campaign-driven (キャンペーン主導型). 10–25% → mixed (混合型). 25% or more → season-driven (季節性主導型).

**Why both numbers, always.** With twelve months and only a few years of history, η² runs high even for a product with no season at all. The demo's litter is exactly this trap: η² = 0.147 looks mildly seasonal, while F = 1.2 says the pattern is indistinguishable from noise. More years of history shrink the problem, and showing both lets you see when it's biting.

**How spikes are read.** The ten strongest months are compared with that product's own normal, and the first rule that fits becomes the suggested reason:

- average order value 15%+ above normal → 客単価上昇 (bigger baskets)
- customers 15%+ above that year's average, without an unusual share of new ones → 既存顧客の再購買 (existing customers returning)
- new-customer share 1.5× normal or more → 新規顧客の増加 (a wave of new customers)
- otherwise, customers 10%+ above average → 顧客数の増加 (more customers); if nothing fits → 要因不明瞭 (unclear)

It's a correlation, so it's labelled as a hypothesis and paired with a note field for the real answer.

The method comes from the seasonality analysis my colleague and I were already running in a spreadsheet; the app that automates it was built with generative AI under my direction.

## Specimens in the demo greenhouse

The real data is confidential, so no company data appears anywhere in this repository. The demo is a fictional cat-supply store with eight products, about seven years each. They were picked to give the app a fair test, not an easy one:

| Product | What it is | Verdict |
|---|---|---|
| 猫のおせち にゃん重 | New Year feast, for cats | Season-driven |
| ハロウィン仮装 かぼちゃニャン | Halloween costume | Season-driven |
| ひんやりニャンモック | Cooling hammock | Season-driven |
| こたつニャンハウス | Heated dome | Season-driven |
| 毛玉ケアフード 毎日ブラッシュ | Hairball care food | Mixed |
| 高級ちゅーるタワー ギフト箱 | Premium gift tower | Mixed |
| ミラクル猫砂 10L | Litter | Mixed |
| またたびスティック30本 | Matatabi sticks | Campaign-driven |

A few of them are there on purpose:

- **おせち and ハロウィン** are the extreme cases: products that barely exist outside one month a year.
- **またたびスティック** sells steadily, with promotions scattered across nine different months. Plenty of ups and downs, none of them tied to the calendar, which is exactly what campaign-driven looks like.
- **ミラクル猫砂** is the honest trap. Its seasonality score looks mildly seasonal, but the second number says the pattern is no stronger than luck. It's the reason the app never shows one number without the other.
- **ハロウィン仮装** stops in November 2025, so the `更新推奨` tag has something to catch.

Two of the products also come as real Excel files in the repo (`ひんやりニャンモック.xlsx`, `またたびスティック30本.xlsx`). Drag them onto the upload area to try the real upload path.

## What it eats

One sheet per product, and the **sheet name becomes the product name**. The columns can be in any order, but the headers must match exactly:

| 月別推移 | 売上金額 | 購入個数 | 購入件数 | 総顧客数 | 新規顧客数 | 既存顧客数 |
|---|---|---|---|---|---|---|
| 25_04 | 1294060 | 223 | 179 | 121 | 36 | 85 |

This format isn't arbitrary. It's exactly what my [basket analysis tool](https://github.com/coolcatplayground/basket-sales-analysis) exports. The two tools form a small food chain: one pulls monthly figures out of the company database, the other works out what their shape means.
