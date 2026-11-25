/*
 * The page itself, in headless Chrome over the DevTools protocol (Node 22+: global WebSocket
 * and fetch, no automation library). With the demo loaded it visits every tab and every product
 * page, in both languages, both display modes, all three periods and every channel filter; then
 * checks phone width, the .xlsx upload path with the two samples, and the demo reset.
 * Fails on any page exception, console error, the red error banner, an empty view, or a page
 * wider than the phone.
 *
 *   python3 -m http.server 8000 &
 *   node tools/smoke.js http://localhost:8000/
 *
 * CHROME_PATH picks the browser; the default is Chrome's usual place on Windows, macOS or Linux.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const BASE = process.argv[2] || 'http://localhost:8000/';
const CHROME = process.env.CHROME_PATH || {
  win32: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
}[process.platform] || 'google-chrome';
const PORT = 9300 + Math.floor(Math.random() * 500);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'sa-smoke-'));
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-sandbox',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore' });
  let targets;
  for (let i = 0; i < 100 && !targets; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); } catch (e) { await sleep(200); }
  }
  if (!targets) throw new Error('Chrome did not start: ' + CHROME);
  const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));

  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result); }
    if (m.method === 'Runtime.exceptionThrown') errors.push('exception: ' + JSON.stringify(m.params.exceptionDetails).slice(0, 400));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('console: ' + m.params.args.map((a) => a.value || a.description).join(' '));
    // the reset asks for confirmation; say yes
    if (m.method === 'Page.javascriptDialogOpening') send('Page.handleJavaScriptDialog', { accept: true });
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const n = ++id; pending.set(n, { resolve, reject }); ws.send(JSON.stringify({ id: n, method, params })); });
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(expr.slice(0, 80) + ' → ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
    return r.result.value;
  };
  const viewport = (width, mobile) => send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile });
  await send('Runtime.enable');
  await send('Page.enable');
  await send('DOM.enable');
  await viewport(1280, false);

  const goto = async (url) => { await send('Page.navigate', { url }); await sleep(1500); };
  const click = (sel) => ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; el.click(); return true; })()`);
  const waitFor = async (expr, ms = 15000) => { for (let t = 0; t < ms; t += 250) { if (await ev(expr)) return true; await sleep(250); } return false; };

  let checks = 0;
  const fail = [];
  const check = async (label, { phone = false } = {}) => {
    checks++;
    const banner = await ev("(document.getElementById('fatal-error-banner') || {}).textContent || ''");
    const text = await ev("(document.querySelector('.view.is-active') || {}).innerText || ''");
    if (banner) fail.push(`${label}: banner ${banner.slice(0, 200)}`);
    if (text.trim().length < 40) fail.push(`${label}: view looks empty`);
    if (phone) {
      const w = await ev('[document.documentElement.scrollWidth, window.innerWidth]');
      if (w[0] > w[1] || w[1] > 390) fail.push(`${label}: page is ${w[0]}px wide on a 390px phone`);
    }
  };

  // a clean browser, every 会計区分 and the ended series in scope, so every product is reachable
  await goto(BASE + 'index.html');
  await ev(`localStorage.setItem('seasonal-analyzer-scope', JSON.stringify({ accounts: ['商品売上高', 'サービス売上高', '__manual'], includeEnded: true })); true`);
  await goto(BASE + 'index.html?demo');
  if (!(await waitFor("document.querySelectorAll('#view-products.is-active tbody tr').length === 11"))) fail.push('?demo: the eleven demo series did not load');
  if (await ev("document.getElementById('demo-notice').hidden")) fail.push('?demo: the demo notice is hidden');

  const tabs = ['products', 'calendar', 'momentum', 'channels', 'notes'];
  async function sweep(label, { details = true, phone = false } = {}) {
    for (const tab of tabs) {
      await click(`.tab-btn[data-view="${tab}"]`);
      await sleep(350);
      await check(`${label} / ${tab}`, { phone });
    }
    if (!details) return;
    await click('.tab-btn[data-view="products"]');
    await sleep(300);
    // rows in 数値 mode; in ビジュアル mode the first SVG mark of each product (two charts draw one each)
    const items = `(() => {
      if (!document.body.classList.contains('is-visual')) return Array.from(document.querySelectorAll('#view-products tbody tr'));
      const seen = new Set();
      return Array.from(document.querySelectorAll('#view-products [data-name]')).filter((el) => !seen.has(el.dataset.name) && seen.add(el.dataset.name));
    })()`;
    const names = await ev(`${items}.map((el) => (el.dataset.name || el.textContent).trim().slice(0, 20))`);
    for (let i = 0; i < names.length; i++) {
      await click('.tab-btn[data-view="products"]');
      await sleep(250);
      // SVG elements have no .click(), so dispatch it
      await ev(`${items}[${i}].dispatchEvent(new MouseEvent('click', { bubbles: true })); true`);
      await sleep(500);
      await check(`${label} / detail ${names[i]}`, { phone });
      // one SKU on its own, then back to the whole series
      if (!phone && await click('#sku-table .sku-only')) { await sleep(400); await check(`${label} / detail ${names[i]} / one SKU`); await click('#sku-all'); await sleep(300); }
    }
  }

  for (const lang of ['ja', 'en']) {
    await click(`.lang-btn[data-lang="${lang}"]`);
    await sleep(300);
    for (const mode of ['numbers', 'visual']) {
      await click(`.mode-btn[data-display="${mode}"]`);
      await sleep(300);
      for (const period of ['0', '5', '3']) {
        await click(`.period-btn[data-period="${period}"]`);
        await sleep(300);
        await sweep(`${lang}/${mode}/${period}y`, { details: period !== '5' });
      }
      await click('.period-btn[data-period="0"]');
    }
  }
  // every channel group as the top-bar filter
  const groups = await ev("Array.from(document.querySelectorAll('#channel-filter option')).map((o) => o.value).filter(Boolean)");
  for (const g of groups) {
    await ev(`(() => { const s = document.getElementById('channel-filter'); s.value = ${JSON.stringify(g)}; s.dispatchEvent(new Event('change')); return true; })()`);
    await sleep(500);
    await sweep(`channel ${g}`, { details: g === 'mall' || g === 'seminar' });
  }
  await ev("(() => { const s = document.getElementById('channel-filter'); s.value = ''; s.dispatchEvent(new Event('change')); return true; })()");

  // phone width, both display modes, every product page
  await viewport(390, true);
  await click('.lang-btn[data-lang="ja"]');
  for (const mode of ['numbers', 'visual']) {
    await click(`.mode-btn[data-display="${mode}"]`);
    await sleep(300);
    await sweep(`phone/${mode}`, { phone: true });
  }
  await viewport(1280, false);
  await click('.mode-btn[data-display="numbers"]');

  // the demo reset: delete a product, then get the whole store back
  await click('.tab-btn[data-view="products"]');
  await ev("SalesDB.remove('ミラクル猫砂 10L').then(() => true)");
  await click('#reset-demo');
  if (!(await waitFor("SalesDB.getAll().then((a) => a.length === 11)"))) fail.push('reset: the deleted demo product did not come back');
  checks++;

  // the .xlsx path: the two sample files through the real file input (SheetJS from the CDN)
  await click('.tab-btn[data-view="upload"]');
  const doc = await send('DOM.getDocument');
  const { nodeId } = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '#file-input' });
  const samples = path.join(__dirname, '..', 'samples');
  const files = fs.readdirSync(samples).filter((f) => f.endsWith('.xlsx')).map((f) => path.join(samples, f));
  const before = await ev("document.querySelectorAll('.log-row.ok').length");
  await send('DOM.setFileInputFiles', { nodeId, files });
  if (!(await waitFor(`document.querySelectorAll('.log-row.ok').length >= ${before + files.length}`))) fail.push('upload: the sample .xlsx files were not read');
  const errRows = await ev("Array.from(document.querySelectorAll('.log-row.err')).map((r) => r.textContent.trim())");
  errRows.forEach((r) => fail.push('upload: ' + r));
  checks++;

  console.log('%d views checked; %d failure(s); %d page error(s)', checks, fail.length, errors.length);
  fail.slice(0, 30).forEach((f) => console.log('  FAIL ' + f));
  errors.slice(0, 20).forEach((e) => console.log('  ERROR ' + e));
  ws.close();
  chrome.kill();
  await sleep(400);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) { /* Chrome may still hold a file */ }
  process.exit(fail.length || errors.length ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
