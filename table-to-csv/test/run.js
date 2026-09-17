/**
 * Tests. Most of these are about merged cells and number formats, because that
 * is where the existing tools in this niche quietly produce wrong spreadsheets.
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const CODE = fs.readFileSync(path.join(__dirname, "..", "src", "tables.js"), "utf8");
const BASE = { format: "csv", delimiter: ",", cleanNumbers: true, bom: false };

function load(html) {
  const dom = new JSDOM(html, { url: "https://example.com/report" });
  const { window } = dom;
  global.window = window; global.document = window.document;
  global.location = window.location;
  return new Function(CODE + "\nreturn { scanTables, exportTable, cleanNumber, toGrid, findTables };")
    .call(window);
}

let failures = 0;
const check = (name, fn) => {
  try { fn(); console.log("PASS " + name); }
  catch (e) { failures++; console.log("FAIL " + name + " -> " + e.message); }
};
const assert = (c, m) => { if (!c) throw new Error(m); };

check("colspan is expanded so every row has the same width", () => {
  const api = load(`<table>
    <tr><th colspan="2">Region</th><th>Total</th></tr>
    <tr><td>North</td><td>A</td><td>10</td></tr>
    <tr><td>South</td><td>B</td><td>20</td></tr></table>`);
  const out = api.exportTable(0, BASE).text.trim().split("\r\n");
  assert(out.every(r => r.split(",").length === 3), "rows are not the same width: " + JSON.stringify(out));
  assert(out[0] === "Region,Region,Total", "colspan header not expanded: " + out[0]);
});

check("rowspan carries a value down into later rows", () => {
  const api = load(`<table>
    <tr><th>Country</th><th>City</th></tr>
    <tr><td rowspan="2">Vietnam</td><td>Hanoi</td></tr>
    <tr><td>Da Nang</td></tr></table>`);
  const rows = api.exportTable(0, BASE).text.trim().split("\r\n");
  assert(rows[1] === "Vietnam,Hanoi", "first spanned row wrong: " + rows[1]);
  assert(rows[2] === "Vietnam,Da Nang", "rowspan did not carry down: " + rows[2]);
});

check("rowspan and colspan together still produce a rectangle", () => {
  const api = load(`<table>
    <tr><td rowspan="2" colspan="2">Big</td><td>x</td></tr>
    <tr><td>y</td></tr>
    <tr><td>a</td><td>b</td><td>c</td></tr></table>`);
  const rows = api.exportTable(0, BASE).text.trim().split("\r\n");
  assert(rows.every(r => r.split(",").length === 3), "not rectangular: " + JSON.stringify(rows));
  assert(rows[1].startsWith("Big,Big,"), "span did not carry: " + rows[1]);
});

check("numbers are cleaned for spreadsheets", () => {
  const api = load("<table><tr><td>x</td></tr></table>");
  const n = api.cleanNumber;
  assert(n("$1,234.56") === "1234.56", "US format: " + n("$1,234.56"));
  assert(n("€1.234,56") === "1234.56", "EU format: " + n("€1.234,56"));
  assert(n("1 234") === "1234", "space separator: " + n("1 234"));
  assert(n("-42") === "-42", "negative: " + n("-42"));
  assert(n("N/A") === "N/A", "text should be untouched");
  assert(n("Q1 2026") === "Q1 2026", "mixed text should be untouched");
  assert(n("") === "", "empty stays empty");
});

check("CSV quoting survives commas, quotes and newlines", () => {
  const api = load(`<table>
    <tr><th>a</th><th>b</th></tr>
    <tr><td>x, y</td><td>He said "hi"</td></tr></table>`);
  const text = api.exportTable(0, BASE).text;
  assert(text.includes('"x, y"'), "comma not quoted");
  assert(text.includes('"He said ""hi"""'), "quotes not doubled: " + text);
});

check("Excel gets a BOM when asked", () => {
  const api = load("<table><tr><th>á</th><th>b</th></tr><tr><td>é</td><td>c</td></tr></table>");
  assert(api.exportTable(0, { ...BASE, bom: true }).text.charCodeAt(0) === 0xFEFF, "no BOM");
  assert(api.exportTable(0, { ...BASE, bom: false }).text.charCodeAt(0) !== 0xFEFF, "unwanted BOM");
});

check("JSON uses the header row and de-duplicates column names", () => {
  const api = load(`<table>
    <tr><th>name</th><th>name</th><th>value</th></tr>
    <tr><td>a</td><td>b</td><td>1,000</td></tr></table>`);
  const rows = JSON.parse(api.exportTable(0, { ...BASE, format: "json" }).text);
  assert(rows.length === 1, "wrong row count");
  assert(rows[0].name === "a" && rows[0].name_2 === "b", "duplicate headers not handled");
  assert(rows[0].value === "1000", "number not cleaned in JSON");
});

check("layout tables are ignored", () => {
  const api = load(`<table><tr><td>just a layout wrapper</td></tr></table>
    <table><tr><th>a</th><th>b</th></tr><tr><td>1</td><td>2</td></tr></table>`);
  const scan = api.scanTables(BASE);
  assert(scan.count === 1, "layout table not skipped, found " + scan.count);
});

check("tables are labelled by caption or the heading above them", () => {
  const api = load(`<h2>Quarterly Revenue</h2>
    <table><tr><th>a</th><th>b</th></tr><tr><td>1</td><td>2</td></tr></table>`);
  assert(api.scanTables(BASE).tables[0].caption === "Quarterly Revenue", "heading not picked up");
});

check("hidden tables are skipped", () => {
  const api = load(`<table hidden><tr><th>a</th><th>b</th></tr><tr><td>1</td><td>2</td></tr></table>
    <table><tr><th>c</th><th>d</th></tr><tr><td>3</td><td>4</td></tr></table>`);
  const scan = api.scanTables(BASE);
  assert(scan.count === 1, "hidden table included");
});

check("a page with no tables reports zero instead of throwing", () => {
  const api = load("<p>nothing here</p>");
  assert(api.scanTables(BASE).count === 0, "should be zero");
  assert(api.exportTable(0, BASE) === null, "should return null");
});

check("stylesheet and script text never reaches a cell", () => {
  const api = load(`<table>
    <tr><th>Name</th><th>Value</th></tr>
    <tr><td><style>.x{color:red}</style>Real</td><td><script>var a=1;</script>42</td></tr></table>`);
  const text = api.exportTable(0, BASE).text;
  assert(!text.includes("color:red"), "CSS leaked into a cell: " + text);
  assert(!text.includes("var a"), "JS leaked into a cell: " + text);
  assert(text.includes("Real") && text.includes("42"), "real content lost: " + text);
});

check("an image of a table is correctly reported as no table", () => {
  const api = load(`<article><h2>How to build a data table</h2>
    <img src="/screenshot-of-excel.png" alt="Bảng dữ liệu bố cục theo chiều dọc">
    <p>Some explanation about the screenshot above.</p></article>`);
  assert(api.scanTables(BASE).count === 0, "an image was counted as a table");
});

check("a div-based grid is not mistaken for a table", () => {
  const api = load(`<div class="grid">
    <div class="row"><div>A</div><div>B</div></div>
    <div class="row"><div>1</div><div>2</div></div></div>`);
  assert(api.scanTables(BASE).count === 0, "div grid counted as a table");
});

check("apps whose grids are not HTML tables are detected", () => {
  const apps = new Function(fs.readFileSync(path.join(__dirname, "..", "src", "apps.js"), "utf8")
    + "\nreturn { detectApp };")();
  const sheet = "https://docs.google.com/spreadsheets/d/1RzHsJS5e3t/edit?gid=2124276868#gid=2124276868";
  const app = apps.detectApp(sheet);
  assert(app && app.id === "google-sheets", "Google Sheets not detected");
  const url = app.exportUrl(sheet);
  assert(url === "https://docs.google.com/spreadsheets/d/1RzHsJS5e3t/export?format=csv&gid=2124276868",
    "wrong export URL: " + url);

  assert(apps.detectApp("https://airtable.com/app123/tbl456").id === "airtable", "Airtable missed");
  assert(apps.detectApp("https://www.notion.so/My-Page-abc").id === "notion", "Notion missed");
  assert(apps.detectApp("https://en.wikipedia.org/wiki/X") === null, "false positive on a normal page");
});

check("a sheet with no gid in the URL still exports the first tab", () => {
  const apps = new Function(fs.readFileSync(path.join(__dirname, "..", "src", "apps.js"), "utf8")
    + "\nreturn { detectApp };")();
  const url = "https://docs.google.com/spreadsheets/d/ABC123/edit";
  assert(apps.detectApp(url).exportUrl(url).endsWith("gid=0"), "should fall back to gid=0");
});

console.log();
console.log(failures ? `${failures} FAILED` : "ALL PASS");
process.exit(failures ? 1 : 0);
