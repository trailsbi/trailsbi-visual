// Runs the built visual (.tmp/drop/visual.js, from `pbiviz package`) in a sandboxed iframe
// like Power BI's, with a stand-in host, and feeds it TrailsBI data tables.
//   node tools/harness/run.js <data.csv> [<other data.csv>] [--shots <folder>] [--size 1400x860]
// Needs Playwright (npm i -D playwright) and a Chromium it can launch.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..", "..");
const args = process.argv.slice(2);
const shotsAt = args.indexOf("--shots");
const shots = shotsAt >= 0 ? args.splice(shotsAt, 2)[1] : null;
if (!args.length) { console.error("usage: run.js <data.csv> [<other data.csv>] [--shots <folder>]"); process.exit(2); }
const sizeAt = args.indexOf("--size");
const [W, H] = (sizeAt >= 0 ? args.splice(sizeAt, 2)[1] : "1400x860").split("x").map(Number);
if (shots) fs.mkdirSync(shots, { recursive: true });

function readCsv(file) {            // the two-column CSV that tools/to_table.py writes
  const text = fs.readFileSync(file, "utf8").replace(/^﻿/, "");
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.slice(1).filter(r => r.length === 2).map(r => [Number(r[0]), r[1]]);
}

const js = fs.readFileSync(path.join(ROOT, ".tmp/drop/visual.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, ".tmp/drop/visual.css"), "utf8");
const guid = JSON.parse(fs.readFileSync(path.join(ROOT, "pbiviz.json"), "utf8")).visual.guid;

// Inside the sandbox: a host stand-in, and a message pump the test drives.
const bootstrap = `
window.__log = [];
const send = m => parent.postMessage(m, "*");
console.error = (...a) => send({ kind: "console", text: a.map(String).join(" ") });
window.addEventListener("error", e => send({ kind: "console", text: "uncaught: " + e.message }));
let visual = null;
const el = document.createElement("div"); document.body.appendChild(el);
const host = {
  eventService: { renderingStarted() {}, renderingFinished() { send({ kind: "rendered" }); }, renderingFailed(o, r) { send({ kind: "failed", reason: r }); } },
  launchUrl(u) { send({ kind: "launch", url: u }); },
};
window.addEventListener("message", e => {
  const m = e.data;
  if (m.cmd === "update") {
    if (!visual) visual = window.powerbi.visuals.plugins["${guid}"].create({ element: el, host });
    const dataView = m.rows ? { metadata: { objects: m.objects || {} }, table: { columns: [{ roles: { part: true } }, { roles: { chunk: true } }], rows: m.rows } } : undefined;
    visual.update({ dataViews: dataView ? [dataView] : [], viewport: { width: innerWidth, height: innerHeight }, type: 2 });
    const card = visual.getFormattingModel().cards[0];
    const slices = card ? card.groups[0].slices.map(s => [s.displayName, s.control.properties.value]) : [];
    send({ kind: "listeners", n: visual.listeners.length, slices });
  }
});
send({ kind: "ready" });
`;

const srcdoc = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%}${css}</style></head><body>
<script>window.powerbi = {};</` + `script><script>${js.replace(/<\/script/gi, "<\\/script")}</` + `script><script>${bootstrap}</` + `script></body></html>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const events = [];
  await page.exposeFunction("__record", m => events.push(m));
  await page.setContent(`<html><body style="margin:0"><iframe id="v" sandbox="allow-scripts" style="border:0;width:${W}px;height:${H}px"></iframe>
    <script>addEventListener("message", e => window.__record(e.data));</script></body></html>`);
  await page.evaluate(doc => { document.getElementById("v").srcdoc = doc; }, srcdoc);
  const waitFor = async (kind, from = 0, ms = 15000) => {
    const t = Date.now();
    while (Date.now() - t < ms) { const e = events.slice(from).find(x => x.kind === kind); if (e) return e; await page.waitForTimeout(50); }
    throw new Error("timed out waiting for " + kind);
  };
  const frame = () => page.frames().find(f => f !== page.mainFrame());
  const post = msg => page.evaluate(m => document.getElementById("v").contentWindow.postMessage(m, "*"), msg);
  const update = async (rows, objects) => { const n = events.length; await post({ cmd: "update", rows, objects }); await waitFor("rendered", n); await page.waitForTimeout(1500); return events.slice(n); };
  const results = [];
  const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  (" + detail + ")" : ""}`); };
  const shot = async name => { if (shots) await page.screenshot({ path: path.join(shots, name + ".png") }); };

  await waitFor("ready");
  let out = await update(null);
  check("no fields: shows how to set it up", /Part and Chunk/.test(await frame().innerText("body")));
  await shot("0-empty");

  const a = readCsv(args[0]);
  out = await update(a);
  const fa = frame();
  const titleA = (await fa.textContent("header h1")).trim();
  check("data A renders the page", !!titleA && (await fa.$("#boot")) === null, titleA);
  const listenersA = out.find(e => e.kind === "listeners").n;
  for (const tab of ["graph", "model", "report", "health", "ai"]) {
    await fa.click(`button[data-tab="${tab}"]`); await page.waitForTimeout(500);
    const visible = await fa.$eval(`#tab-${tab === "graph" ? "graph" : tab}`, s => s.offsetHeight > 100).catch(() => false);
    check(`tab ${tab} shows content`, visible);
    await shot("1-" + tab);
  }
  await fa.click('button[data-tab="graph"]');

  // Every scrolling area must scroll with the mouse wheel, as it does in the HTML report.
  const scrollAreas = [
    ["graph", "#canvas", "lineage canvas"],
    ["report", "#tab-report .doc", "reports view"],
    ["health", "#tab-health .doc", "health view"],
    ["ai", "#tab-ai .doc", "AI readiness view"],
    ["model", "#tab-model .doc", "model view"],
  ];
  for (const [tab, sel, label] of scrollAreas) {
    await fa.click(`button[data-tab="${tab}"]`); await page.waitForTimeout(400);
    const box = await fa.$eval(sel, el => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, sh: el.scrollHeight, ch: el.clientHeight }; }).catch(() => null);
    if (!box) { check(`${label} scrolls`, false, "not found"); continue; }
    const iframeBox = await page.$eval("#v", f => { const r = f.getBoundingClientRect(); return { x: r.x, y: r.y }; });
    await page.mouse.move(iframeBox.x + box.x, iframeBox.y + box.y);
    await page.mouse.wheel(0, 600); await page.waitForTimeout(300);
    const top = await fa.$eval(sel, el => el.scrollTop);
    check(`${label} scrolls with the wheel`, box.sh <= box.ch + 1 ? box.ch < 2000 : top > 0, `content ${box.sh}px in ${box.ch}px, scrolled ${top}px`);
    await fa.$eval(sel, el => { el.scrollTop = 0; });
  }
  await fa.click('button[data-tab="graph"]');
  // the lineage details panel, with a busy item selected
  await fa.click("#canvas .box >> nth=8").catch(() => {});
  await page.waitForTimeout(500);
  {
    const sel = "#side .pane";
    const box = await fa.$eval(sel, el => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, sh: el.scrollHeight, ch: el.clientHeight, w: r.width }; }).catch(() => null);
    if (!box || box.w < 50) {
      await fa.click("#sideShow").catch(() => {});
      await page.waitForTimeout(400);
    }
    const b2 = await fa.$eval(sel, el => { const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, sh: el.scrollHeight, ch: el.clientHeight }; }).catch(() => null);
    if (!b2) check("details panel scrolls with the wheel", false, "not found");
    else {
      const iframeBox = await page.$eval("#v", f => { const r = f.getBoundingClientRect(); return { x: r.x, y: r.y }; });
      await page.mouse.move(iframeBox.x + b2.x, iframeBox.y + b2.y);
      await page.mouse.wheel(0, 600); await page.waitForTimeout(300);
      const top = await fa.$eval(sel, el => el.scrollTop);
      check("details panel scrolls with the wheel", b2.sh <= b2.ch || top > 0, `content ${b2.sh}px in ${b2.ch}px, scrolled ${top}px`);
      await shot("1-details");
    }
  }

  out = await update(a);
  check("same data again keeps the page (no rebuild)", out.find(e => e.kind === "listeners").n === listenersA && (await frame().textContent("header h1")).trim() === titleA);

  await frame().click(".logo-link"); await page.waitForTimeout(300);
  check("links open through host.launchUrl", events.some(e => e.kind === "launch" && /trailsbi\.com/.test(e.url)));

  await frame().click('button[data-tab="model"]'); await page.waitForTimeout(300);
  await frame().click('button:has-text("Diagram")'); await page.waitForTimeout(800);
  const exportBtn = await frame().$(".dexp-btn");
  if (exportBtn) {
    await exportBtn.click(); await page.waitForTimeout(200);
    await frame().click('.dexp-pop button[data-exp="png"]'); await page.waitForTimeout(1500);
    const text = await frame().innerText("body");
    check("diagram export explains it is not available here", /not available inside Power BI/.test(text));
    await shot("2-export");
  } else check("diagram export button found", false);
  await frame().click('button[data-tab="graph"]');

  if (args[1]) {
    const b = readCsv(args[1]);
    out = await update(b);
    const titleB = (await frame().textContent("header h1")).trim();
    const listenersB = out.find(e => e.kind === "listeners").n;
    check("new data rebuilds the page", titleB !== titleA, titleB);
    check("old listeners are removed on rebuild", listenersB === listenersA, `${listenersA} -> ${listenersB}`);
    check("nothing from the old page is left behind", !/not available inside Power BI/.test(await frame().innerText("body")));
    await shot("3-second-data");
  }

  // Format visual > Pages: each page can be switched off.
  {
    const allOn = (await update(a)).find(e => e.kind === "listeners").slices;
    check("format pane lists the five pages, all on", allOn.length === 5 && allOn.every(s => s[1] === true), allOn.map(s => s[0]).join(", "));
    const railShown = async () => frame().$$eval(".rail button[data-tab]", bs => bs.filter(b => !b.hidden).map(b => b.dataset.tab));
    await frame().click('button[data-tab="graph"]');
    out = await update(a, { pages: { lineage: false, health: false } });
    const shown = await railShown();
    const current = await frame().$eval(".rail button.on", b => b.dataset.tab);
    check("switched-off pages leave the rail", shown.join() === "model,report,ai", shown.join());
    check("a switched-off open page moves to the first one left", current === "model" && await frame().$eval("#tab-model", s => s.offsetHeight > 100), current);
    const sl = out.find(e => e.kind === "listeners").slices;
    check("format pane shows the switches as set", sl.map(s => s[1]).join() === "false,true,true,false,true", sl.map(s => s[1]).join());
    check("changing pages does not rebuild the page", out.find(e => e.kind === "listeners").n === listenersA && (await frame().textContent("header h1")).trim() === titleA);
    // a link inside the page to a switched-off page explains instead of opening it
    await frame().click('button[data-tab="ai"]'); await page.waitForTimeout(400);
    await frame().evaluate(() => { const b = document.querySelector('.rail button[data-tab="health"]'); b.hidden = false; b.click(); b.hidden = true; });
    await page.waitForTimeout(400);
    check("a link to a switched-off page explains, stays put", (await frame().$eval(".rail button.on", b => b.dataset.tab)) === "ai" && /Health page is turned off/.test(await frame().innerText("body")));
    await shot("4-pages-hidden");
    await update(a, { pages: { model: false, reports: false, health: false, ai: false } });
    check("one page left: the rail is hidden", await frame().$eval(".rail", r => r.hidden) && await frame().$eval("#tab-graph", s => s.offsetHeight > 100));
    await shot("4-lineage-only");
    await update(a, { pages: { lineage: false, model: false, reports: false, health: false, ai: false } });
    check("all pages off: says how to turn one back on", /All pages are hidden/.test(await frame().innerText("body")));
    await update(a, {});
    check("turning pages back on brings the page back", (await railShown()).length === 5 && !(await frame().$eval(".rail", r => r.hidden)));
  }

  out = await update(a.filter(r => r[0] !== 2));
  check("a missing chunk is reported, not crashed on", /Chunk 2 of the TrailsBI data is missing/.test(await frame().innerText("body")));

  const errors = events.filter(e => e.kind === "console" || e.kind === "failed");
  check("no errors in the console", errors.length === 0, errors.map(e => e.text || e.reason).slice(0, 3).join(" | "));
  await browser.close();
  const failed = results.filter(r => !r).length;
  console.log(failed ? `${failed} check(s) failed` : `all ${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
