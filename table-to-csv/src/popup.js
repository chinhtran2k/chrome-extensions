const BUY_URL = "https://example.com/buy";   // replace with your Paddle checkout link
// A page that definitely has real tables, so a first-time user can see what
// the extension does instead of guessing why nothing happened.
const EXAMPLE_URL = "https://en.wikipedia.org/wiki/List_of_countries_by_GDP_(nominal)";

const $ = id => document.getElementById(id);
const status = t => { $("status").textContent = t; };

let limits = { tablesPerPage: 1, formats: ["csv"], exportAll: false, pro: false };
let tables = [];
let selected = 0;

function options() {
  return {
    format: $("format").value,
    delimiter: $("format").value === "tsv" ? "\t" : ",",
    cleanNumbers: $("cleanNumbers").checked,
    bom: $("bom").checked && $("format").value === "csv",
  };
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !/^https?:/.test(tab.url || "")) throw new Error("This page cannot be scanned.");
  return tab;
}

async function inPage(func, args) {
  const tab = await activeTab();
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["src/tables.js"] });
  const [{ result }] = await chrome.scripting.executeScript(
    { target: { tabId: tab.id }, func, args });
  return result;
}

function renderList() {
  const list = $("list");
  list.innerHTML = "";
  tables.forEach(t => {
    const locked = t.index >= limits.tablesPerPage;
    const row = document.createElement("div");
    row.className = "t" + (t.index === selected ? " sel" : "") + (locked ? " locked" : "");
    const name = t.caption || `Table ${t.index + 1}`;
    row.innerHTML = `<div class="name">${name.replace(/</g, "&lt;")}</div>`
      + `<div class="meta">${t.rows} rows × ${t.cols} columns${locked ? " · Pro" : ""}</div>`;
    if (!locked) row.addEventListener("click", () => { selected = t.index; renderList(); });
    list.appendChild(row);
  });
}

function setActionsEnabled(on) {
  for (const id of ["download", "copy", "all"]) $(id).disabled = !on;
  if (on) $("all").disabled = !limits.exportAll;
}

function enforceLimits() {
  $("badge").textContent = limits.pro ? "Pro" : "";
  $("proBox").style.display = limits.pro ? "none" : "";
  for (const opt of $("format").options) {
    opt.disabled = !limits.formats.includes(opt.value);
    if (opt.disabled) opt.textContent = opt.value.toUpperCase() + " — Pro";
  }
  if (!limits.formats.includes($("format").value)) $("format").value = "csv";
  $("all").disabled = !limits.exportAll;
  $("all").title = limits.exportAll ? "" : "Pro feature";
}

function save(text, name, mime) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function fileName(caption, index, format) {
  const ext = { csv: "csv", tsv: "tsv", json: "json", markdown: "md" }[format];
  const base = (caption || `table-${index + 1}`)
    .replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 60) || `table-${index + 1}`;
  return `${base}.${ext}`;
}

async function exportOne(copy) {
  if (!tables.length) { status("There is nothing on this page to export."); return; }
  const opts = options();
  const result = await inPage((i, o) => exportTable(i, o), [selected, opts]);
  if (!result) { status("That table could not be read."); return; }
  if (copy) {
    await navigator.clipboard.writeText(result.text);
    status(`Copied ${result.rows} rows.`);
  } else {
    const mime = { csv: "text/csv", tsv: "text/tab-separated-values",
                   json: "application/json", markdown: "text/markdown" }[opts.format];
    save(result.text, fileName(result.caption, selected, opts.format), mime);
    status(`Saved ${result.rows} rows.`);
  }
}

$("download").addEventListener("click", () => exportOne(false).catch(e => status(e.message)));
$("copy").addEventListener("click", () => exportOne(true).catch(e => status(e.message)));

$("all").addEventListener("click", async () => {
  if (!limits.exportAll) return;
  try {
    const opts = options();
    for (const t of tables) {
      const r = await inPage((i, o) => exportTable(i, o), [t.index, opts]);
      if (!r) continue;
      const mime = { csv: "text/csv", tsv: "text/tab-separated-values",
                     json: "application/json", markdown: "text/markdown" }[opts.format];
      save(r.text, fileName(r.caption, t.index, opts.format), mime);
    }
    status(`Saved ${tables.length} tables.`);
  } catch (e) { status(e.message); }
});

$("activate").addEventListener("click", async () => {
  const ok = await activate($("key").value);
  if (ok) {
    limits = await getLimits();
    enforceLimits();
    renderList();
    status("Licence activated. Thank you.");
  } else {
    status("That licence key was not accepted.");
  }
});

$("example").addEventListener("click", () => chrome.tabs.create({ url: EXAMPLE_URL }));

$("buy").addEventListener("click", e => {
  e.preventDefault();
  chrome.tabs.create({ url: BUY_URL });
});

for (const id of ["cleanNumbers", "bom"]) {
  $(id).addEventListener("change", () =>
    chrome.storage.sync.set({ cleanNumbers: $("cleanNumbers").checked, bom: $("bom").checked }));
}
$("format").addEventListener("change", enforceLimits);

function showAppMode(app, url) {
  $("sub").textContent = app.name + " detected.";
  $("appNote").textContent = app.note;
  $("app").style.display = "";
  $("work").style.display = "none";
  $("empty").style.display = "none";
  $("proBox").style.display = "none";
  if (app.exportUrl) {
    const target = app.exportUrl(url);
    const btn = $("appExport");
    btn.style.display = "";
    btn.textContent = app.id === "google-docs" ? "Download the document" : "Download the whole sheet";
    btn.onclick = () => chrome.tabs.create({ url: target });
  }
}

(async function init() {
  const saved = await chrome.storage.sync.get({ cleanNumbers: true, bom: true });
  $("cleanNumbers").checked = saved.cleanNumbers;
  $("bom").checked = saved.bom;

  limits = await getLimits();
  enforceLimits();

  try {
    const tab = await activeTab();
    const app = detectApp(tab.url);
    if (app) { showAppMode(app, tab.url); return; }

    const scan = await inPage(o => scanTables(o), [options()]);
    tables = scan.tables || [];
    const found = tables.length > 0;
    setActionsEnabled(found);
    $("work").style.display = found ? "" : "none";
    $("empty").style.display = found ? "none" : "";
    $("proBox").style.display = (found && !limits.pro) ? "" : "none";

    if (found) {
      $("sub").textContent = `${tables.length} table${tables.length > 1 ? "s" : ""} found`
        + (limits.pro ? "" : " · free tier exports the first one");
      status("");
    } else {
      $("sub").textContent = "No tables on this page.";
    }
    renderList();
  } catch (e) {
    $("sub").textContent = e.message;
    $("work").style.display = "none";
    $("empty").style.display = "none";
    $("proBox").style.display = "none";
  }
})();
