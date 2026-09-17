const OPTION_KEYS = ["selectionOnly", "links", "images", "tables", "frontMatter"];
const DEFAULTS = { selectionOnly: false, links: false, images: false, tables: true, frontMatter: false };

const $ = id => document.getElementById(id);
const status = (text, ok = false) => {
  const el = $("status");
  el.textContent = text;
  el.className = "status" + (ok ? " ok" : "");
};

async function loadOptions() {
  const stored = await chrome.storage.sync.get(DEFAULTS);
  for (const key of OPTION_KEYS) $(key).checked = Boolean(stored[key]);
}

function readOptions() {
  const opts = {};
  for (const key of OPTION_KEYS) opts[key] = $(key).checked;
  return opts;
}

for (const key of OPTION_KEYS) {
  document.addEventListener("DOMContentLoaded", () => {
    $(key).addEventListener("change", () => chrome.storage.sync.set(readOptions()));
  });
}

async function run() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !/^https?:/.test(tab.url || "")) {
    throw new Error("This page cannot be converted.");
  }
  const opts = readOptions();
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["src/extract.js"],
  }).then(() => chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: o => convert(o),
    args: [opts],
  }));
  return result;
}

function showStats(result) {
  $("stats").textContent =
    `${result.tokens.toLocaleString()} tokens · ${result.chars.toLocaleString()} characters`
    + (result.usedSelection ? " · selection" : "");
}

$("copy").addEventListener("click", async () => {
  status("Converting…");
  try {
    const result = await run();
    if (!result || !result.markdown.trim()) {
      status("Nothing to convert on this page.");
      return;
    }
    await navigator.clipboard.writeText(result.markdown);
    status("Copied. Paste it into your AI tool.", true);
    showStats(result);
  } catch (e) {
    status(e.message || "Could not read this page.");
  }
});

$("download").addEventListener("click", async () => {
  status("Converting…");
  try {
    const result = await run();
    if (!result || !result.markdown.trim()) {
      status("Nothing to convert on this page.");
      return;
    }
    const name = (result.title || "page")
      .replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 80) || "page";
    // A plain anchor click avoids the "downloads" permission entirely, which
    // keeps the permission set minimal and the store review fast.
    const url = URL.createObjectURL(new Blob([result.markdown], { type: "text/markdown" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status("Saved.", true);
    showStats(result);
  } catch (e) {
    status(e.message || "Could not read this page.");
  }
});

loadOptions();
